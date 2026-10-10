// CourtIQ's AI Coach receives aggregates, never player names, email addresses,
// personal identifiers, journal entries, source videos, or raw session rows.
// These functions are pure and can be regression-tested without credentials.

const validCount = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000;
const percent = (made, attempts) => attempts > 0 ? Math.round(made / attempts * 100) : null;
const shotZone = value => typeof value === 'string' && /^[a-z0-9-]{1,45}$/.test(value) ? value : null;

export function coachQuestion(value) {
  if (typeof value !== 'string') return { ok: false, reason: 'Enter a basketball question.' };
  const question = value.trim().replace(/\s+/g, ' ');
  if (question.length < 8 || question.length > 320) return { ok: false, reason: 'Ask a question between 8 and 320 characters.' };
  // Prevent accidental disclosures of commonly formatted personal identifiers.
  if (/\bhttps?:\/\/|\bwww\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d(). -]{8,}\d)/i.test(question))
    return { ok: false, reason: 'Remove links, email addresses, and phone numbers before asking.' };
  return { ok: true, question };
}

export function summarizeCoachEvidence({ sessions = [], shots = [], workouts = [] } = {}) {
  // Only completed, user-attested full-coverage games are included.
  const eligible = sessions.filter(session => session?.type === 'game' &&
    session.tracker_status === 'completed' && session.coverage_confirmed === true &&
    typeof session.id === 'string');
  const eligibleIds = new Set(eligible.map(g => g.id));
  const bySession = new Map(eligible.map(g => [g.id, []]));
  for (const shot of shots) {
    if (!eligibleIds.has(shot?.session_id) || typeof shot.made !== 'boolean' || !shotZone(shot.zone_id)) continue;
    bySession.get(shot.session_id).push({ made: shot.made, zone_id: shot.zone_id });
  }

  const gameResults = eligible.map(game => {
    const rows = bySession.get(game.id) || [];
    const fieldGoals = rows.filter(x => x.zone_id !== 'free-throw');
    const result = {
      attempts: fieldGoals.length,
      makes: fieldGoals.filter(x => x.made).length,
      zones: fieldGoals,
    };
    // Missing box-score counts are NOT treated as zeros.
    for (const key of ['ast','to','reb','stl','blk']) {
      result[key] = validCount(game.game_stats?.[key]) ? game.game_stats[key] : null;
    }
    return result;
  });
  const attempts = gameResults.reduce((n,g) => n + g.attempts, 0);
  const makes = gameResults.reduce((n,g) => n + g.makes, 0);
  const all = gameResults.flatMap(g => g.zones);
  const zones = new Map();
  for (const shot of all) {
    const value = zones.get(shot.zone_id) || { attempts: 0, makes: 0 };
    value.attempts++; if (shot.made) value.makes++;
    zones.set(shot.zone_id, value);
  }
  const zoneStats = [...zones.entries()]
    .map(([zone, row]) => ({ zone, attempts: row.attempts, makes: row.makes, pct: row.attempts >= 10 ? percent(row.makes, row.attempts) : null }))
    .sort((a, b) => b.attempts - a.attempts).slice(0, 6);
  const avg = key => {
    const values = gameResults.map(g => g[key]).filter(x => x !== null);
    return values.length >= 3 ? { games: values.length, perGame: Math.round(values.reduce((a,b) => a+b,0) / values.length * 10) / 10 } : null;
  };

  // Outcome comparisons require identical drill and target and completed reps.
  const groups = new Map();
  for (const result of workouts) {
    if (!result || !Number.isFinite(Date.parse(result.completed_at)) || !Array.isArray(result.drills)) continue;
    for (const drill of result.drills) {
      if (drill?.practice_version !== 'skill-practice-v1' || drill.outcome_kind !== 'makes' ||
        drill.skipped || !validCount(drill.target_reps) || drill.target_reps < 1 ||
        drill.reps_completed !== drill.target_reps || !validCount(drill.successful_reps) ||
        drill.successful_reps > drill.target_reps || !shotZone(drill.drill_id)) continue;
      const key = drill.drill_id + ':' + drill.target_reps;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ at: result.completed_at, made: drill.successful_reps, attempts: drill.target_reps });
    }
  }
  const practice = [...groups.entries()].map(([key, rows]) => {
    rows.sort((a,b) => Date.parse(b.at) - Date.parse(a.at));
    const latest = rows.slice(0, 5);
    const recentAttempts = latest.reduce((n,r) => n + r.attempts, 0);
    const recentMakes = latest.reduce((n,r) => n + r.made, 0);
    return { drill: key.split(':')[0], target: latest[0].attempts, sessions: rows.length,
      recentAttempts, recentMakes, recentPct: percent(recentMakes, recentAttempts),
      trend: rows.length >= 6 ? { latest3: percent(rows.slice(0,3).reduce((n,r)=>n+r.made,0),rows.slice(0,3).reduce((n,r)=>n+r.attempts,0)),
        previous3: percent(rows.slice(3,6).reduce((n,r)=>n+r.made,0),rows.slice(3,6).reduce((n,r)=>n+r.attempts,0)) } : null };
  }).sort((a,b)=>b.recentAttempts-a.recentAttempts).slice(0,5);

  return {
    provenance: 'Self-recorded performance; full game coverage confirmed by account holder, not independently audited',
    recentRecordedGames: sessions.filter(s=>s?.type==='game').length,
    eligibleGames: eligible.length,
    gameFieldGoals: { attempts, makes, pct: attempts >= 20 ? percent(makes, attempts) : null },
    topZones: zoneStats,
    gameAverages: { assists: avg('ast'), turnovers: avg('to'), rebounds: avg('reb'), steals: avg('stl'), blocks: avg('blk') },
    recentPracticeAssessments: practice,
    notIncluded: 'Unconfirmed games, journal text, raw film, names, other players, and incomplete drill entries',
    adequateForSpecificShotDiscussion: eligible.length >= 3 && attempts >= 60,
  };
}

export function coachEvidenceSummary(evidence) {
  const shot = evidence.gameFieldGoals;
  if (!evidence.eligibleGames && !evidence.recentPracticeAssessments.length) {
    return 'No confirmed game or completed self-recorded shooting assessment is available yet. Record a complete session before requesting individualized analysis.';
  }
  return `Available evidence: ${evidence.eligibleGames} confirmed games; ${shot.makes}/${shot.attempts} recorded field goals${shot.pct === null ? ' (sample too small for a reliable percentage)' : ` (${shot.pct}%)`}; ${evidence.recentPracticeAssessments.length} measured shooting-drill groups. Missing statistics must remain unknown. Evidence is self-recorded.`;
}
