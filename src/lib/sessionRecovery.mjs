export const STAT_KEYS = ['ast', 'reb', 'stl', 'blk', 'to', 'pf', 'min', 'oreb', 'dreb'];
export const EMPTY_GAME_STATS = Object.fromEntries(STAT_KEYS.map(key => [key, 0]));
const PREFIX = 'courtiq-recovery-v1:';

export function recoveryKey(accountId, playerId) {
  if (!accountId || !playerId) throw new Error('A signed-in account and player are required.');
  return `${PREFIX}${accountId}:${playerId}`;
}

export function clearAccountRecovery(storage, accountId) {
  if (!storage || !accountId) return;
  const prefix = `${PREFIX}${accountId}:`;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) if (key?.startsWith(prefix)) storage.removeItem(key);
}

export function hasPendingRecovery(storage, accountId) {
  if (!storage || !accountId) return false;
  const prefix = `${PREFIX}${accountId}:`;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) {
      try { if (JSON.parse(storage.getItem(key))?.pending?.length) return true; }
      catch { return true; } // damaged recovery data must not be silently discarded
    }
  }
  return false;
}

// No player names, emails, tokens or call/journal notes are stored on the device.
// Game details and the entry ledger are device data; logout removes them.
// Persistence MUST succeed before an entry is shown as queued.
export function saveRecovery(storage, accountId, playerId, value) {
  storage.setItem(recoveryKey(accountId, playerId), JSON.stringify(value));
}
export function loadRecovery(storage, accountId, playerId) {
  const raw = storage.getItem(recoveryKey(accountId, playerId));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.accountId !== accountId || value?.playerId !== playerId || !Array.isArray(value.pending)
    || value.pending.some(command => command.sessionId !== value.snapshot?.session?.id)) {
    throw new Error('Recovery data does not belong to this player.');
  }
  return value;
}

export function projectCommand(snapshot, command) {
  if (command.sessionId !== snapshot.session.id) throw new Error('Wrong session.');
  if (command.version !== snapshot.session.tracker_version) throw new Error('Session changed on another device.');
  if (snapshot.session.tracker_status !== 'active') throw new Error('Session is already completed.');
  const next = structuredClone(snapshot);
  const { payload } = command;
  next.session.game_stats = { ...EMPTY_GAME_STATS, ...next.session.game_stats };
  if (payload.kind === 'stat') {
    if (!STAT_KEYS.includes(payload.key) || ![-1, 1].includes(payload.delta)) throw new Error('Invalid stat.');
    const count = next.session.game_stats[payload.key] + payload.delta;
    if (count < 0) throw new Error('A stat cannot be negative.');
    if (payload.key === 'reb' && count < next.session.game_stats.oreb + next.session.game_stats.dreb) throw new Error('Total rebounds cannot be below the recorded split.');
    next.session.game_stats[payload.key] = count;
    if (['oreb', 'dreb'].includes(payload.key)) next.session.game_stats.reb += payload.delta;
  } else if (payload.kind === 'shot') {
    next.shots.push({ id: command.id, session_id: command.sessionId,
      zone_id: payload.zone_id, made: payload.made, created_at: payload.recorded_at });
  } else if (payload.kind === 'reverse') {
    const original = next.events.find(event => event.id === payload.target);
    if (!original || next.events.some(event => event.payload.kind === 'reverse' && event.payload.target === original.id)) throw new Error('Entry cannot be reversed.');
    if (original.payload.kind === 'shot') next.shots = next.shots.filter(shot => shot.id !== original.id);
    else if (original.payload.kind === 'stat') {
      const count = next.session.game_stats[original.payload.key] - original.payload.delta;
      if (count < 0) throw new Error('Correct the current total instead; reversing would make it negative.');
      if (original.payload.key === 'reb' && count < next.session.game_stats.oreb + next.session.game_stats.dreb) throw new Error('Reverse the split rebound entry instead.');
      next.session.game_stats[original.payload.key] = count;
      if (['oreb', 'dreb'].includes(original.payload.key)) next.session.game_stats.reb -= original.payload.delta;
    } else throw new Error('Only shot and stat entries can be reversed.');
  } else if (payload.kind === 'context') {
    next.session.tracker_context = payload.context;
    next.session.date = payload.context.date || next.session.date;
  }
  else if (payload.kind === 'end') next.session.tracker_status = 'completed';
  else throw new Error('Unknown entry type.');
  next.session.tracker_version += 1;
  next.events.push({ id: command.id, session_id: command.sessionId, version: next.session.tracker_version,
    payload, created_at: payload.recorded_at });
  return next;
}

// Commands are ordered and stop at the first error. Retry sends the SAME ID.
// The server rejects stale versions instead of accepting last-write-wins totals.
export async function flushRecovery(value, send, persist, identityIsCurrent = () => true) {
  let current = structuredClone(value);
  while (current.pending.length) {
    if (!identityIsCurrent()) throw new Error('Account changed. Sync stopped.');
    const command = current.pending[0];
    const acknowledged = await send(command);
    if (acknowledged?.tracker_version !== undefined && acknowledged.tracker_version !== command.version + 1) {
      const conflict = new Error('SESSION_CONFLICT: the saved game changed after this entry was accepted.');
      conflict.code = '40001';
      throw conflict;
    }
    if (!identityIsCurrent()) throw new Error('Account changed. Sync stopped.');
    const next = { ...current, pending: current.pending.slice(1) };
    persist(next);
    current = next;
  }
  return current;
}

export function filterSessionRecords(sessions, { type = 'all', from = '', to = '', season = '' } = {}) {
  return sessions.filter(session => {
    const date = session.date || session.created_at?.slice(0, 10) || '';
    return (type === 'all' || session.type === type) && (!from || date >= from)
      && (!to || date <= to) && (!season || session.tracker_context?.season === season);
  });
}

export function recordedPeriodScoring(events, zones) {
  const reversed = new Set(events.filter(event => event.payload.kind === 'reverse').map(event => event.payload.target));
  const points = new Map(zones.map(zone => [zone.id, zone.pts]));
  const periods = new Map();
  for (const event of events) {
    if (event.payload.kind !== 'shot' || reversed.has(event.id)) continue;
    const period = Number(event.payload.period);
    if (!periods.has(period)) periods.set(period, { period, points: 0, attempts: 0, made: 0 });
    const bucket = periods.get(period); bucket.attempts += 1;
    if (event.payload.made) { bucket.made += 1; bucket.points += points.get(event.payload.zone_id) || 0; }
  }
  return [...periods.values()].sort((a, b) => a.period - b.period);
}

export function recordedGameResult(context) {
  if (context?.team_score === '' || context?.opponent_score === '' || context?.team_score == null || context?.opponent_score == null) return null;
  const team = Number(context.team_score); const opponent = Number(context.opponent_score);
  if (![team, opponent].every(score => Number.isInteger(score) && score >= 0)) return null;
  return { team, opponent, outcome: team > opponent ? 'Win' : team < opponent ? 'Loss' : 'Tie' };
}
