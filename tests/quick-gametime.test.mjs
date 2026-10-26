import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';

const componentURL = new URL('../src/components/shots/ReliableTracker.jsx', import.meta.url);

async function fixture({ active = [], local = null } = {}) {
  const h = reactHarness(), calls = [], stored = new Map();
  const TrackerView = () => null, GameDetails = () => null;
  const backend = {
    async fetchActiveSessions() { calls.push('list'); return active; },
    async fetchTrackerSession(id) { calls.push(`fetch:${id}`); return {
      session: { id, date: '2026-10-23', type: 'game', tracker_status: 'active',
        tracker_version: 0, game_stats: {}, tracker_context: { date: '2026-10-23' } },
      shots: [], events: [],
    }; },
    async createTrackerSession(_playerId, type, context) { calls.push(`create:${type}`); return {
      id: 'new-game', type, date: context.date, tracker_status: 'active',
      tracker_context: context, tracker_version: 0, game_stats: {},
    }; },
    async applySessionCommand() { throw new Error('Not expected during startup'); },
  };
  const deps = {
    react: h.react,
    '@/context/AppContext': { useApp: () => ({}) },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: 'account' } }) },
    '@/lib/queries': {},
    '@/lib/sessionRecovery.mjs': {
      EMPTY_GAME_STATS: {}, loadRecovery: () => local, saveRecovery: (_storage, _account, _player, data) => stored.set('recovery', data),
      projectCommand() {}, flushRecovery() {}, recoveryKey() { return 'key'; },
      recordedPeriodScoring: () => [], recordedGameResult: () => null,
    },
    '@/lib/constants': { COURT_ZONES: [] },
    '@/lib/sessionReport.mjs': { buildSessionReport: () => ({ pts: 0, fgm: 0, fga: 0, ftm: 0, fta: 0 }) },
    '@/lib/liveEntryQueue.mjs': {drainLiveEntries:async()=>true},
    '@/lib/rebasePendingGame.mjs': {rebasePendingGame:()=>({})},
    './CourtTrackerView': TrackerView,
    './AdvancedSessionReport': () => null, './SessionTimeline': () => null,
    './GameContextForm': GameDetails,
    './GameTrackerRecorder': () => null,
  };
  const globals = { window: { localStorage: { removeItem() {} }, addEventListener() {}, removeEventListener() {} },
    crypto: { randomUUID: () => 'uuid' } };
  const { ReliableTrackerWorkspace } = await loadComponent(componentURL, deps, globals);
  h.render(ReliableTrackerWorkspace, { accountId: 'account', playerId: 'player',
    playerName: 'Sample', refreshData: async () => {}, onClose() {}, darkMode: false,
    onToggleTheme() {}, quickStart: true, backend });
  await h.settle();
  return { h, calls, stored, TrackerView };
}

test('Quick Gametime creates one game with blank optional fields then opens court', async () => {
  const f = await fixture();
  assert.deepEqual(f.calls, ['list', 'create:game']);
  assert.equal(f.stored.get('recovery').snapshot.session.type, 'game');
  assert.equal(f.stored.get('recovery').snapshot.session.tracker_context.opponent, '');
  const activeView=findElement(f.h.output, element => element.type === f.TrackerView);
  assert.ok(activeView);
  assert.ok(activeView.props.videoDock,'Game preview is mounted above stat entry controls.');
  f.h.flush();
  assert.deepEqual(f.calls, ['list', 'create:game'], 'Re-render must not create duplicates');
  f.h.unmount();
});

test('Quick Gametime resumes an existing game instead of creating another', async () => {
  const f = await fixture({ active: [{ id: 'game-123', type: 'game', date: '2026-10-23' }] });
  assert.deepEqual(f.calls, ['list', 'fetch:game-123']);
  assert.equal(f.stored.get('recovery').snapshot.session.id, 'game-123');
  assert.ok(findElement(f.h.output, element => element.type === f.TrackerView));
  f.h.unmount();
});

test('Quick Gametime preserves unsynced local entries instead of overwriting them', async () => {
  const snapshot = { session: { id: 'local-game', tracker_status: 'active', type: 'game',
      game_stats: {}, tracker_version: 0 }, shots: [], events: [] };
  const local = { accountId: 'account', playerId: 'player', snapshot, pending: [{ id: 'unflushed' }] };
  const f = await fixture({ local });
  assert.deepEqual(f.calls, ['list']);
  assert.ok(findElement(f.h.output, element => element.type === f.TrackerView));
  f.h.unmount();
});
