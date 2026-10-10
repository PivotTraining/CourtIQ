'use client';
import { useMemo, useState } from 'react';
import { buildPracticeIntelligence } from '@/lib/practiceIntelligence.mjs';

export default function PracticeOutlook({ entries = [] }) {
  const groups = useMemo(() => buildPracticeIntelligence(entries), [entries]);
  const [selection, setSelection] = useState('');
  const active = groups.find(item => item.key === selection)
    || groups.find(item => item.forecast.available) || groups[0];

  return <section className="skill-intelligence" aria-label="Practice intelligence">
    <p className="skill-eyebrow">CourtIQ / Evidence Lab</p>
    <h4>What your recorded practice can tell us</h4>
    <p className="skill-muted">We compare the same drill and target. Makes and misses are self-recorded, not camera-verified. Clean-rep judgments cannot be treated as shot percentages.</p>
    {!groups.length ? <p className="skill-muted">Complete and save a shooting or finishing assessment to start collecting comparable evidence.</p> : <>
      <label className="skill-outlook-select">Choose an assessment
        <select value={active.key} onChange={event => setSelection(event.target.value)}>
          {groups.map(item => <option key={item.key} value={item.key}>{item.name} · {item.target} attempts</option>)}
        </select>
      </label>
      <div className="skill-outlook-metrics">
        <div><span>Last {Math.min(active.totalSessions, 5)} comparable sessions</span><strong>{active.recordedRate}%</strong><small>{active.successes}/{active.attempts} recorded makes</small></div>
        <div><span>Change between assessments</span><strong>{active.trend ? `${active.trend.deltaPoints > 0 ? '+' : ''}${active.trend.deltaPoints} pp` : '—'}</strong><small>{active.trend ? 'Last 3 vs prior 3' : 'Needs six completed sessions'}</small></div>
      </div>
      {active.forecast.available ? <div className="skill-outlook-result">
        <span className="skill-outlook-label">Experimental next-10 outlook</span>
        <strong>{active.forecast.expectedMakes} of 10</strong>
        <p>Model-based average for 10 similar attempts. Approximate 80% predictive interval: <b>{active.forecast.plausibleLow}–{active.forecast.plausibleHigh} makes</b>.</p>
        <p className="skill-muted">Beta-binomial statistical model, not trained AI. This projection is not externally validated and is not a prediction of game results. Shot context may change outcomes.</p>
      </div> : <p className="skill-outlook-result skill-muted">Outlook not available yet: record at least three completed sessions and 60 attempts of this same drill and target. Current: {active.forecast.sessions} sessions and {active.forecast.attempts} attempts.</p>}
      <p className="skill-cue"><strong>Your evidence-based next move</strong>{active.nextAction}</p>
    </>}
    <p className="skill-muted">Why these numbers? We require repeat assessments and never count missing recordings as failures. An observed change does not establish that a drill caused the improvement.</p>
  </section>;
}
