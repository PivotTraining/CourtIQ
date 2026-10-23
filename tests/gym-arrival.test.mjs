import test from 'node:test';
import assert from 'node:assert/strict';
import { gymArrivalTransition, GYM_COOLDOWN_MS, safeCustomGyms,
  gymPreferenceKey, gymCustomKey } from '../src/lib/gymArrival.mjs';

const site = { id: 'north', name: 'Sample High School', lat: 34.0, lon: -84.0 };
const outside = { lat: 34.01, lon: -84 };
const inside = { lat: 34.0002, lon: -84.0 };

test('nearby campus entry triggers once; staying inside does not spam', () => {
  const first = gymArrivalTransition({}, [site], outside, 10000000);
  assert.equal(first.arrival, null);
  const entry = gymArrivalTransition(first.state, [site], inside, 10000001);
  assert.equal(entry.arrival.name, site.name);
  const repeat = gymArrivalTransition(entry.state, [site], inside, 10000100);
  assert.equal(repeat.arrival, null);
  assert.equal(repeat.state.insideId, site.id);
});

test('boundary jitter does not retrigger and cooldown survives exits and reloads', () => {
  const now = 10000000;
  const entered = gymArrivalTransition({}, [site], inside, now);
  const jitter = gymArrivalTransition(entered.state, [site], { lat: 34.0031, lon: -84 }, now + 5);
  assert.equal(jitter.arrival, null);
  assert.equal(jitter.state.insideId, site.id);
  const departed = gymArrivalTransition(jitter.state, [site], outside, now + 1000);
  assert.equal(departed.state.insideId, null);
  const returning = gymArrivalTransition(JSON.parse(JSON.stringify(departed.state)), [site], inside, now + 2000);
  assert.equal(returning.arrival, null);
  const leftAgain = gymArrivalTransition(returning.state, [site], outside, now + 3000);
  assert.equal(gymArrivalTransition(leftAgain.state, [site], inside, now + GYM_COOLDOWN_MS + 1).arrival?.id, site.id);
});

test('invalid GPS values never create a fabricated arrival', () => {
  for (const position of [null, {}, { lat: 34 }, { lat: 'oops', lon: -84 }]) {
    assert.equal(gymArrivalTransition({}, [site], position).arrival, null);
  }
});

test('custom gyms are bounded and account preferences are namespaced', () => {
  assert.notEqual(gymPreferenceKey('a'), gymPreferenceKey('b'));
  assert.notEqual(gymCustomKey('a'), gymCustomKey('b'));
  const raw = [{ id: 'custom-1', name: 'AAU gym', lat: 34, lon: -84 },
    { id: 'custom-2', name: 'invalid', lat: 140, lon: -84 },
    { id: 'public-3', name: 'spoof', lat: 34, lon: -84 }];
  assert.deepEqual(safeCustomGyms(raw).map(gym => gym.name), ['AAU gym']);
});

test('one-tap entry and opt-in UI are wired without creating a session on every shell render', async () => {
  const { readFile } = await import('node:fs/promises');
  const shell = await readFile(new URL('../src/components/Shell.jsx', import.meta.url), 'utf8');
  const legacy = await readFile(new URL('../src/components/shots/ShotLogger.jsx', import.meta.url), 'utf8');
  const reliable = await readFile(new URL('../src/components/shots/ReliableTracker.jsx', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../src/components/settings/GymArrivalSettings.jsx', import.meta.url), 'utf8');
  assert.match(shell, /<ShotLogger quickStart/);
  assert.match(legacy, /startSession\('game'\)/);
  assert.match(reliable, /const previous = games.find\(game => game.type === 'game'\)/);
  assert.match(reliable, /local.pending.length > 0/);
  assert.match(settings, /await getPosition\(\); \/\/ Request permission only/);
  assert.match(settings, /window.localStorage.removeItem\(gymPreferenceKey\(accountId\)\)/);
});
