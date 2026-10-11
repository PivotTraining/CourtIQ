// CourtIQ Finishing Lab v1. This is transparent, rules-based coaching, not
// computer-vision, machine-learning, validated scouting, or injury advice.
export const FINISHING_VERSION = 'adaptive-finishing-v1';
export const FINISHING_DRILL_ID = 'mikan-drill';
export const FINISHING_TARGET = 8;
export const FINISHING_STAGES = Object.freeze([
  { id: 'baseline', label: 'Assess', title: 'Find your starting point',
    instruction: 'Begin under the rim. Alternate right-hand and left-hand finishes, starting from the same marked spots each time. No defender or time limit.',
    cue: 'Use balanced feet, protect the ball, and finish under control.',
    condition: 'same-spot-alternating-uncontested', target: FINISHING_TARGET },
  { id: 'build', label: 'Build', title: 'Repeat the movement',
    instruction: 'Stay close to the basket and alternate hands for eight attempts. Focus on your footwork and finishing softly off the glass.',
    cue: 'Slow enough to keep balance, eyes on your target.',
    condition: 'controlled-close-alternating', target: FINISHING_TARGET },
  { id: 'adapt', label: 'Adapt', title: 'Your next challenge',
    instruction: '', cue: '', condition: '', target: FINISHING_TARGET },
  { id: 'retest', label: 'Retest', title: 'Try the original test again',
    instruction: 'Return to the same spots, hands, ball, hoop, and no-defender setup as your baseline. Alternate hands for eight finishes. Do not add speed or pressure.',
    cue: 'Same setup. An honest comparison is more valuable than an inflated score.',
    condition: 'same-spot-alternating-uncontested', target: FINISHING_TARGET },
]);

export function finishingStage(index, completed = []) {
  if (!Number.isInteger(index) || index < 0 || index > 3) return null;
  const base = FINISHING_STAGES[index];
  if (base.id !== 'adapt') return base;
  const baseline = completed.find(x => x?.stage_id === 'baseline');
  const build = completed.find(x => x?.stage_id === 'build');
  // Failure or incompleteness cannot unlock a harder variation.
  const controlled = baseline?.control_confirmed === true && build?.control_confirmed === true;
  const madeEnough = baseline?.successful_reps >= 6 && build?.successful_reps >= 6
    && baseline?.reps_completed === FINISHING_TARGET && build?.reps_completed === FINISHING_TARGET;
  if (controlled && madeEnough) return {
    ...base, mode: 'progress', condition: 'controlled-alternating-after-catch',
    title: 'Add a read, not a rush',
    instruction: 'After every rebound, pause in balance and choose the right or left finish. Alternate sides across all eight shots. No contact, defender or speed requirement.',
    cue: 'Look, decide, then finish. If balance breaks down, slow it down.',
    reason: 'Two controlled sets met the progression threshold. This is an optional mild variation, not proof of mastery.',
  };
  return {
    ...base, mode: 'support', condition: 'controlled-short-approach',
    title: 'Build control before difficulty',
    instruction: 'Keep your approach short and repeat balanced alternating finishes close to the rim. Use eight attempts without a defender or clock.',
    cue: 'Prioritize foot placement and a soft finish, not making every shot.',
    reason: 'The earlier sets did not meet both accuracy and self-reported control gates. Stay at a manageable difficulty.',
  };
}

export function finishStageRecord(stage, outcomes, controlled) {
  if (!stage || !FINISHING_STAGES.some(s => s.id === stage.id) ||
      !Array.isArray(outcomes) || outcomes.length !== FINISHING_TARGET ||
      outcomes.some(v => typeof v !== 'boolean') || typeof controlled !== 'boolean' ||
      (stage.id === 'adapt' && !['progress','support'].includes(stage.mode))) {
    throw new Error('A completed, honestly recorded eight-attempt set is required.');
  }
  return {
    drill_id: FINISHING_DRILL_ID,
    name: 'Finishing Lab · ' + stage.label,
    category: 'finishing',
    practice_version: FINISHING_VERSION,
    stage_id: stage.id, condition: stage.condition,
    path: stage.id === 'adapt' ? stage.mode : 'standard',
    target_reps: FINISHING_TARGET,
    reps_completed: FINISHING_TARGET,
    successful_reps: outcomes.filter(Boolean).length,
    outcome_kind: 'makes', skipped: false,
    control_confirmed: controlled,
    source: 'self-reported',
  };
}

function validStage(drill, stage, earlier) {
  if (!drill || drill.practice_version !== FINISHING_VERSION
    || drill.drill_id !== FINISHING_DRILL_ID || drill.stage_id !== stage.id
    || drill.target_reps !== FINISHING_TARGET || drill.reps_completed !== FINISHING_TARGET
    || drill.skipped !== false || drill.outcome_kind !== 'makes'
    || !Number.isInteger(drill.successful_reps) || drill.successful_reps < 0
    || drill.successful_reps > FINISHING_TARGET || typeof drill.control_confirmed !== 'boolean'
    || drill.source !== 'self-reported') return false;
  const expected = finishingStage(FINISHING_STAGES.indexOf(stage), earlier);
  return drill.condition === expected.condition && drill.path === (stage.id === 'adapt' ? expected.mode : 'standard');
}

export function summarizeFinishing(drills) {
  if (!Array.isArray(drills) || drills.length !== FINISHING_STAGES.length ||
      !drills.every((drill, index) => validStage(drill, FINISHING_STAGES[index], drills.slice(0,index)))) return null;
  const [baseline, build, adapt, retest] = drills;
  const change = retest.successful_reps - baseline.successful_reps;
  const control = baseline.control_confirmed && retest.control_confirmed;
  return {
    baseline: baseline.successful_reps,
    build: build.successful_reps,
    adaptation: adapt.path,
    retest: retest.successful_reps,
    deltaMakes: change,
    deltaPoints: Math.round(100 * change / FINISHING_TARGET),
    comparableConditions: true,
    control,
    next: !control ? 'Repeat the same no-pressure baseline setup, concentrating on balance and footwork.' :
      change < 0 ? 'Retest on another day under the same conditions before making any conclusions.' :
      'Repeat this exact assessment in a later session. A single-session change does not prove lasting improvement.',
  };
}

export function finishingResult({ stages, elapsedSeconds, id }) {
  const analysis = summarizeFinishing(stages);
  if (!id || typeof id !== 'string' || !analysis ||
      !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds > 86400) {
    throw new Error('Finish each stage before saving a measured Finishing Lab session.');
  }
  return {
    id,
    elapsed_seconds: Math.floor(elapsedSeconds),
    drills: stages.map(stage => ({ ...stage })), // immutable snapshot for loss-safe retries
  };
}

export function finishingHistory(rows = []) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows.filter(row => {
    if (!row?.id || seen.has(row.id) || !Number.isFinite(Date.parse(row.completed_at))) return false;
    seen.add(row.id);
    return summarizeFinishing(row.drills) !== null;
  }).map(row => ({
    id: row.id, at: row.completed_at,
    ...summarizeFinishing(row.drills),
  })).sort((a,b) => Date.parse(b.at) - Date.parse(a.at));
}
