"use client";

import { useState } from 'react';
import { COURT_ZONES } from '@/lib/constants';
import { buildGameShotChartData } from '@/lib/gameShotChart.mjs';
import './game-shot-chart.css';

// Placement matches the live court's labeled zones. Each badge represents
// a ZONE COUNT, not an invented exact release position for individual shots.
const ZONE_POSITIONS = {
  'left-corner-3': [40, 332], 'right-corner-3': [460, 332],
  'top-key-3': [250, 44], 'left-wing-3': [48, 100], 'right-wing-3': [452, 100],
  'left-elbow': [160, 128], 'right-elbow': [340, 128],
  'left-mid': [85, 216], 'right-mid': [415, 216],
  paint: [250, 226], 'left-block': [165, 316], 'right-block': [335, 316],
};
const MODES = [
  { id: 'all', label: 'All shots' },
  { id: 'misses', label: 'Misses' },
  { id: 'makes', label: 'Makes' },
];

function ShotMarker({ x, y, count, made }) {
  const shade = made ? '#147D4E' : '#C32F42';
  return <g transform={`translate(${x} ${y})`}>
    <circle r="18" fill={shade} stroke="#ffffff" strokeWidth="2.5" />
    <text y="4.5" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="850">
      {made ? '✓' : '×'}{count}
    </text>
  </g>;
}

export default function GameShotChart({ shots = [] }) {
  const [mode, setMode] = useState('all');
  const report = buildGameShotChartData(shots, COURT_ZONES);
  const visible = report.zones.filter(zone =>
    mode === 'makes' ? zone.made > 0 : mode === 'misses' ? zone.missed > 0 : true);
  const hasFieldGoals = report.attempts > 0;

  return <section className="game-shot-chart" aria-label="Recorded game shot chart">
    <div className="game-shot-chart-heading">
      <div>
        <h3>Game shot chart</h3>
        <p>Review where recorded shots went in this game.</p>
      </div>
      <div className="game-shot-chart-summary" aria-label="Recorded field goal totals">
        <span><strong>{report.made}</strong> made</span>
        <span><strong>{report.missed}</strong> missed</span>
      </div>
    </div>

    {hasFieldGoals ? <>
      <div className="game-shot-chart-filters" role="group" aria-label="Filter recorded shot results">
        {MODES.map(item => <button
          key={item.id} type="button" aria-pressed={mode === item.id}
          onClick={() => setMode(item.id)}>
          {item.label}
          <span>{item.id === 'all' ? report.attempts : item.id === 'makes' ? report.made : report.missed}</span>
        </button>)}
      </div>
      <div className="game-shot-chart-court">
        <svg viewBox="0 0 500 400" role="img"
          aria-label={`Half basketball court with ${mode === 'all' ? 'makes and misses' : mode} grouped by recorded shooting zone`}>
          <rect x="25" y="10" width="450" height="380" rx="4" fill="none" stroke="#A58D6D" strokeWidth="2.5"/>
          <path d="M 60 380 L 60 300 Q 60 80 250 45 Q 440 80 440 300 L 440 380"
            fill="none" stroke="#A58D6D" strokeWidth="2.5" />
          <rect x="160" y="230" width="180" height="160" fill="none" stroke="#A58D6D" strokeWidth="2.5" />
          <circle cx="250" cy="230" r="55" fill="none" stroke="#A58D6D" strokeWidth="2" strokeDasharray="6 4"/>
          <circle cx="250" cy="360" r="7" fill="none" stroke="#A58D6D" strokeWidth="2.5"/>
          <path d="M 222 368 L 278 368 M 220 380 Q 220 335 250 326 Q 280 335 280 380"
            fill="none" stroke="#A58D6D" strokeWidth="2.5"/>
          {visible.map(zone => {
            const [x, y] = ZONE_POSITIONS[zone.id] || [zone.x * 5, zone.y * 4];
            const both = mode === 'all' && zone.made > 0 && zone.missed > 0;
            return <g key={zone.id}>
              {mode !== 'misses' && zone.made > 0 &&
                <ShotMarker x={x - (both ? 19 : 0)} y={y} count={zone.made} made />}
              {mode !== 'makes' && zone.missed > 0 &&
                <ShotMarker x={x + (both ? 19 : 0)} y={y} count={zone.missed} made={false} />}
            </g>;
          })}
        </svg>
      </div>
      <div className="game-shot-chart-legend">
        <span><i className="game-shot-chart-make">✓</i> Made</span>
        <span><i className="game-shot-chart-miss">×</i> Missed</span>
        <span>Number = attempts in that zone</span>
      </div>
      {visible.length ? <div className="game-shot-chart-zones">
        <h4>{mode === 'misses' ? 'Missed-shot locations' : mode === 'makes' ? 'Made-shot locations' : 'Recorded shooting zones'}</h4>
        <ul>
          {visible.map(zone => <li key={zone.id}>
            <strong>{zone.label}</strong>
            <span>{mode === 'misses'
              ? `${zone.missed} missed`
              : mode === 'makes' ? `${zone.made} made`
                : `${zone.made} made · ${zone.missed} missed`}</span>
          </li>)}
        </ul>
      </div> : <p className="game-shot-chart-empty">
        {mode === 'misses' ? 'No missed field goals were recorded for this game.' : 'No made field goals were recorded for this game.'}
      </p>}
    </> : <p className="game-shot-chart-empty">
      No field-goal locations were recorded for this game. The court chart will populate when shots are tracked during a game.
    </p>}

    {report.freeThrows.attempts > 0 && <p className="game-shot-chart-free-throws">
      Free throws (tracked separately): <strong>{report.freeThrows.made} made · {report.freeThrows.missed} missed</strong>
    </p>}
    {report.unmapped > 0 && <p className="game-shot-chart-caution">
      {report.unmapped} historical {report.unmapped === 1 ? 'entry has' : 'entries have'} no usable shot-zone information and {report.unmapped === 1 ? 'is' : 'are'} not placed on this court.
    </p>}
    <p className="game-shot-chart-footnote">Positions represent recorded court zones, not exact release points. Only attempts saved for this game are shown.</p>
  </section>;
}
