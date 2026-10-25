-- CourtIQ family collaboration, reviewable draft. Do not apply without two-family
-- security tests and a backup. No historical game moves occur automatically.
begin;

create table public.player_collaborators (
  player_id uuid not null references public.players(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor','viewer')),
  created_at timestamptz not null default now(),
  primary key(player_id,account_id)
);
create index player_collaborators_account_idx on public.player_collaborators(account_id,player_id);
alter table public.player_collaborators enable row level security;
revoke all on public.player_collaborators from public,anon,authenticated;
grant select on public.player_collaborators to authenticated;

create or replace function private.is_player_owner(p_player uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.players p
    where p.id=p_player and p.manager_uid=(select auth.uid())::text
  );
$$;
create or replace function private.can_read_player(p_player uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and (
    private.is_player_owner(p_player) or exists(
      select 1 from public.player_collaborators m
      where m.player_id=p_player and m.account_id=(select auth.uid())
    )
  );
$$;
create or replace function private.can_edit_player(p_player uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and (
    private.is_player_owner(p_player) or exists(
      select 1 from public.player_collaborators m
      where m.player_id=p_player and m.account_id=(select auth.uid())
        and m.role='editor'
    )
  );
$$;
revoke all on function private.is_player_owner(uuid),
  private.can_read_player(uuid),private.can_edit_player(uuid) from public,anon,authenticated;

create policy collaborators_visible on public.player_collaborators
for select to authenticated
using (account_id=(select auth.uid()) or private.is_player_owner(player_id));

-- Keep the existing owner-only policies. Add access only for explicitly linked
-- authenticated accounts; never broaden UPDATE/DELETE of a player identity.
create policy shared_players_visible on public.players for select to authenticated
using (private.can_read_player(id));
create policy shared_sessions_read on public.sessions for select to authenticated
using (private.can_read_player(player_id));
create policy shared_sessions_insert on public.sessions for insert to authenticated
with check (private.can_edit_player(player_id));
create policy shared_sessions_update on public.sessions for update to authenticated
using (private.can_edit_player(player_id)) with check (private.can_edit_player(player_id));
create policy shared_shots_read on public.shot_logs for select to authenticated
using (private.can_read_player(player_id));
create policy shared_shots_insert on public.shot_logs for insert to authenticated
with check (private.can_edit_player(player_id) and exists (
  select 1 from public.sessions s where s.id=session_id and s.player_id=shot_logs.player_id
));
create policy shared_shots_delete on public.shot_logs for delete to authenticated
using (private.can_edit_player(player_id));
create policy shared_commands_read on public.session_commands for select to authenticated
using (exists(select 1 from public.sessions s
  where s.id=session_id and private.can_read_player(s.player_id)));
create policy shared_workouts_read on public.workout_results for select to authenticated
using (private.can_read_player(player_id));
create policy shared_workouts_insert on public.workout_results for insert to authenticated
with check (private.can_edit_player(player_id));
-- Journal entries remain private to the owner; family stat sharing does not
-- silently share personal journal reflections.

create table public.player_share_invites (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  token_sha256 text unique not null check(length(token_sha256)=64),
  role text not null check(role in ('editor','viewer')),
  recipient_email text not null check(length(recipient_email) between 3 and 254),
  issued_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  check (redeemed_at is null or redeemed_at>=created_at)
);
create index player_share_invites_active_idx on public.player_share_invites(player_id,expires_at)
where redeemed_at is null;
alter table public.player_share_invites enable row level security;
revoke all on public.player_share_invites from public,anon,authenticated;

create or replace function public.create_player_share_invite(
  p_player uuid,p_recipient_email text,p_role text default 'editor'
) returns text language plpgsql security definer set search_path='' as $$
declare code text;
begin
 if not private.is_player_owner(p_player) then
   raise exception 'Only the owning parent can invite collaborators' using errcode='42501';
 end if;
 if p_role not in ('editor','viewer') then raise exception 'Invalid access level'; end if;
 if p_recipient_email is null or length(trim(p_recipient_email))>254
   or trim(p_recipient_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+
 if (select count(*) from public.player_share_invites i
     where i.player_id=p_player and i.redeemed_at is null
       and i.expires_at>now())>=5 then
   raise exception 'Too many active invitations. Try again after they expire.';
 end if;
 code:=replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 insert into public.player_share_invites(player_id,token_sha256,role,recipient_email,issued_by,expires_at)
 values(p_player,encode(sha256(convert_to(code,'UTF8')),'hex'),p_role,
   lower(trim(p_recipient_email)),auth.uid(),now()+interval '24 hours');
 return code;
end $$;
revoke all on function public.create_player_share_invite(uuid,text,text) from public,anon;
grant execute on function public.create_player_share_invite(uuid,text,text) to authenticated;

create or replace function public.join_shared_player(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invite public.player_share_invites%rowtype; me uuid := auth.uid();
begin
 if me is null then raise exception 'Sign in to link a player' using errcode='42501'; end if;
 if p_code is null or p_code !~ '^[a-f0-9]{64}$' then
   raise exception 'Invalid sharing invitation' using errcode='22023';
 end if;
 select * into invite from public.player_share_invites i
 where i.token_sha256=encode(sha256(convert_to(p_code,'UTF8')),'hex')
 for update;
 if not found or invite.expires_at<=now() or invite.redeemed_at is not null
 then raise exception 'Invitation expired or already used' using errcode='22023'; end if;
 if (select lower(email) from auth.users where id=me) is distinct from invite.recipient_email then
   raise exception 'Invitation belongs to a different signed-in email' using errcode='42501';
 end if;
 if private.is_player_owner(invite.player_id) then
   raise exception 'This player is already yours' using errcode='22023';
 end if;
 insert into public.player_collaborators(player_id,account_id,role)
 values(invite.player_id,me,invite.role)
 on conflict (player_id,account_id) do nothing;
 update public.player_share_invites set used_by=me,redeemed_at=now() where id=invite.id;
 return invite.player_id;
end $$;
revoke all on function public.join_shared_player(text) from public,anon;
grant execute on function public.join_shared_player(text) to authenticated;

create or replace function public.revoke_shared_player(p_player uuid,p_account uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare deleted_count integer;
begin
 if auth.uid() is null or not (
    private.is_player_owner(p_player) or p_account=auth.uid()
 ) then raise exception 'Not authorized to remove this access' using errcode='42501'; end if;
 delete from public.player_collaborators
 where player_id=p_player and account_id=p_account;
 get diagnostics deleted_count=row_count;
 return deleted_count>0;
end $$;
revoke all on function public.revoke_shared_player(uuid,uuid) from public,anon;
grant execute on function public.revoke_shared_player(uuid,uuid) to authenticated;

-- Transfer only separately logged, completed game sessions, and only after
-- the secondary parent chooses each specific game. Same-date probable duplicates
-- are rejected, never added together. Source data remains unchanged on errors.
create table public.shared_game_transfers(
 session_id uuid primary key references public.sessions(id) on delete cascade,
 source_player uuid not null,
 destination_player uuid not null references public.players(id) on delete cascade,
 transferred_by uuid references auth.users(id) on delete set null,
 transferred_at timestamptz not null default now()
);
alter table public.shared_game_transfers enable row level security;
revoke all on public.shared_game_transfers from public,anon,authenticated;
grant select on public.shared_game_transfers to authenticated;
create policy shared_game_transfers_read on public.shared_game_transfers
 for select to authenticated using (private.can_read_player(destination_player));

create or replace function public.import_shared_game(
 p_source_player uuid,p_destination_player uuid,p_session uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sessions%rowtype; opposing text; competitor text;
begin
 if p_source_player=p_destination_player or p_session is null then
   raise exception 'Choose a separate saved game' using errcode='22023'; end if;
 if not private.is_player_owner(p_source_player)
   or not private.can_edit_player(p_destination_player)
   or private.is_player_owner(p_destination_player) then
   raise exception 'Link the other parent''s player as editor before importing games'
   using errcode='42501';
 end if;
 select * into s from public.sessions where id=p_session and player_id=p_source_player for update;
 perform 1 from public.players where id=p_destination_player for update;
 if not found then raise exception 'Shared destination was removed' using errcode='22023'; end if;
 if s.type<>'game' or s.mode is distinct from 'individual'
   or s.tracker_status='active' then
   raise exception 'Only completed, individual games can be imported' using errcode='22023';
 end if;
 opposing:=lower(trim(coalesce(s.tracker_context->>'opponent','')));
 if exists(
   select 1 from public.sessions t
   where t.player_id=p_destination_player and t.type='game' and t.date=s.date
     and (opposing='' or lower(trim(coalesce(t.tracker_context->>'opponent','')))=''
       or lower(trim(coalesce(t.tracker_context->>'opponent','')))=opposing)
 ) then raise exception 'POSSIBLE_DUPLICATE_GAME: compare both game records before importing'
 using errcode='23505'; end if;
 perform set_config('courtiq.command_write','on',true);
 update public.sessions set player_id=p_destination_player where id=p_session;
 perform set_config('courtiq.command_write','off',true);
 update public.shot_logs set player_id=p_destination_player
 where session_id=p_session and player_id=p_source_player;
 insert into public.shared_game_transfers(session_id,source_player,destination_player,transferred_by)
 values(p_session,p_source_player,p_destination_player,auth.uid());
 return p_session;
end $$;
revoke all on function public.import_shared_game(uuid,uuid,uuid) from public,anon;
grant execute on function public.import_shared_game(uuid,uuid,uuid) to authenticated;

-- The versioned tracker previously allowed only the player owner to append.
-- Modify exactly one guard; retain all version/conflict/idempotency checks.
do $repair$
declare definition text; replaced text; matches int;
begin
 select pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure)
 into definition;
 select count(*) into matches from regexp_matches(definition,
   'manager_uid[[:space:]]*=[[:space:]]*\(select auth\.uid\(\)\)::text','g');
 if matches<>1 or position('SESSION_CONFLICT' in definition)=0 then
  raise exception 'Unexpected tracker function; collaboration patch withheld';
 end if;
 replaced:=regexp_replace(definition,
   'manager_uid[[:space:]]*=[[:space:]]*\(select auth\.uid\(\)\)::text',
   'private.can_edit_player(s.player_id)');
 if replaced=definition then raise exception 'Tracker ownership guard did not match'; end if;
 execute replaced;
end $repair$;

commit; then
   raise exception 'Valid recipient email required' using errcode='22023';
 end if;
 if (select count(*) from public.player_share_invites i
     where i.player_id=p_player and i.redeemed_at is null
       and i.expires_at>now())>=5 then
   raise exception 'Too many active invitations. Try again after they expire.';
 end if;
 code:=replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 insert into public.player_share_invites(player_id,token_sha256,role,recipient_email,issued_by,expires_at)
 values(p_player,encode(sha256(convert_to(code,'UTF8')),'hex'),p_role,
   lower(trim(p_recipient_email)),auth.uid(),now()+interval '24 hours');
 return code;
end $$;
revoke all on function public.create_player_share_invite(uuid,text,text) from public,anon;
grant execute on function public.create_player_share_invite(uuid,text,text) to authenticated;

create or replace function public.join_shared_player(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invite public.player_share_invites%rowtype; me uuid := auth.uid();
begin
 if me is null then raise exception 'Sign in to link a player' using errcode='42501'; end if;
 if p_code is null or p_code !~ '^[a-f0-9]{64}$' then
   raise exception 'Invalid sharing invitation' using errcode='22023';
 end if;
 select * into invite from public.player_share_invites i
 where i.token_sha256=encode(sha256(convert_to(p_code,'UTF8')),'hex')
 for update;
 if not found or invite.expires_at<=now() or invite.redeemed_at is not null
 then raise exception 'Invitation expired or already used' using errcode='22023'; end if;
 if (select lower(email) from auth.users where id=me) is distinct from invite.recipient_email then
   raise exception 'Invitation belongs to a different signed-in email' using errcode='42501';
 end if;
 if private.is_player_owner(invite.player_id) then
   raise exception 'This player is already yours' using errcode='22023';
 end if;
 insert into public.player_collaborators(player_id,account_id,role)
 values(invite.player_id,me,invite.role)
 on conflict (player_id,account_id) do nothing;
 update public.player_share_invites set used_by=me,redeemed_at=now() where id=invite.id;
 return invite.player_id;
end $$;
revoke all on function public.join_shared_player(text) from public,anon;
grant execute on function public.join_shared_player(text) to authenticated;

create or replace function public.revoke_shared_player(p_player uuid,p_account uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare deleted_count integer;
begin
 if auth.uid() is null or not (
    private.is_player_owner(p_player) or p_account=auth.uid()
 ) then raise exception 'Not authorized to remove this access' using errcode='42501'; end if;
 delete from public.player_collaborators
 where player_id=p_player and account_id=p_account;
 get diagnostics deleted_count=row_count;
 return deleted_count>0;
end $$;
revoke all on function public.revoke_shared_player(uuid,uuid) from public,anon;
grant execute on function public.revoke_shared_player(uuid,uuid) to authenticated;

-- Transfer only separately logged, completed game sessions, and only after
-- the secondary parent chooses each specific game. Same-date probable duplicates
-- are rejected, never added together. Source data remains unchanged on errors.
create table public.shared_game_transfers(
 session_id uuid primary key references public.sessions(id) on delete cascade,
 source_player uuid not null,
 destination_player uuid not null references public.players(id) on delete cascade,
 transferred_by uuid references auth.users(id) on delete set null,
 transferred_at timestamptz not null default now()
);
alter table public.shared_game_transfers enable row level security;
revoke all on public.shared_game_transfers from public,anon,authenticated;
grant select on public.shared_game_transfers to authenticated;
create policy shared_game_transfers_read on public.shared_game_transfers
 for select to authenticated using (private.can_read_player(destination_player));

create or replace function public.import_shared_game(
 p_source_player uuid,p_destination_player uuid,p_session uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sessions%rowtype; opposing text; competitor text;
begin
 if p_source_player=p_destination_player or p_session is null then
   raise exception 'Choose a separate saved game' using errcode='22023'; end if;
 if not private.is_player_owner(p_source_player)
   or not private.can_edit_player(p_destination_player)
   or private.is_player_owner(p_destination_player) then
   raise exception 'Link the other parent''s player as editor before importing games'
   using errcode='42501';
 end if;
 select * into s from public.sessions where id=p_session and player_id=p_source_player for update;
 perform 1 from public.players where id=p_destination_player for update;
 if not found then raise exception 'Shared destination was removed' using errcode='22023'; end if;
 if s.type<>'game' or s.mode is distinct from 'individual'
   or s.tracker_status='active' then
   raise exception 'Only completed, individual games can be imported' using errcode='22023';
 end if;
 opposing:=lower(trim(coalesce(s.tracker_context->>'opponent','')));
 if exists(
   select 1 from public.sessions t
   where t.player_id=p_destination_player and t.type='game' and t.date=s.date
     and (opposing='' or lower(trim(coalesce(t.tracker_context->>'opponent','')))=''
       or lower(trim(coalesce(t.tracker_context->>'opponent','')))=opposing)
 ) then raise exception 'POSSIBLE_DUPLICATE_GAME: compare both game records before importing'
 using errcode='23505'; end if;
 perform set_config('courtiq.command_write','on',true);
 update public.sessions set player_id=p_destination_player where id=p_session;
 perform set_config('courtiq.command_write','off',true);
 update public.shot_logs set player_id=p_destination_player
 where session_id=p_session and player_id=p_source_player;
 insert into public.shared_game_transfers(session_id,source_player,destination_player,transferred_by)
 values(p_session,p_source_player,p_destination_player,auth.uid());
 return p_session;
end $$;
revoke all on function public.import_shared_game(uuid,uuid,uuid) from public,anon;
grant execute on function public.import_shared_game(uuid,uuid,uuid) to authenticated;

-- The versioned tracker previously allowed only the player owner to append.
-- Modify exactly one guard; retain all version/conflict/idempotency checks.
do $repair$
declare definition text; replaced text; matches int;
begin
 select pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure)
 into definition;
 select count(*) into matches from regexp_matches(definition,
   'manager_uid[[:space:]]*=[[:space:]]*\(select auth\.uid\(\)\)::text','g');
 if matches<>1 or position('SESSION_CONFLICT' in definition)=0 then
  raise exception 'Unexpected tracker function; collaboration patch withheld';
 end if;
 replaced:=regexp_replace(definition,
   'not exists \([[:space:]]*select 1[[:space:]]*from public\.players[[:space:]]*where id = s\.player_id[[:space:]]*and manager_uid = \(select auth\.uid\(\)\)::text[[:space:]]*\)',
   'not private.can_edit_player(s.player_id)');
 if replaced=definition then raise exception 'Tracker ownership guard did not match'; end if;
 execute replaced;
end $repair$;

commit;