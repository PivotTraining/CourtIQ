-- Supersedes the unapplied August managed-player migration. Apply this instead.
-- Atomic, additive, and fail-closed. Does not delete or reassign existing players.
begin;

alter table public.players add column if not exists manager_uid text;
update public.players p
set manager_uid = split_part(p.firebase_uid, '_', 1)
where p.manager_uid is null
  and exists (select 1 from auth.users u where u.id::text = split_part(p.firebase_uid, '_', 1));

do $$
begin
  if exists (
    select 1 from public.players p
    where p.manager_uid is null
      or not exists (select 1 from auth.users u where u.id::text = p.manager_uid)
  ) then
    raise exception 'Players with unverified owners exist. Review ownership before applying; no data was removed.';
  end if;
  -- Deleting a player must be a single transaction, not client-side cleanup.
  if (select count(*) from pg_constraint c
      where c.contype = 'f' and c.confdeltype = 'c'
        and (c.conrelid, c.confrelid) in (
          ('public.sessions'::regclass, 'public.players'::regclass),
          ('public.shot_logs'::regclass, 'public.players'::regclass),
          ('public.shot_logs'::regclass, 'public.sessions'::regclass),
          ('public.journal_entries'::regclass, 'public.players'::regclass),
          ('public.teams'::regclass, 'public.players'::regclass),
          ('public.team_members'::regclass, 'public.players'::regclass),
          ('public.team_members'::regclass, 'public.teams'::regclass)
        )) <> 7 then
    raise exception 'Expected cascading relationships are missing. Review the live schema before applying.';
  end if;
end $$;

alter table public.players alter column manager_uid set not null;
-- Tie all managed profiles to the real Auth account. Deleting Auth now cleans
-- players and their cascading records atomically; stale JWTs cannot recreate them.
alter table public.players add column if not exists owner_id uuid
  generated always as (manager_uid::uuid) stored;
alter table public.players add constraint players_owner_auth_fk
  foreign key (owner_id) references auth.users(id) on delete cascade;
create index if not exists idx_players_manager_uid on public.players(manager_uid);
create index if not exists idx_players_owner_id on public.players(owner_id);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.owns_player(target_player_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.players p
    where p.id = target_player_id and p.manager_uid = (select auth.uid())::text);
$$;

-- Avoid the existing team/member RLS recursion without exposing private records.
create or replace function private.can_access_team(target_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.teams t join public.players p on p.id = t.created_by
      where t.id = target_team_id and p.manager_uid = (select auth.uid())::text)
    or exists (select 1 from public.team_members tm join public.players p on p.id = tm.player_id
      where tm.team_id = target_team_id and p.manager_uid = (select auth.uid())::text)
  );
$$;
revoke all on function private.owns_player(uuid) from public, anon;
revoke all on function private.can_access_team(uuid) from public, anon;
grant execute on function private.owns_player(uuid), private.can_access_team(uuid) to authenticated;

-- Harden legacy helpers still referenced by older tables; no RLS bypass.
create or replace function public.requesting_firebase_uid()
returns text language sql stable security invoker set search_path = '' as $$ select auth.uid()::text $$;
create or replace function public.requesting_player_id()
returns uuid language sql stable security invoker set search_path = '' as $$
  select p.id from public.players p where p.firebase_uid = (select auth.uid())::text;
$$;
revoke all on function public.requesting_firebase_uid(), public.requesting_player_id() from public, anon;
grant execute on function public.requesting_firebase_uid(), public.requesting_player_id() to authenticated;

create or replace function private.keep_player_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.manager_uid is distinct from old.manager_uid
    or new.firebase_uid is distinct from old.firebase_uid then
    raise exception 'Player ownership and account identity cannot be changed.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.keep_player_identity() from public, anon, authenticated;
create trigger players_keep_identity before update on public.players
  for each row execute function private.keep_player_identity();

-- Fail closed on unexpected policies; permissive policies otherwise OR together.
do $$
declare entry record;
begin
  for entry in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('players','sessions','shot_logs','journal_entries','teams','team_members')
  loop
    if entry.policyname not in ('players_select','players_insert','players_update','players_delete',
      'sessions_select','sessions_insert','sessions_update','sessions_delete',
      'shots_select','shots_insert','shots_delete','journal_select','journal_insert',
      'teams_select','teams_insert','members_select','members_insert') then
      raise exception 'Unexpected policy % on %. Review before applying.', entry.policyname, entry.tablename;
    end if;
    execute format('drop policy %I on %I.%I', entry.policyname, entry.schemaname, entry.tablename);
  end loop;
end $$;

alter table public.players enable row level security;
alter table public.sessions enable row level security;
alter table public.shot_logs enable row level security;
alter table public.journal_entries enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
revoke all on public.players, public.sessions, public.shot_logs, public.journal_entries, public.teams, public.team_members from anon, authenticated;
grant select, insert, update, delete on public.players, public.sessions to authenticated;
grant select, insert, delete on public.shot_logs to authenticated;
grant select, insert on public.journal_entries, public.teams, public.team_members to authenticated;

create policy players_select on public.players for select to authenticated
  using (manager_uid = (select auth.uid())::text);
create policy players_insert on public.players for insert to authenticated
  with check (manager_uid = (select auth.uid())::text and (
    firebase_uid = (select auth.uid())::text or starts_with(firebase_uid, (select auth.uid())::text || '_')));
create policy players_update on public.players for update to authenticated
  using (manager_uid = (select auth.uid())::text) with check (manager_uid = (select auth.uid())::text);
-- Primary account/profile is removed only through authenticated account deletion.
create policy players_delete on public.players for delete to authenticated
  using (manager_uid = (select auth.uid())::text and firebase_uid <> (select auth.uid())::text);

create policy sessions_select on public.sessions for select to authenticated using (private.owns_player(player_id));
create policy sessions_insert on public.sessions for insert to authenticated with check (private.owns_player(player_id));
create policy sessions_update on public.sessions for update to authenticated
  using (private.owns_player(player_id)) with check (private.owns_player(player_id));
create policy sessions_delete on public.sessions for delete to authenticated using (private.owns_player(player_id));
create policy shots_select on public.shot_logs for select to authenticated using (private.owns_player(player_id));
create policy shots_insert on public.shot_logs for insert to authenticated with check (
  private.owns_player(player_id) and exists (select 1 from public.sessions s
    where s.id = public.shot_logs.session_id and s.player_id = public.shot_logs.player_id));
create policy shots_delete on public.shot_logs for delete to authenticated using (private.owns_player(player_id));
create policy journal_select on public.journal_entries for select to authenticated using (private.owns_player(player_id));
create policy journal_insert on public.journal_entries for insert to authenticated with check (private.owns_player(player_id));
create policy teams_select on public.teams for select to authenticated
  using (private.owns_player(created_by) or private.can_access_team(id));
create policy teams_insert on public.teams for insert to authenticated with check (private.owns_player(created_by));
create policy members_select on public.team_members for select to authenticated using (private.can_access_team(team_id));
create policy members_insert on public.team_members for insert to authenticated with check (
  private.owns_player(player_id) and exists (select 1 from public.teams t
    where t.id = public.team_members.team_id and private.owns_player(t.created_by)));
commit;
