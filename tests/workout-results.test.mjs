import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/components/train/WorkoutTimer.jsx', import.meta.url), 'utf8');

test('a skipped drill records actual partial reps, not a completed target', () => {
  const body = source.match(/function recordDrill\(reps, skipped\) \{([\s\S]*?)\n  \}/)[1];
  const resultsRef = { current: [] };
  const fn = vm.runInNewContext(`((reps, skipped) => {${body}})`, { resultsRef, drill: { id: 'drill-1', name: 'Form shooting', reps: 10 } });
  fn(3, true);
  assert.equal(resultsRef.current[0].reps_completed, 3);
  assert.equal(resultsRef.current[0].target_reps, 10);
  assert.equal(resultsRef.current[0].skipped, true);
});

test('failed workout saving retains its result and retries with the same identifier', async () => {
  const body = source.match(/async function saveResult\(\) \{([\s\S]*?)\n  \}/)[1];
  const resultRef = { current: null };
  const savingRef = { current: false };
  const sent = [];
  let error;
  const fn = vm.runInNewContext(`(async () => {${body}})`, {
    savingRef, resultRef, persistResult: true, elapsed: 120,
    resultsRef: { current: [{ drill_id: 'drill-1', reps_completed: 3, skipped: true }] },
    crypto: { randomUUID: () => 'stable-workout-id' }, setSavingResult() {}, setSaveError(value) { error = value; },
    async onComplete(result) { sent.push(result); if (sent.length === 1) throw new Error('Offline'); },
  });
  await fn();
  assert.match(error, /did not save/);
  assert.equal(savingRef.current, false);
  await fn();
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1]);
  assert.equal(sent[1].id, 'stable-workout-id');
  assert.equal(sent[1].drills[0].skipped, true);
});

test('overlapping workout saves are ignored while the first request is pending', async () => {
  const body = source.match(/async function saveResult\(\) \{([\s\S]*?)\n  \}/)[1];
  let calls = 0;
  let release;
  const fn = vm.runInNewContext(`(async () => {${body}})`, {
    savingRef: { current: false }, resultRef: { current: { id: 'workout' } }, persistResult: true,
    setSavingResult() {}, setSaveError() {}, onComplete: () => { calls++; return new Promise(resolve => { release = resolve; }); },
  });
  const first = fn();
  await fn();
  assert.equal(calls, 1);
  release(); await first;
});
