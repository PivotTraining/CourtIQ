import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sqlUrl=new URL('../supabase/migrations/20261027051000_courtiq_parent_shared_players.sql',import.meta.url);
test('sharing is opt-in, by expiring high-entropy one-use parent codes, never account-wide',async()=>{
 const sql=await readFile(sqlUrl,'utf8');
 assert.match(sql,/manager_uid=\(select auth\.uid\(\)\)::text/);
 assert.match(sql,/gen_random_bytes\(24\)/);
 assert.match(sql,/digest\(raw,'sha256'\)/);
 assert.match(sql,/interval '48 hours'/);
 assert.match(sql,/consumed_at is null/);
 assert.match(sql,/for update;/);
 assert.match(sql,/revoke all on private\.courtiq_player_shares,private\.courtiq_player_invites from anon,authenticated,public/);
 assert.match(sql,/raise exception 'Player unavailable'/);
 assert.match(sql,/courtiq_revoke_player_share/);
});
test('RLS lets an invited account see data but not delete an owner player or games',async()=>{
 const sql=await readFile(sqlUrl,'utf8');
 assert.match(sql,/create policy courtiq_shared_player_read on public\.players for select to authenticated/);
 assert.match(sql,/create policy courtiq_shared_game_read on public\.sessions for select to authenticated/);
 assert.match(sql,/create policy courtiq_shared_shots_read on public\.shot_logs for select to authenticated/);
 assert.match(sql,/create policy courtiq_shared_commands_read on public\.session_commands for select to authenticated/);
 assert.match(sql,/create policy courtiq_shared_workouts_read on public\.workout_results for select to authenticated/);
 assert.match(sql,/create policy courtiq_shared_game_start on public\.sessions for insert to authenticated/);
 assert.doesNotMatch(sql,/create policy \w+ on public\.players for (update|delete) to authenticated/);
 assert.doesNotMatch(sql,/create policy \w+ on public\.sessions for (update|delete) to authenticated/);
});
test('server game RPC retains authoritative version/ownership checks and accepts only a scoped share',async()=>{
 const sql=await readFile(sqlUrl,'utf8');
 assert.match(sql,/pg_get_functiondef\('public\.apply_session_command\(uuid,uuid,integer,jsonb\)'::regprocedure\)/);
 assert.match(sql,/private\.courtiq_has_player_share\(s\.player_id\)/);
 assert.match(sql,/Unexpected game RPC body; stop before changing authorization/);
 assert.match(sql,/security invoker set search_path=''/);
 const queries=await readFile(new URL('../src/lib/queries.js',import.meta.url),'utf8');
 assert.match(queries,/courtiq_issue_player_invite/);
 assert.match(queries,/courtiq_accept_player_invite/);
 assert.match(queries,/courtiq_revoke_player_share/);
 assert.match(queries,/RLS returns owned and explicitly invited player records/);
 const chooser=await readFile(new URL('../src/components/PlayerSwitcher.jsx',import.meta.url),'utf8');
 assert.match(chooser,/p\.manager_uid === user\?\.id/);
});
