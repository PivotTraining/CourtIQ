"use client";

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icons';
import { COURT_ZONES } from '@/lib/constants';
import { getHeatColor } from '@/lib/utils';
import './tracker.css';

const STAT_INPUTS = [
  { key: 'ast', label: 'Assist', short: 'AST', icon: 'eye', tone: 'green' },
  { key: 'reb', label: 'Rebound', short: 'REB', icon: 'refresh', tone: 'amber' },
  { key: 'stl', label: 'Steal', short: 'STL', icon: 'hand', tone: 'teal' },
  { key: 'blk', label: 'Block', short: 'BLK', icon: 'shield', tone: 'violet' },
  { key: 'to', label: 'Turnover', short: 'TO', icon: 'zap', tone: 'red' },
  { key: 'pf', label: 'Foul', short: 'PF', icon: 'alert', tone: 'amber' },
];
// Spread touch targets apart on small courts; all zones remain named and selectable.
const TOUCH_POSITIONS = {
  'left-corner-3': [8, 83], 'right-corner-3': [92, 83],
  'top-key-3': [50, 11], 'left-wing-3': [9, 25], 'right-wing-3': [91, 25],
  'left-elbow': [32, 32], 'right-elbow': [68, 32],
  'left-mid': [17, 54], 'right-mid': [83, 54],
  'paint': [50, 56], 'left-block': [33, 79], 'right-block': [67, 79],
};

export function StatInputs({ stats, updateStat, busy, compact = false }) {
  return <div className={`tracker-stat-grid ${compact ? 'compact' : ''}`} role="group" aria-label="Record a player statistic">
    {STAT_INPUTS.map(stat => <button
      key={stat.key} type="button" className="tracker-stat-input" data-tone={stat.tone} data-stat-key={stat.key}
      disabled={busy} aria-label={`Add ${stat.label.toLowerCase()}, current count ${stats[stat.key] ?? 0}`}
      onClick={() => updateStat(stat.key, 1, stat.label)}>
      <Icon name={stat.icon} size={compact ? 20 : 24} />
      <span>{stat.label}</span><strong>{stats[stat.key] ?? 0}</strong>
    </button>)}
  </div>;
}

export default function CourtTrackerView({ sessionType, shots, gameStats, updateStat,
  saving, ending, saveError, tab, setTab, darkMode, onToggleTheme, courtTheme, setCourtTheme,
  undoCount, undoLast, endSession, logShotAtZone, logFreeThrow, ticker, videoDock,
  period=1,setPeriod=()=>{},clock='00:00',setClock=()=>{},
  gameContext={},onEditGame=()=>{},endLabel = 'End session', headerTitle }) {
  const busy = saving || ending;
  const [lastStat, setLastStat] = useState('');
  const [shotMode, setShotMode] = useState('made');
  const [lastShot, setLastShot] = useState('');
  const [lastShotZone, setLastShotZone] = useState(null);
  // Confirm the precise stat the app accepted locally; never claim cloud sync
  // while a game command may still be pending.
  const recordStat = (key, delta, label) => {
    if (busy) return false;
    const accepted = updateStat(key, delta);
    if (accepted === true) setLastStat(`${label} ${delta > 0 ? '+1' : '−1'} added to this game`);
    return accepted;
  };
  const recordCourtShot = zone => {
    if (busy) return;
    // Durable device state is written by the tracker entry() function before
    // it returns true. A tap alone is the shot event, never a zone selection.
    const accepted = logShotAtZone?.(zone.id, shotMode === 'made');
    if (accepted === true) {
      setLastShotZone(zone.id);
      setLastShot(`${shotMode === 'made' ? 'Made' : 'Missed'} ${zone.pts}-point attempt recorded · ${zone.label}`);
    } else {
      setLastShot('Shot not recorded. Please tap the location again.');
    }
  };
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.focus();
    const trapFocus = event => {
      if (event.key !== 'Tab') return;
      const targets = [...dialog.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), a[href]')];
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
        <button className="tracker-end" onClick={endSession} disabled={busy}>{ending ? 'Saving…' : endLabel}</button>
        <strong>{headerTitle || (sessionType === 'game' ? 'Gametime' : 'Practice')}</strong>
        <button onClick={undoLast} disabled={busy || undoCount === 0}><Icon name="undo" size={16} /> Undo</button>
        <button className="tracker-theme" onClick={onToggleTheme} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}>
          <Icon name={darkMode ? 'sun' : 'moon'} size={20} />
        </button>
      </header>
      {saveError && <div className="tracker-error" role="alert">{saveError}</div>}
      <div className={`tracker-workspace${videoDock ? " tracker-workspace-video" : ""}`}>
        {videoDock}
        <div className="tracker-tracking-column">
      {sessionType==='game'&&<div className="tracker-game-bar" aria-label="Current game controls">
        <div className="tracker-period-controls">
          <button type="button" aria-label="Previous period" disabled={busy||period<=1}
            onClick={()=>setPeriod(Math.max(1,period-1))}>−</button>
          <strong>{gameContext?.format==='halves'?'H':'Q'}{period}</strong>
          <button type="button" aria-label="Next period" disabled={busy}
            onClick={()=>setPeriod(Math.min(99,period+1))}>+</button>
        </div>
        <label className="tracker-live-clock">Game clock
          <input aria-label="Manual game clock" inputMode="numeric" value={clock}
            disabled={busy} onChange={event=>{
              if(/^\d{0,2}:?\d{0,2}$/.test(event.target.value))setClock(event.target.value);
            }}/>
        </label>
        <button type="button" className="tracker-score-control" onClick={onEditGame}>
          Team {gameContext?.team_score||'—'} : {gameContext?.opponent_score||'—'} Opp <span>Edit</span>
        </button>
      </div>}
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
                return <button key={zone.id} type="button" className="tracker-zone" aria-label={`${zone.label}, ${zone.pts} points, ${made} made of ${attempts.length}; tap to record a ${shotMode === 'made' ? 'made' : 'missed'} shot`}
                  data-last-recorded={lastShotZone === zone.id} disabled={busy} onClick={() => recordCourtShot(zone)}
                  style={{ left: `${x}%`, top: `${y}%`, ...(attempts.length ? { background: getHeatColor(made / attempts.length * 100) } : {}) }}>
                  {attempts.length ? `${made}/${attempts.length}` : zone.pts === 3 ? '3' : '2'}
                </button>;
              })}
            </div>
            <div className="tracker-location-row">
              <p className="tracker-location-feedback" role="status" aria-live="polite">
                {`Tap a court spot once to record a ${shotMode === 'made' ? 'made' : 'missed'} shot`}
              </p>
              <button type="button" aria-label="Change court surface" title="Change court surface" onClick={() => setCourtTheme(courtTheme === 'tan' ? 'gray' : 'tan')} className="tracker-surface-button"><Icon name="paint" size={18} /></button>
            </div>
          </section>
          <section className="tracker-controls" aria-label="Stat inputs">
            <div className="tracker-shot-actions">
              <p className="tracker-shot-instruction">Choose the result, then tap the court once. Each tap records one attempt.</p>
              <div className="tracker-shot-mode" role="group" aria-label="Shot result for next court tap">
                <button type="button" data-shot-mode="made" data-tone="green" aria-pressed={shotMode === 'made'}
                  disabled={busy} onClick={() => {setShotMode('made');setLastShot('');}}>
                  <Icon name="check" size={17} /> Made
                </button>
                <button type="button" data-shot-mode="missed" data-tone="red" aria-pressed={shotMode === 'missed'}
                  disabled={busy} onClick={() => {setShotMode('missed');setLastShot('');}}>
                  <Icon name="x" size={17} /> Missed
                </button>
              </div>
              {lastShot && <p className="tracker-shot-ack" role="status" aria-live="polite">{lastShot}</p>}
              <div className="tracker-free-throw-actions" role="group" aria-label="One-tap free throws">
                <span>Free throws</span>
                <div className="tracker-free-throw-buttons">
                  <button type="button" className="tracker-result" data-tone="green" aria-label="Record a made free throw" disabled={busy} onClick={() => logFreeThrow(true)}><Icon name="check" size={18} />Made FT</button>
                  <button type="button" className="tracker-result" data-tone="red" aria-label="Record a missed free throw" disabled={busy} onClick={() => logFreeThrow(false)}><Icon name="x" size={18} />Missed FT</button>
                </div>
              </div>
            </div>
            <p className="tracker-stat-label">Live stats · Tap to add one</p>
            <StatInputs stats={gameStats} updateStat={recordStat} busy={busy} compact />
            {lastStat && <p className="tracker-stat-ack" role="status" aria-live="polite">{lastStat}</p>}
            <p className="tracker-hint tracker-tracking-tip">Made is the default. Switch to Missed to record misses with one tap per attempt. The mode stays active until changed. Free throws have separate one-tap buttons. Undo reverses the last entry.</p>
          </section>
        </div> : <section className="tracker-boxscore" aria-label="Player box score inputs">
          <h2>Player box score</h2>
          <StatInputs stats={gameStats} updateStat={recordStat} busy={busy} />
          {lastStat && <p className="tracker-stat-ack" role="status" aria-live="polite">{lastStat}</p>}
          {gameStats.oreb !== undefined && <div className="tracker-tool-row" aria-label="Rebound split">
            <button className="tracker-result" data-tone="amber" disabled={busy} onClick={() => recordStat('oreb', 1, 'Offensive rebound')}>Offensive rebound · {gameStats.oreb}</button>
            <button className="tracker-result" data-tone="amber" disabled={busy} onClick={() => recordStat('dreb', 1, 'Defensive rebound')}>Defensive rebound · {gameStats.dreb}</button>
             
          </div>}
          <div className="tracker-minutes">
            <h3>Minutes played</h3>
            <div><button aria-label="Subtract one minute" disabled={busy || gameStats.min <= 0} onClick={() => recordStat('min', -1, 'Minutes played')}>−</button><output aria-label="Minutes played">{gameStats.min}</output><button aria-label="Add one minute" disabled={busy} onClick={() => recordStat('min', 1, 'Minutes played')}>+</button></div>
             
          </div>
           
        </section>}
        {ticker}
      </div>
        </div>
      </div>
    </div>
  </div>;
}
