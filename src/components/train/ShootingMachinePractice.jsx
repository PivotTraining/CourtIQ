'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import SessionVideo from '@/components/shots/SessionVideo';
import LiveShootingAnalyzer from './LiveShootingAnalyzer';
import { createDeviceVideoStore, validateClip } from '@/lib/deviceVideo.mjs';
import { downloadBlob } from '@/lib/browserDownload.mjs';
import {
  FORM_CUES, MACHINE_PLANS, MACHINE_STYLES, MACHINE_ZONES, machineCsv, machineDraftKey,
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
  const scopeRef=useRef(key);scopeRef.current=key;
  const [draft, setDraft] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadedKey, setLoadedKey] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [bulkMakes, setBulkMakes] = useState('0');
  const [bulkAttempts, setBulkAttempts] = useState('25');
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pendingFilmRef = useRef(null);
  const [pendingFilmSize,setPendingFilmSize] = useState(0);
  const [cameraRecording,setCameraRecording] = useState(false);

  const history = useMemo(() => machineHistory(records), [records]);
  const isCurrent = ready && loadedKey === key && !!key;
  const summary = useMemo(() => machineSummary(isCurrent ? (draft?.entries || []) : []), [draft?.entries, isCurrent]);
  const pendingConfirmation = !!draft?.frozenResult && !savedId;
  const running = isCurrent && expanded && !!draft && !draft.paused && !savedId && !pendingConfirmation;
  const selectedPlan = MACHINE_PLANS.find(plan => plan.id === draft?.plan) || MACHINE_PLANS[0];

  useEffect(() => {
    setReady(false);
    setLoadedKey(null);
    setSelectedVideoId(null);
    setDetailId(null);
    setExpanded(false);
    // Never allow a clip recorded for another player or account to be attached.
    if(pendingFilmRef.current?.key!==key){
      pendingFilmRef.current=null;setPendingFilmSize(0);
    }
    setCameraRecording(false);
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
    setLoadedKey(key);
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!isCurrent || !key || !draft) return;
    try {
      if (savedId === draft.id) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      setMessage('Device draft storage is unavailable. Export a CSV before leaving this screen.');
    }
  }, [key, draft, isCurrent, savedId]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setDraft(current => current && current.elapsed < 86400
        ? { ...current, elapsed: current.elapsed + 1 } : current);
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  const change = (field, value) => {
    if (savedId || saving || pendingConfirmation) return;
    setDraft(current => ({ ...current, [field]: value }));
  };
  const record = (makes, attempts, source) => {
    if (!isCurrent || !draft || saving || savedId || pendingConfirmation) return;
    const item = {
      id: crypto.randomUUID(), zone: draft.zone,
      style: draft.zone === 'free-throw' ? 'free-throw' : draft.style,
      makes, attempts, source,
    };
    setDraft(current => current.entries.length >= 5000 || current.entries.reduce((sum, e) => sum + e.attempts, 0) + attempts > 100000
      ? current : ({ ...current, entries: [...current.entries, item] }));
    setError('');
  };
  const applyPlan = planId => {
    if (!draft || summary.attempts || savedId || saving || pendingConfirmation) return;
    const plan = MACHINE_PLANS.find(item => item.id === planId) || MACHINE_PLANS[0];
    setDraft(current => ({ ...current, plan: plan.id, target: plan.goal,
      focus: plan.label, style: plan.style, zone: plan.first }));
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
  const receiveAnnotatedFilm = blob => {
    if(!isCurrent || !draft || !key || scopeRef.current!==key || savedId || saving) return;
    try{
      validateClip(blob);
      pendingFilmRef.current={key,draftId:draft.id,blob};
      setPendingFilmSize(blob.size);
      setMessage('Annotated video captured on this device. Finish and save to attach it. Download a backup if needed.');
      setError('');
    }catch(cause){setError(cause.message || 'Video was not saved.');}
  };
  const downloadPendingFilm = () => {
    const clip=pendingFilmRef.current;
    if(!clip?.blob || clip.key!==key)return;
    try{
      const ext=clip.blob.type==='video/mp4'?'mp4':'webm';
      downloadBlob(clip.blob,'courtiq-form-iq-'+clip.draftId+'.'+ext);
      setMessage('Annotated clip download started. Keep the original in Photos or Files.');
    }catch{setError('Video download did not start. Please try again.');}
  };
  const captureFormObservation = observation => {
    if (!isCurrent || savedId || saving || pendingConfirmation) throw new Error('Finish or start a new workout before capturing more observations.');
    if (!observation || observation.method !== 'on-device-movenet-v1' ||
        !Number.isFinite(Date.parse(observation.at))) throw new Error('Unrecognized camera observation.');
    if ((draft.observations || []).length >= 30) throw new Error('This workout already has 30 observations. Save it before capturing more.');
    setDraft(current => ({ ...current, observations: [...(current.observations || []), observation] }));
  };
  const undo = () => {
    if (!draft || savedId || saving || pendingConfirmation) return;
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
    if(cameraRecording){
      setError('Stop the annotated video recording first so the clip finishes processing.');
      return;
    }
    if (!canSave || !playerId || !accountId || saving || savedId || !onSave) {
      setError('Account saving is unavailable. Export your session before leaving.');
      return;
    }
    let result;
    try { result = draft.frozenResult || machineWorkoutResult(draft); }
    catch (cause) { setError(cause.message); return; }
    setMessage('');
    // Freeze the exact payload before the network write. A lost response must retry
    // the same UUID and the same JSONB, even after browser refresh or timer changes.
    if (!draft.frozenResult) {
      const frozen = { ...draft, paused: true, frozenResult: result };
      setDraft(frozen);
      try { window.localStorage.setItem(key, JSON.stringify(frozen)); }
      catch { setMessage('Device recovery storage is unavailable. Do not close this tab before confirming the save.'); }
    }
    setSaving(true);
    setError('');
    try {
      const stored = await onSave(result);
      if (stored?.id !== result.id || stored.player_id !== playerId)
        throw new Error('The saved result did not confirm this player. Keep your draft and retry.');
      const filmed=pendingFilmRef.current;
      let filmSaved=false,filmIssue='';
      if(filmed && filmed.key===key && filmed.draftId===result.id){
        try{
          await createDeviceVideoStore().put(accountId,result.id,filmed.blob);
          filmSaved=true;
          pendingFilmRef.current=null;setPendingFilmSize(0);
        }catch(err){filmIssue=err.message||'Local video storage failed.';}
      }
      setSavedId(result.id);
      setSelectedVideoId(filmSaved || !filmed ? result.id : null);
      setExpanded(false);
      setMessage(filmIssue ?
        'Practice statistics saved. Annotated video did not save on this device. Download it from this tab before leaving. '+filmIssue :
        filmSaved ? 'Practice and annotated video saved. Download a backup of the video.' :
          'Shooting practice saved to this player. You can now attach a video clip.');
    } catch (cause) {
      setError(cause.message || 'Could not save. Your draft remains on this device.');
    } finally {
      setSaving(false);
    }
  };
  const newSession = () => {
    if(cameraRecording){
      setError('Stop the recording before starting a different practice.');
      return;
    }
    if(pendingFilmRef.current?.key===key && !window.confirm('A local video clip is attached to this draft. Starting a new session will discard the unsaved in-memory clip. Download a backup first. Continue?'))return;
    if (pendingConfirmation && !window.confirm('This save may have reached the server. Starting over will abandon its retry record. Continue?')) return;
    if (!savedId && draft?.entries.length &&
        !window.confirm('Start over? All unsaved attempts in this draft will be lost.')) return;
    pendingFilmRef.current=null;setPendingFilmSize(0);
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
  const selectedDetail = history.find(row => row.id === detailId);
  const hasPlayer = !!key;
  return <section className="machine-lab" aria-label="Shooting machine practice">
    <header className="machine-hero">
      <div><p className="machine-eyebrow">PRACTICE / SHOOTING MACHINE LAB</p>
        <h3>Make every machine rep count.</h3>
        <p>Log shots, compare locations, review video, and save a measurable practice baseline. This never changes game statistics.</p>
      </div>
      <button className="machine-primary" disabled={!hasPlayer || !isCurrent}
        onClick={() => {if(cameraRecording){setError('Stop the video recording before closing this practice.');return;} savedId ? newSession() : setExpanded(open => !open);}}>
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
    {expanded && draft && isCurrent && !savedId && <>
      <div className="machine-section">
        <div className="machine-section-heading"><h4>1. Set up the workout</h4>
          <button type="button" disabled={pendingConfirmation} onClick={() => change('paused', !draft.paused)}>{draft.paused ? 'Resume timer' : 'Pause timer'} · {formatTime(draft.elapsed)}</button></div>
        <label className="machine-style">Quick shooting plan<select value={draft.plan || 'custom'}
          disabled={summary.attempts > 0 || pendingConfirmation} onChange={event => applyPlan(event.target.value)}>
          {MACHINE_PLANS.map(plan => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
        </select></label>
        <p className="machine-hint">{selectedPlan.instruction} These are practice guides; CourtIQ does not program the shooting machine.</p>
        {pendingConfirmation && <p className="machine-hint" role="status">Save confirmation is pending. Entries and duration are frozen so retry cannot create a conflicting workout. Retry using the same result ID.</p>}
        <div className="machine-settings">
          <label>Workout focus<input disabled={pendingConfirmation} maxLength={100} value={draft.focus} onChange={event => change('focus', event.target.value)} placeholder="e.g. five-spot catch and shoot" /></label>
          <label>Machine (optional)<input disabled={pendingConfirmation} maxLength={80} value={draft.machine} onChange={event => change('machine', event.target.value)} placeholder="e.g. The Gun 12K" /></label>
          <label>Shot goal<input disabled={pendingConfirmation} type="number" inputMode="numeric" min="1" max="10000" value={draft.target} onChange={event => setDraft(current => current.frozenResult ? current : ({ ...current, plan: 'custom', target: Number(event.target.value) }))} /></label>
          <label>Feed interval, seconds (optional)<input disabled={pendingConfirmation} type="number" min="0.5" max="30" step="0.5" inputMode="decimal" value={draft.feedSeconds} onChange={event => change('feedSeconds', event.target.value)} placeholder="e.g. 4.0" /></label>
        </div>
      </div>
      <div className="machine-section">
        <h4>2. Analyze form while shooting</h4>
        <p className="machine-hint">See live red/green joint overlays and an optional uncalibrated ball trace. You can still train or save shots without the camera.</p>
        <LiveShootingAnalyzer onObservation={captureFormObservation} onClipReady={receiveAnnotatedFilm}
          onRecordingChange={setCameraRecording} disabled={pendingConfirmation || saving}
          remaining={Math.max(0,30-(draft.observations || []).length)} />
        {pendingFilmSize>0 && <div className="machine-annotated-film" role="status">
          <strong>Annotated clip ready · {(pendingFilmSize/1024/1024).toFixed(1)} MB</strong>
          <p>Kept temporarily in this tab until the practice is saved. Stop recording, then save to attach it to this player on this device.</p>
          <button type="button" onClick={downloadPendingFilm}>Download annotated clip backup</button>
        </div>}
        <p className="machine-hint">{(draft.observations || []).length}/30 on-device form observations captured with this draft.</p>
      </div>
      <div className="machine-section">
        <h4>3. Choose a shooting location</h4><p className="machine-hint">Left and right are from the shooter’s view facing the rim. Select a new spot when the machine moves.</p>
        <div className="machine-zones" role="group" aria-label="Shooting location">
          {MACHINE_ZONES.map(zone => {
            const line = summary.perZone.find(item => item.id === zone.id);
            return <button type="button" key={zone.id} disabled={pendingConfirmation} aria-pressed={draft.zone === zone.id} className="machine-zone"
              onClick={() => change('zone', zone.id)}>
              <strong>{zone.label}</strong><small>{line.attempts ? line.makes + '/' + line.attempts + ' · ' + line.pct + '%' : 'No shots'}</small>
            </button>;
          })}
        </div>
        <label className="machine-style">Shot style<select value={draft.style} disabled={pendingConfirmation} onChange={event => change('style', event.target.value)}>
          {MACHINE_STYLES.map(style => <option value={style.id} key={style.id}>{style.label}</option>)}
        </select></label>
      </div>
      <div className="machine-section">
        <h4>4. Record shots</h4><p className="machine-hint">Choose one method. Tap each make/miss, or enter the total shown by the machine for this spot. Do not record the same shots twice.</p>
        <div className="machine-shot-buttons">
          <button type="button" className="machine-made" disabled={saving || pendingConfirmation || draft.entries.length >= 5000} onClick={() => record(1, 1, 'tap')}>+ Made</button>
          <button type="button" className="machine-missed" disabled={saving || pendingConfirmation || draft.entries.length >= 5000} onClick={() => record(0, 1, 'tap')}>+ Missed</button>
        </div>
        <form className="machine-batch" onSubmit={addBatch}>
          <div><strong>Enter machine display totals</strong><p className="machine-hint">One batch per shooting location, maximum 500 attempts.</p></div>
          <label>Made<input disabled={pendingConfirmation} value={bulkMakes} type="number" min="0" max="500" inputMode="numeric" onChange={event => setBulkMakes(event.target.value)} /></label>
          <label>Attempts<input disabled={pendingConfirmation} value={bulkAttempts} type="number" min="1" max="500" inputMode="numeric" onChange={event => setBulkAttempts(event.target.value)} /></label>
          <button type="submit" disabled={saving || pendingConfirmation || draft.entries.length >= 5000}>Add set</button>
        </form>
        <div className="machine-entry-footer"><span>{draft.entries.length} recorded entries (individual shots or machine sets)</span>
          <button type="button" onClick={undo} disabled={!draft.entries.length || saving || pendingConfirmation}>Undo last entry</button></div>
      </div>
      <div className="machine-section">
        <h4>5. Live session measurements</h4>
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
        <div className="machine-splits">{summary.perStyle.filter(style => style.attempts > 0).map(style =>
          <span key={style.id}>{style.label}: {style.makes}/{style.attempts} · {valueOrDash(style.pct)}</span>)}</div>
        <div className="machine-locations">
          {summary.populatedZones.map(zone => <div key={zone.id}><span>{zone.label}</span><strong>{zone.makes}/{zone.attempts} · {valueOrDash(zone.pct)}</strong></div>)}
        </div>
        <p className="machine-hint">Percentages are calculated from manually entered outcomes, not camera detection. Goal progress can exceed 100% if you shoot extra attempts.</p>
      </div>
      <div className="machine-section">
        <h4>6. Video-review checklist and notes</h4>
        <p className="machine-hint">Use these cues while watching film. Checking a box means someone reviewed it; CourtIQ is not estimating release angle, arc, or mechanical quality.</p>
        <div className="machine-form-cues">{FORM_CUES.map(cue =>
          <label key={cue.id}><input type="checkbox" disabled={pendingConfirmation} checked={draft.form?.[cue.id] === true} onChange={event =>
            setDraft(current => current.frozenResult ? current : ({ ...current, form: { ...current.form, [cue.id]: event.target.checked } }))} />{cue.label}</label>)}</div>
        <label className="machine-notes">Coaching observations<textarea disabled={pendingConfirmation} maxLength={1500} rows={3} value={draft.notes}
          onChange={event => change('notes', event.target.value)} placeholder="What improved? What did you notice about footwork, release, rhythm, and fatigue?" /></label>
        <p className="machine-hint">Film with the phone Camera, then save a short clip here after the workout. If using one phone for filming, enter the machine&apos;s shot totals when filming is done. Keep the original recording in Photos or another backup.</p>
      </div>
      <footer className="machine-finish">
        <div><strong>Save to this player&apos;s Practice history</strong>
          <p>{canSave ? 'Saving confirms the player and stores these measurements in the account.' : 'Cloud saving is not enabled or history has not loaded. Export before leaving.'}</p>
        </div>
        <div className="machine-finish-buttons">
          <button type="button" onClick={exportCsv} disabled={!summary.attempts || saving}>Export CSV</button>
          <button type="button" className="machine-primary" onClick={save} disabled={!canSave || !summary.attempts || saving || cameraRecording}>
            {saving ? 'Saving…' : pendingConfirmation ? 'Retry same saved result' : 'Finish and save practice'}
          </button>
          <button type="button" className="machine-reset" onClick={newSession} disabled={saving || cameraRecording}>Discard draft</button>
        </div>
      </footer>
    </>}
    {draft && savedId === draft.id && pendingFilmSize>0 && <div className="machine-annotated-film" role="status">
      <strong>Local video is not yet stored</strong>
      <p>Practice stats were saved, but the clip remains only in this open tab. Download your backup now.</p>
      <button type="button" onClick={downloadPendingFilm}>Download annotated clip backup</button>
    </div>}
    {draft && savedId === draft.id && <div className="machine-saved">
      <h4>Session saved</h4><p>{summary.makes} of {summary.attempts} · {valueOrDash(summary.pct)} · {formatTime(draft.elapsed)} active time</p>
      <p>Your shots are saved as practice, not game stats. Add a short clip below or begin another workout.</p>
    </div>}
    {history.length > 0 && <section className="machine-history" aria-label="Previous shooting machine workouts">
      <h4>Practice trend</h4><p className="machine-hint">Compare workouts with the same distance, pace, and drills. A single higher percentage does not by itself demonstrate improvement.</p>
      {history.slice(0, 6).map(row => <div className="machine-history-line" key={row.id}>
        <div><strong>{formatDate(row.date)}</strong><small>{row.machine.focus || 'Shooting machine'} · {row.attempts} attempts</small></div>
        <strong>{row.makes}/{row.attempts} · {valueOrDash(row.pct)}</strong>
        <button type="button" aria-expanded={detailId === row.id}
          onClick={() => setDetailId(current => current === row.id ? null : row.id)}>Details</button>
        <button type="button" onClick={() => setSelectedVideoId(row.id)}>Video</button>
      </div>)}
      {selectedDetail && <div className="machine-detail">
        <h4>{formatDate(selectedDetail.date)} · Workout details</h4>
        <p>{selectedDetail.machine.name || 'Shooting machine'} · {selectedDetail.machine.focus || 'Practice'}
          {selectedDetail.machine.feed_seconds ? ' · ' + selectedDetail.machine.feed_seconds + 's machine interval' : ''}
          {' · ' + formatTime(selectedDetail.elapsed) + ' logged practice time'}</p>
        <div className="machine-locations">{selectedDetail.populatedZones.map(zone =>
          <div key={zone.id}><span>{zone.label}</span><strong>{zone.makes}/{zone.attempts} · {valueOrDash(zone.pct)}</strong></div>)}</div>
        <div className="machine-splits">{selectedDetail.perStyle.filter(style => style.attempts > 0).map(style =>
          <span key={style.id}>{style.label}: {style.makes}/{style.attempts} · {valueOrDash(style.pct)}</span>)}</div>
        <strong>Video-review observations</strong>
        <p>{selectedDetail.machine.notes || 'No notes were entered for this session.'}</p>
        {(selectedDetail.machine.observations || []).length > 0 && <div className="machine-form-history">
          <strong>Saved on-device form measurements ({selectedDetail.machine.observations.length})</strong>
          {selectedDetail.machine.observations.slice(-8).map((item, index) => <p key={item.at + index}>
            {new Date(item.at).toLocaleTimeString()} · {item.trigger === 'extension-pattern-v1' ? 'Auto: arm extension (not shot-confirmed)' : 'Manual frame'} · {item.phase} · Elbow {item.elbow_angle ?? '—'}° · Knee {item.knee_angle ?? '—'}° · Image-plane ball rise {item.projected_rise_angle ?? '—'}°
          </p>)}
          <p>These are uncalibrated camera observations, not verified shooting-form scores or true 3D ball-flight measurements.</p>
        </div>}
        <p>{FORM_CUES.filter(cue => selectedDetail.machine.form?.[cue.id])
          .map(cue => cue.label).join(' · ') || 'No form cues marked as reviewed.'}</p>
      </div>}
    </section>}
    {isCurrent && !!accountId && !!selectedVideoId && <section className="machine-video">
      <div className="machine-section-heading"><h4>Saved workout video</h4><button type="button" onClick={() => setSelectedVideoId(null)}>Close video</button></div>
      <SessionVideo key={selectedVideoId} accountId={accountId} sessionId={selectedVideoId} />
      <p className="machine-hint">The clip is stored only on this device and will not sync to a second phone. Download the original for a permanent backup.</p>
    </section>}
  </section>;
}
