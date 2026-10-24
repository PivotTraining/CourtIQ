'use client';
import { useEffect, useRef, useState } from 'react';
import { practiceMetric, practiceGuide, skillResult, practiceBestStreak, formatPracticeClock } from '@/lib/skillPractice.mjs';

export default function SkillPracticeSession({ drill, previous, canSave, onSave, onClose }) {
  const [outcomes, setOutcomes] = useState([]);
  const [attemptSeconds, setAttemptSeconds] = useState([]);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const live = useRef(false), lock = useRef(false), clock = useRef(null), panel = useRef(null);
  const target = Math.max(1, Math.floor(Number(drill.reps) || 1));
  const metric = practiceMetric(drill), guide = practiceGuide(drill);
  const isShooting = metric.kind === 'makes';
  useEffect(() => { live.current = true; panel.current?.focus(); return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (paused || result) { clock.current = null; return; }
    clock.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(), difference = (now - clock.current) / 1000;
      clock.current = now;
      setElapsed(value => Math.min(86400, value + Math.max(0, difference)));
    }, 250);
    return () => clearInterval(timer);
  }, [paused, result]);
  const good = outcomes.filter(Boolean).length, missed = outcomes.length - good;
  const rate = outcomes.length ? Math.round(good / outcomes.length * 100) : null;
  const bestStreak = practiceBestStreak(outcomes);
  const currentStreak = practiceBestStreak([...outcomes.slice(outcomes.lastIndexOf(false) + 1)]);
  const currentTime = Math.min(86400, elapsed + (!paused && clock.current ? Math.max(0, (Date.now() - clock.current) / 1000) : 0));
  const duration = result?.elapsed_seconds ?? Math.floor(currentTime);

  const recordAttempt = made => {
    if (paused || result || busy || outcomes.length >= target) return;
    const second = Math.floor(currentTime);
    setOutcomes(rows => rows.length >= target ? rows : [...rows, made]);
    setAttemptSeconds(rows => rows.length >= target ? rows : [...rows, second]);
  };
  const undo = () => {
    if (result || busy || !outcomes.length) return;
    setOutcomes(rows => rows.slice(0, -1));
    setAttemptSeconds(rows => rows.slice(0, -1));
  };
  const finish = () => {
    if (!outcomes.length || result) return;
    const finalElapsed = Math.max(Math.ceil(attemptSeconds.at(-1) || 0), Math.floor(currentTime));
    setResult(skillResult({ drill, outcomes, attemptSeconds, elapsedSeconds: finalElapsed, id: crypto.randomUUID() }));
  };
  const save = async () => {
    if (lock.current || !result || !canSave) return;
    lock.current = true; setBusy(true); setError('');
    try { await onSave(result); if (live.current) onClose(); }
    catch { if (live.current) setError('Saving was not confirmed. Your result may already be stored. Keep this screen open and retry with the same result ID.'); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  };
  const leave = () => {
    if (busy) return;
    if (!outcomes.length || window.confirm('Leave without saving this practice result?')) onClose();
  };
  const trapFocus = event => {
    if (event.key === 'Escape') { event.preventDefault(); leave(); return; }
    if (event.key !== 'Tab' || !panel.current) return;
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
  };
  const complete = result?.drills[0].reps_completed === target;
  const recap = result !== null;
  return <section className="skill-session skill-session-studio" role="dialog" aria-modal="true" aria-label={`Practice: ${drill.name}`} tabIndex={-1} ref={panel} onKeyDown={trapFocus}>
    <header className="skill-studio-header">
      <button type="button" disabled={busy} onClick={leave}>{recap ? 'Close' : 'Exit practice'}</button>
      <span>COURTIQ <strong>TRAINING MODE</strong></span>
      <time aria-label="Elapsed training time">{formatPracticeClock(duration)}</time>
    </header>
    <div className="skill-session-body skill-studio-body">
      <div className="skill-studio-intro">
        <p className="skill-eyebrow">{recap ? 'SESSION COMPLETE' : 'LIVE PRACTICE'} · {drill.category.replaceAll('-', ' ')}</p>
        <h2>{recap ? 'Solid work.' : drill.name}</h2>
        <p>{recap ? `${good} of ${outcomes.length} ${isShooting ? 'shots made' : 'clean reps'} · ${drill.name} · ${complete ? 'Target completed' : 'Partial session'}` : `Target: ${target} ${guide.unit} · ${drill.level}`}</p>
        {!recap && <p className="skill-cue">{drill.videoTip || guide.steps[0]?.[1]}</p>}
      </div>

      <div className="skill-studio-metrics" aria-label="Training session stats">
        <div className="skill-studio-metric"><span className="skill-metric-icon">◷</span><strong>{formatPracticeClock(duration)}</strong><span>Duration</span></div>
        <div className="skill-studio-metric"><span className="skill-metric-icon">◎</span><strong>{good}/{outcomes.length}</strong><span>{isShooting ? 'Shots made' : 'Clean reps'}</span></div>
        <div className="skill-studio-metric"><span className="skill-metric-icon">↗</span><strong>{bestStreak} in a row</strong><span>Best streak</span></div>
        <div className="skill-studio-metric"><span className="skill-metric-icon">%</span><strong>{rate === null ? '—' : `${rate}%`}</strong><span>{isShooting ? 'Shot accuracy' : 'Clean-rep rate'}</span></div>
      </div>

      {!recap && <>
        <div className="skill-studio-count"><strong aria-live="polite">{outcomes.length}<small> / {target}</small></strong><span>{isShooting ? 'Shots logged' : 'Reps logged'}</span></div>
        <progress value={outcomes.length} max={target} aria-label="Recorded practice attempts"/>
        <p className="skill-studio-status" aria-live="polite">{good} of {outcomes.length} {isShooting ? 'shots made' : 'clean reps'} · {missed} {isShooting ? 'missed' : 'need work'}{rate !== null ? ` · ${rate}%` : ''}{currentStreak > 1 ? ` · ${currentStreak} straight` : ''}</p>
        <div className="skill-log-buttons skill-studio-log-buttons">
          <button className="skill-primary" type="button" disabled={paused || busy || outcomes.length >= target} onClick={() => recordAttempt(true)}>+ {metric.good}</button>
          <button type="button" disabled={paused || busy || outcomes.length >= target} onClick={() => recordAttempt(false)}>+ {metric.other}</button>
        </div>
        <div className="skill-session-actions">
          <button type="button" disabled={!outcomes.length || busy} onClick={undo}>Undo last</button>
          <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Resume timer' : 'Pause timer'}</button>
        </div>
        {paused && <p role="status">Paused · rep inputs are locked.</p>}
      </>}

      {recap && <>
        {previous && complete && <p className="skill-cue">{rate - previous.rate > 0 ? '+' : ''}{rate - previous.rate} percentage points versus the last completed practice of the same drill and target. Different conditions may affect results.</p>}
        {(!previous || !complete) && <p className="skill-muted">{complete ? 'Your first comparable result. Repeat this drill with the same target and setup to build a trend.' : 'Partial practice counts toward recorded volume, not completed-target comparisons.'}</p>}
      </>}

      {outcomes.length > 0 && <section className="skill-studio-attempts" aria-label={isShooting ? 'Shot by shot' : 'Rep by rep'}>
        <div className="skill-studio-row-heading"><h3>{isShooting ? 'SHOT BY SHOT' : 'REP BY REP'}</h3><span>{outcomes.length} {isShooting ? 'shots' : 'reps'}</span></div>
        <ol className="skill-studio-strip">
          {outcomes.map((made, index) => <li key={index} className={made ? 'is-success' : 'is-miss'}>
            <span>{isShooting ? 'SHOT' : 'REP'} {index + 1}</span>
            <strong>{made ? (isShooting ? 'MAKE' : 'CLEAN') : (isShooting ? 'MISS' : 'RETRY')}</strong>
            <small>{formatPracticeClock(attemptSeconds[index] ?? 0)} · manually recorded</small>
          </li>)}
        </ol>
      </section>}

      {recap ? <>
        {error && <p role="alert">{error}</p>}
        {canSave ? <button className="skill-primary skill-studio-save" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : error ? 'Retry saving result' : 'Save practice result'}</button> : <p role="status">Saving is unavailable. This result has not been stored.</p>}
        <p className="skill-muted">After saving, open My progress to review the shot-by-shot log and optionally attach a video for replay on this device.</p>
        <p className="skill-muted">All results are self-recorded. Camera-based make/miss detection, release angle and automatic video synchronization are not provided.</p>
      </> : <>
        <button className="skill-studio-finish" type="button" disabled={!outcomes.length || busy} onClick={finish}>{outcomes.length === target ? 'Finish practice' : 'Finish with recorded reps'}</button>
        <p className="skill-muted">{isShooting ? 'Tap Made or Missed for every shot, including misses.' : 'Clean = completed the coaching cue; Needs work = attempted without the cue.'} This counter measures recorded attempts, not automated shot detection. Rest as needed. Stop for pain, dizziness or unsafe conditions.</p>
      </>}
    </div>
  </section>;
}
