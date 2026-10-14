import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const migration = await read('supabase/migrations/20261014160509_tracker_ownership_alignment.sql');

test('actual installed ledger ownership repair supports null/stale legacy owner, preserves retries and rejects foreign accounts', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${alice}'),('${bob}');`);
    await db.exec(await read('supabase/schema.sql'));
    await db.exec(await read('supabase/migrations/20260930171602_web_player_ownership_safeguards.sql'));
    await db.exec(await read('supabase/migrations/20260930202201_reliable_sessions_and_development.sql'));
    // Reproduce the inspected live schema: owner_id is NOT a generated column.
    await db.exec('alter table players alter column owner_id drop expression');
    await db.exec(await read('docs/launch-repair-2026-10-14/tracker-function-before.sql'));
    const player = randomUUID(), session = randomUUID(), id = randomUUID();
    await db.exec(`set request.jwt.claim.sub='${alice}'; set role authenticated;`);
    await db.query('insert into players(id,firebase_uid,manager_uid,name) values($1,$2,$2,$3)', [player, alice, 'Isolated test player']);
    await db.query("insert into sessions(id,player_id,type,tracker_status) values($1,$2,'game','active')", [session, player]);
    const payload = {kind:'stat',key:'ast',delta:1,period:1,clock:'08:00',recorded_at:'2026-10-14T16:00:00Z'};
    const send = (uid, commandId=id, version=0, value=payload) => db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`).then(() => db.query('select apply_session_command($1,$2,$3,$4) as result',[session,commandId,version,value]));
    await assert.rejects(send(alice), /Session unavailable/);
    await db.exec('reset role');
    const before = (await db.query("select pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure) d,proacl::text acl from pg_proc where oid='public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure")).rows[0];
    await db.exec(migration);
    const after = (await db.query("select pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure) d,proacl::text acl from pg_proc where oid='public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure")).rows[0];
    assert.equal(after.d, before.d.replace(/owner_id\s*=\s*auth\.uid\(\)/,'manager_uid = (select auth.uid())::text'));
    assert.equal(after.acl,before.acl);
    assert.equal((await send(alice)).rows[0].result.game_stats.ast,1);
    assert.equal((await send(alice)).rows[0].result.tracker_version,1);
    await assert.rejects(send(bob,randomUUID(),1), /Session unavailable/);
    await assert.rejects(send('',randomUUID(),1), /Authentication required/);
    await assert.rejects(send(alice,randomUUID(),0), /SESSION_CONFLICT/);
    const shotId = randomUUID();
    const shot = {...payload,kind:'shot',zone_id:'paint',made:true};
    await send(alice,shotId,1,shot); await send(alice,shotId,1,shot);
    assert.equal((await db.query('select count(*)::int n from shot_logs where session_id=$1',[session])).rows[0].n,1);
    await send(alice,randomUUID(),2,{...payload,kind:'reverse',target:shotId});
    await send(alice,randomUUID(),3,{...payload,kind:'end'});
    assert.equal((await db.query('select tracker_status from sessions where id=$1',[session])).rows[0].tracker_status,'completed');
    await db.exec('reset role'); await db.exec(migration);
    assert.equal((await db.query("select pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure) d")).rows[0].d,after.d);
    // A misleading legacy owner cannot authorize access to someone else's row.
    await db.query('update players set owner_id=$1 where id=$2',[bob,player]);
    await assert.rejects(send(bob,randomUUID(),4), /Session unavailable/);
    // Snapshot restore is the rollback for this function-only change.
    await db.exec('reset role'); await db.exec(await read('docs/launch-repair-2026-10-14/tracker-function-before.sql'));
    assert.equal((await db.query("select pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure) d")).rows[0].d,before.d);
  } finally { await db.close(); }
});

test('repair refuses unexpected function bodies rather than replacing unrelated behavior', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table players(manager_uid text not null);
      create function apply_session_command(uuid,uuid,integer,jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;`);
    await assert.rejects(db.exec(migration), /Unexpected tracker function/);
  } finally { await db.close(); }
});
