"use client";

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { fetchActiveSessions, fetchTrackerSession, createTrackerSession, applySessionCommand } from '@/lib/queries';
import { EMPTY_GAME_STATS, loadRecovery, saveRecovery, projectCommand, flushRecovery, recoveryKey, recordedPeriodScoring, recordedGameResult } from '@/lib/sessionRecovery.mjs';
import { COURT_ZONES } from '@/lib/constants';
import CourtTrackerView from './CourtTrackerView';
import AdvancedSessionReport from './AdvancedSessionReport';
import SessionTimeline from './SessionTimeline';
import GameContextForm from './GameContextForm';
import { buildSessionReport } from '@/lib/sessionReport.mjs';

export default function ReliableTracker({ onClose, darkMode, onToggleTheme }) {
  const { playerId, refreshData } = useApp();
  const { user } = useAuth();
  return <ReliableTrackerWorkspace key={`${user.id}:${playerId}`} accountId={user.id} playerId={playerId} refreshData={refreshData}
    onClose={onClose} darkMode={darkMode} onToggleTheme={onToggleTheme} />;
}

const DEFAULT_BACKEND = { fetchActiveSessions, fetchTrackerSession, createTrackerSession, applySessionCommand };

export function ReliableTrackerWorkspace({ accountId, playerId, refreshData, onClose, darkMode, onToggleTheme, backend = DEFAULT_BACKEND }) {
  const [value, setValue] = useState(null);
  const valueRef = useRef(null);
  const identity = useRef(`${accountId}:${playerId}`);
  const busyRef = useRef(false);
  const [active, setActive] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [status, setStatus] = useState('Checking saved games…');
  const [sessionType, setSessionType] = useState('game');
  const [context, setContext] = useState({ date: new Date().toLocaleDateString('en-CA'), opponent: '', season: '', competition: '', location: 'home', format: 'quarters', team_score: '', opponent_score: '' });
  const [period, setPeriod] = useState(1);
  const [clock, setClock] = useState('00:00');
  const [selectedZone, setSelectedZone] = useState(null);
  const [tab, setTab] = useState('court');
  const [courtTheme, setCourtTheme] = useState('tan');
  const [timeline, setTimeline] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const persist = next => {
    if (identity.current !== `${accountId}:${playerId}`) throw new Error('Account changed.');
    if (next.accountId !== accountId || next.playerId !== playerId) throw new Error('Recovery belongs to another account or player.');
    saveRecovery(window.localStorage, accountId, playerId, next);
    valueRef.current = next;
    setValue(next);
  };

  useEffect(() => {
    const expected = `${accountId}:${playerId}`;
    identity.current = expected;
    valueRef.current = null; busyRef.current = false;
    setValue(null); setReady(false); setActive([]); setBusy(false); setConflict(false); setError('');
    let alive = true;
    async function load() {
      try {
        const local = loadRecovery(window.localStorage, accountId, playerId);
        if (local && alive) { valueRef.current = local; setValue(local); setStatus(local.pending.length ? `${local.pending.length} entries on this device — not yet synced` : 'Restored on this device'); }
        const games = await backend.fetchActiveSessions(playerId);
        if (!alive) return;
        setActive(games);
        setReady(true);
        if (local && !local.pending.length) {
          const recovered = await backend.fetchTrackerSession(local.snapshot.session.id, playerId);
          if (!alive) return;
          const next = { accountId, playerId, snapshot: recovered, pending: [] };
          saveRecovery(window.localStorage, accountId, playerId, next);
          valueRef.current = next; setValue(next); setStatus('Saved to your account');
        }
      } catch {
        if (alive) { setError('Saved-game recovery is unavailable. Your records have not been cleared. The database upgrade or connection must be checked.'); setStatus('Not connected'); }
      }
    }
    load();
    return () => { alive = false; identity.current = null; };
  }, [accountId, playerId, backend]);

  useEffect(() => {
    const warn = event => { if (valueRef.current?.pending.length) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  async function sync(next = valueRef.current) {
    if (!next || busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError('');
    const expected = `${accountId}:${playerId}`;
    try {
      setStatus('Syncing…');
      await flushRecovery(next, backend.applySessionCommand, persist, () => identity.current === expected);
      setStatus('Saved to your account');
      return true;
    } catch (err) {
      if (identity.current !== expected) return false;
      const stale = err.code === '40001' || String(err.message).includes('SESSION_CONFLICT');
      setConflict(stale);
      setStatus(stale ? 'Another device changed this game — sync stopped' : 'Entries saved on this device — not yet synced');
      setError(stale ? 'No competing edits were overwritten. Download your pending entries before resolving this game.' : 'Sync failed. Your queued entries are still on this device. Reconnect and retry before signing out.');
      return false;
    } finally { if (identity.current === expected) { busyRef.current = false; setBusy(false); } }
  }

  async function entry(payload) {
    if (busyRef.current || conflict || !valueRef.current) return;
    try {
      const current = valueRef.current;
      const command = { id: crypto.randomUUID(), sessionId: current.snapshot.session.id,
        version: current.snapshot.session.tracker_version,
        payload: { ...payload, period, clock, recorded_at: new Date().toISOString() } };
      const next = { ...current, snapshot: projectCommand(current.snapshot, command), pending: [...current.pending, command] };
      persist(next);
      setStatus(`${next.pending.length} entries on this device — not yet synced`);
      return await sync(next);
    } catch (err) { setError(err.message || 'This device could not save the entry. It was not recorded.'); return false; }
  }

  async function start() {
    if (!ready || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (valueRef.current?.pending.length) throw new Error('Sync the existing session first.');
      const session = await backend.createTrackerSession(playerId, sessionType, context);
      persist({ accountId, playerId, snapshot: { session, shots: [], events: [] }, pending: [] });
      setStatus('Saved to your account');
    } catch (err) { setError(err.message || 'Could not start a game.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function resume(session) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const snapshot = await backend.fetchTrackerSession(session.id, playerId);
      persist({ accountId, playerId, snapshot, pending: [] });
      setContext(snapshot.session.tracker_context); setSessionType(snapshot.session.type);
      setStatus('Saved to your account');
    } catch { setError('Could not resume. Your saved game has not been changed.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function downloadPending() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(valueRef.current?.pending, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'courtiq-unsynced-entries.json'; link.click(); URL.revokeObjectURL(url);
  }
  async function resolveConflict() {
    if (!window.confirm('Replace this device’s pending entries with the saved account version? Download the unsynced entries first. Entries not accepted by the server will be removed from this device.')) return;
    busyRef.current = true; setBusy(true);
    try {
      const snapshot = await backend.fetchTrackerSession(valueRef.current.snapshot.session.id, playerId);
      persist({ accountId, playerId, snapshot, pending: [] });
      setConflict(false); setError(''); setStatus('Loaded saved account version. Review the downloaded entries before re-entering anything.');
    } catch { setError('The saved account version could not be loaded. Pending entries were kept.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function finish() {
    if (valueRef.current?.pending.length && !await sync()) return;
    if (await entry({ kind: 'end' })) {
      window.localStorage.removeItem(recoveryKey(accountId, playerId));
      await refreshData();
    }
  }

  const snapshot = value?.snapshot;
  const stats = { ...EMPTY_GAME_STATS, ...snapshot?.session.game_stats };
  const shots = snapshot?.shots.filter(shot => shot.zone_id !== 'free-throw') || [];
  const freeThrows = snapshot?.shots.filter(shot => shot.zone_id === 'free-throw') || [];
  const liveReport = buildSessionReport(shots, stats, COURT_ZONES, freeThrows);
  const reversals = new Set(snapshot?.events.filter(event => event.payload.kind === 'reverse').map(event => event.payload.target));
  const reversible = snapshot?.events.filter(event => ['stat', 'shot'].includes(event.payload.kind) && !reversals.has(event.id)) || [];
  const inputStyle = { minHeight: 44, borderRadius: 10, padding: 10, color: 'var(--color-text)', background: 'var(--color-card)', border: '1px solid var(--color-border)' };

  if (!snapshot) return <div role="dialog" aria-modal="true" aria-label="Start or resume game" className="fixed inset-0 z-[200] overflow-y-auto bg-bg p-6">
    <div className="max-w-lg mx-auto"><button onClick={onClose} style={inputStyle}>Close</button><h2 className="text-2xl font-black my-5">Start or resume</h2>
      {error && <p role="alert">{error}</p>}
      {active.map(session => <button key={session.id} disabled={busy} onClick={() => resume(session)} style={{ ...inputStyle, display: 'block', width: '100%', marginBottom: 12 }}>Resume {session.type} · {session.date}{session.tracker_context?.opponent ? ` vs ${session.tracker_context.opponent}` : ''}</button>)}
      <label>Session type <select style={inputStyle} value={sessionType} onChange={event => setSessionType(event.target.value)}><option value="game">Game</option><option value="practice">Practice</option></select></label>
      <GameContextForm value={context} onChange={setContext} />
      <p className="text-sm text-text-sec">One player per session. Shared roster recording is not activated yet.</p>
      <button style={{ ...inputStyle, width: '100%', marginTop: 16 }} disabled={!ready || busy} onClick={start}>{busy ? 'Starting…' : 'Start new session'}</button>
    </div></div>;

  if (snapshot.session.tracker_status === 'completed' && !value.pending.length) return <div className="fixed inset-0 z-[200] overflow-y-auto bg-bg p-6"><div className="max-w-lg mx-auto">
    <p className="text-sm">{snapshot.session.date}{snapshot.session.tracker_context?.opponent ? ` vs ${snapshot.session.tracker_context.opponent}` : ''}</p>
    <h2 className="text-2xl font-black mb-4">Saved session report</h2><AdvancedSessionReport shots={shots} freeThrows={freeThrows} gameStats={stats} sessionType={snapshot.session.type} />
    {recordedGameResult(snapshot.session.tracker_context) && <p>Team result: {recordedGameResult(snapshot.session.tracker_context).outcome} · {recordedGameResult(snapshot.session.tracker_context).team}–{recordedGameResult(snapshot.session.tracker_context).opponent}</p>}
    <h3 className="font-bold text-sm my-3">Player scoring by recorded period</h3>
    {recordedPeriodScoring(snapshot.events, COURT_ZONES).map(row => <p key={row.period} className="text-sm">Period {row.period}: {row.points} points</p>)}
    <p className="text-xs text-text-sec my-3">Only recorded player shots are included. This is not the team’s period score.</p>
    <button style={inputStyle} onClick={onClose}>Done</button></div></div>;

  const tools = <section className="tracker-recovery-tools">
    <div className="tracker-tool-row" aria-label="Live player totals"><strong>{liveReport.pts} PTS</strong><span>FG {liveReport.fgm}/{liveReport.fga}</span><span>FT {liveReport.ftm}/{liveReport.fta}</span></div>
    <div role="status" aria-live="polite">{status}</div>
    <div className="tracker-tool-row">
      {value.pending.length > 0 && <button style={inputStyle} disabled={busy || conflict} onClick={() => sync()}>Retry sync ({value.pending.length})</button>}
      <button style={inputStyle} onClick={() => setTimeline(!timeline)} aria-expanded={timeline}>Entries</button>
      <button style={inputStyle} onClick={() => { setContext(snapshot.session.tracker_context); setShowContext(!showContext); }} aria-expanded={showContext}>Game details</button>
      <button style={inputStyle} onClick={() => { onClose(); }}>Save for later</button>
    </div>
    {value.pending.length > 0 && <button style={inputStyle} onClick={downloadPending}>Download unsynced entries</button>}
    {conflict && <button style={inputStyle} disabled={busyRef.current} onClick={resolveConflict}>Resolve with saved account version</button>}
    {showContext && snapshot.session.type === 'game' && <div className="tracker-tool-row">
      <label>Period <input style={{ ...inputStyle, width: 70 }} type="number" min="1" max="99" value={period} onChange={event => setPeriod(Math.min(99, Math.max(1, Number(event.target.value))))} /></label>
      <label>Game clock <input style={{ ...inputStyle, width: 100 }} inputMode="numeric" value={clock} onChange={event => { if (/^\d{0,2}:?\d{0,2}$/.test(event.target.value)) setClock(event.target.value); }} onBlur={() => { if (!/^\d{1,2}:[0-5]\d$/.test(clock)) setClock('00:00'); }} /></label>
      <p className="tracker-hint">Manual clock reference; player minutes are recorded separately. Period numbers beyond the selected format represent overtime.</p>
    </div>}
    {showContext && <><GameContextForm value={context} onChange={setContext} /><button style={inputStyle} disabled={busy || conflict} onClick={async () => { if (await entry({ kind: 'context', context })) setShowContext(false); }}>Save game details</button></>}
    {timeline && <SessionTimeline events={snapshot.events} busy={busy || conflict} reverse={id => entry({ kind: 'reverse', target: id })} />}
  </section>;
  return <CourtTrackerView sessionType={snapshot.session.type} shots={shots} selectedZone={selectedZone} selectZone={setSelectedZone}
    gameStats={stats} updateStat={(key, delta) => entry({ kind: 'stat', key, delta })}
    saving={busy || conflict} ending={false} saveError={error} tab={tab} setTab={setTab} darkMode={darkMode} onToggleTheme={onToggleTheme}
    courtTheme={courtTheme} setCourtTheme={setCourtTheme} undoCount={reversible.length}
    undoLast={() => entry({ kind: 'reverse', target: reversible.at(-1)?.id })} endSession={finish}
    logShot={made => { entry({ kind: 'shot', zone_id: selectedZone, made }); setSelectedZone(null); }}
    logFreeThrow={made => entry({ kind: 'shot', zone_id: 'free-throw', made })} ticker={tools} />;
}
