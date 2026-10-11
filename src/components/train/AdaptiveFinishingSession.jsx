'use client';
import { useEffect, useRef, useState } from 'react';
import { FINISHING_STAGES, FINISHING_TARGET, finishingStage, finishStageRecord, finishingResult, summarizeFinishing } from '@/lib/adaptiveFinishing.mjs';
import './adaptive-finishing.css';

function CourtMap({ nextIndex, stage }) {
  const left = nextIndex % 2 === 1;
  return <svg className="af-court" viewBox="0 0 320 174" role="img" aria-label="Illustration: alternate finishing from the left and right sides of the rim; the highlighted spot is the next side. Not live technique analysis.">
    <rect x="8" y="8" width="304" height="158" rx="20" fill="none" stroke="currentColor" opacity=".25" />
    <path d="M80 8V80H240V8M90 90Q160 155 230 90M135 8V40H185V8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
    <circle cx="160" cy="40" r="13" fill="none" stroke="#FF9C70" strokeWidth="3" />
    <path d="M144 27H176" stroke="#FF9C70" strokeWidth="3" />
    <path d={left ? 'M109 117Q115 73 158 44' : 'M211 117Q205 73 162 44'} fill="none" stroke="#FF8A5A" strokeWidth="3.5" strokeDasharray="7 6" />
    <circle cx="109" cy="117" r="14" fill={left ? '#FF7039' : '#333849'} stroke="#FFAC84" strokeWidth="2" />
    <circle cx="211" cy="117" r="14" fill={left ? '#333849' : '#FF7039'} stroke="#FFAC84" strokeWidth="2" />
    <g fill="currentColor" fontSize="12" fontWeight="700" textAnchor="middle">
      <text x="109" y="151">LEFT</text><text x="211" y="151">RIGHT</text>
      <text x="160" y="89">{stage.id === 'retest' ? 'SAME SETUP' : 'ALTERNATE'}</text>
    </g>
  </svg>;
}

export default function AdaptiveFinishingSession({ onSave, onClose, canSave, previous = null }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [stages, setStages] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [controlled, setControlled] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef(null), live = useRef(false), saveLock = useRef(false), last = useRef(null);
  const stage = finishingStage(stageIndex, stages);
  const summary = result ? summarizeFinishing(result.drills) : null;
  useEffect(() => {
    live.current = true; panel.current?.focus();
    return () => { live.current = false; };
  }, []);
  useEffect(() => {
    if (paused || result) return;
    last.current = Date.now();
    const handle = setInterval(() => {
      const now = Date.now();
      setElapsed(seconds => Math.min(86400, seconds + Math.max(0, (now - last.current) / 1000)));
      last.current = now;
    }, 350);
    return () => clearInterval(handle);
  }, [paused, result]);

  const leave = () => {
    if (saving) return;
    if (!outcomes.length && !stages.length || window.confirm('Leave this mission? Unfinished attempts will not be saved.')) onClose();
  };
  const record = value => {
    if (paused || saving || result) return;
    setOutcomes(rows => rows.length >= FINISHING_TARGET ? rows : [...rows, value]);
  };
  const advance = () => {
    if (!stage || outcomes.length !== FINISHING_TARGET || controlled === null || saving || result) return;
    const all = [...stages, finishStageRecord(stage, outcomes, controlled)];
    if (stageIndex === FINISHING_STAGES.length - 1) {
      // A stable ID prevents duplicate writes if a network response is lost.
      const seconds = Math.min(86400, elapsed + (!paused && last.current ? Math.max(0, (Date.now() - last.current) / 1000) : 0));
      setResult(finishingResult({ stages: all, elapsedSeconds: seconds, id: crypto.randomUUID() }));
    } else {
      setStages(all);
      setStageIndex(value => value + 1);
      setOutcomes([]);
      setControlled(null);
      setPaused(true); // stop between sets until player deliberately resumes
    }
  };
  const save = async () => {
    if (!result || !canSave || saveLock.current) return;
    saveLock.current = true; setSaving(true); setError('');
    try { await onSave(result); if (live.current) onClose(); }
    catch { if (live.current) setError('Saving could not be confirmed. Keep this session open and retry with the same result.'); }
    finally { saveLock.current = false; if (live.current) setSaving(false); }
  };
  const trapFocus = event => {
    if (event.key === 'Escape') { event.preventDefault(); leave(); return; }
    if (event.key !== 'Tab') return;
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === panel.current)) { event.preventDefault(); buttons.at(-1).focus(); }
    if (!event.shiftKey && (document.activeElement === buttons.at(-1) || document.activeElement === panel.current)) { event.preventDefault(); buttons[0].focus(); }
  };

  return <section className="af-session" role="dialog" aria-modal="true" aria-label="Adaptive Finishing Lab" tabIndex={-1} ref={panel} onKeyDown={trapFocus}>
    <header className="af-session-head"><button type="button" onClick={leave} disabled={saving}>← Exit</button><span>COURTIQ / FINISHING LAB</span><span>{Math.floor(result ? result.elapsed_seconds : elapsed)}s</span></header>
    <div className="af-session-scroll">
      <div className="af-stage-rail" aria-label="Mission progress">{FINISHING_STAGES.map((item,i)=>
        <span key={item.id} className={i===stageIndex?'active':i<stageIndex?'done':''}>{i < stageIndex ? '✓ ' : ''}{item.label}</span>)}</div>
      {summary ? <>
        <p className="af-kicker">MISSION COMPLETE · SELF-RECORDED</p>
        <h2>Now you have a measurable baseline.</h2>
        <div className="af-result-pair">
          <div><span>First test</span><strong>{summary.baseline}<small>/{FINISHING_TARGET}</small></strong></div>
          <div><span>Same-setup retest</span><strong>{summary.retest}<small>/{FINISHING_TARGET}</small></strong></div>
        </div>
        <p className="af-result-change">{summary.deltaMakes > 0 ? '+' : ''}{summary.deltaMakes} makes · {summary.deltaPoints > 0 ? '+' : ''}{summary.deltaPoints} percentage points, within this session</p>
        <p className="af-coach-voice">{summary.next}</p>
        <p className="af-disclaimer">An immediate retest is not proof of long-term improvement or game transfer. All outcomes and movement control were self-reported.</p>
        {previous && <p className="af-footnote">Your last saved mission ended at {previous.retest}/{FINISHING_TARGET} makes. Conditions and readiness may differ.</p>}
        {error && <p className="af-error" role="alert">{error}</p>}
        {canSave ? <button type="button" className="af-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : error ? 'Retry saving this result' : 'Save my training results →'}</button> : <p role="status" className="af-error">Saving is unavailable. This mission is not stored. Copy your results before leaving.</p>}
      </> : <>
        <div className="af-heading"><span className="af-kicker">STAGE {stageIndex + 1} OF 4</span><h2>{stage.title}</h2><p>{stage.instruction}</p></div>
        <CourtMap stage={stage} nextIndex={outcomes.length} />
        <div className="af-stage-cue"><strong>Coach's cue</strong><p>{stage.cue}</p>{stage.reason && <small>{stage.reason}</small>}</div>
        {paused && <div className="af-rest" role="status"><strong>Rest and reset.</strong><p>Take the time you need. Your timer and shot inputs are paused.</p><button type="button" onClick={() => setPaused(false)}>Continue this stage →</button></div>}
        <div className="af-reps"><div><span>Recorded finishes</span><strong aria-live="polite">{outcomes.length}<small>/{FINISHING_TARGET}</small></strong></div><div><span>Made</span><strong>{outcomes.filter(Boolean).length}</strong></div></div>
        <progress value={outcomes.length} max={FINISHING_TARGET} aria-label="Finishes recorded in this stage" />
        <div className="af-actions">
          <button type="button" className="af-made" onClick={() => record(true)} disabled={paused || outcomes.length === FINISHING_TARGET}>+ Made</button>
          <button type="button" className="af-missed" onClick={() => record(false)} disabled={paused || outcomes.length === FINISHING_TARGET}>+ Missed</button>
        </div>
        <div className="af-tools">
          <button type="button" disabled={paused || !outcomes.length} onClick={() => setOutcomes(rows=>rows.slice(0,-1))}>Undo last</button>
          <button type="button" onClick={() => setPaused(v => !v)}>{paused ? 'Resume' : 'Pause & rest'}</button>
        </div>
        {outcomes.length === FINISHING_TARGET && <fieldset className="af-control"><legend>Did the movements feel balanced and controlled?</legend>
          <label><input type="radio" name="af-control" checked={controlled === true} onChange={() => setControlled(true)} /> Yes, controlled</label>
          <label><input type="radio" name="af-control" checked={controlled === false} onChange={() => setControlled(false)} /> Not consistently</label>
          <p>This is your own assessment, not a camera-verified mechanics grade.</p>
        </fieldset>}
        <button className="af-primary" type="button" onClick={advance} disabled={outcomes.length !== FINISHING_TARGET || controlled === null || paused}>
          {stageIndex === 3 ? 'See my results →' : 'Finish this set →'}
        </button>
        <p className="af-footnote">Record every actual attempt. Keep the baseline and retest setup identical. There is no opponent, contact, or speed target. Rest as needed; stop for pain, dizziness or unsafe conditions.</p>
      </>}
    </div>
  </section>;
}
