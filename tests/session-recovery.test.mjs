import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { loadRecovery, saveRecovery, clearAccountRecovery, hasPendingRecovery, projectCommand, flushRecovery, filterSessionRecords, recordedPeriodScoring, recordedGameResult } from '../src/lib/sessionRecovery.mjs';

const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const player = '10000000-0000-0000-0000-000000000001';
const snapshot = () => ({ session: { id: 'game', tracker_version: 0, tracker_status: 'active', game_stats: {} }, shots: [], events: [] });
const command = (version, payload) => ({ id: randomUUID(), sessionId: 'game', version, payload: { ...payload, period: 1, clock: '08:00', recorded_at: '2026-09-30T20:00:00Z' } });
function storage() {
  const map = new Map();
  return { get length() { return map.size; }, key: index => [...map.keys()][index],
    getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}

test('recovery survives reload, is account/player isolated, and logout clears only its account', () => {
  const device = storage();
  const value = { accountId: alice, playerId: player, snapshot: snapshot(), pending: [command(0, { kind: 'stat', key: 'ast', delta: 1 })] };
  saveRecovery(device, alice, player, value);
  assert.equal(loadRecovery(device, alice, player).pending.length, 1);
  assert.equal(loadRecovery(device, bob, player), null);
  assert.equal(loadRecovery(device, alice, 'other-player'), null);
  assert.equal(hasPendingRecovery(device, alice), true);
  saveRecovery(device, bob, player, { ...value, accountId: bob });
  clearAccountRecovery(device, alice);
  assert.equal(loadRecovery(device, alice, player), null);
  assert.equal(loadRecovery(device, bob, player).pending.length, 1);
  assert.throws(() => saveRecovery({ setItem() { throw new Error('Disk full'); } }, alice, player, value), /Disk full/);
});

test('entry projection tracks every stat, split rebounds and reversible corrections without mutating originals', () => {
  const base = snapshot();
  const ast = command(0, { kind: 'stat', key: 'ast', delta: 1 });
  let next = projectCommand(base, ast);
  assert.equal(base.session.game_stats.ast, undefined);
  assert.equal(next.session.game_stats.ast, 1);
  const oreb = command(1, { kind: 'stat', key: 'oreb', delta: 1 });
  next = projectCommand(next, oreb);
  assert.equal(next.session.game_stats.reb, 1);
  assert.throws(() => projectCommand(next, command(2, { kind: 'stat', key: 'reb', delta: -1 })), /below the recorded split/);
  next = projectCommand(next, command(2, { kind: 'reverse', target: ast.id }));
  assert.equal(next.session.game_stats.ast, 0);
  assert.throws(() => projectCommand(next, command(3, { kind: 'reverse', target: ast.id })), /cannot be reversed/);
  assert.throws(() => projectCommand(next, command(0, { kind: 'stat', key: 'stl', delta: 1 })), /another device/);
  assert.throws(() => projectCommand(next, command(3, { kind: 'stat', key: 'to', delta: -1 })), /negative/);
});

test('sync stops at an error, retries the same ID and does not cross account switches', async () => {
  const first = command(0, { kind: 'shot', zone_id: 'paint', made: true });
  const second = command(1, { kind: 'stat', key: 'ast', delta: 1 });
  let saved = { accountId: alice, playerId: player, snapshot: projectCommand(projectCommand(snapshot(), first), second), pending: [first, second] };
  const sent = [];
  await assert.rejects(flushRecovery(saved, async cmd => { sent.push(cmd.id); if (cmd.id === second.id) throw new Error('Offline'); }, next => { saved = next; }), /Offline/);
  assert.deepEqual(sent, [first.id, second.id]);
  assert.equal(saved.pending.length, 1);
  await flushRecovery(saved, async cmd => sent.push(cmd.id), next => { saved = next; });
  assert.deepEqual(sent, [first.id, second.id, second.id]);
  assert.equal(saved.pending.length, 0);
  let currentAccount = true;
  await assert.rejects(flushRecovery({ ...saved, pending: [first] }, async () => { currentAccount = false; }, () => assert.fail('Must not save into another account'), () => currentAccount), /Account changed/);
});

test('season filters use game dates rather than upload dates and separate practice', () => {
  const sessions = [
    { type: 'game', date: '2026-01-01', created_at: '2026-09-30', tracker_context: { season: '25/26' } },
    { type: 'practice', date: '2026-01-02', tracker_context: { season: '25/26' } },
    { type: 'game', date: '2026-09-01', tracker_context: { season: '26/27' } },
  ];
  assert.deepEqual(filterSessionRecords(sessions, { type: 'game', season: '25/26', to: '2026-02-01' }), [sessions[0]]);
  assert.equal(filterSessionRecords(sessions, { from: '2026-09-01' }).length, 1);
});

test('period scoring honors corrected entries and never substitutes player scoring for a team result', () => {
  const first = command(0, { kind: 'shot', zone_id: 'three', made: true });
  const second = command(1, { kind: 'shot', zone_id: 'ft', made: true });
  const third = command(2, { kind: 'shot', zone_id: 'three', made: false }); third.payload.period = 5;
  const correction = command(3, { kind: 'reverse', target: first.id });
  const events = [first, second, third, correction].map(cmd => ({ id: cmd.id, payload: cmd.payload }));
  assert.deepEqual(recordedPeriodScoring(events, [{ id: 'three', pts: 3 }, { id: 'ft', pts: 1 }]), [
    { period: 1, points: 1, attempts: 1, made: 1 }, { period: 5, points: 0, attempts: 1, made: 0 },
  ]);
  assert.equal(recordedGameResult({ team_score: '', opponent_score: '' }), null);
  assert.equal(recordedGameResult({ team_score: '0', opponent_score: '2' }).outcome, 'Loss');
  assert.equal(recordedGameResult({ team_score: 'bad', opponent_score: '2' }), null);
});

test('a retried acknowledgement from a newer server version stops sync rather than hiding a competing edit', async () => {
  const first = command(0, { kind: 'stat', key: 'ast', delta: 1 });
  let persisted = false;
  await assert.rejects(flushRecovery({ snapshot: snapshot(), pending: [first] }, async () => ({ tracker_version: 3 }), () => { persisted = true; }), /SESSION_CONFLICT/);
  assert.equal(persisted, false);
});

test('Postgres ledger saves stats immediately, deduplicates retries, rejects stale edits and denies foreign accounts', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; insert into auth.users values ('${alice}'),('${bob}');`);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(`insert into players(id,firebase_uid,manager_uid,name) values ('${player}','${alice}_child','${alice}','Managed player');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20260930171602_web_player_ownership_safeguards.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20260930202201_reliable_sessions_and_development.sql', import.meta.url), 'utf8'));
    const sid = randomUUID();
    await db.exec(`insert into sessions(id,player_id,type,tracker_status) values ('${sid}','${player}','game','active');`);
    async function user(uid) { await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`); }
    async function send(cmd) {
      return (await db.query('select apply_session_command($1,$2,$3,$4) result', [sid, cmd.id, cmd.version, cmd.payload])).rows[0].result;
    }
    await user(alice);
    const ast = command(0, { kind: 'stat', key: 'ast', delta: 1 });
    assert.equal((await send(ast)).game_stats.ast, 1);
    assert.equal((await send(ast)).game_stats.ast, 1);
    await assert.rejects(send({ ...ast, payload: { ...ast.payload, delta: -1 } }), /reused/);
    await assert.rejects(send(command(0, { kind: 'stat', key: 'stl', delta: 1 })), /SESSION_CONFLICT/);
    const shot = command(1, { kind: 'shot', zone_id: 'top-key-3', made: true });
    await send(shot); await send(shot);
    assert.equal((await db.query('select count(*)::int n from shot_logs')).rows[0].n, 1);
    await assert.rejects(db.query(`update sessions set game_stats='{}' where id='${sid}'`), /versioned/);
    await assert.rejects(db.query(`insert into shot_logs(session_id,player_id,zone_id,made) values ('${sid}','${player}','paint',true)`), /row-level security/);
    assert.equal((await db.query(`delete from shot_logs where session_id='${sid}' returning id`)).rows.length, 0);
    await send(command(2, { kind: 'reverse', target: shot.id }));
    assert.equal((await db.query('select count(*)::int n from shot_logs')).rows[0].n, 0);
    await assert.rejects(send(command(3, { kind: 'reverse', target: shot.id })), /cannot be reversed/);
    await assert.rejects(send(command(3, { kind: 'shot', zone_id: 'invented', made: true })), /Invalid shot zone/);
    await user(bob);
    await assert.rejects(send(command(3, { kind: 'stat', key: 'ast', delta: 1 })), /unavailable/);
    assert.equal((await db.query('select * from session_commands')).rows.length, 0);
    await assert.rejects(db.query(`insert into workout_results(id,player_id,elapsed_seconds,drills) values (gen_random_uuid(),'${player}',20,'[{}]')`), /row-level security/);
    await user(alice);
    await send(command(3, { kind: 'end' }));
    await assert.rejects(send(command(4, { kind: 'stat', key: 'stl', delta: 1 })), /not active/);
    assert.equal((await db.query(`select tracker_status, game_stats->>'ast' ast from sessions where id='${sid}'`)).rows[0].ast, '1');
    await db.exec(`reset role; delete from auth.users where id='${alice}';`);
    assert.equal((await db.query('select count(*)::int n from session_commands')).rows[0].n, 0);
  } finally { await db.close(); }
});
