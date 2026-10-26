import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MACHINE_DRILL_ID, MACHINE_VERSION, MACHINE_ZONES, machineCsv, machineDraftKey,
  machineHistory, machineSummary, machineWorkoutResult, newMachineDraft,
} from '../src/lib/shootingMachine.mjs';

const sample = (zone, makes, attempts, source = 'machine-display') =>
  ({ id: zone + ':' + makes + ':' + attempts, zone, style: zone === 'free-throw' ? 'free-throw' : 'catch-shoot',
    makes, attempts, source });
const draft = () => ({ ...newMachineDraft('session-1', '2026-10-26T13:00:00Z'),
  target: 60, machine: 'Shooting machine', focus: 'Five spots',
  elapsed: 1320, entries: [
    sample('left-wing', 18, 25), sample('top-three', 11, 25), sample('free-throw', 8, 10),
  ] });

test('machine and manually tapped shots produce exact location and type percentages', () => {
  const input = [...draft().entries, sample('paint', 1, 1, 'tap')];
  const totals = machineSummary(input);
  assert.deepEqual([totals.attempts, totals.makes, totals.misses, totals.pct], [61, 38, 23, 62]);
  assert.deepEqual([totals.threes.attempts, totals.threes.makes, totals.threes.pct], [50, 29, 58]);
  assert.deepEqual([totals.twos.attempts, totals.twos.makes, totals.twos.pct], [1, 1, 100]);
  assert.deepEqual([totals.freeThrows.attempts, totals.freeThrows.makes, totals.freeThrows.pct], [10, 8, 80]);
  assert.equal(totals.perZone.find(row => row.id === 'left-wing').pct, 72);
  assert.equal(totals.perZone.find(row => row.id === 'right-wing').pct, null);
  assert.equal(totals.populatedZones.length, 4);
});

test('all zone names are distinct and carry only supported point categories', () => {
  assert.equal(MACHINE_ZONES.length, new Set(MACHINE_ZONES.map(zone => zone.id)).size);
  assert.ok(MACHINE_ZONES.every(zone => [1, 2, 3].includes(zone.pts)));
});

test('invalid makes, zero attempts, malicious invalid zones, or excessive batches cannot be used', () => {
  for (const row of [
    sample('left-wing', 26, 25), sample('left-wing', -1, 25), sample('left-wing', 0, 0),
    sample('left-wing', 1.5, 25), sample('left-wing', 10, 501), sample('not-a-zone', 1, 1),
    { ...sample('paint', 1, 1), source: 'auto-camera' },
  ]) assert.throws(() => machineSummary([row]), /invalid/);
  assert.deepEqual(machineSummary([]).attempts, 0);
});

test('practice workout persists zone-set evidence and cannot be mistaken for game stats', () => {
  const result = machineWorkoutResult(draft());
  assert.equal(result.id, 'session-1');
  assert.equal(result.elapsed_seconds, 1320);
  assert.equal(result.drills.length, 1);
  assert.equal(result.drills[0].drill_id, MACHINE_DRILL_ID);
  assert.equal(result.drills[0].practice_version, MACHINE_VERSION);
  assert.equal(result.drills[0].successful_reps, 37);
  assert.equal(result.drills[0].reps_completed, 60);
  assert.equal(result.drills[0].skipped, false);
  assert.equal(result.drills[0].machine.entries.length, 3);
  assert.equal(result.drills[0].machine.entries[0].zone, 'left-wing');
  assert.equal(result.drills[0].machine.name, 'Shooting machine');
  assert.ok(!('game_stats' in result));
  assert.ok(!('player_id' in result));
});

test('practice target may be unfinished without faking a completed workout', () => {
  const input = { ...draft(), target: 100 };
  const result = machineWorkoutResult(input);
  assert.equal(result.drills[0].target_reps, 100);
  assert.equal(result.drills[0].reps_completed, 60);
  assert.equal(result.drills[0].skipped, true);
  assert.throws(() => machineWorkoutResult({ ...draft(), entries: [] }), /at least one/);
});

test('machine trend loads only valid, consistent saved workouts', () => {
  const workout = machineWorkoutResult(draft());
  const row = { ...workout, completed_at: '2026-10-26T13:40:00Z',
    drills: [{ ...workout.drills[0], machine: {
      ...workout.drills[0].machine, entries: [...workout.drills[0].machine.entries],
    } }] };
  const history = machineHistory([row, row,
    { ...row, id: 'bad', drills: [{ ...workout.drills[0], successful_reps: 300 }] },
    { ...row, id: 'wrong-version', drills: [{ ...workout.drills[0], practice_version: 'other' }] }]);
  assert.equal(history.length, 1);
  assert.equal(history[0].attempts, 60);
  assert.equal(history[0].makes, 37);
  assert.equal(history[0].pct, 62);
});

test('draft keys keep each child separate across parent accounts', () => {
  assert.notEqual(machineDraftKey('parent-a', 'caleb'), machineDraftKey('parent-a', 'jaxon'));
  assert.notEqual(machineDraftKey('parent-a', 'caleb'), machineDraftKey('parent-b', 'caleb'));
  assert.throws(() => machineDraftKey('', 'caleb'));
});

test('CSV retains all recorded sets, escapes quotes, and protects spreadsheet formula fields', () => {
  const input = { ...draft(), machine: '=BADCOMMAND', focus: 'Catch "and" shoot' };
  const csv = machineCsv(input);
  assert.equal(csv.split('\r\n').filter(Boolean).length, 5);
  assert.ok(csv.includes("'=BADCOMMAND"));
  assert.ok(csv.includes('Catch ""and"" shoot'));
  assert.ok(csv.includes('"TOTAL"'));
  assert.ok(csv.includes('"37","60","62%"'));
});

test('UI exposes account save gating, manual-entry methods, video attachment, and no automatic accuracy claims', async () => {
  const component = await readFile(new URL('../src/components/train/ShootingMachinePractice.jsx', import.meta.url), 'utf8');
  const skills = await readFile(new URL('../src/components/train/SkillsScreen.jsx', import.meta.url), 'utf8');
  assert.match(component, /machineWorkoutResult\(draft\)/);
  assert.match(component, /stored\?\.id !== result\.id \|\| stored\.player_id !== playerId/);
  assert.match(component, /'machine-display'/);
  assert.match(component, /'tap'/);
  assert.match(component, /<SessionVideo/);
  assert.match(component, /never changes game statistics/);
  assert.match(skills, /<ShootingMachinePractice/);
});
