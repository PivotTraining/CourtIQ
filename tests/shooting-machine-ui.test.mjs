import test from 'node:test';
import assert from 'node:assert/strict';
import * as machine from '../src/lib/shootingMachine.mjs';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';

const source = new URL('../src/components/train/ShootingMachinePractice.jsx', import.meta.url);

function visibleText(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return [value.props?.children].flat(Infinity).map(visibleText).join(' ').replace(/\s+/g, ' ').trim();
}
function button(h, label) {
  const found = findElement(h.output, node => node.type === 'button' && visibleText(node) === label);
  assert.ok(found, 'Missing button: ' + label);
  return found;
}
function input(h, value) {
  const found = findElement(h.output, node => node.type === 'input' && node.props.value === value);
  assert.ok(found, 'Missing input with value: ' + value);
  return found;
}
async function setup(onSave, accountId = 'family-a', playerId = 'caleb') {
  const memory = new Map();
  const storage = {
    getItem: k => memory.has(k) ? memory.get(k) : null,
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: k => memory.delete(k),
  };
  const h = reactHarness();
  let sequence = 0;
  const Video = () => null;
  const { default: Component } = await loadComponent(source, {
    react: h.react,
    '@/context/AuthContext': { useAuth: () => ({ user: { id: accountId } }) },
    '@/components/shots/SessionVideo': Video,
    './LiveShootingAnalyzer': () => null,
    '@/lib/browserDownload.mjs': { downloadBlob: () => {} },
    '@/lib/shootingMachine.mjs': machine,
  }, {
    crypto: { randomUUID: () => 'uuid-' + (++sequence) },
    window: { localStorage: storage, confirm: () => true },
    setInterval: () => 1, clearInterval: () => {}, Date,
  });
  h.render(Component, { playerId, records: [], canSave: true, onSave }); h.flush();
  return { h, memory, storage, Component, Video };
}

test('gym-side machine screen logs taps, accepts displayed sets and attaches film to a saved practice', async () => {
  const calls = [];
  const fixture = await setup(async result => {
    calls.push(result);
    return { ...result, player_id: 'caleb', completed_at: '2026-10-26T13:00:00Z' };
  });
  const { h, Video } = fixture;
  button(h, 'Start machine practice').props.onClick(); h.flush();
  assert.match(visibleText(h.output), /Choose a shooting location/);
  button(h, '+ Made').props.onClick(); h.flush();
  button(h, '+ Missed').props.onClick(); h.flush();
  // The batch counts a different shooting location, not a duplicate of tapped reps.
  const left = findElement(h.output, node => node.type === 'button' && visibleText(node).includes('Left wing 3'));
  assert.ok(left);
  left.props.onClick(); h.flush();
  input(h, '0').props.onChange({ target: { value: '12' } }); h.flush();
  input(h, '25').props.onChange({ target: { value: '20' } }); h.flush();
  const form = findElement(h.output, node => node.type === 'form');
  form.props.onSubmit({ preventDefault() {} }); h.flush();
  assert.match(visibleText(h.output), /22/); // two taps and 20 machine shots
  assert.match(visibleText(h.output), /13/); // 1 tapped make and 12 machine makes
  await button(h, 'Finish and save practice').props.onClick(); await h.settle();
  assert.equal(calls.length, 1);
  const drill = calls[0].drills[0];
  assert.equal(drill.reps_completed, 22);
  assert.equal(drill.successful_reps, 13);
  assert.equal(drill.machine.entries.length, 3);
  assert.equal(drill.machine.entries[2].zone, 'left-wing');
  assert.ok(findElement(h.output, node => node.type === Video));
  assert.match(visibleText(h.output), /Session saved/);
});

test('lost save confirmation reuses immutable ID and payload, and never creates game stats', async () => {
  const attempts = [];
  const { h, memory } = await setup(async result => {
    attempts.push(result);
    if (attempts.length === 1) throw new Error('Offline');
    return { ...result, player_id: 'caleb' };
  });
  button(h, 'Start machine practice').props.onClick(); h.flush();
  button(h, '+ Made').props.onClick(); h.flush();
  await button(h, 'Finish and save practice').props.onClick(); await h.settle();
  assert.match(visibleText(h.output), /Offline/);
  assert.ok(memory.has(machine.machineDraftKey('family-a', 'caleb')));
  assert.ok(JSON.parse(memory.get(machine.machineDraftKey('family-a', 'caleb'))).frozenResult);
  assert.ok(button(h, '+ Made').props.disabled);
  await button(h, 'Retry same saved result').props.onClick(); await h.settle();
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0], attempts[1]);
  assert.ok(!('game_stats' in attempts[1]));
  assert.equal(memory.has(machine.machineDraftKey('family-a', 'caleb')), false);
  assert.match(visibleText(h.output), /Session saved/);
});

test('player switch does not display previous child machine draft', async () => {
  const { h, Component, memory } = await setup(async result => ({ ...result, player_id: 'caleb' }));
  button(h, 'Start machine practice').props.onClick(); h.flush();
  button(h, '+ Made').props.onClick(); h.flush();
  const firstKey = machine.machineDraftKey('family-a', 'caleb');
  assert.ok(memory.has(firstKey));
  h.render(Component, { playerId: 'jaxon', records: [], canSave: true, onSave: async result => ({ ...result, player_id: 'jaxon' }) });
  h.flush();
  assert.ok(memory.has(firstKey));
  assert.ok(memory.has(machine.machineDraftKey('family-a', 'jaxon')));
  button(h, 'Start machine practice').props.onClick(); h.flush();
  assert.match(visibleText(h.output), /Attempts/);
  assert.equal(button(h, '+ Made').props.disabled, false);
  assert.ok(!visibleText(h.output).includes('1 recorded entries'));
});
