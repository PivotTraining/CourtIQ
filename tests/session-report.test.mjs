import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildSessionReport, percent, sessionReportCsv } from '../src/lib/sessionReport.mjs';

const zones = [
  { id: 'paint', pts: 2, label: 'Paint' }, { id: 'top-key-3', pts: 3, label: 'Top Key 3' },
  { id: 'free-throw', pts: 1, label: 'Free Throw' },
];
const shot = (zone_id, made) => ({ zone_id, made });
const logs = [shot('paint', true), shot('paint', false), shot('top-key-3', true), shot('top-key-3', false), shot('free-throw', true), shot('free-throw', false)];

test('FT ledger is excluded from FGA and counted once in points, even with a saved summary', () => {
  const report = buildSessionReport(logs, { ft_made: 1, ft_total: 2, ast: 3, reb: 4, stl: 1, blk: 2, to: 2, min: 12 }, zones);
  assert.equal(report.fga, 4);
  assert.equal(report.fgm, 2);
  assert.equal(report.pts, 6);
  assert.equal(report.fgPct, 50);
  assert.equal(report.efgPct, 62.5);
  assert.ok(Math.abs(report.tsPct - 6 / (2 * (4 + 0.44 * 2)) * 100) < 0.000001);
  assert.equal(report.pointsPerFga, 1.25);
  assert.equal(report.astTo, 1.5);
  assert.equal(report.pointsPer36, 18);
  assert.equal(report.eff, 11);
  assert.equal(report.zones.length, 2);
});

test('live recap and reopened history derive identical shooting values', () => {
  const stats = { ft_made: 1, ft_total: 2 };
  const live = buildSessionReport(logs.filter(log => log.zone_id !== 'free-throw'), stats, zones, logs.filter(log => log.zone_id === 'free-throw'));
  const reopened = buildSessionReport(logs, stats, zones);
  assert.deepEqual(live, reopened);
});

test('older summary-only FT data is supported and inconsistent summary cannot exceed attempts', () => {
  assert.equal(buildSessionReport([shot('paint', true)], { ft_made: 2, ft_total: 3 }, zones).pts, 4);
  assert.equal(buildSessionReport([], { ft_made: 8, ft_total: 3 }, zones).ftm, 3);
  assert.equal(buildSessionReport([], { ft_made: 2, ft_total: 3 }, zones, []).fta, 0);
});

test('no attempts and no minutes mean unavailable metrics, while actual misses mean zero', () => {
  const empty = buildSessionReport([], {}, zones);
  for (const key of ['fgPct', 'twoPct', 'threePct', 'ftPct', 'efgPct', 'tsPct', 'pointsPer36', 'astTo']) assert.equal(empty[key], null);
  assert.equal(percent(empty.fgPct), '—');
  assert.equal(buildSessionReport([shot('paint', false)], {}, zones).efgPct, 0);
  const ftOnly = buildSessionReport([shot('free-throw', true)], {}, zones);
  assert.equal(ftOnly.pts, 1);
  assert.equal(ftOnly.fga, 0);
  assert.equal(ftOnly.efgPct, null);
  assert.ok(Number.isFinite(ftOnly.tsPct));
});

test('unknown zones are excluded rather than invented as two-point makes', () => {
  const report = buildSessionReport([shot('bad-zone', true)], {}, zones);
  assert.equal(report.pts, 0);
  assert.equal(report.fga, 0);
  assert.equal(report.unknownShots, 1);
});

test('export includes denominators, interpretation, zones and undefined-ratio handling', () => {
  const csv = sessionReportCsv(buildSessionReport(logs, { ast: 2 }, zones), { type: 'game' });
  assert.match(csv, /"FGA","4"/);
  assert.match(csv, /"2 AST \/ 0 TO \(ratio undefined\)"/);
  assert.match(csv, /0.44/);
  assert.match(csv, /"Paint","1","2","50.0%"/);
  assert.doesNotMatch(csv, /NaN|Infinity/);
  assert.doesNotMatch(sessionReportCsv(buildSessionReport([], {}, zones), { type: 'practice' }), /PTS per 36/);
});

test('minutes subtraction can be undone, and stat writes are blocked while saving', async () => {
  const source = await readFile(new URL('../src/components/shots/ShotLogger.jsx', import.meta.url), 'utf8');
  const update = source.match(/const updateStat = \(key, delta\) => \{([\s\S]*?)\n  \};/)[1];
  let stats = { min: 3 };
  let stack = [];
  const pendingWrite = { current: false };
  const fn = vm.runInNewContext(`((key, delta) => {${update}})`, { pendingWrite, ending: false, gameStats: stats, haptic() {}, playTap() {}, setGameStats: change => { stats = change(stats); }, setUndoStack: change => { stack = change(stack); } });
  fn('min', -1);
  assert.equal(stats.min, 2);
  assert.equal(stack[0].delta, -1);
  pendingWrite.current = true;
  fn('min', 1);
  assert.equal(stats.min, 2);
  const undo = source.match(/const undoLast = async \(\) => \{([\s\S]*?)\n  \};/)[1];
  pendingWrite.current = false;
  await vm.runInNewContext(`(async () => {${undo}})`, { pendingWrite, saving: false, ending: false, undoStack: stack, setSaving() {}, setSaveError() {}, setGameStats: change => { stats = change(stats); }, setUndoStack: change => { stack = change(stack); } })();
  assert.equal(stats.min, 3);
  assert.equal(stack.length, 0);
});
