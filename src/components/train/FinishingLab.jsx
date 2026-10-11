'use client';
import { useMemo, useRef, useState } from 'react';
import { FINISHING_TARGET, finishingHistory } from '@/lib/adaptiveFinishing.mjs';
import { DRILL_BANK } from '@/lib/drillBank';
import DrillWalkthrough from './DrillWalkthrough';
import AdaptiveFinishingSession from './AdaptiveFinishingSession';
import './adaptive-finishing.css';

const demonstration = DRILL_BANK.find(drill => drill.id === 'mikan-drill');

export default function FinishingLab({ playerId, records = [], status, canSave, onSave }) {
  const [active, setActive] = useState(false);
  const beginRef = useRef(null);
  const completed = useMemo(() => status === 'ready' ? finishingHistory(records) : [], [records, status]);
  const prior = completed[0] || null;
  return <section className="af-mission" aria-label="Adaptive finishing mission">
    <div className="af-mission-head"><span className="af-kicker">COURTIQ / ADAPTIVE TRAINING IQ</span><span className="af-mission-stamp">4 STAGES</span></div>
    <h3>FINISHING LAB</h3>
    <p>Less scrolling. More development. Measure your finishing, practice with a purpose, adapt to your results, then repeat the exact test.</p>
    <div className="af-mission-phases"><span>01 Assess</span><span>02 Build</span><span>03 Adapt</span><span>04 Retest</span></div>
    {prior && <div className="af-mission-last">Your last saved retest: <strong>{prior.retest}/{FINISHING_TARGET} makes</strong> · baseline {prior.baseline}/{FINISHING_TARGET}. One workout is a starting point, not evidence of long-term skill transfer.</div>}
    {status === 'loading' && <p role="status">Checking your previous missions…</p>}
    {status === 'error' && <p role="alert">Your saved history cannot be loaded. You may train, but saving will be unavailable until the connection is restored.</p>}
    <button ref={beginRef} type="button" className="af-launch" disabled={!playerId} onClick={() => setActive(true)}>Start my guided mission →</button>
    <p className="af-footnote">{canSave ? 'Four 8-shot stages · approximately 12–18 minutes · results saved only when you choose' : 'Practice can be explored, but reliable saving is not currently available.'} No coaching video, camera, or subscription is required.</p>
    {demonstration && <details><summary>Preview the finishing movement ↓</summary><DrillWalkthrough drill={demonstration} /></details>}
    {active && <AdaptiveFinishingSession canSave={canSave} previous={prior} onSave={onSave} onClose={() => { setActive(false); beginRef.current?.focus(); }} />}
  </section>;
}
