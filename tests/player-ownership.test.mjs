import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const primary = '10000000-0000-0000-0000-000000000001';
const child = '10000000-0000-0000-0000-000000000002';
const other = '10000000-0000-0000-0000-000000000003';
const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260930171602_web_player_ownership_safeguards.sql', import.meta.url), 'utf8');

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');`);
  await db.exec(schema);
  await db.exec(`insert into public.players(id, firebase_uid, manager_uid, name) values
    ('${primary}', '${alice}', '${alice}', 'Existing primary'),
    ('${child}', '${alice}_existing', '${alice}', 'Existing managed player'),
    ('${other}', '${bob}', '${bob}', 'Other account');`);
  await db.exec(migration);
  return db;
}
async function asUser(db, uid, sql) {
  await db.exec(`reset role; set request.jwt.claim.sub = '${uid}'; set role authenticated;`);
  return db.query(sql);
}

test('migration preserves existing profiles, grants only owned rows, and denies ownership changes', async () => {
  const db = await fixture();
  try {
    assert.equal((await db.query('select count(*)::int n from players')).rows[0].n, 3);
    const { rows } = await asUser(db, alice, 'select id from players order by id');
    assert.deepEqual(rows.map(r => r.id), [primary, child]);
    assert.equal((await asUser(db, bob, 'select id from players')).rows[0].id, other);
    await assert.rejects(asUser(db, alice, `update players set manager_uid='${bob}' where id='${child}'`));
    await assert.rejects(asUser(db, alice, `update players set firebase_uid='${bob}' where id='${child}'`));
    assert.equal((await asUser(db, alice, `update players set name='Hijack' where id='${other}' returning id`)).rows.length, 0);
    await assert.rejects(asUser(db, alice, `insert into players(firebase_uid, manager_uid, name) values ('${bob}_forged','${bob}','Forged')`));
    await asUser(db, alice, `insert into players(firebase_uid, manager_uid, name) values ('${alice}_new','${alice}','New managed player')`);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from players'));
    await assert.rejects(db.query(`select private.can_access_team(gen_random_uuid())`));
  } finally { await db.close(); }
});

test('shots must match the exact owned session/player and managed deletion cascades atomically', async () => {
  const db = await fixture();
  try {
    const sid = '20000000-0000-0000-0000-000000000001';
    await asUser(db, alice, `insert into sessions(id,player_id,type) values ('${sid}','${child}','practice')`);
    await asUser(db, alice, `insert into shot_logs(session_id,player_id,zone_id,made) values ('${sid}','${child}','paint',true)`);
    await assert.rejects(asUser(db, alice, `insert into shot_logs(session_id,player_id,zone_id,made) values ('${sid}','${primary}','paint',true)`));
    await assert.rejects(asUser(db, bob, `insert into shot_logs(session_id,player_id,zone_id,made) values ('${sid}','${other}','paint',true)`));
    assert.equal((await asUser(db, bob, `select * from sessions where id='${sid}'`)).rows.length, 0);
    assert.equal((await asUser(db, bob, `select * from shot_logs`)).rows.length, 0);
    await asUser(db, alice, `insert into journal_entries(player_id,type,mood,title,body) values ('${child}','practice','focused','Saved journal','Preserved text')`);
    assert.equal((await asUser(db, alice, `delete from players where id='${primary}' returning id`)).rows.length, 0);
    assert.equal((await asUser(db, bob, `delete from players where id='${child}' returning id`)).rows.length, 0);
    await asUser(db, alice, `delete from players where id='${child}'`);
    await db.exec('reset role;');
    for (const table of ['sessions','shot_logs','journal_entries']) {
      assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
    }
    assert.equal((await db.query('select count(*)::int n from players')).rows[0].n, 2);
  } finally { await db.close(); }
});

test('Auth deletion cascades all account players and data, leaves other users untouched, and blocks stale-token recreation', async () => {
  const db = await fixture();
  try {
    const sid = (await asUser(db, alice, `insert into sessions(player_id,type) values ('${child}','game') returning id`)).rows[0].id;
    await asUser(db, alice, `insert into shot_logs(session_id,player_id,zone_id,made) values ('${sid}','${child}','paint',false)`);
    await db.exec(`reset role; delete from auth.users where id='${alice}';`);
    assert.deepEqual((await db.query('select id from players')).rows.map(r => r.id), [other]);
    assert.equal((await db.query('select count(*)::int n from shot_logs')).rows[0].n, 0);
    await assert.rejects(asUser(db, alice, `insert into players(firebase_uid,manager_uid,name) values ('${alice}','${alice}','Stale session')`));
  } finally { await db.close(); }
});

test('team lookup avoids policy recursion without exposing another managers player/session data', async () => {
  const db = await fixture();
  try {
    const tid = (await asUser(db, alice, `insert into teams(name,created_by) values ('Private team','${primary}') returning id`)).rows[0].id;
    await asUser(db, alice, `insert into team_members(team_id,player_id) values ('${tid}','${child}')`);
    assert.equal((await asUser(db, alice, 'select * from teams')).rows.length, 1);
    assert.equal((await asUser(db, alice, 'select * from team_members')).rows.length, 1);
    assert.equal((await asUser(db, bob, 'select * from teams')).rows.length, 0);
    await assert.rejects(asUser(db, alice, `insert into team_members(team_id,player_id) values ('${tid}','${other}')`));
  } finally { await db.close(); }
});

test('a local fixture snapshot restores saved records and ownership protections', async () => {
  const db = await fixture();
  let restored;
  try {
    await asUser(db, alice, `insert into journal_entries(player_id,type,mood,title,body) values ('${child}','practice','focused','Restore proof','Keep this text')`);
    await db.exec('reset role;');
    const snapshot = await db.dumpDataDir();
    restored = new PGlite({ loadDataDir: snapshot });
    const rows = (await asUser(restored, alice, 'select title,body from journal_entries')).rows;
    assert.deepEqual(rows, [{ title: 'Restore proof', body: 'Keep this text' }]);
    assert.equal((await asUser(restored, bob, 'select * from journal_entries')).rows.length, 0);
  } finally { await db.close(); if (restored) await restored.close(); }
});

test('migration refuses unknown policies atomically without losing profiles or installing a partial FK', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      insert into auth.users values ('${alice}');`);
    await db.exec(schema);
    await db.exec(`insert into players(firebase_uid,manager_uid,name) values ('${alice}','${alice}','Preserve');
      create policy unreviewed_access on players for select using (true);`);
    await assert.rejects(db.exec(migration), /Unexpected policy/);
    await db.exec('rollback;');
    assert.equal((await db.query('select count(*)::int n from players')).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from pg_constraint where conname='players_owner_auth_fk'")).rows[0].n, 0);
  } finally { await db.close(); }
});
