-- Migration 002: Add mode + game_stats columns to sessions, add UPDATE policy
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/tkjvkvrzlvbukxbsilvw/sql/new
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add missing columns to sessions table
alter table sessions
  add column if not exists mode       text not null default 'individual'
    check (mode in ('individual', 'team')),
  add column if not exists game_stats jsonb not null default '{}'::jsonb;

-- 2. Add UPDATE RLS policy (was missing — this is why saves silently failed)
drop policy if exists "sessions_update" on sessions;
create policy "sessions_update" on sessions
  for update using (player_id = requesting_player_id())
  with check (player_id = requesting_player_id());

-- 3. Enable Realtime on shot_logs (required for collaborative live sessions)
alter publication supabase_realtime add table shot_logs;

-- 4. Index for join code lookups (game_stats->>'join_code')
create index if not exists idx_sessions_join_code
  on sessions ((game_stats->>'join_code'))
  where game_stats->>'join_code' is not null;

-- Verify
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'sessions'
order by ordinal_position;
