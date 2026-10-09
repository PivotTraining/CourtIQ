import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DRILL_BANK, DRILL_CATEGORIES } from '../src/lib/drillBank.js';
import * as policy from '../src/lib/skillPractice.mjs';
import { deferred, findElement, loadComponent, reactHarness } from './helpers/reactHarness.mjs';
const shooting = DRILL_BANK.find(drill => drill.id === 'form-shooting-close');
const sourceUrl = new URL('../src/components/train/SkillsScreen.jsx', import.meta.url);

test('every skill has a real guided drill and every library drill has usable instructions', () => {
  assert.deepEqual(new Set(policy.FEATURED_IDS.map(id => DRILL_BANK.find(drill => drill.id === id)?.category)), new Set(DRILL_CATEGORIES.map(cat => cat.id)));
  for (const drill of DRILL_BANK) {
    assert.ok(policy.practiceGuide(drill).steps.length > 0, drill.id);
    assert.ok(drill.reps > 0);
    if (policy.GUIDED_DRILLS[drill.id]) for (const step of policy.practiceGuide(drill).steps) assert.equal(step.length, 4);
  }
});
test('skill results retain misses, partial reps and self-recorded metadata without game-stat mutations', () => {
  const result = policy.skillResult({ drill: shooting, outcomes: [true, false, false], elapsedSeconds: 14.9, id: 'retry-id' });
  assert.equal(result.elapsed_seconds, 14);
  assert.equal(result.drills[0].successful_reps, 1);
  assert.equal(result.drills[0].reps_completed, 3);
  assert.equal(result.drills[0].skipped, true);
  assert.equal(policy.recordedPractice(result.drills[0]).rate, 33);
  assert.ok(!('game_stats' in result));
  for (const outcomes of [[], [1], Array(31).fill(true)]) assert.throws(() => policy.skillResult({ drill: shooting, outcomes, elapsedSeconds: 5, id: 'id' }));
  assert.equal(policy.recordedPractice({ ...result.drills[0], successful_reps: 4 }), null);
});
test('older workouts contribute volume but never invented accuracy; duplicate results are not double-counted', () => {
  const legacy = { id: 'old', completed_at: '2026-10-01', drills: [{ drill_id: shooting.id, target_reps: 30, reps_completed: 12, skipped: true }] };
  const result = { ...policy.skillResult({ drill: shooting, outcomes: Array(30).fill(false), elapsedSeconds: 120, id: 'new' }), completed_at: '2026-10-02' };
  const history = policy.practiceHistory([legacy, result, result], DRILL_BANK);
  assert.equal(history.categories.shooting.reps, 42);
  assert.equal(history.categories.shooting.sessions, 2);
  assert.equal(history.entries.length, 1);
  assert.equal(history.entries[0].rate, 0);
  assert.equal(policy.previousPractice(history.entries, shooting).rate, 0);
  assert.equal(policy.previousPractice(history.entries, shooting, 25), null);
});
test('bad counts, dates, unknown drills and partial practices cannot manufacture completed-target comparisons', () => {
  const partial = { ...policy.skillResult({ drill: shooting, outcomes: [true], elapsedSeconds: 10, id: 'partial' }), completed_at: '2026-10-02' };
  const bad = { ...partial, id: 'bad', drills: [{ ...partial.drills[0], reps_completed: 999 }] };
  const history = policy.practiceHistory([partial, bad, { ...partial, id: 'invalid', completed_at: 'wrong' }], DRILL_BANK);
  assert.equal(history.categories.shooting.reps, 1);
  assert.equal(policy.previousPractice(history.entries, shooting), null);
});

function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return [tree?.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ');
}
function button(h, name) { return findElement(h.output, node => node.type === 'button' && text(node).trim() === name); }
async function workspace(loadResults = async () => [], saveResult = async (player, result) => ({ ...result, player_id: player })) {
  const h = reactHarness();
  const dependencies = { react: h.react, '@/context/AppContext': { useApp: () => ({ playerId: 'alice' }) },
    '@/lib/drillBank': { DRILL_BANK, DRILL_CATEGORIES, SKILL_LEVELS: [{ id: 'beginner', label: 'Beginner' }] }, '@/lib/skillPractice.mjs': policy,
    '@/lib/queries': {}, '@/components/ui/Icons': () => null, './DrillWalkthrough': () => null, './SkillPracticeSession': () => null };
  const loaded = await loadComponent(sourceUrl, dependencies, { process: { env: {} }, AbortController, setTimeout: () => 1, clearTimeout() {} });
  h.render(loaded.SkillsWorkspace, { playerId: 'alice', preview: true, loadResults, saveResult });
  await h.settle();
  return { h, dependencies, loaded };
}
test('actual skills screen launches an actionable practice, saves to the current player and updates history', async () => {
  let sent;
  const { h, dependencies } = await workspace(undefined, async (owner, result) => { sent = { owner, result }; return { ...result, player_id: owner, completed_at: '2026-10-08' }; });
  button(h, 'Start practice').props.onClick(); h.flush();
  const session = findElement(h.output, node => node.type === dependencies['./SkillPracticeSession']);
  assert.equal(session.props.canSave, true);
  const result = policy.skillResult({ drill: session.props.drill, outcomes: [true, false], elapsedSeconds: 2, id: 'save-id' });
  await session.props.onSave(result); h.flush();
  assert.equal(sent.owner, 'alice');
  assert.equal(sent.result.id, 'save-id');
  assert.match(text(h.output), /Saved Stationary Crossover/);
  session.props.onClose(); h.flush();
  button(h, 'My progress').props.onClick(); h.flush();
  assert.match(text(h.output), /50\s*%/);
});
test('history errors do not masquerade as zero progress or enable storage', async () => {
  const { h, dependencies } = await workspace(async () => { throw new Error('RLS unavailable'); });
  assert.match(text(h.output), /history could not be loaded/);
  button(h, 'Start practice').props.onClick(); h.flush();
  assert.equal(findElement(h.output, node => node.type === dependencies['./SkillPracticeSession']).props.canSave, false);
  button(h, 'My progress').props.onClick(); h.flush();
  assert.match(text(h.output), /Progress is unavailable/);
});
test('late history reads and saves cannot update a departed player; workspace is keyed by player', async () => {
  const pending = deferred();
  const { h, loaded } = await workspace(() => pending.promise);
  h.unmount(); pending.resolve([]); await h.settle();
  assert.deepEqual(h.changes, []);
  const screen = loaded.default();
  assert.equal(screen.key, 'alice');
  const save = deferred();
  const second = await workspace(undefined, () => save.promise);
  button(second.h, 'Start practice').props.onClick(); second.h.flush();
  const session = findElement(second.h.output, node => node.type === second.dependencies['./SkillPracticeSession']);
  const result = policy.skillResult({ drill: session.props.drill, outcomes: [true], elapsedSeconds: 1, id: 'late-id' });
  const writing = session.props.onSave(result); second.h.unmount(); save.resolve({ ...result, player_id: 'alice' }); await writing;
  assert.deepEqual(second.h.changes, []);
});
async function practice(save = async () => {}, canSave = true) {
  const h = reactHarness(); let closed = 0;
  const { default: Session } = await loadComponent(new URL('../src/components/train/SkillPracticeSession.jsx', import.meta.url), { react: h.react, '@/lib/skillPractice.mjs': policy }, {
    Date, crypto: { randomUUID: () => 'stable-id' }, setInterval: () => 1, clearInterval() {}, window: { confirm: () => true },
  });
  h.render(Session, { drill: { ...shooting, reps: 3 }, canSave, onSave: save, onClose: () => { closed++; } }); h.flush();
  const click = name => { const item = button(h, name); assert.ok(item, name); if (!item.props.disabled) item.props.onClick(); h.flush(); };
  return { h, click, get closed() { return closed; } };
}
test('practice counts all attempts, undo and pause work, and repeated taps cannot exceed the target', async () => {
  const p = await practice();
  p.click('+ Made'); p.click('+ Missed'); p.click('Undo last'); p.click('Pause timer');
  assert.equal(button(p.h, '+ Made').props.disabled, true);
  p.click('Resume timer'); p.click('+ Missed'); p.click('+ Made');
  assert.equal(button(p.h, '+ Made').props.disabled, true);
  p.click('Finish practice');
  assert.match(text(p.h.output), /67\s*%/);
  assert.match(text(p.h.output), /2 of 3/);
});
test('failed saves retain a stable immutable result and suppress overlapping writes', async () => {
  const sent = [], pending = deferred();
  const p = await practice(async result => { sent.push(result); if (sent.length === 1) throw new Error('offline'); return pending.promise; });
  p.click('+ Made'); p.click('Finish with recorded reps');
  await button(p.h, 'Save practice result').props.onClick(); await p.h.settle();
  assert.equal(p.closed, 0); assert.match(text(p.h.output), /Saving was not confirmed/);
  const retry = button(p.h, 'Retry saving result').props.onClick;
  const first = retry(); await retry(); p.h.flush();
  assert.equal(sent.length, 2); assert.equal(sent[0], sent[1]); assert.equal(sent[0].id, 'stable-id');
  pending.resolve(); await first; await p.h.settle(); assert.equal(p.closed, 1);
});
test('save finishing after unmount cannot dismiss another session', async () => {
  const pending = deferred(); const p = await practice(() => pending.promise);
  p.click('+ Made'); p.click('Finish with recorded reps');
  const saving = button(p.h, 'Save practice result').props.onClick(); p.h.flush(); p.h.unmount();
  pending.resolve(); await saving;
  assert.equal(p.closed, 0); assert.deepEqual(p.h.changes, []);
});
test('local skill preview cannot become a production auth bypass', async () => {
  const { default: page } = await loadComponent(new URL('../src/app/dev/skills/page.jsx', import.meta.url), { 'next/navigation': { notFound: () => { throw new Error('404'); } }, './SkillsPreview': () => null }, { process: { env: { NODE_ENV: 'production', COURTIQ_LOCAL_PREVIEW: 'true' } } });
  assert.throws(page, /404/);
  const css = await readFile(new URL('../src/components/train/skills.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion:reduce/);
});
