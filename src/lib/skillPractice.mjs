// Versioned, self-recorded practice outcomes. These are not game statistics,
// coach assessments, population rankings, or automated form analysis.
export const PRACTICE_VERSION = 'skill-practice-v1';
export const GUIDED_DRILLS = {
  'crossover-stationary': { equipment: 'One basketball · a clear, flat space', unit: 'crossovers', scene: 'handles', steps: [
    ['Set your base', 'Feet shoulder-width apart, knees bent, head up.', [90, 130], [230, 130]],
    ['Cross low', 'Push the ball from one hand to the other below your knees.', [90, 130], [230, 130]],
    ['Return and repeat', 'Cross back without standing up. One hand-to-hand transfer is one rep.', [230, 130], [90, 130]],
  ] },
  'form-shooting-close': { equipment: 'One basketball · one hoop', unit: 'shots', scene: 'court', steps: [
    ['Start close', 'Stand about three feet from the basket with a balanced stance.', [160, 106], [160, 106]],
    ['Align and release', 'Use your shooting hand, with your elbow under the ball. Extend toward the rim.', [160, 106], [160, 50]],
    ['Hold and reset', 'Hold your follow-through, retrieve the ball, and return to the same spot.', [160, 50], [160, 106]],
  ] },
  'mikan-drill': { equipment: 'One basketball · one hoop', unit: 'layups', scene: 'court', steps: [
    ['Right-side finish', 'Start under the rim. Finish from the right side with your right hand.', [192, 83], [160, 50]],
    ['Catch high', 'Retrieve the ball and keep it above your head as you move to the other side.', [160, 50], [128, 83]],
    ['Left-side finish', 'Use your left hand on the left side. Alternate sides; each finish is one rep.', [128, 83], [160, 50]],
  ] },
  'lateral-defensive-slides': { equipment: 'A clear court · two sideline markers', unit: 'trips', scene: 'court', steps: [
    ['Get low', 'Start at one sideline in a wide defensive stance, with your hands active.', [45, 148], [45, 148]],
    ['Slide across', 'Push off your trailing foot and lead with the other. Do not cross your feet.', [45, 148], [275, 148]],
    ['Return under control', 'Reverse direction without bringing your heels together. Each sideline-to-sideline trip is one rep.', [275, 148], [45, 148]],
  ] },
  'box-out-fundamentals': { equipment: 'One partner · hoop · controlled contact only', unit: 'box-outs', scene: 'court', steps: [
    ['Find your player', 'On the shot cue, locate your partner before watching the ball.', [160, 119], [160, 106]],
    ['Establish position', 'Pivot into a legal, balanced position between your partner and the basket. Do not shove or hold.', [160, 106], [160, 90]],
    ['Hold and pursue', 'Keep your base, locate the ball, then release to pursue it. Reset for the next cue.', [160, 90], [160, 65]],
  ] },
  'chest-pass-fundamentals': { equipment: 'One basketball · one partner, about 10 feet away', unit: 'passes', scene: 'passing', steps: [
    ['Prepare the pass', 'Face your partner with the ball at chest level and a balanced base.', [75, 115], [75, 115]],
    ['Step and deliver', 'Step toward your target, extend your arms, and snap your wrists.', [75, 115], [245, 115]],
    ['Receive and return', 'Aim at your partner’s chest. Record each pass you throw, then reset.', [245, 115], [75, 115]],
  ] },
  'suicides-classic': { equipment: 'A full court · clear running lanes', unit: 'sets', scene: 'lines', steps: [
    ['First line and back', 'Start at the baseline. Run to the near free-throw line, touch it, and return.', [70, 160], [70, 120]],
    ['Extend the shuttle', 'Run to half court and back, then the far free-throw line and back.', [160, 160], [160, 80]],
    ['Complete the set', 'Run to the far baseline and back. That entire sequence is one set; rest 30 seconds before repeating.', [250, 160], [250, 30]],
  ] },
  'ladder-two-feet-in': { equipment: 'An agility ladder · flat, clear space', unit: 'ladder runs', scene: 'ladder', steps: [
    ['Enter the first square', 'Step both feet into the first square. Start slowly to learn the pattern.', [132, 159], [145, 140]],
    ['Two feet in each', 'Continue up the ladder with both feet entering every square. Stay on the balls of your feet.', [145, 140], [175, 80]],
    ['Finish and reset', 'Move through the final square, walk back, and reset. A full trip through the ladder is one rep.', [175, 80], [160, 32]],
  ] },
};

export const FEATURED_IDS = Object.keys(GUIDED_DRILLS);

export function practiceGuide(drill) {
  const guide = GUIDED_DRILLS[drill.id];
  if (guide) return guide;
  const sentences = (drill.description || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  return { equipment: 'Check the setup below before starting.', unit: 'reps', scene: null,
    steps: sentences.map((text, index) => [index === 0 ? 'Set up' : `Coaching step ${index + 1}`, text]) };
}

export function practiceMetric(drill) {
  const shooting = ['shooting', 'finishing'].includes(drill.category);
  return shooting ? { kind: 'makes', good: 'Made', other: 'Missed', label: 'Shooting accuracy' }
    : { kind: 'clean-reps', good: 'Clean rep', other: 'Needs work', label: 'Clean-rep rate' };
}

export function skillResult({ drill, outcomes, elapsedSeconds, id }) {
  const target = Math.max(1, Math.floor(Number(drill.reps) || 1));
  if (!id || !Array.isArray(outcomes) || !outcomes.length || outcomes.length > target || outcomes.some(value => typeof value !== 'boolean'))
    throw new Error('Record valid attempts before finishing this practice.');
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds > 86400) throw new Error('Practice time is unavailable.');
  return { id, elapsed_seconds: Math.floor(elapsedSeconds), drills: [{
    drill_id: drill.id, name: drill.name, target_reps: target, reps_completed: outcomes.length,
    skipped: outcomes.length < target, practice_version: PRACTICE_VERSION,
    category: drill.category, outcome_kind: practiceMetric(drill).kind,
    successful_reps: outcomes.filter(Boolean).length,
  }] };
}

export function recordedPractice(row) {
  const count = row?.reps_completed, good = row?.successful_reps, target = row?.target_reps;
  if (row?.practice_version !== PRACTICE_VERSION || !['makes', 'clean-reps'].includes(row?.outcome_kind)
    || !Number.isInteger(count) || count < 1 || !Number.isInteger(good) || good < 0 || good > count
    || !Number.isInteger(target) || target < count || typeof row.drill_id !== 'string') return null;
  return { ...row, rate: Math.round(good / count * 100) };
}

export function practiceHistory(rows, drills) {
  const bank = new Map(drills.map(drill => [drill.id, drill]));
  const seen = new Set(), entries = [], categories = {};
  for (const row of [...rows].sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))) {
    if (!row.id || seen.has(row.id) || !Number.isFinite(Date.parse(row.completed_at)) || !Array.isArray(row.drills)) continue;
    seen.add(row.id);
    for (const item of row.drills) {
      const drill = bank.get(item.drill_id);
      if (!drill || !Number.isInteger(item.reps_completed) || item.reps_completed < 1
        || !Number.isInteger(item.target_reps) || item.target_reps < item.reps_completed) continue;
      categories[drill.category] ??= { reps: 0, sessions: new Set() };
      categories[drill.category].reps += item.reps_completed;
      categories[drill.category].sessions.add(row.id);
      const measured = recordedPractice(item);
      if (measured && measured.outcome_kind === practiceMetric(drill).kind)
        entries.push({ ...measured, category: drill.category, name: drill.name, workoutId: row.id, completed_at: row.completed_at });
    }
  }
  return { entries, categories: Object.fromEntries(Object.entries(categories).map(([key, item]) => [key, { reps: item.reps, sessions: item.sessions.size }])) };
}

export function previousPractice(entries, drill, target = drill.reps) {
  return entries.find(entry => entry.drill_id === drill.id && entry.target_reps === target && entry.reps_completed === target && !entry.skipped) || null;
}
