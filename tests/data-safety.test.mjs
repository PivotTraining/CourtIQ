import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { checked, readAll, requireSavedRow } from '../src/lib/dataSafety.mjs';
import { selectPlayer } from '../src/lib/playerSelection.mjs';

test('auth expiry preserves queued entries but clears synced recovery for the departing account', async () => {
  const source = await readFile(new URL('../src/context/AuthContext.jsx', import.meta.url), 'utf8');
  const body = source.match(/onAuthStateChange\(\(_event, session\) => \{([\s\S]*?)\n    \}\);/)[1];
  const cleared = [];
  let pending = true;
  const accepted = [];
  const callback = vm.runInNewContext(`((_event, session) => {${body}})`, {
    window: { localStorage: {} }, identity: { current: 'alice' }, active: true, authRevision: 0,
    hasPendingRecovery: () => pending, clearAccountRecovery: (_storage, id) => cleared.push(id),
    acceptSession: session => accepted.push(session),
  });
  callback('SIGNED_OUT', null);
  assert.deepEqual(cleared, []);
  pending = false; callback('SIGNED_OUT', null);
  assert.deepEqual(cleared, ['alice']);
  assert.equal(accepted.length, 2);
});

test('pagination continues after capped pages and fails rather than returning partial statistics', async () => {
  const ranges = [];
  const records = Array.from({ length: 1005 }, (_, id) => ({ id }));
  const all = await readAll(() => ({ range: async (start, end) => {
    ranges.push([start, end]);
    return { data: records.slice(start, Math.min(end + 1, start + 200)), error: null };
  } }));
  assert.equal(all.length, 1005);
  assert.deepEqual(ranges[1], [200, 699]);
  await assert.rejects(readAll(() => ({ range: async () => ({ data: null, error: new Error('Permission denied') }) })), /Permission denied/);
  assert.throws(() => checked({ data: [], error: new Error('Denied') }), /Denied/);
  assert.throws(() => requireSavedRow({ data: null, error: null }, 'Update'), /not saved/);
});

test('active player preference only resolves among the signed-in managers returned players', () => {
  const players = [{ id: 'primary', firebase_uid: 'owner' }, { id: 'child', firebase_uid: 'owner_child' }];
  assert.equal(selectPlayer(players, 'owner', 'child').id, 'child');
  assert.equal(selectPlayer(players, 'owner', 'foreign').id, 'primary');
  assert.equal(selectPlayer(players.slice(1), 'owner', null).id, 'child');
  assert.equal(selectPlayer([], 'owner', 'child'), null);
});

test('history independently paginates more than fifty sessions and capped shot ledgers, excluding active games', async () => {
  const source = await readFile(new URL('../src/lib/queries.js', import.meta.url), 'utf8');
  const handler = source.match(/export async function fetchSessionHistory\(playerId\) \{([\s\S]*?)\n\}/)[1];
  const sessions = Array.from({ length: 75 }, (_, id) => ({ id: `session-${id}`, tracker_status: id === 74 ? 'active' : 'completed' }));
  const shots = Array.from({ length: 1105 }, (_, id) => ({ id, session_id: `session-${id % 75}`, zone_id: 'paint', made: false }));
  const fn = vm.runInNewContext(`(async (playerId) => {${handler}})`, {
    readAll, getSupabase: () => ({ from(table) { const rows = table === 'sessions' ? sessions : shots;
      return { select() { return this; }, eq() { return this; }, order() { return this; }, range: async (start, end) => ({ data: rows.slice(start, Math.min(end + 1, start + 200)), error: null }) }; } }),
  });
  const rows = await fn('player');
  assert.equal(rows.length, 74);
  assert.equal(rows.flatMap(row => row.shot_logs).length, shots.filter(shot => shot.session_id !== 'session-74').length);
});

test('failed journal save leaves draft, statistics, and form untouched', async () => {
  const source = await readFile(new URL('../src/components/journal/JournalScreen.jsx', import.meta.url), 'utf8');
  const handler = source.match(/const handleSave = async \(\) => \{([\s\S]*?)\n  \};/)[1];
  let error;
  const destructiveChanges = [];
  const fn = vm.runInNewContext(`(async () => {${handler}})`, {
    saving: false, newEntry: { title: 'My draft', body: 'Keep my notes', type: 'practice' }, stats: {},
    setSaving() {}, setSaveError: value => { error = value; },
    addJournalEntry: async () => { throw new Error('Offline'); },
    setNewEntry: () => destructiveChanges.push('draft'), setStats: () => destructiveChanges.push('stats'),
    setShowNew: () => destructiveChanges.push('form'),
  });
  await fn();
  assert.deepEqual(destructiveChanges, []);
  assert.match(error, /draft is still here/);
});

test('player deletion makes only one checked delete request, never partial client cleanup', async () => {
  const source = await readFile(new URL('../src/lib/queries.js', import.meta.url), 'utf8');
  const handler = source.match(/export async function deleteManagedPlayer\(playerId\) \{([\s\S]*?)\n\}/)[1];
  const tables = [];
  const chain = { delete() { return this; }, eq() { return this; }, select() { return this; },
    single: async () => ({ data: null, error: new Error('Blocked') }) };
  const fn = vm.runInNewContext(`(async (playerId) => {${handler}})`, {
    requireSavedRow, getSupabase: () => ({ from: table => { tables.push(table); return chain; } }),
  });
  await assert.rejects(fn('child'), /Blocked/);
  assert.deepEqual(tables, ['players']);
});

test('failed session completion keeps the tracker open and does not show a saved recap', async () => {
  const source = await readFile(new URL('../src/components/shots/ShotLogger.jsx', import.meta.url), 'utf8');
  const handler = source.match(/const endSession = async \(\) => \{([\s\S]*?)\n  \};/)[1];
  const transitions = [];
  let error;
  const pendingWrite = { current: false };
  const fn = vm.runInNewContext(`(async () => {${handler}})`, {
    pendingWrite, saving: false, ending: false, playWhistle() {}, setEnding() {},
    session: { id: 'session' }, shots: [], freeThrows: [], COURT_ZONES: [], gameStats: {}, focus: '',
    updateSessionStats: async () => { throw new Error('Denied'); },
    refreshData: async () => transitions.push('refresh'), setStep: () => transitions.push('summary'),
    onClose: () => transitions.push('close'), setSaveError: message => { error = message; }, console: { error() {} },
  });
  await fn();
  assert.deepEqual(transitions, []);
  assert.match(error, /didn't save/);
  assert.equal(pendingWrite.current, false);
});

test('failed undo leaves shot and undo stack intact', async () => {
  const source = await readFile(new URL('../src/components/shots/ShotLogger.jsx', import.meta.url), 'utf8');
  const handler = source.match(/const undoLast = async \(\) => \{([\s\S]*?)\n  \};/)[1];
  const changes = [];
  let error;
  const fn = vm.runInNewContext(`(async () => {${handler}})`, {
    pendingWrite: { current: false }, saving: false, ending: false, undoStack: [{ type: 'shot', id: 'shot' }],
    setSaving() {}, setSaveError: message => { error = message; },
    deleteShot: async () => { throw new Error('Offline'); }, setShots: () => changes.push('shots'),
    setFreeThrows: () => changes.push('free throws'), setGameStats: () => changes.push('stats'), setUndoStack: () => changes.push('undo'),
  });
  await fn();
  assert.deepEqual(changes, []);
  assert.match(error, /shot is still in your record/);
});
