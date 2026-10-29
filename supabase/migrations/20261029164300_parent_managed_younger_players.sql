-- Parent-created, parent-operated player records for younger athletes.
-- The attestation records a parent statement, not independent identity verification.
-- Children receive no authentication account, email address or login.
begin;

create table public.parent_managed_player_attestations (
  player_id uuid primary key references public.players(id) on delete cascade,
  parent_uid uuid not null references auth.users(id) on delete cascade,
  notice_version text not null check (notice_version = 'parent-managed-v1-2026-10'),
  acknowledged_at timestamptz not null default now()
);

alter table public.parent_managed_player_attestations enable row level security;
revoke all on public.parent_managed_player_attestations from public, anon, authenticated;
grant select on public.parent_managed_player_attestations to authenticated;

create policy parent_managed_attestation_owner_read
 on public.parent_managed_player_attestations for select to authenticated
 using (parent_uid = (select auth.uid())
   and exists (select 1 from public.players p where p.id = player_id
     and p.manager_uid = (select auth.uid())::text));

create or replace function private.courtiq_guard_minor_profile()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.age is not null and (new.age < 0 or new.age > 120) then
    raise exception 'Player age must be between 0 and 120' using errcode = '22023';
  end if;
  if new.age is not null and new.age < 13 then
    if tg_op = 'INSERT' then
      if current_setting('courtiq.parent_managed_creation', true) is distinct from 'approved'
        then raise exception 'Under-13 players require parent-managed creation' using errcode = '42501';
      end if;
    elsif not exists (
      select 1 from public.parent_managed_player_attestations a
      where a.player_id = new.id and a.parent_uid::text = new.manager_uid
    ) then
      raise exception 'This younger-player record requires a verified parent-managed pathway'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger courtiq_guard_minor_profile
before insert or update of age on public.players
for each row execute function private.courtiq_guard_minor_profile();

create or replace function public.courtiq_create_parent_managed_player(
 p_name text,
 p_age integer,
 p_position text,
 p_jersey_number integer,
 p_team_name text,
 p_guardian_statement boolean
) returns public.players
language plpgsql security definer set search_path = '' as $$
declare
  parent_id uuid := (select auth.uid());
  created_player public.players%rowtype;
begin
  if parent_id is null then raise exception 'Sign in as the parent first' using errcode='42501'; end if;
  if not exists (
    select 1 from auth.users u
    where u.id=parent_id and u.email_confirmed_at is not null
  ) then raise exception 'Parent account email must be confirmed' using errcode='42501'; end if;
  if p_guardian_statement is distinct from true then
    raise exception 'A parent or guardian acknowledgement is required' using errcode='42501';
  end if;
  if p_age is null or p_age < 0 or p_age >= 13 then
    raise exception 'This pathway is only for players younger than 13' using errcode='22023';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 80 then
    raise exception 'Enter a player name of up to 80 characters' using errcode='22023';
  end if;
  if p_position is null or p_position not in ('PG','SG','SF','PF','C') then
    raise exception 'Choose a basketball position' using errcode='22023';
  end if;
  if p_jersey_number is not null and (p_jersey_number<0 or p_jersey_number>99) then
    raise exception 'Jersey number must be between 0 and 99' using errcode='22023';
  end if;
  if p_team_name is not null and length(p_team_name)>100 then
    raise exception 'Team name is too long' using errcode='22023';
  end if;

  perform set_config('courtiq.parent_managed_creation','approved',true);
  insert into public.players(firebase_uid,manager_uid,name,team_name,position,jersey_number,age)
  values(
    parent_id::text || '_' || gen_random_uuid()::text,
    parent_id::text,
    trim(p_name),
    nullif(trim(p_team_name),''),
    p_position,
    p_jersey_number,
    p_age
  ) returning * into created_player;
  perform set_config('courtiq.parent_managed_creation','',true);

  insert into public.parent_managed_player_attestations(player_id,parent_uid,notice_version)
   values(created_player.id,parent_id,'parent-managed-v1-2026-10');

  return created_player;
end $$;
revoke all on function public.courtiq_create_parent_managed_player(text,integer,text,integer,text,boolean)
 from public, anon;
grant execute on function public.courtiq_create_parent_managed_player(text,integer,text,integer,text,boolean)
 to authenticated;

commit;