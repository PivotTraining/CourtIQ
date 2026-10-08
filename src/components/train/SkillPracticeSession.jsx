'use client';
import { useEffect, useRef, useState } from 'react';
import { practiceMetric, practiceGuide, skillResult } from '@/lib/skillPractice.mjs';

export default function SkillPracticeSession({ drill, previous, canSave, onSave, onClose }) {
  const [outcomes, setOutcomes] = useState([]), [paused, setPaused] = useState(false), [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const live = useRef(false), lock = useRef(false), clock = useRef(null), panel = useRef(null);
  const target = Math.max(1, Math.floor(Number(drill.reps) || 1)), metric = practiceMetric(drill), guide = practiceGuide(drill);
  useEffect(() => { live.current = true; panel.current?.focus(); return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (paused || result) { clock.current = null; return; }
    clock.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(), difference = (now - clock.current) / 1000; clock.current = now;
      setElapsed(value => Math.min(86400, value + Math.max(0, difference)));
    }, 250);
    return () => clearInterval(timer);
  }, [paused, result]);
  const good = outcomes.filter(Boolean).length, rate = outcomes.length ? Math.round(good / outcomes.length * 100) : null;
  const finish = () => {
    if (!outcomes.length || result) return;
    const finalElapsed = elapsed + (!paused && clock.current ? Math.max(0, (Date.now() - clock.current) / 1000) : 0);
    setResult(skillResult({ drill, outcomes, elapsedSeconds: Math.min(86400, finalElapsed), id: crypto.randomUUID() }));
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
    if (event.key !== 'Tab') return;
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
  };
  const complete = result?.drills[0].reps_completed === target;
  return <section className="skill-session" role="dialog" aria-modal="true" aria-label={`Practice: ${drill.name}`} tabIndex={-1} ref={panel} onKeyDown={trapFocus}>
    <header><button disabled={busy} onClick={leave}>Exit practice</button><span>SKILL LAB</span><span>{Math.floor(result ? result.elapsed_seconds : elapsed)}s</span></header>
    <div className="skill-session-body">
      <p className="skill-eyebrow">{drill.category.replaceAll('-', ' ')} · {drill.level}</p><h2>{drill.name}</h2>
      {result ? <>
        <p>{complete ? 'Recording target reached' : 'Partial practice recorded'} · {outcomes.length}/{target} {guide.unit}</p>
        <div className="skill-big-number">{rate}%</div><p>{metric.label}: {good} of {outcomes.length} · self-recorded</p>
        {previous && complete && <p className="skill-cue">{rate - previous.rate > 0 ? '+' : ''}{rate - previous.rate} percentage points versus your last completed practice of this same drill and target. Different conditions may affect results.</p>}
        {(!previous || !complete) && <p className="skill-muted">{complete ? 'Your first comparable result. Repeat this drill with the same target and setup to establish a trend.' : 'Partial results count toward practice volume, not completed-target comparisons.'}</p>}
        {error && <p role="alert">{error}</p>}
        {canSave ? <button className="skill-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : error ? 'Retry saving result' : 'Save practice result'}</button> : <p role="status">Saving is unavailable in this environment. This result has not been stored.</p>}
        <p className="skill-muted">Practice accuracy is not a verified skill rating. It does not change your game stats.</p>
      </> : <>
        <p>Recording target: {target} {guide.unit} · ~{drill.duration} min</p>
        <p className="skill-cue">{drill.videoTip || guide.steps[0]?.[1]}</p>
        <div className="skill-big-number" aria-live="polite">{outcomes.length}<small> / {target}</small></div>
        <progress value={outcomes.length} max={target} aria-label="Recorded practice attempts" />
        <p>{good} {metric.kind === 'makes' ? 'made' : 'clean'} · {outcomes.length - good} {metric.kind === 'makes' ? 'missed' : 'need work'}{rate !== null ? ` · ${rate}%` : ''}</p>
        <div className="skill-log-buttons"><button className="skill-primary" disabled={paused || outcomes.length >= target} onClick={() => setOutcomes(rows => rows.length < target ? [...rows, true] : rows)}>+ {metric.good}</button><button disabled={paused || outcomes.length >= target} onClick={() => setOutcomes(rows => rows.length < target ? [...rows, false] : rows)}>+ {metric.other}</button></div>
        <div className="skill-session-actions"><button disabled={!outcomes.length} onClick={() => setOutcomes(rows => rows.slice(0, -1))}>Undo last</button><button aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Resume timer' : 'Pause timer'}</button></div>
        {paused && <p role="status">Paused — rep inputs are locked.</p>}
        <button disabled={!outcomes.length} onClick={finish}>{outcomes.length === target ? 'Finish practice' : 'Finish with recorded reps'}</button>
        <p className="skill-muted">{metric.kind === 'makes' ? 'Record every shot, including misses. This counter measures attempts, not a required number of makes.' : 'Clean = completed the rep with the coaching cue. Needs work = the rep was attempted but the cue was missed.'} Follow the drill’s actual completion rules; a filled counter alone does not prove drill completion. Rest as needed; stop for pain, dizziness, or unsafe conditions.</p>
      </>}
    </div>
  </section>;
}
