import { buildSessionReport } from './sessionReport.mjs';
import { NBA_REFERENCES, NBA_REFERENCE_SEASON } from './nbaReferences.mjs';
const rate = (a, b, scale = 1) => b > 0 ? a / b * scale : null;
const keys = ['ast', 'reb', 'stl', 'blk', 'to', 'pf', 'min'];
export const STYLE_MINIMUM = Object.freeze({ games: 5, minutes: 100, attempts: 50 });
export const STYLE_FEATURES = Object.freeze([
  { key: 'threeShare', label: '3PA / FGA', scale: .2 },
  { key: 'ftRate', label: 'FTA / FGA', scale: .2 },
  { key: 'assistShare', label: 'Assist contribution share', scale: .15 },
  { key: 'reboundShare', label: 'Rebound contribution share', scale: .15 },
  { key: 'stealShare', label: 'Steal contribution share', scale: .1 },
  { key: 'blockShare', label: 'Block contribution share', scale: .1 },
]);
export function styleVector(value) {
  const support = value.ast + value.reb + value.stl + value.blk;
  if (!(value.fga > 0) || !(support > 0)) return null;
  return { threeShare: value.threeAttempts / value.fga, ftRate: value.fta / value.fga,
    assistShare: value.ast / support, reboundShare: value.reb / support, stealShare: value.stl / support, blockShare: value.blk / support };
}
export function styleDistance(a, b) {
  return STYLE_FEATURES.reduce((sum, feature) => sum + Math.abs(a[feature.key] - b[feature.key]) / feature.scale, 0) / STYLE_FEATURES.length;
}
export function qualifyGames(sessions, zones) {
  const all = sessions.filter(session => session.type === 'game' && session.tracker_status !== 'active');
  const games = [], excluded = [];
  for (const session of all) {
    const stats = session.game_stats || {}, report = buildSessionReport(session.shot_logs || [], stats, zones);
    let reason;
    if (session.coverage_confirmed !== true) reason = 'Full-game coverage not confirmed';
    else if (!keys.every(key => typeof stats[key] === 'number' && Number.isFinite(stats[key]) && stats[key] >= 0) || !(stats.min > 0 && stats.min <= 120)) reason = 'Missing or invalid box score / minutes';
    else if (['ast','reb','stl','blk','to','pf'].some(key => !Number.isInteger(stats[key]))) reason = 'Box-score counts must be whole numbers';
    else if (report.unknownShots || (session.shot_logs || []).some(shot => typeof shot.made !== 'boolean')) reason = 'Unknown or invalid shot records';
    else if (!Number.isFinite(Date.parse(session.date))) reason = 'Game date is missing';
    if (reason) excluded.push({ id: session.id, date: session.date, reason });
    else games.push({ id: session.id, date: session.date, report });
  }
  games.sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  return { games, excluded, recordedGames: all.length };
}
export function aggregateGames(games) {
  const sum = { games: games.length, pts: 0, fga: 0, fgm: 0, threeAttempts: 0, threeMade: 0, fta: 0, ftm: 0, ...Object.fromEntries(keys.map(key => [key, 0])) };
  const zones = new Map();
  for (const { report } of games) {
    for (const key of ['pts','fga','fgm','threeAttempts','threeMade','fta','ftm']) sum[key] += report[key];
    for (const key of keys) sum[key] += report.box[key];
    for (const zone of report.zones) { const total = zones.get(zone.id) || { ...zone, made: 0, attempts: 0 }; total.made += zone.made; total.attempts += zone.attempts; zones.set(zone.id, total); }
  }
  return { ...sum, fgPct: rate(sum.fgm, sum.fga, 100), threePct: rate(sum.threeMade, sum.threeAttempts, 100), ftPct: rate(sum.ftm, sum.fta, 100),
    efgPct: rate(sum.fgm + .5 * sum.threeMade, sum.fga, 100), tsPct: rate(sum.pts, 2 * (sum.fga + .44 * sum.fta), 100),
    astTo: rate(sum.ast, sum.to), per36: Object.fromEntries(['pts','ast','reb','stl','blk','to'].map(key => [key, rate(sum[key], sum.min, 36)])),
    zones: [...zones.values()].map(zone => ({ ...zone, pct: rate(zone.made, zone.attempts, 100) })) };
}
export function nbaStyle(aggregate, references = NBA_REFERENCES) {
  const vector = styleVector(aggregate);
  if (aggregate.games < STYLE_MINIMUM.games || aggregate.min < STYLE_MINIMUM.minutes || aggregate.fga < STYLE_MINIMUM.attempts || !vector)
    return { available: false, minimum: STYLE_MINIMUM, season: NBA_REFERENCE_SEASON, matches: [] };
  const matches = references.map(reference => {
    const target = styleVector(reference);
    const differences = STYLE_FEATURES.map(feature => ({ label: feature.label, key: feature.key, yours: vector[feature.key], reference: target[feature.key], gap: Math.abs(vector[feature.key] - target[feature.key]) / feature.scale })).sort((a, b) => a.gap - b.gap);
    return { name: reference.name, distance: styleDistance(vector, target), closestFeatures: differences.slice(0, 2), largestDifference: differences.at(-1) };
  }).sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  // Never force an out-of-range statistical pattern into a convincing star label.
  return { available: true, matches: matches.slice(0, 3), weakMatch: matches[0].distance > 1, season: NBA_REFERENCE_SEASON, referenceCount: references.length };
}
export function premiumAnalysis(sessions, zones) {
  const coverage = qualifyGames(sessions, zones), aggregate = aggregateGames(coverage.games);
  const recentGames = coverage.games.slice(-5), priorGames = coverage.games.slice(-10, -5);
  const recent = aggregateGames(recentGames), prior = aggregateGames(priorGames);
  const recentStyle = nbaStyle(recent), priorStyle = nbaStyle(prior);
  let styleTrend = null;
  if (recentStyle.available && priorStyle.available) {
    const name = recentStyle.matches[0].name, current = recentStyle.matches[0].distance, previous = priorStyle.matches.find(match => match.name === name)?.distance;
    // Evaluate the same reference even if it was outside the previous top three.
    const reference = NBA_REFERENCES.find(ref => ref.name === name);
    const before = previous ?? styleDistance(styleVector(prior), styleVector(reference));
    styleTrend = { name, previous: before, current, direction: current < before - .05 ? 'closer' : current > before + .05 ? 'further' : 'steady' };
  }
  return { ...coverage, aggregate, nba: nbaStyle(aggregate), recent, prior, styleTrend,
    trendAvailable: recentGames.length === 5 && priorGames.length === 5,
    recentIds: recentGames.map(game => game.id), priorIds: priorGames.map(game => game.id) };
}
