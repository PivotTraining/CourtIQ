-- Make family-managed player ownership explicit and apply it consistently.
-- Run this before enabling family/player switching in production.

alter table public.players add column if not exists manager_uid text;

update public.players
set manager_uid = firebase_uid
where manager_uid is null;

alter table public.players alter column manager_uid set not null;
create index if not exists idx_players_manager_uid on public.players(manager_uid);

create or replace function public.owns_player(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.players p
    where p.id = target_player_id
      and p.manager_uid = auth.uid()::text
  );
$$;

create or replace function public.can_access_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.teams t
    where t.id = target_team_id and public.owns_player(t.created_by)
  ) or exists (
    select 1 from public.team_members tm
    where tm.team_id = target_team_id and public.owns_player(tm.player_id)
  );
$$;

revoke all on function public.owns_player(uuid) from public;
revoke all on function public.can_access_team(uuid) from public;
grant execute on function public.owns_player(uuid) to authenticated;
grant execute on function public.can_access_team(uuid) to authenticated;

drop policy if exists "players_select" on public.players;
drop policy if exists "players_insert" on public.players;
drop policy if exists "players_update" on public.players;
drop policy if exists "players_delete" on public.players;

create policy "players_select" on public.players
for select to authenticated
using (manager_uid = auth.uid()::text);

create policy "players_insert" on public.players
for insert to authenticated
with check (manager_uid = auth.uid()::text);

create policy "players_update" on public.players
for update to authenticated
using (manager_uid = auth.uid()::text)
with check (manager_uid = auth.uid()::text);

create policy "players_delete" on public.players
for delete to authenticated
using (manager_uid = auth.uid()::text);

drop policy if exists "sessions_select" on public.sessions;
drop policy if exists "sessions_insert" on public.sessions;
drop policy if exists "sessions_update" on public.sessions;
drop policy if exists "sessions_delete" on public.sessions;

create policy "sessions_select" on public.sessions
for select to authenticated using (public.owns_player(player_id));
create policy "sessions_insert" on public.sessions
for insert to authenticated with check (public.owns_player(player_id));
create policy "sessions_update" on public.sessions
for update to authenticated using (public.owns_player(player_id))
with check (public.owns_player(player_id));
create policy "sessions_delete" on public.sessions
for delete to authenticated using (public.owns_player(player_id));

drop policy if exists "shots_select" on public.shot_logs;
drop policy if exists "shots_insert" on public.shot_logs;
drop policy if exists "shots_delete" on public.shot_logs;

create policy "shots_select" on public.shot_logs
for select to authenticated using (public.owns_player(player_id));
create policy "shots_insert" on public.shot_logs
for insert to authenticated with check (
  public.owns_player(player_id)
  and exists (
    select 1 from public.sessions s
    where s.id = session_id and s.player_id = player_id
  )
);
create policy "shots_delete" on public.shot_logs
for delete to authenticated using (public.owns_player(player_id));

drop policy if exists "journal_select" on public.journal_entries;
drop policy if exists "journal_insert" on public.journal_entries;

create policy "journal_select" on public.journal_entries
for select to authenticated using (public.owns_player(player_id));
create policy "journal_insert" on public.journal_entries
for insert to authenticated with check (public.owns_player(player_id));

drop policy if exists "teams_select" on public.teams;
drop policy if exists "teams_insert" on public.teams;
drop policy if exists "members_select" on public.team_members;
drop policy if exists "members_insert" on public.team_members;

create policy "teams_select" on public.teams
for select to authenticated using (public.can_access_team(id));
create policy "teams_insert" on public.teams
for insert to authenticated with check (public.owns_player(created_by));
create policy "members_select" on public.team_members
for select to authenticated using (public.can_access_team(team_id));
create policy "members_insert" on public.team_members
for insert to authenticated with check (
  exists (
    select 1 from public.teams t
    where t.id = team_id and public.owns_player(t.created_by)
  )
);
