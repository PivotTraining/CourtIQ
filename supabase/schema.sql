-- Court IQ Database Schema
-- Run this in the Supabase SQL Editor (fresh install)
-- For existing installs, run supabase/migrations/001_clean_rls.sql instead.

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  -- firebase_uid stores the Supabase auth user UUID (legacy name kept for
  -- backwards-compatibility with existing rows and queries).
  firebase_uid text unique not null,
  name         text not null,
  team_name    text,
  position     text,
  jersey_number integer,
  age          integer,
  skill_level  text check (skill_level in ('beginner', 'intermediate', 'advanced', 'elite')),
  created_at   timestamptz default now()
);

create table if not exists sessions (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  type      text not null check (type in ('game', 'practice')),
  date      date not null default current_date,
  created_at timestamptz default now()
);

create table if not exists shot_logs (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  zone_id    text not null,
  made       boolean not null,
  created_at timestamptz default now()
);

create table if not exists journal_entries (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  type      text not null check (type in ('game', 'practice')),
  mood      text not null,
  title     text not null,
  body      text,
  stats     jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  season     text,
  created_by uuid not null references players(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role      text,
  unique(team_id, player_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_sessions_player       on sessions(player_id);
create index if not exists idx_shot_logs_player      on shot_logs(player_id);
create index if not exists idx_shot_logs_session     on shot_logs(session_id);
create index if not exists idx_journal_entries_player on journal_entries(player_id);
create index if not exists idx_team_members_team     on team_members(team_id);
create index if not exists idx_players_firebase_uid  on players(firebase_uid);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table players        enable row level security;
alter table sessions       enable row level security;
alter table shot_logs      enable row level security;
alter table journal_entries enable row level security;
alter table teams          enable row level security;
alter table team_members   enable row level security;

-- ─── RLS Helper Functions ─────────────────────────────────────────────────────

-- Returns the Supabase auth user UUID from the JWT (same as auth.uid()::text).
-- Kept so existing policies keep working without changes.
create or replace function requesting_firebase_uid()
returns text as $$
  select auth.uid()::text;
$$ language sql stable security definer;

-- Returns the players.id for the current authenticated user.
create or replace function requesting_player_id()
returns uuid as $$
  select id from players where firebase_uid = auth.uid()::text;
$$ language sql stable security definer;

-- ─── Players Policies ─────────────────────────────────────────────────────────

drop policy if exists "players_select" on players;
drop policy if exists "players_insert" on players;
drop policy if exists "players_update" on players;

create policy "players_select" on players
  for select using (firebase_uid = auth.uid()::text);

create policy "players_insert" on players
  for insert with check (firebase_uid = auth.uid()::text);

create policy "players_update" on players
  for update using (firebase_uid = auth.uid()::text);

-- ─── Sessions Policies ────────────────────────────────────────────────────────

drop policy if exists "sessions_select" on sessions;
drop policy if exists "sessions_insert" on sessions;
drop policy if exists "sessions_delete" on sessions;

create policy "sessions_select" on sessions
  for select using (player_id = requesting_player_id());

create policy "sessions_insert" on sessions
  for insert with check (player_id = requesting_player_id());

create policy "sessions_delete" on sessions
  for delete using (player_id = requesting_player_id());

-- ─── Shot Logs Policies ───────────────────────────────────────────────────────

drop policy if exists "shots_select" on shot_logs;
drop policy if exists "shots_insert" on shot_logs;
drop policy if exists "shots_delete" on shot_logs;

create policy "shots_select" on shot_logs
  for select using (player_id = requesting_player_id());

create policy "shots_insert" on shot_logs
  for insert with check (player_id = requesting_player_id());

create policy "shots_delete" on shot_logs
  for delete using (player_id = requesting_player_id());

-- ─── Journal Policies ─────────────────────────────────────────────────────────

drop policy if exists "journal_select" on journal_entries;
drop policy if exists "journal_insert" on journal_entries;

create policy "journal_select" on journal_entries
  for select using (player_id = requesting_player_id());

create policy "journal_insert" on journal_entries
  for insert with check (player_id = requesting_player_id());

-- ─── Teams Policies ───────────────────────────────────────────────────────────

drop policy if exists "teams_select" on teams;
drop policy if exists "teams_insert" on teams;

create policy "teams_select" on teams
  for select using (
    id in (select team_id from team_members where player_id = requesting_player_id())
  );

create policy "teams_insert" on teams
  for insert with check (created_by = requesting_player_id());

-- ─── Team Members Policies ────────────────────────────────────────────────────

drop policy if exists "members_select" on team_members;
drop policy if exists "members_insert" on team_members;

create policy "members_select" on team_members
  for select using (
    team_id in (select team_id from team_members where player_id = requesting_player_id())
  );

create policy "members_insert" on team_members
  for insert with check (
    team_id in (select id from teams where created_by = requesting_player_id())
  );
