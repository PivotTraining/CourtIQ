'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import SessionVideo from '@/components/shots/SessionVideo';
import { downloadBlob } from '@/lib/browserDownload.mjs';
import {
  FORM_CUES, MACHINE_STYLES, MACHINE_ZONES, machineCsv, machineDraftKey,
  machineHistory, machineSummary, machineWorkoutResult, newMachineDraft,
} from '@/lib/shootingMachine.mjs';
import './shooting-machine.css';

const formatTime = seconds => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
};
const valueOrDash = value => value === null ? '—' : value + '%';
const formatDate = date => {
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString() : 'Unknown date';
};

export default function ShootingMachinePractice({ playerId, records = [], canSave = false, onSave }) {
  const { user } = useAuth();
  const accountId = user?.id;
  const key = accountId && playerId ? machineDraftKey(accountId, playerId) : null;
  const [draft, setDraft] = useState(null);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [bulkMakes, setBulkMakes] = useState('0');
  const [bulkAttempts, setBulkAttempts] = useState('25');
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const history = useMemo(() => machineHistory(records), [records]);
  const summary = useMemo(() => machineSummary(draft?.entries || []), [draft?.entries]);

  useEffect(() => {
    setReady(false);
    if (!key) { setDraft(null); return; }
    let restored = null;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Do not let bad, stale, or malformed browser data masquerade as a workout.
        if (parsed?.id && parsed?.createdAt && Array.isArray(parsed.entries)) {
          machineSummary(parsed.entries);
          if (MACHINE_ZONES.some(zone => zone.id === parsed.zone) &&
              MACHINE_STYLES.some(style => style.id === parsed.style) &&
              Number.isFinite(Date.parse(parsed.createdAt))) restored = parsed;
        }
      }
    } catch { /* Start a fresh draft if device storage cannot be read. */ }
    setDraft(restored || newMachineDraft(crypto.randomUUID()));
    setSavedId(null);
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready || !key || !draft) return;
    try {
      if (savedId === draft.id) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      setMessage('Device draft storage is unavailable. Export a CSV before leaving this screen.');
    }
  }, [key, draft, ready, savedId]);

  useEffect(() => {
    if (!ready || !expanded || !draft || draft.paused || savedId) return;
    const timer = setInterval(() => {
      setDraft(current => current && current.elapsed < 86400
        ? { ...current, elapsed: current.elapsed + 1 } : current);
    }, 1000);
    return () => clearInterval(timer);
  }, [ready, expanded, draft?.paused, savedId, draft?.id]);

  const change = (field, value) => {
    if (savedId || saving) return;
    setDraft(current => ({ ...current, [field]: value }));
  };
  const record = (makes, attempts, source) => {
    if (!ready || !draft || saving || savedId) return;
    const item = {
      id: crypto.randomUUID(), zone: draft.zone,
      style: draft.zone === 'free-throw' ? 'free-throw' : draft.style,
      makes, attempts, source,
    };
    setDraft(current => ({ ...current, entries: [...current.entries, item] }));
    setError('');
  };
  const addBatch = event => {
    event.preventDefault();
    const makes = Number(bulkMakes), attempts = Number(bulkAttempts);
    if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 500 ||
        !Number.isSafeInteger(makes) || makes < 0 || makes > attempts) {
      setError('Enter 1–500 attempts and a made-shot count between 0 and those attempts.');
      return;
    }
    if (draft.entries.length >= 5000) {
      setError('This session is too large. Save this workout before starting another.');
      return;
    }
    record(makes, attempts, 'machine-display');
  };
  const undo = () => {
    if (!draft || savedId || saving) return;
    setDraft(current => ({ ...current, entries: current.entries.slice(0, -1) }));
    setError('');
  };
  const exportCsv = () => {
    try {
      downloadBlob(new Blob([machineCsv(draft)], { type: 'text/csv;charset=utf-8' }),
        'courtiq-shooting-machine-' + draft.createdAt.slice(0, 10) + '.csv');
      setMessage('CSV download started. Keep a copy outside the app.');
    } catch {
      setError('Could not download the CSV on this device. Your entries are still shown here.');
    }
  };
  const save = async () => {
    if (!canSave || !playerId || !accountId || saving || savedId || !onSave) {
      setError('Account saving is unavailable. Export your session before leaving.');
      return;
    }
    let result;
    try { result = machineWorkoutResult(draft); }
    catch (cause) { setError(cause.message); return; }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const stored = await onSave(result);
      if (stored?.id !== result.id || stored.player_id !== playerId)
        throw new Error('The saved result did not confirm this player. Keep your draft and retry.');
      setSavedId(result.id);
      setSelectedVideoId(result.id);
      setExpanded(false);
      setMessage('Shooting practice saved to this player. You can now attach a video clip.');
    } catch (cause) {
      setError(cause.message || 'Could not save. Your draft remains on this device.');
    } finally {
      setSaving(false);
    }
  };
  const newSession = () => {
    if (!savedId && draft?.entries.length &&
        !window.confirm('Start over? All unsaved attempts in this draft will be lost.')) return;
    setDraft(newMachineDraft(crypto.randomUUID()));
    setSavedId(null);
    setSelectedVideoId(null);
    setMessage('');
    setError('');
    setBulkMakes('0');
    setBulkAttempts('25');
    setExpanded(true);
  };
  const latest = history[0];
  const hasPlayer = !!key;
  return <section className="machine-lab" aria-label="Shooting machine practice">
    <header className="machine-hero">
      <div><p className="machine-eyebrow">PRACTICE / SHOOTING MACHINE LAB</p>
        <h3>Make every machine rep count.</h3>
        <p>Log shots, compare locations, review video, and save a measurable practice baseline. This never changes game statistics.</p>
      </div>
      <button className="machine-primary" disabled={!hasPlayer || !ready}
        onClick={() => savedId ? newSession() : setExpanded(open => !open)}>
        {savedId ? 'Start another session' : expanded ? 'Close practice' : 'Start machine practice'}
      </button>
    </header>
    {latest && <div className="machine-last"><strong>Last saved machine workout</strong>
      <span>{formatDate(latest.date)} · {latest.makes}/{latest.attempts} shots · {valueOrDash(latest.pct)}</span>
      <button type="button" onClick={() => setSelectedVideoId(latest.id)}>Review / attach last clip</button>
    </div>}
    {!hasPlayer && <p role="status">Select a player profile before recording practice.</p>}
    {message && <p className="machine-message" role="status">{message}</p>}
    {error && <p className="machine-error" role="alert">{error}</p>}
    {expanded && draft && ready && !savedId && <>
      <div className="machine-section">
        <div className="machine-section-heading"><h4>1. Set up the workout</h4>
          <button type="button" onClick={() => change('paused', !draft.paused)}>{draft.paused ? 'Resume timer' : 'Pause timer'} · {formatTime(draft.elapsed)}</button></div>
        <div className="machine-settings">
          <label>Workout focus<input maxLength={100} value={draft.focus} onChange={event => change('focus', event.target.value)} placeholder="e.g. five-spot catch and shoot" /></label>
          <label>Machine (optional)<input maxLength={80} value={draft.machine} onChange={event => change('machine', event.target.value)} placeholder="e.g. The Gun 12K" /></label>
          <label>Shot goal<input type="number" inputMode="numeric" min="1" max="10000" value={draft.target} onChange={event => change('target', Number(event.target.value))} /></label>
          <label>Feed interval, seconds (optional)<input type="number" min="0.5" max="30" step="0.5" inputMode="decimal" value={draft.feedSeconds} onChange={event => change('feedSeconds', event.target.value)} placeholder="e.g. 4.0" /></label>
        </div>
      </div>
      <div className="machine-section">
        <h4>2. Choose a shooting location</h4><p className="machine-hint">Left and right are from the shooter’s view facing the rim. Select a new spot when the machine moves.</p>
        <div className="machine-zones" role="group" aria-label="Shooting location">
          {MACHINE_ZONES.map(zone => {
            const line = summary.perZone.find(item => item.id === zone.id);
            return <button type="button" key={zone.id} aria-pressed={draft.zone === zone.id} className="machine-zone"
              onClick={() => change('zone', zone.id)}>
              <strong>{zone.label}</strong><small>{line.attempts ? line.makes + '/' + line.attempts + ' · ' + line.pct + '%' : 'No shots'}</small>
            </button>;
          })}
        </div>
        <label className="machine-style">Shot style<select value={draft.style} onChange={event => change('style', event.target.value)}>
          {MACHINE_STYLES.map(style => <option value={style.id} key={style.id}>{style.label}</option>)}
        </select></label>
      </div>
      <div className="machine-section">
        <h4>3. Record shots</h4><p className="machine-hint">Choose one method. Tap each make/miss, or enter the total shown by the machine for this spot. Do not record the same shots twice.</p>
        <div className="machine-shot-buttons">
          <button type="button" className="machine-made" disabled={saving || draft.entries.length >= 5000} onClick={() => record(1, 1, 'tap')}>+ Made</button>
          <button type="button" className="machine-missed" disabled={saving || draft.entries.length >= 5000} onClick={() => record(0, 1, 'tap')}>+ Missed</button>
        </div>
        <form className="machine-batch" onSubmit={addBatch}>
          <div><strong>Enter machine display totals</strong><p className="machine-hint">One batch per shooting location, maximum 500 attempts.</p></div>
          <label>Made<input value={bulkMakes} type="number" min="0" max="500" inputMode="numeric" onChange={event => setBulkMakes(event.target.value)} /></label>
          <label>Attempts<input value={bulkAttempts} type="number" min="1" max="500" inputMode="numeric" onChange={event => setBulkAttempts(event.target.value)} /></label>
          <button type="submit" disabled={saving || draft.entries.length >= 5000}>Add set</button>
        </form>
        <div className="machine-entry-footer"><span>{draft.entries.length} recorded entries (individual shots or machine sets)</span>
          <button type="button" onClick={undo} disabled={!draft.entries.length || saving}>Undo last entry</button></div>
      </div>
      <div className="machine-section">
        <h4>4. Live session measurements</h4>
        <div className="machine-metrics">
          <div><strong>{summary.attempts}</strong><span>Attempts</span></div>
          <div><strong>{summary.makes}</strong><span>Made</span></div>
          <div><strong>{valueOrDash(summary.pct)}</strong><span>Shooting</span></div>
          <div><strong>{Math.round(summary.attempts / Math.max(1, Number(draft.target)) * 100)}%</strong><span>Goal progress</span></div>
        </div>
        <progress value={Math.min(summary.attempts, Math.max(1, draft.target))} max={Math.max(1, draft.target)} aria-label="Shot target progress" />
        <div className="machine-splits">
          <span>3PT {summary.threes.makes}/{summary.threes.attempts} · {valueOrDash(summary.threes.pct)}</span>
          <span>2PT {summary.twos.makes}/{summary.twos.attempts} · {valueOrDash(summary.twos.pct)}</span>
          <span>FT {summary.freeThrows.makes}/{summary.freeThrows.attempts} · {valueOrDash(summary.freeThrows.pct)}</span>
        </div>
        <div className="machine-locations">
          {summary.populatedZones.map(zone => <div key={zone.id}><span>{zone.label}</span><strong>{zone.makes}/{zone.attempts} · {valueOrDash(zone.pct)}</strong></div>)}
        </div>
        <p className="machine-hint">Percentages are calculated from manually entered outcomes, not camera detection. Goal progress can exceed 100% if you shoot extra attempts.</p>
      </div>
      <div className="machine-section">
        <h4>5. Video-review checklist and notes</h4>
        <p className="machine-hint">Use these cues while watching film. Checking a box means someone reviewed it; CourtIQ is not estimating release angle, arc, or mechanical quality.</p>
        <div className="machine-form-cues">{FORM_CUES.map(cue =>
          <label key={cue.id}><input type="checkbox" checked={draft.form?.[cue.id] === true} onChange={event =>
            setDraft(current => ({ ...current, form: { ...current.form, [cue.id]: event.target.checked } }))} />{cue.label}</label>)}</div>
        <label className="machine-notes">Coaching observations<textarea maxLength={1500} rows={3} value={draft.notes}
          onChange={event => change('notes', event.target.value)} placeholder="What improved? What did you notice about footwork, release, rhythm, and fatigue?" /></label>
        <p className="machine-hint">After saving, attach a short video to this workout on this device. Keep the original camera footage in Photos or another backup.</p>
      </div>
      <footer className="machine-finish">
        <div><strong>Save to this player's Practice history</strong>
          <p>{canSave ? 'Saving confirms the player and stores these measurements in the account.' : 'Cloud saving is not enabled or history has not loaded. Export before leaving.'}</p>
        </div>
        <div className="machine-finish-buttons">
          <button type="button" onClick={exportCsv} disabled={!summary.attempts || saving}>Export CSV</button>
          <button type="button" className="machine-primary" onClick={save} disabled={!canSave || !summary.attempts || saving}>
            {saving ? 'Saving…' : 'Finish and save practice'}
          </button>
          <button type="button" className="machine-reset" onClick={newSession} disabled={saving}>Discard draft</button>
        </div>
      </footer>
    </>}
    {draft && savedId === draft.id && <div className="machine-saved">
      <h4>Session saved</h4><p>{summary.makes} of {summary.attempts} · {valueOrDash(summary.pct)} · {formatTime(draft.elapsed)} active time</p>
      <p>Your shots are saved as practice, not game stats. Add a short clip below or begin another workout.</p>
    </div>}
    {history.length > 0 && <section className="machine-history" aria-label="Previous shooting machine workouts">
      <h4>Practice trend</h4><p className="machine-hint">Compare workouts with the same distance, pace, and drills. A single higher percentage does not by itself demonstrate improvement.</p>
      {history.slice(0, 6).map(row => <div className="machine-history-line" key={row.id}>
        <div><strong>{formatDate(row.date)}</strong><small>{row.machine.focus || 'Shooting machine'} · {row.attempts} attempts</small></div>
        <strong>{row.makes}/{row.attempts} · {valueOrDash(row.pct)}</strong>
        <button type="button" onClick={() => setSelectedVideoId(row.id)}>Video</button>
      </div>)}
    </section>}
    {!!accountId && !!selectedVideoId && <section className="machine-video">
      <div className="machine-section-heading"><h4>Saved workout video</h4><button type="button" onClick={() => setSelectedVideoId(null)}>Close video</button></div>
      <SessionVideo key={selectedVideoId} accountId={accountId} sessionId={selectedVideoId} />
      <p className="machine-hint">The clip is stored only on this device and will not sync to a second phone. Download the original for a permanent backup.</p>
    </section>}
  </section>;
}
