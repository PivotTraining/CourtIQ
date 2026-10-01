// Shooting definitions: https://www.nba.com/stats/help/glossary
// TS uses the conventional 0.44 FT approximation, not possession tracking.
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const ratio = (numerator, denominator, scale = 1) => denominator > 0 ? numerator / denominator * scale : null;
export const percent = value => value === null ? '—' : `${value.toFixed(1)}%`;

export function buildSessionReport(shotLogs = [], stats = {}, zones = [], freeThrows) {
  const zoneMap = new Map(zones.map(zone => [zone.id, zone]));
  const fieldGoals = shotLogs.filter(shot => [2, 3].includes(zoneMap.get(shot.zone_id)?.pts));
  const unknownShots = shotLogs.filter(shot => !zoneMap.has(shot.zone_id)).length;
  const ftLogs = freeThrows ?? shotLogs.filter(shot => shot.zone_id === 'free-throw');
  // Prefer the shot ledger. Older sessions may have only summary FT counts.
  const useLedger = freeThrows !== undefined || ftLogs.length > 0;
  const fta = useLedger ? ftLogs.length : count(stats.ft_total);
  const ftm = useLedger ? ftLogs.filter(shot => shot.made).length : Math.min(fta, count(stats.ft_made));
  const fga = fieldGoals.length;
  const fgm = fieldGoals.filter(shot => shot.made).length;
  const threes = fieldGoals.filter(shot => zoneMap.get(shot.zone_id).pts === 3);
  const threeMade = threes.filter(shot => shot.made).length;
  const twoAttempts = fga - threes.length;
  const twoMade = fgm - threeMade;
  const fieldGoalPoints = 2 * twoMade + 3 * threeMade;
  const pts = fieldGoalPoints + ftm;
  const box = Object.fromEntries(['ast', 'reb', 'stl', 'blk', 'to', 'pf', 'min'].map(key => [key, count(stats[key])]));
  // Missing historical splits are unknown, not evidence of zero split rebounds.
  if (stats.oreb !== undefined && stats.dreb !== undefined) {
    box.oreb = count(stats.oreb); box.dreb = count(stats.dreb);
  }
  const eff = pts + box.reb + box.ast + box.stl + box.blk - (fga - fgm) - (fta - ftm) - box.to;
  return {
    fieldGoals, unknownShots, fga, fgm, ftm, fta, pts, box, eff,
    twoAttempts, twoMade, threeAttempts: threes.length, threeMade,
    fgPct: ratio(fgm, fga, 100), twoPct: ratio(twoMade, twoAttempts, 100),
    threePct: ratio(threeMade, threes.length, 100), ftPct: ratio(ftm, fta, 100),
    efgPct: ratio(fgm + 0.5 * threeMade, fga, 100),
    tsPct: ratio(pts, 2 * (fga + 0.44 * fta), 100),
    astTo: ratio(box.ast, box.to), threeShare: ratio(threes.length, fga, 100),
    pointsPerFga: ratio(fieldGoalPoints, fga),
    pointsPer36: ratio(pts * 36, box.min),
    zones: zones.filter(zone => zone.pts !== 1).map(zone => {
      const attempts = fieldGoals.filter(shot => shot.zone_id === zone.id);
      const made = attempts.filter(shot => shot.made).length;
      return { id: zone.id, label: zone.label, attempts: attempts.length, made, pct: ratio(made, attempts.length, 100) };
    }).filter(zone => zone.attempts > 0),
  };
}

export function sessionReportCsv(report, { type = 'game', date = '', playerName = '' } = {}) {
  const rows = [
    ...(playerName ? [['Player', playerName]] : []),
    ['Session type', type], ['Date', date], ['PTS', report.pts], ['MIN', report.box.min || 'Not recorded'],
    ['FGM', report.fgm], ['FGA', report.fga], ['FG%', percent(report.fgPct)],
    ['2PM', report.twoMade], ['2PA', report.twoAttempts], ['2PT%', percent(report.twoPct)],
    ['3PM', report.threeMade], ['3PA', report.threeAttempts], ['3PT%', percent(report.threePct)],
    ['FTM', report.ftm], ['FTA', report.fta], ['FT%', percent(report.ftPct)],
    ...Object.entries(report.box).filter(([key]) => key !== 'min').map(([key, value]) => [key.toUpperCase(), value]),
    ['eFG%', percent(report.efgPct)], ['Estimated TS%', percent(report.tsPct)],
    ['AST/TO', report.astTo === null ? `${report.box.ast} AST / 0 TO (ratio undefined)` : report.astTo.toFixed(2)],
    ['EFF (box-score tally; not PER)', report.eff], ['3PA share of FGA', percent(report.threeShare)],
    ['FG points per FGA (excludes FT)', report.pointsPerFga?.toFixed(2) ?? '—'],
    ...(type === 'game' ? [['PTS per 36 (normalized; not a forecast)', report.pointsPer36?.toFixed(1) ?? 'Minutes not recorded']] : []),
    ['Scope', 'Manually recorded player session; unlogged events are not included'],
    ['TS method', 'PTS / (2 * (FGA + 0.44 * FTA)); FT estimate, not exact possessions'],
    ['Excluded unknown-zone shots', report.unknownShots],
    ['Zone', 'Made', 'Attempts', 'FG%'],
    ...report.zones.map(zone => [zone.label, zone.made, zone.attempts, percent(zone.pct)]),
  ];
  const cell = value => { const text = String(value); const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };
  return rows.map(row => row.map(cell).join(',')).join('\r\n');
}
