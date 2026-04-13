-- Court IQ Database Schema
-- Run this in the Supabase SQL Editor

-- Players table
create table players (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique not null,
  name text not null,
  team_name text,
  position text,
  jersey_number integer,
  age integer,
  created_at timestamptz default now()
);

-- Sessions (a game or practice event)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  type text not null check (type in ('game', 'practice')),
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Shot logs (individual shots within a session)
create table shot_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  zone_id text not null,
  made boolean not null,
  created_at timestamptz default now()
);

-- Journal entries
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  type text not null check (type in ('game', 'practice')),
  mood text not null,
  title text not null,
  body text,
  stats jsonb default '{}',
  created_at timestamptz default now()
);

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text,
  created_by uuid not null references players(id) on delete cascade,
  created_at timestamptz default now()
);

-- Team members
create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role text,
  unique(team_id, player_id)
);

-- Indexes
create index idx_sessions_player on sessions(player_id);
create index idx_shot_logs_player on shot_logs(player_id);
create index idx_shot_logs_session on shot_logs(session_id);
create index idx_journal_entries_player on journal_entries(player_id);
create index idx_team_members_team on team_members(team_id);

-- Row Level Security
alter table players enable row level security;
alter table sessions enable row level security;
alter table shot_logs enable row level security;
alter table journal_entries enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;

-- Helper: extract Firebase UID from request header
create or replace function requesting_firebase_uid()
returns text as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'sub',
    (current_setting('request.headers', true)::json->>'x-firebase-uid')::text
  );
$$ language sql stable;

-- Helper: get player ID for current Firebase user
create or replace function requesting_player_id()
returns uuid as $$
  select id from players where firebase_uid = requesting_firebase_uid();
$$ language sql stable;

-- Players policies
create policy "players_select" on players for select using (firebase_uid = requesting_firebase_uid());
create policy "players_insert" on players for insert with check (firebase_uid = requesting_firebase_uid());
create policy "players_update" on players for update using (firebase_uid = requesting_firebase_uid());

-- Sessions policies
create policy "sessions_select" on sessions for select using (player_id = requesting_player_id());
create policy "sessions_insert" on sessions for insert with check (player_id = requesting_player_id());
create policy "sessions_delete" on sessions for delete using (player_id = requesting_player_id());

-- Shot logs policies
create policy "shots_select" on shot_logs for select using (player_id = requesting_player_id());
create policy "shots_insert" on shot_logs for insert with check (player_id = requesting_player_id());
create policy "shots_delete" on shot_logs for delete using (player_id = requesting_player_id());

-- Journal policies
create policy "journal_select" on journal_entries for select using (player_id = requesting_player_id());
create policy "journal_insert" on journal_entries for insert with check (player_id = requesting_player_id());

-- Teams policies
create policy "teams_select" on teams for select using (
  id in (select team_id from team_members where player_id = requesting_player_id())
);
create policy "teams_insert" on teams for insert with check (created_by = requesting_player_id());

-- Team members policies
create policy "members_select" on team_members for select using (
  team_id in (select team_id from team_members where player_id = requesting_player_id())
);
create policy "members_insert" on team_members for insert with check (
  team_id in (select id from teams where created_by = requesting_player_id())
);
