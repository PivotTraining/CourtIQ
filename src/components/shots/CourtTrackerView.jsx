"use client";

import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/Icons';
import { COURT_ZONES } from '@/lib/constants';
import { getHeatColor } from '@/lib/utils';
import './tracker.css';

const STAT_INPUTS = [
  { key: 'ast', label: 'Assist', short: 'AST', icon: 'eye', tone: 'green' },
  { key: 'reb', label: 'Rebound', short: 'REB', icon: 'refresh', tone: 'amber' },
  { key: 'stl', label: 'Steal', short: 'STL', icon: 'lock', tone: 'teal' },
  { key: 'blk', label: 'Block', short: 'BLK', icon: 'shield', tone: 'violet' },
  { key: 'to', label: 'Turnover', short: 'TO', icon: 'zap', tone: 'red' },
  { key: 'pf', label: 'Foul', short: 'PF', icon: 'hand', tone: 'amber' },
];
// Spread touch targets apart on small courts; all zones remain named and selectable.
const TOUCH_POSITIONS = {
  'left-corner-3': [8, 83], 'right-corner-3': [92, 83],
  'top-key-3': [50, 11], 'left-wing-3': [9, 25], 'right-wing-3': [91, 25],
  'left-elbow': [32, 32], 'right-elbow': [68, 32],
  'left-mid': [17, 54], 'right-mid': [83, 54],
  'paint': [50, 56], 'left-block': [33, 79], 'right-block': [67, 79],
};

function StatInputs({ stats, updateStat, busy, compact = false }) {
  return <div className={`tracker-stat-grid ${compact ? 'compact' : ''}`}>
    {STAT_INPUTS.map(stat => <button key={stat.key} className="tracker-stat-input" data-tone={stat.tone}
      disabled={busy} aria-label={`Add ${stat.label.toLowerCase()}, current count ${stats[stat.key]}`}
      onClick={() => updateStat(stat.key, 1)}>
      <Icon name={stat.icon} size={compact ? 18 : 24} />
      <span>{compact ? stat.short : stat.label}</span><strong>{stats[stat.key]}</strong>
    </button>)}
  </div>;
}

export default function CourtTrackerView({ sessionType, shots, selectedZone, selectZone, gameStats, updateStat,
  saving, ending, saveError, tab, setTab, darkMode, onToggleTheme, courtTheme, setCourtTheme,
  undoCount, undoLast, endSession, logShot, logFreeThrow, ticker }) {
  const busy = saving || ending;
  const selected = COURT_ZONES.find(zone => zone.id === selectedZone);
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.focus();
    const trapFocus = event => {
      if (event.key !== 'Tab') return;
      const targets = [...dialog.querySelectorAll('button:not(:disabled), select:not(:disabled), a[href]')];
      const first = targets[0];
      const last = targets.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    dialog.addEventListener('keydown', trapFocus);
    return () => { dialog.removeEventListener('keydown', trapFocus); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <div ref={dialogRef} tabIndex={-1} className="stat-tracker" role="dialog" aria-modal="true" aria-label="Basketball stat tracker">
    <div className="tracker-frame">
      <header className="tracker-header">
        <button className="tracker-end" onClick={endSession} disabled={busy}>{ending ? 'Saving…' : 'End session'}</button>
        <strong>{sessionType === 'game' ? 'Gametime' : 'Practice'}</strong>
        <button onClick={undoLast} disabled={busy || undoCount === 0}><Icon name="undo" size={16} /> Undo</button>
        <button className="tracker-theme" onClick={onToggleTheme} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}>
          <Icon name={darkMode ? 'sun' : 'moon'} size={20} />
        </button>
      </header>
      {saveError && <div className="tracker-error" role="alert">{saveError}</div>}
      {ticker}
      <div className="tracker-tabs" aria-label="Tracking view">
        {['court', 'stats'].map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>
          <Icon name={value === 'court' ? 'basketball' : 'barChart'} size={16} />{value === 'court' ? 'Shot chart' : 'Box score'}
        </button>)}
      </div>
      <div className="tracker-content">
        {tab === 'court' ? <div className="tracker-court-layout">
          <section className="tracker-court-panel" aria-label="Shot location">
            <div className={`tracker-court ${courtTheme === 'gray' ? 'gray' : ''}`}>
              <svg viewBox="0 0 500 400" aria-hidden="true">
                <rect x="25" y="10" width="450" height="380" fill="none" rx="4" />
                <path d="M 60 380 L 60 300 Q 60 80 250 45 Q 440 80 440 300 L 440 380" fill="none" />
                <rect x="160" y="230" width="180" height="160" fill="none" rx="2" />
                <circle cx="250" cy="230" r="55" fill="none" strokeDasharray="6 4" />
                <circle cx="250" cy="360" r="7" fill="none" />
                <path d="M 222 368 L 278 368 M 220 380 Q 220 335 250 326 Q 280 335 280 380" fill="none" />
              </svg>
              {COURT_ZONES.filter(zone => zone.pts !== 1).map(zone => {
                const attempts = shots.filter(shot => shot.zone_id === zone.id);
                const made = attempts.filter(shot => shot.made).length;
                const [x, y] = TOUCH_POSITIONS[zone.id] || [zone.x, zone.y];
                return <button key={zone.id} className="tracker-zone" aria-label={`${zone.label}, ${zone.pts} points, ${made} made of ${attempts.length}`} aria-pressed={selectedZone === zone.id}
                  onClick={() => selectZone(selectedZone === zone.id ? null : zone.id)}
                  style={{ left: `${x}%`, top: `${y}%`, ...(attempts.length ? { background: getHeatColor(made / attempts.length * 100) } : {}) }}>
                  {attempts.length ? `${made}/${attempts.length}` : zone.pts === 3 ? '3' : '2'}
                </button>;
              })}
            </div>
            <div className="tracker-location-row">
              <label className="tracker-location"><span className="sr-only">Shot location</span>
                <select value={selectedZone || ''} onChange={event => selectZone(event.target.value || null)}>
                  <option value="">Free throws / choose a zone</option>
                  {COURT_ZONES.filter(zone => zone.pts !== 1).map(zone => <option key={zone.id} value={zone.id}>{zone.label} · {zone.pts}PT</option>)}
                </select>
              </label>
              <button aria-label="Change court surface" title="Change court surface" onClick={() => setCourtTheme(courtTheme === 'tan' ? 'gray' : 'tan')}><Icon name="paint" size={18} /></button>
            </div>
          </section>
          <section className="tracker-controls" aria-label="Stat inputs">
            <div className="tracker-shot-actions">
              <p>{selected ? `${selected.label} · ${selected.pts}PT` : 'Free throws'}<span>{saving ? 'Saving…' : 'Tap a zone, then record the result'}</span></p>
              <div>
                <button className="tracker-result" data-tone="green" disabled={busy} onClick={() => selected ? logShot(true) : logFreeThrow(true)}><Icon name="check" size={18} />{selected ? 'Made' : 'Made FT'}</button>
                <button className="tracker-result" data-tone="red" disabled={busy} onClick={() => selected ? logShot(false) : logFreeThrow(false)}><Icon name="x" size={18} />{selected ? 'Missed' : 'Missed FT'}</button>
              </div>
            </div>
            <StatInputs stats={gameStats} updateStat={updateStat} busy={busy} compact />
            <p className="tracker-hint">Undo corrects the last entry. Minutes are in Box score.</p>
          </section>
        </div> : <section className="tracker-boxscore" aria-label="Player box score inputs">
          <h2>Player box score</h2><p className="tracker-hint">Track a player yourself or keep their stats as a coach. Shooting totals come from the shot chart.</p>
          <StatInputs stats={gameStats} updateStat={updateStat} busy={busy} />
          <div className="tracker-minutes">
            <h3>Minutes played</h3>
            <div><button aria-label="Subtract one minute" disabled={busy || gameStats.min <= 0} onClick={() => updateStat('min', -1)}>−</button><output aria-label="Minutes played">{gameStats.min}</output><button aria-label="Add one minute" disabled={busy} onClick={() => updateStat('min', 1)}>+</button></div>
            <p className="tracker-hint">Enter actual playing time, not session length. This enables per-36 scoring in the game report.</p>
          </div>
          <div className="tracker-report-preview"><h3>Included in your final report</h3><p>Full box score, 2PT / 3PT / FT splits, eFG%, estimated TS%, assist-to-turnover ratio, shot-zone distribution and a downloadable CSV for coach review.</p></div>
        </section>}
      </div>
    </div>
  </div>;
}
