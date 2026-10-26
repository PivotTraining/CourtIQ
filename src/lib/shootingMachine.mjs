// Shooting machine results are self-recorded practice data, never game statistics
// or automated camera analysis. Stored inside existing owner-scoped workout_results.
export const MACHINE_VERSION = 'shooting-machine-v1';
export const MACHINE_DRILL_ID = 'shooting-machine-session';
export const MACHINE_ZONES = [
  { id: 'left-corner', label: 'Left corner 3', pts: 3 },
  { id: 'left-wing', label: 'Left wing 3', pts: 3 },
  { id: 'top-three', label: 'Top of key 3', pts: 3 },
  { id: 'right-wing', label: 'Right wing 3', pts: 3 },
  { id: 'right-corner', label: 'Right corner 3', pts: 3 },
  { id: 'left-baseline', label: 'Left baseline 2', pts: 2 },
  { id: 'left-elbow', label: 'Left elbow 2', pts: 2 },
  { id: 'paint', label: 'Paint 2', pts: 2 },
  { id: 'right-elbow', label: 'Right elbow 2', pts: 2 },
  { id: 'right-baseline', label: 'Right baseline 2', pts: 2 },
  { id: 'free-throw', label: 'Free throw', pts: 1 },
];
export const MACHINE_STYLES = [
  { id: 'catch-shoot', label: 'Catch and shoot' },
  { id: 'off-dribble', label: 'Off the dribble' },
  { id: 'movement', label: 'On the move / relocation' },
  { id: 'free-throw', label: 'Free throws' },
];
export const MACHINE_PLANS = [
  { id: 'custom', label: 'Custom machine workout', goal: 100, style: 'catch-shoot', first: 'left-corner',
    instruction: 'Choose any spot, style, and number of attempts.' },
  { id: 'five-spot', label: '5 spots · 100 catch-and-shoot threes', goal: 100, style: 'catch-shoot', first: 'left-corner',
    instruction: '20 shots each: left corner, left wing, top, right wing, right corner.' },
  { id: 'midrange', label: 'Midrange · 100 shots', goal: 100, style: 'catch-shoot', first: 'left-baseline',
    instruction: '20 shots each: left baseline, left elbow, paint, right elbow, right baseline.' },
  { id: 'free-throws', label: 'Free throws · 50 shots', goal: 50, style: 'free-throw', first: 'free-throw',
    instruction: 'Use the same routine on all 50 attempts. Log the machine display when complete.' },
  { id: 'moving', label: 'Game-speed movement · 75 threes', goal: 75, style: 'movement', first: 'left-corner',
    instruction: '15 attempts at each of five three-point locations at a manageable feed pace.' },
];
export const FORM_CUES = [
  { id: 'feet', label: 'Feet ready and balanced' },
  { id: 'alignment', label: 'Shoulders and hips aligned' },
  { id: 'pocket', label: 'Repeatable shooting pocket' },
  { id: 'release', label: 'Consistent release' },
  { id: 'finish', label: 'Controlled follow-through' },
];

const ZONE_IDS = new Set(MACHINE_ZONES.map(zone => zone.id));
const STYLE_IDS = new Set(MACHINE_STYLES.map(style => style.id));
const safeText = (value, limit = 240) => String(value || '').trim().slice(0, limit);
const isCount = value => Number.isSafeInteger(value) && value >= 0;
export const machineDraftKey = (accountId, playerId) => {
  if (!accountId || !playerId) throw new Error('A signed-in account and selected player are required.');
  return 'courtiq:machine:draft:v1:' + accountId + ':' + playerId;
};

export function newMachineDraft(id, createdAt = new Date().toISOString()) {
  if (!id || !Number.isFinite(Date.parse(createdAt))) throw new Error('Start a valid practice.');
  return {
    id, createdAt, zone: MACHINE_ZONES[0].id, style: MACHINE_STYLES[0].id,
    target: 100, machine: '', focus: 'Shooting machine', feedSeconds: '', plan: 'custom',
    notes: '', elapsed: 0, paused: false, entries: [], form: {},
  };
}

export function validMachineEntry(entry) {
  return !!entry && typeof entry.id === 'string' && !!entry.id &&
    ZONE_IDS.has(entry.zone) && STYLE_IDS.has(entry.style) &&
    isCount(entry.attempts) && entry.attempts >= 1 && entry.attempts <= 500 &&
    isCount(entry.makes) && entry.makes <= entry.attempts &&
    ['tap', 'machine-display'].includes(entry.source);
}

export function machineSummary(entries) {
  if (!Array.isArray(entries) || entries.length > 5000 || entries.some(entry => !validMachineEntry(entry)))
    throw new Error('Practice entries are invalid. Review the recorded makes and attempts.');
  const groups = Object.fromEntries(MACHINE_ZONES.map(zone => [zone.id, { ...zone, attempts: 0, makes: 0 }]));
  let attempts = 0;
  let makes = 0;
  for (const entry of entries) {
    attempts += entry.attempts;
    makes += entry.makes;
    groups[entry.zone].attempts += entry.attempts;
    groups[entry.zone].makes += entry.makes;
  }
  if (attempts > 100000) throw new Error('The session is too large to save as one workout.');
  const perZone = MACHINE_ZONES.map(zone => ({
    ...groups[zone.id],
    pct: groups[zone.id].attempts ? Math.round(groups[zone.id].makes * 100 / groups[zone.id].attempts) : null,
  }));
  const split = pts => {
    const matching = perZone.filter(zone => zone.pts === pts);
    const taken = matching.reduce((sum, row) => sum + row.attempts, 0);
    const made = matching.reduce((sum, row) => sum + row.makes, 0);
    return { attempts: taken, makes: made, pct: taken ? Math.round(made * 100 / taken) : null };
  };
  return { attempts, makes, misses: attempts - makes,
    pct: attempts ? Math.round(makes * 100 / attempts) : null,
    threes: split(3), twos: split(2), freeThrows: split(1),
    perZone, populatedZones: perZone.filter(row => row.attempts > 0) };
}

export function machineWorkoutResult(draft) {
  if (!draft || typeof draft.id !== 'string' || !draft.id || !Number.isFinite(Date.parse(draft.createdAt)))
    throw new Error('Practice has an invalid identifier.');
  const summary = machineSummary(draft.entries);
  if (!summary.attempts) throw new Error('Record at least one attempt before saving.');
  const goal = Number(draft.target);
  if (!Number.isSafeInteger(goal) || goal < 1 || goal > 10000) throw new Error('Set a target from 1 to 10,000 shots.');
  const interval = draft.feedSeconds === '' ? null : Number(draft.feedSeconds);
  if (interval !== null && (!Number.isFinite(interval) || interval < 0.5 || interval > 30))
    throw new Error('Machine feed interval must be between 0.5 and 30 seconds.');
  const elapsed = Number(draft.elapsed);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 86400) throw new Error('Practice duration is invalid.');
  return { id: draft.id, elapsed_seconds: Math.floor(elapsed), drills: [{
    drill_id: MACHINE_DRILL_ID, name: 'Shooting Machine Session', category: 'shooting',
    practice_version: MACHINE_VERSION, outcome_kind: 'makes',
    target_reps: Math.max(goal, summary.attempts), reps_completed: summary.attempts,
    successful_reps: summary.makes, skipped: summary.attempts < goal,
    machine: {
      version: MACHINE_VERSION, started_at: draft.createdAt,
      name: safeText(draft.machine, 80), focus: safeText(draft.focus, 100),
      feed_seconds: interval, plan: safeText(draft.plan, 30),
      notes: safeText(draft.notes, 1500), form: Object.fromEntries(
        FORM_CUES.map(cue => [cue.id, draft.form?.[cue.id] === true])),
      entries: draft.entries.map(row => ({
        id: row.id, zone: row.zone, style: row.style, makes: row.makes,
        attempts: row.attempts, source: row.source,
      })),
    },
  }] };
}

export function machineHistory(rows) {
  if (!Array.isArray(rows)) return [];
  const found = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    const drill = row.drills?.find(item =>
      item?.drill_id === MACHINE_DRILL_ID && item?.practice_version === MACHINE_VERSION &&
      item?.machine?.version === MACHINE_VERSION);
    if (!drill || !Number.isFinite(Date.parse(row.completed_at))) continue;
    try {
      const summary = machineSummary(drill.machine.entries);
      if (!summary.attempts || drill.reps_completed !== summary.attempts ||
          drill.successful_reps !== summary.makes) continue;
      seen.add(row.id);
      found.push({ id: row.id, date: row.completed_at, elapsed: row.elapsed_seconds,
        machine: drill.machine, target: drill.target_reps, ...summary });
    } catch { /* Ignore unsupported or corrupted historical records, not all history. */ }
  }
  return found.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

const csvCell = value => {
  const str = String(value ?? '');
  // Guard formula injection for Excel-compatible CSV exports.
  const sanitized = /^[=+\-@]/.test(str.trim()) ? "'" + str : str;
  return '"' + sanitized.replaceAll('"', '""') + '"';
};
export function machineCsv(draft) {
  const header = ['Date', 'Machine', 'Focus', 'Shot zone', 'Shot type', 'Source', 'Makes', 'Attempts', 'Percentage'];
  const rows = draft.entries.map(row => {
    const zone = MACHINE_ZONES.find(item => item.id === row.zone);
    const style = MACHINE_STYLES.find(item => item.id === row.style);
    return [draft.createdAt, safeText(draft.machine, 80), safeText(draft.focus, 100), zone?.label || '',
      style?.label || '', row.source, row.makes, row.attempts,
      Math.round(row.makes * 100 / row.attempts) + '%'];
  });
  const s = machineSummary(draft.entries);
  rows.push(['TOTAL', '', '', '', '', '', s.makes, s.attempts, s.pct === null ? '' : s.pct + '%']);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
