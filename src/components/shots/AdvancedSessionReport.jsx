"use client";

import { useState } from 'react';
import { COURT_ZONES } from '@/lib/constants';
import { buildSessionReport, percent, sessionReportCsv } from '@/lib/sessionReport.mjs';
import './tracker.css';

export default function AdvancedSessionReport({ shots, gameStats = {}, freeThrows, sessionType = 'game', date = '' }) {
  const report = buildSessionReport(shots, gameStats, COURT_ZONES, freeThrows);
  const [exportError, setExportError] = useState('');
  const exportCsv = () => {
    let url;
    try {
      url = URL.createObjectURL(new Blob([sessionReportCsv(report, { type: sessionType, date })], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `courtiq-${sessionType}-report.csv`;
      link.click();
      setExportError('');
    } catch {
      setExportError('The report could not download. Your stats are still here. Please try again.');
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  const metrics = [
    ['eFG%', percent(report.efgPct), 'Adjusts for three-point value'],
    ['Estimated TS%', percent(report.tsPct), 'Includes FT using a 0.44 estimate'],
    ['AST / TO', report.astTo === null ? `${report.box.ast} / 0` : `${report.astTo.toFixed(2)} : 1`, report.astTo === null ? 'No turnovers recorded; ratio undefined' : 'Assists per turnover'],
    ['3PT shot share', percent(report.threeShare), 'Three-point attempts / all FG attempts'],
    ['FG points / attempt', report.pointsPerFga?.toFixed(2) ?? '—', 'Field-goal scoring only; excludes FT'],
    ...(sessionType === 'game' ? [['PTS per 36', report.pointsPer36?.toFixed(1) ?? '—', report.box.min > 0 ? 'Normalized to 36 minutes; not a forecast' : 'Record minutes to calculate']] : []),
  ];
  return (
    <section className="advanced-report" aria-label="Advanced player session report" onClick={event => event.stopPropagation()}>
      <div className="report-heading"><h3>Player performance report</h3><button onClick={exportCsv}>Export CSV</button></div>
      <p className="report-note">{sessionType === 'game' ? 'Game' : 'Practice'} · {report.fga} FG attempts · {report.fta} FT attempts. Based only on what you recorded.</p>
      <div className="report-metrics">{metrics.map(([label, value, description]) => (
        <div key={label}><span>{label}</span><strong>{value}</strong><small>{description}</small></div>
      ))}</div>
      <div className="report-splits">
        {[['2PT', report.twoMade, report.twoAttempts, report.twoPct], ['3PT', report.threeMade, report.threeAttempts, report.threePct], ['FT', report.ftm, report.fta, report.ftPct]].map(([label, made, attempts, pct]) => (
          <div key={label}><b>{label}</b><span>{made}/{attempts}</span><span>{percent(pct)}</span></div>
        ))}
      </div>
      <div className="report-box">{[['PTS', report.pts], ...Object.entries(report.box).map(([key, value]) => [key.toUpperCase(), key === 'min' && !value ? '—' : value]), ['EFF', report.eff]].map(([label, value]) => <span key={label}><b>{value}</b> {label}</span>)}</div>
      <details>
        <summary>Shot zones & how to read this report</summary>
        {report.zones.length > 0 ? <div className="report-splits">{report.zones.map(zone => <div key={zone.id}><b>{zone.label}</b><span>{zone.made}/{zone.attempts}</span><span>{percent(zone.pct)}</span></div>)}</div> : <p className="report-note">No field-goal attempts recorded.</p>}
        <p className="report-note">Small samples are descriptive, not a player rating. Unlogged stats are not included. EFF is a basic box-score tally, not PER. Estimated TS uses PTS ÷ [2 × (FGA + 0.44 × FTA)]; it is not exact possession efficiency. Practice and game reports should not be treated as equivalent.</p>
        <p className="report-note">Team ratings, usage and plus/minus require team, opponent or lineup data and are not inferred here. Definitions: <a href="https://www.nba.com/stats/help/glossary" target="_blank" rel="noopener noreferrer">NBA stats glossary</a>.</p>
      </details>
      {report.unknownShots > 0 && <p role="status" className="report-note">{report.unknownShots} unknown-zone shot(s) excluded. Review the source records.</p>}
      {exportError && <p role="alert">{exportError}</p>}
    </section>
  );
}
