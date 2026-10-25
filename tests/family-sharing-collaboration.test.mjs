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
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated;
  insert into auth.users values ('${alice}'),('${bob}'),('${eve}');`);
 await db.exec(await ref("supabase/schema.sql"));
 await db.exec(`insert into public.players(id,firebase_uid,manager_uid,name) values
  ('${ownedChild}','${alice}_caleb','${alice}','Caleb'),
  ('${bobChild}','${bob}_caleb','${bob}','Caleb'),
  ('${anotherChild}','${eve}_unrelated','${eve}','Unrelated Player');`);
 await db.exec(await ref("supabase/migrations/20260930171602_web_player_ownership_safeguards.sql"));
 await db.exec(await ref("supabase/migrations/20260930202201_reliable_sessions_and_development.sql"));
 await db.exec(await ref("supabase/migrations/20261014160509_tracker_ownership_alignment.sql"));
 // PGlite may not bundle pgcrypto. When it does, this is a real database ACL test.
 await db.exec(`create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;`);
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
   const token=(await user(db,alice,`select public.create_player_share_invite('${ownedChild}') code`)).rows[0].code;
   assert.match(token,/^[a-f0-9]{64}$/);
   assert.equal((await user(db,bob,`select public.join_shared_player('${token}') id`)).rows[0].id,ownedChild);
   assert.equal((await user(db,bob,`select count(*)::int n from players where id='${ownedChild}'`)).rows[0].n,1);
   assert.equal((await user(db,eve,`select count(*)::int n from players where id='${ownedChild}'`)).rows[0].n,0);
   await assert.rejects(user(db,eve,`select public.join_shared_player('${token}')`));
   await assert.rejects(user(db,bob,`delete from players where id='${ownedChild}'`));
   const sid=(await user(db,bob,`insert into sessions(player_id,type,mode) values ('${ownedChild}','game','individual') returning id`)).rows[0].id;
   assert.equal((await user(db,alice,`select count(*)::int n from sessions where id='${sid}'`)).rows[0].n,1);
   assert.equal((await user(db,eve,`select count(*)::int n from sessions where id='${sid}'`)).rows[0].n,0);
   await user(db,alice,`select public.revoke_shared_player('${ownedChild}','${bob}')`);
   assert.equal((await user(db,bob,`select count(*)::int n from sessions where id='${sid}'`)).rows[0].n,0);
 } finally { await db.close(); }
});
