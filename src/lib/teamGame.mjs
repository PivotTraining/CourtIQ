import { buildSessionReport, percent } from './sessionReport.mjs';

export function lastRecordingReference(bundle, pending = []) {
  const entries=[...bundle.members.flatMap(member=>member.snapshot.events || []),...pending]
    .filter(event=>['shot','stat','reverse'].includes(event.payload.kind))
    .sort((a,b)=>new Date(b.payload.recorded_at)-new Date(a.payload.recorded_at));
  return {period:entries[0]?.payload.period ?? 1,clock:entries[0]?.payload.clock ?? '00:00'};
}

export function buildTeamGameReport(bundle, roster, zones) {
  const players = new Map(roster.map(player => [player.id, player]));
  const seen = new Set();
  const rows = bundle.members.map(member => {
    if (seen.has(member.player_id) || member.snapshot.session.player_id !== member.player_id) throw new Error('Inconsistent roster records');
    seen.add(member.player_id);
    const profile = players.get(member.player_id);
    const report = buildSessionReport(member.snapshot.shots, member.snapshot.session.game_stats, zones);
    return { playerId: member.player_id, sessionId: member.session_id, name: profile?.name || 'Unavailable player',
      jersey: profile?.jersey_number ?? '', report, version: member.snapshot.session.tracker_version };
  });
  const stats = Object.fromEntries(['ast','reb','stl','blk','to','pf'].map(key => [key, rows.reduce((sum, row) => sum+row.report.box[key], 0)]));
  const totals = buildSessionReport(bundle.members.flatMap(member => member.snapshot.shots), stats, zones);
  const expected = bundle.game.create_request?.players?.length ?? rows.length;
  return { rows, totals, expected, missing: Math.max(0, expected-rows.length) };
}

export function teamGameCsv(bundle, report) {
  const totals = report.totals;
  const cells = [
    ['Team',bundle.game.team_name], ['Opponent',bundle.game.context.opponent || 'Not entered'], ['Date',bundle.game.context.date],
    ['Status',bundle.game.status], ['Scope','Recorded roster totals only; unlogged player/opponent events are excluded'],
    ['Missing roster records',report.missing],
    ['Player','Jersey','PTS','FGM','FGA','FG%','3PM','3PA','FTM','FTA','AST','REB','STL','BLK','TO','PF','MIN'],
    ...report.rows.map(row => { const r=row.report; return [row.name,row.jersey,r.pts,r.fgm,r.fga,percent(r.fgPct),r.threeMade,r.threeAttempts,r.ftm,r.fta,r.box.ast,r.box.reb,r.box.stl,r.box.blk,r.box.to,r.box.pf,r.box.min || 'Not recorded']; }),
    ['Recorded roster totals','',totals.pts,totals.fgm,totals.fga,percent(totals.fgPct),totals.threeMade,totals.threeAttempts,totals.ftm,totals.fta,totals.box.ast,totals.box.reb,totals.box.stl,totals.box.blk,totals.box.to,totals.box.pf,'Not a team clock'],
    ['Actual final team score',bundle.game.context.team_score ?? 'Not entered'], ['Actual final opponent score',bundle.game.context.opponent_score ?? 'Not entered'],
    ['Recorded roster eFG%',percent(totals.efgPct)],['Recorded roster estimated TS%',percent(totals.tsPct)],
    ['TS method','PTS / (2 * (FGA + 0.44 * FTA)); approximation, not measured possessions'],
  ];
  // Neutralize spreadsheet formula prefixes in user-authored names/labels.
  const cell = value => { const text=String(value ?? ''); const safe=typeof value==='string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g,'""')}"`; };
  return cells.map(row => row.map(cell).join(',')).join('\r\n');
}
