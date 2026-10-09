import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { skillResult } from '../src/lib/skillPractice.mjs';
import { DRILL_BANK } from '../src/lib/drillBank.js';
import * as safety from '../src/lib/dataSafety.mjs';
import { loadComponent } from './helpers/reactHarness.mjs';
const drill = DRILL_BANK.find(row => row.id === 'form-shooting-close');

test('actual workout query recovers same-id skill results with JSONB key order and retains abort signal', async () => {
  const result = skillResult({ drill, outcomes: [true, false], elapsedSeconds: 30, id: 'same-id' });
  const stored = { ...result, player_id: 'alice', drills: [Object.fromEntries(Object.entries(result.drills[0]).reverse())] };
  let write, recovering = false; const signals = [], filters = [];
  const chain = { insert(row) { write = row; recovering = false; return this; }, select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, single() { return this; }, abortSignal(signal) { signals.push(signal); return this; },
    then(resolve, reject) { return Promise.resolve(recovering ? { data: stored, error: null } : (recovering = true, { data: null, error: { code: '23505' } })).then(resolve, reject); } };
  const { saveWorkoutResult } = await loadComponent(new URL('../src/lib/queries.js', import.meta.url), { './supabase': { getSupabase: () => ({ from: () => chain }) }, './constants': {}, './dataSafety.mjs': safety });
  const signal = new AbortController().signal;
  const saved = await saveWorkoutResult('alice', result, { signal });
  assert.equal(saved.id, result.id); assert.equal(write.drills[0].successful_reps, 1);
  assert.deepEqual(filters, [['id', 'same-id'], ['player_id', 'alice']]);
  assert.deepEqual(signals, [signal, signal]);
  stored.drills[0].successful_reps = 2;
  await assert.rejects(saveWorkoutResult('alice', result), /different result/);
});

test('existing local PostgreSQL schema stores outcome metadata, rejects duplicate IDs and isolates owners', async () => {
  const alice = randomUUID(), bob = randomUUID(), player = randomUUID(), foreign = randomUUID();
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; insert into auth.users values('${alice}'),('${bob}');`);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(`insert into players(id,firebase_uid,manager_uid,name) values('${player}','${alice}','${alice}','One'),('${foreign}','${bob}','${bob}','Other');`);
    for (const file of ['20260930171602_web_player_ownership_safeguards.sql', '20260930202201_reliable_sessions_and_development.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    const user = uid => db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`);
    const result = skillResult({ drill, outcomes: [true, false], elapsedSeconds: 10, id: randomUUID() });
    const insert = owner => db.query('insert into workout_results(id,player_id,elapsed_seconds,drills) values($1,$2,$3,$4) returning *', [result.id, owner, result.elapsed_seconds, result.drills]);
    await user(alice);
    await assert.rejects(insert(foreign), /row-level security/);
    const saved = (await insert(player)).rows[0];
    assert.equal(saved.drills[0].successful_reps, 1); assert.equal(saved.drills[0].practice_version, 'skill-practice-v1');
    await assert.rejects(insert(player), /duplicate key/);
    await user(bob); assert.equal((await db.query('select * from workout_results')).rows.length, 0);
    await db.exec('reset role; set role anon;'); await assert.rejects(db.query('select * from workout_results'), /permission denied/);
  } finally { await db.close(); }
});
