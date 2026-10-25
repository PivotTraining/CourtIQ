import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationText = await readFile(new URL("../supabase/migrations/20261025013734_family_shared_player_ledger.sql", import.meta.url), "utf8");

test("family sharing requires explicit invites and only enables player-scoped access", () => {
  assert.match(migrationText,/create table public\.player_collaborators/);
  assert.match(migrationText,/create policy shared_players_visible/);
  assert.match(migrationText,/private\.can_read_player\(id\)/);
  assert.match(migrationText,/create policy shared_sessions_insert/);
  assert.match(migrationText,/private\.can_edit_player\(player_id\)/);
  assert.match(migrationText,/join_shared_player\(p_code text\)/);
  assert.match(migrationText,/role in \('editor','viewer'\)/);
  assert.match(migrationText,/recipient_email/);
  assert.match(migrationText,/expires_at>now\(\)/);
  assert.match(migrationText,/redeemed_at is not null/);
  assert.match(migrationText,/on conflict \(player_id,account_id\) do nothing/);
  assert.match(migrationText,/create policy shared_game_transfers_read/);
  assert.match(migrationText,/POSSIBLE_DUPLICATE_GAME/);
  assert.match(migrationText,/source_player uuid not null/);
  assert.doesNotMatch(migrationText,/grant (?:select|insert|update|delete) on public\.player_share_invites to authenticated/i);
  assert.doesNotMatch(migrationText,/create policy shared_journal/i);
});

const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";
const eve = "00000000-0000-0000-0000-000000000003";
const ownedChild = "10000000-0000-0000-0000-000000000011";
const bobChild = "10000000-0000-0000-0000-000000000022";
const anotherChild = "10000000-0000-0000-0000-000000000033";
const ref = file => readFile(new URL("../" + file, import.meta.url), "utf8");
async function initializeDB() {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key,email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated;
  insert into auth.users values ('${alice}','owner@example.com'),('${bob}','parent@example.com'),('${eve}','stranger@example.com');`);
 await db.exec(await ref("supabase/schema.sql"));
 await db.exec(`insert into public.players(id,firebase_uid,manager_uid,name) values
  ('${ownedChild}','${alice}_caleb','${alice}','Caleb'),
  ('${bobChild}','${bob}_caleb','${bob}','Caleb'),
  ('${anotherChild}','${eve}_unrelated','${eve}','Unrelated Player');`);
 await db.exec(await ref("supabase/migrations/20260930171602_web_player_ownership_safeguards.sql"));
 await db.exec(await ref("supabase/migrations/20260930202201_reliable_sessions_and_development.sql"));
 await db.exec(await ref("supabase/migrations/20261014160509_tracker_ownership_alignment.sql"));
 await db.exec(migrationText);
 return db;
}
async function user(db,uid,sql){
 await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`);
 return db.query(sql);
}
test("two parents can share exactly one player; strangers and viewers cannot edit", async t => {
 const db = await initializeDB();
 try {
   assert.equal((await user(db,bob,`select count(*)::int n from players where id='${ownedChild}'`)).rows[0].n,0);
   assert.equal((await user(db,eve,`select count(*)::int n from players where id='${ownedChild}'`)).rows[0].n,0);
   const token=(await user(db,alice,`select public.create_player_share_invite('${ownedChild}','parent@example.com') code`)).rows[0].code;
   assert.match(token,/^[a-f0-9]{64}$/);
   await assert.rejects(user(db,eve,`select public.join_shared_player('${token}')`));
   assert.equal((await user(db,bob,`select public.join_shared_player('${token}') id`)).rows[0].id,ownedChild);
   assert.equal((await user(db,bob,`select count(*)::int n from players where id='${ownedChild}'`)).rows[0].n,1);
   assert.equal((await user(db,eve,`select count(*)::int n from players where id='${ownedChild}'`)).rows[0].n,0);
   await assert.rejects(user(db,eve,`select public.join_shared_player('${token}')`));
   assert.equal((await user(db,bob,`delete from players where id='${ownedChild}' returning id`)).rows.length,0);
   const sid=(await user(db,bob,`insert into sessions(player_id,type,mode) values ('${ownedChild}','game','individual') returning id`)).rows[0].id;
   assert.equal((await user(db,alice,`select count(*)::int n from sessions where id='${sid}'`)).rows[0].n,1);
   const tracked=(await user(db,bob,`insert into sessions(player_id,type,mode,tracker_status)
     values ('${ownedChild}','game','individual','active') returning id`)).rows[0].id;
   const command='30000000-0000-0000-0000-000000000004';
   await user(db,bob,`select public.apply_session_command('${tracked}','${command}',0,
     '{"kind":"stat","key":"ast","delta":1,"recorded_at":"2026-10-24T20:00:00Z"}'::jsonb)`);
   assert.equal((await user(db,alice,`select (game_stats->>'ast')::int n from sessions where id='${tracked}'`)).rows[0].n,1);
   assert.equal((await user(db,eve,`select count(*)::int n from session_commands where session_id='${tracked}'`)).rows[0].n,0);

   assert.equal((await user(db,eve,`select count(*)::int n from sessions where id='${sid}'`)).rows[0].n,0);
   await user(db,alice,`select public.revoke_shared_player('${ownedChild}','${bob}')`);
   assert.equal((await user(db,bob,`select count(*)::int n from sessions where id='${sid}'`)).rows[0].n,0);
 } finally { await db.close(); }
});

test("view-only collaborator can see the canonical player but cannot save a game or change the profile", async () => {
  const db=await initializeDB();
  try {
    const token=(await user(db,alice,`select public.create_player_share_invite('${ownedChild}','parent@example.com','viewer') code`)).rows[0].code;
    await user(db,bob,`select public.join_shared_player('${token}')`);
    assert.equal((await user(db,bob,`select count(*)::int n from players where id='${ownedChild}'`)).rows[0].n,1);
    await assert.rejects(user(db,bob,`insert into sessions(player_id,type,mode) values ('${ownedChild}','game','individual')`));
    assert.equal((await user(db,bob,`update players set name='Overwritten' where id='${ownedChild}' returning id`)).rows.length,0);
    assert.equal((await user(db,alice,`select name from players where id='${ownedChild}'`)).rows[0].name,'Caleb');
  } finally { await db.close(); }
});

test("separate games transfer only after a per-game duplicate check and preserve shots", async () => {
  const db=await initializeDB();
  try {
    const token=(await user(db,alice,`select public.create_player_share_invite('${ownedChild}','parent@example.com') code`)).rows[0].code;
    await user(db,bob,`select public.join_shared_player('${token}')`);
    const primaryGame=(await user(db,alice,`insert into sessions(player_id,type,mode,date,tracker_context)
      values ('${ownedChild}','game','individual','2026-10-24','{"opponent":"Rivals"}') returning id`)).rows[0].id;
    const olderGame=(await user(db,bob,`insert into sessions(player_id,type,mode,date,tracker_context)
      values ('${bobChild}','game','individual','2026-10-24','{"opponent":"Rivals"}') returning id`)).rows[0].id;
    const shot=(await user(db,bob,`insert into shot_logs(session_id,player_id,zone_id,made)
      values ('${olderGame}','${bobChild}','paint',true) returning id`)).rows[0].id;
    await assert.rejects(user(db,bob,`select public.import_shared_game('${bobChild}','${ownedChild}','${olderGame}')`),/POSSIBLE_DUPLICATE_GAME/);
    assert.equal((await user(db,bob,`select count(*)::int n from sessions where id='${olderGame}' and player_id='${bobChild}'`)).rows[0].n,1);
    const safeGame=(await user(db,bob,`insert into sessions(player_id,type,mode,date,tracker_context)
      values ('${bobChild}','game','individual','2026-10-23','{"opponent":"Another Team"}') returning id`)).rows[0].id;
    const safeShot=(await user(db,bob,`insert into shot_logs(session_id,player_id,zone_id,made)
      values ('${safeGame}','${bobChild}','paint',false) returning id`)).rows[0].id;
    assert.equal((await user(db,bob,`select public.import_shared_game('${bobChild}','${ownedChild}','${safeGame}') id`)).rows[0].id,safeGame);
    assert.equal((await user(db,alice,`select count(*)::int n from sessions where player_id='${ownedChild}'`)).rows[0].n,2);
    assert.equal((await user(db,alice,`select count(*)::int n from shot_logs where id='${safeShot}' and player_id='${ownedChild}'`)).rows[0].n,1);
    assert.equal((await user(db,bob,`select count(*)::int n from shot_logs where id='${shot}' and player_id='${bobChild}'`)).rows[0].n,1);
    assert.equal((await user(db,eve,`select count(*)::int n from sessions where player_id='${ownedChild}'`)).rows[0].n,0);
    assert.equal((await user(db,alice,`select count(*)::int n from sessions where id='${primaryGame}'`)).rows[0].n,1);
  } finally { await db.close(); }
});
