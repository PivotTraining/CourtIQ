-- Scoped family collaboration for player game stats. Neither invites nor access
-- lists are directly accessible through PostgREST; use authenticated RPCs only.
create table if not exists private.courtiq_player_shares (
  player_id uuid not null references public.players(id) on delete cascade,
  member_uid uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id,member_uid)
);
create index if not exists courtiq_player_shares_member_idx on private.courtiq_player_shares(member_uid,player_id);
create table if not exists private.courtiq_player_invites (
  token_hash text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  issued_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now()+interval '48 hours'),
  consumed_by uuid references auth.users(id),
  consumed_at timestamptz
);
create index if not exists courtiq_player_invites_owner_idx on private.courtiq_player_invites(player_id);
alter table private.courtiq_player_shares enable row level security;
alter table private.courtiq_player_invites enable row level security;
revoke all on private.courtiq_player_shares,private.courtiq_player_invites from anon,authenticated,public;

create or replace function private.courtiq_has_player_share(p_player uuid)
returns boolean language sql stable security definer set search_path=''
as $body$
  select (select auth.uid()) is not null and exists (
    select 1 from private.courtiq_player_shares a
    where a.player_id=p_player and a.member_uid=(select auth.uid())
  );
$body$;
revoke all on function private.courtiq_has_player_share(uuid) from public,anon;
grant execute on function private.courtiq_has_player_share(uuid) to authenticated;

create or replace function private.courtiq_issue_player_invite(p_player uuid)
returns text language plpgsql volatile security definer set search_path=''
as $body$
declare raw text;
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.players p where p.id=p_player
   and p.manager_uid=(select auth.uid())::text
 ) then raise exception 'Player unavailable' using errcode='42501'; end if;
 raw := 'CI-'||encode(extensions.gen_random_bytes(24),'hex');
 insert into private.courtiq_player_invites(token_hash,player_id,issued_by)
 values (encode(extensions.digest(raw,'sha256'),'hex'),p_player,(select auth.uid()));
 return raw;
end;
$body$;

create or replace function private.courtiq_accept_player_invite(p_code text)
returns uuid language plpgsql volatile security definer set search_path=''
as $body$
declare invite private.courtiq_player_invites%rowtype;
begin
 if (select auth.uid()) is null or p_code is null or p_code !~ '^CI-[a-f0-9]{48}$'
 then raise exception 'Invalid or expired invitation' using errcode='42501'; end if;
 select * into invite from private.courtiq_player_invites
 where token_hash=encode(extensions.digest(p_code,'sha256'),'hex')
   and expires_at>now() and consumed_at is null
 for update;
 if not found then raise exception 'Invalid or expired invitation' using errcode='42501'; end if;
 if invite.issued_by=(select auth.uid()) then
   raise exception 'Share this code with a different signed-in parent' using errcode='42501';
 end if;
 insert into private.courtiq_player_shares(player_id,member_uid)
 values(invite.player_id,(select auth.uid())) on conflict do nothing;
 update private.courtiq_player_invites set consumed_by=(select auth.uid()),consumed_at=now()
 where token_hash=invite.token_hash;
 return invite.player_id;
end;
$body$;

create or replace function private.courtiq_list_player_shares(p_player uuid)
returns table(member_uid uuid,joined_at timestamptz)
language plpgsql stable security definer set search_path=''
as $body$
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.players p where p.id=p_player and p.manager_uid=(select auth.uid())::text
 ) then raise exception 'Player unavailable' using errcode='42501'; end if;
 return query select a.member_uid,a.created_at from private.courtiq_player_shares a
 where a.player_id=p_player order by a.created_at;
end;
$body$;

create or replace function private.courtiq_revoke_player_share(p_player uuid,p_member uuid)
returns boolean language plpgsql volatile security definer set search_path=''
as $body$
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.players p where p.id=p_player
   and p.manager_uid=(select auth.uid())::text
 ) then raise exception 'Player unavailable' using errcode='42501'; end if;
 delete from private.courtiq_player_shares where player_id=p_player and member_uid=p_member;
 return found;
end;
$body$;

-- Invoker RPCs expose only narrowly checked private functions, never raw tables.
create or replace function public.courtiq_issue_player_invite(p_player uuid)
returns text language sql security invoker set search_path=''
as $body$ select private.courtiq_issue_player_invite(p_player); $body$;
create or replace function public.courtiq_accept_player_invite(p_code text)
returns uuid language sql security invoker set search_path=''
as $body$ select private.courtiq_accept_player_invite(p_code); $body$;
create or replace function public.courtiq_list_player_shares(p_player uuid)
returns table(member_uid uuid,joined_at timestamptz)
language sql security invoker set search_path=''
as $body$ select * from private.courtiq_list_player_shares(p_player); $body$;
create or replace function public.courtiq_revoke_player_share(p_player uuid,p_member uuid)
returns boolean language sql security invoker set search_path=''
as $body$ select private.courtiq_revoke_player_share(p_player,p_member); $body$;

revoke all on function private.courtiq_issue_player_invite(uuid),private.courtiq_accept_player_invite(text),
private.courtiq_list_player_shares(uuid),private.courtiq_revoke_player_share(uuid,uuid)
from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.courtiq_issue_player_invite(uuid),private.courtiq_accept_player_invite(text),
private.courtiq_list_player_shares(uuid),private.courtiq_revoke_player_share(uuid,uuid)
to authenticated;
revoke all on function public.courtiq_issue_player_invite(uuid),public.courtiq_accept_player_invite(text),
public.courtiq_list_player_shares(uuid),public.courtiq_revoke_player_share(uuid,uuid)
from public,anon;
grant execute on function public.courtiq_issue_player_invite(uuid),public.courtiq_accept_player_invite(text),
public.courtiq_list_player_shares(uuid),public.courtiq_revoke_player_share(uuid,uuid)
to authenticated;

-- Read only for invited adults. Existing ownership policies remain unchanged.
create policy courtiq_shared_player_read on public.players for select to authenticated
 using (private.courtiq_has_player_share(id));
create policy courtiq_shared_game_read on public.sessions for select to authenticated
 using (private.courtiq_has_player_share(player_id));
create policy courtiq_shared_game_start on public.sessions for insert to authenticated
 with check (private.courtiq_has_player_share(player_id) and type='game' and mode='individual');
create policy courtiq_shared_shots_read on public.shot_logs for select to authenticated
 using (private.courtiq_has_player_share(player_id));
create policy courtiq_shared_commands_read on public.session_commands for select to authenticated
 using (exists (select 1 from public.sessions s where s.id=session_id
    and private.courtiq_has_player_share(s.player_id)));
create policy courtiq_shared_workouts_read on public.workout_results for select to authenticated
 using (private.courtiq_has_player_share(player_id));

-- The established authoritative game RPC explicitly checked only the original
-- manager UID. Extend ONLY that predicate, without widening update/delete RLS.
do $body$
declare fn text; oldcheck text := 'and manager_uid = (select auth.uid())::text';
begin
 select pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure) into fn;
 if fn not like '%'||oldcheck||'%' or fn like '%private.courtiq_has_player_share(s.player_id)%'
 then raise exception 'Unexpected game RPC body; stop before changing authorization'; end if;
 fn:=replace(fn,oldcheck,
   'and (manager_uid = (select auth.uid())::text or private.courtiq_has_player_share(s.player_id))');
 execute fn;
end;
$body$;
