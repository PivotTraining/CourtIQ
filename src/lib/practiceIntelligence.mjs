import { forecastNextAttempts } from './forecastModel.mjs';

// Only complete, same-drill / same-target practices are comparable.
// In particular, "clean reps" are subjective and never forecast as made shots.
export function buildPracticeIntelligence(entries = []) {
  const groups = new Map();
  for (const entry of entries) {
    if (!entry || entry.skipped || entry.reps_completed !== entry.target_reps
      || entry.outcome_kind !== 'makes' || !Number.isSafeInteger(entry.successful_reps)
      || !Number.isSafeInteger(entry.reps_completed) || entry.reps_completed < 1
      || entry.successful_reps < 0 || entry.successful_reps > entry.reps_completed
      || typeof entry.drill_id !== 'string' || !Number.isFinite(Date.parse(entry.completed_at))) continue;
    const key = entry.drill_id + ':' + entry.target_reps;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  return [...groups.values()].map(rows => {
    rows.sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at));
    const recent = rows.slice(0, 5);
    const attempts = recent.reduce((sum, row) => sum + row.reps_completed, 0);
    const successes = recent.reduce((sum, row) => sum + row.successful_reps, 0);
    const forecast = forecastNextAttempts({ successes, attempts, sessions: recent.length });
    const latestThree = rows.slice(0, 3), priorThree = rows.slice(3, 6);
    const weighted = list => {
      const total = list.reduce((sum, row) => sum + row.reps_completed, 0);
      return total ? Math.round(100 * list.reduce((sum, row) => sum + row.successful_reps, 0) / total) : null;
    };
    const trend = latestThree.length === 3 && priorThree.length === 3
      ? { recentRate: weighted(latestThree), previousRate: weighted(priorThree),
        deltaPoints: weighted(latestThree) - weighted(priorThree),
        description: 'Last three versus preceding three completed same-target practices' }
      : null;

    return {
      key: rows[0].drill_id + ':' + rows[0].target_reps,
      name: rows[0].name, drillId: rows[0].drill_id, target: rows[0].target_reps,
      latestAt: rows[0].completed_at, totalSessions: rows.length,
      attempts, successes, recordedRate: attempts ? Math.round(successes / attempts * 100) : null,
      forecast, trend, evidence: 'Self-recorded practice shots, not game or camera-verified attempts',
      nextAction: trend && trend.deltaPoints < -10
        ? 'Repeat the same assessment after checking your technique and rest. Do not increase difficulty yet.'
        : 'Repeat this same-target assessment to test consistency before raising difficulty.',
    };
  }).sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));
}

// Game-specific outlook. Practice attempts and incomplete/unconfirmed games
// are explicitly excluded; no unverified shot may be silently assumed missed.
export function buildGameShotOutlook(sessions = []) {
  const games = sessions.filter(session => session?.type === 'game'
    && session.coverage_confirmed === true && session.tracker_status === 'completed'
    && Array.isArray(session.shot_logs)
    && session.shot_logs.every(shot => shot && typeof shot.made === 'boolean'));
  const attempts = games.reduce((sum, game) => sum + game.shot_logs.filter(shot => shot.zone_id !== 'free-throw').length, 0);
  const successes = games.reduce((sum, game) => sum + game.shot_logs.filter(shot => shot.zone_id !== 'free-throw' && shot.made).length, 0);
  return {
    games: games.length, attempts, successes,
    forecast: forecastNextAttempts({ successes, attempts, sessions: games.length }),
    evidence: 'Only user-confirmed, complete games; changing shot quality or shot mix may change actual results',
  };
}
