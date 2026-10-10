'use client';
import { useEffect, useRef, useState } from 'react';
import { internalApi } from '@/lib/internalApi.mjs';
import './ai-coach.css';

const SUGGESTIONS = [
  'What does my shooting data actually show?',
  'Which weakness has enough evidence to practice?',
  'Give me a simple measurable training plan.',
];

export default function AICoach({ playerId }) {
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [error, setError] = useState('');
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  const ask = async () => {
    if (!playerId || busy || !consent || question.trim().length < 8) return;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setBusy(true); setError(''); setAnswer(null);
    const submitted = question.trim();
    try {
      const result = await internalApi('/api/coach', {
        method: 'POST', body: { playerId, question: submitted, consent: true },
        signal: active.signal, timeoutMs: 18000,
      });
      if (active.signal.aborted) return;
      setAnswer(result);
      setLastQuestion(submitted);
      setQuestion('');
      setConsent(false);
    } catch (failure) {
      if (!active.signal.aborted) setError(failure.message || 'Unable to load AI Coach.');
    } finally { if (!active.signal.aborted) setBusy(false); }
  };

  return <section className="courtiq-ai-coach" aria-label="CourtIQ AI Coach">
    <div className="courtiq-ai-head">
      <span className="courtiq-ai-eyebrow">CourtIQ / AI Coach Pilot</span>
      <h2>Ask about your game.</h2>
      <p>Get an explanation and suggested next steps grounded in your recorded game and practice results, not invented scouting ratings.</p>
    </div>
    <p className="courtiq-ai-notice">Adult player profiles only during the pilot. CourtIQ does not attach journal text, video, names or account identifiers. Your question is transmitted as typed, so do not include private information. This is one question at a time and is not saved as a conversation.</p>
    <div className="courtiq-ai-suggestions">{SUGGESTIONS.map(value =>
      <button type="button" key={value} onClick={() => setQuestion(value)} disabled={busy || !playerId}>{value}</button>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); ask(); }}>
      <label className="courtiq-ai-label" htmlFor="courtiq-ai-question">Basketball question</label>
      <textarea id="courtiq-ai-question" value={question} onChange={event=>setQuestion(event.target.value)} disabled={busy || !playerId}
        maxLength={320} rows={3} placeholder="For example: What should I practice next, based on my stats?" />
      <p className="courtiq-ai-small">Please do not enter names, schools, contact details, health information, or links.</p>
      <label className="courtiq-ai-consent">
        <input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={busy || !playerId} />
        <span>I agree to send this question and aggregated basketball results to an external AI provider for this answer.</span>
      </label>
      <button type="submit" className="courtiq-ai-submit" disabled={!playerId || busy || !consent || question.trim().length < 8}>
        {busy ? 'Analyzing recorded evidence…' : 'Ask CourtIQ Coach'}
      </button>
    </form>
    {error && <p role="alert" className="courtiq-ai-error">{error}</p>}
    {answer?.answer && <div className="courtiq-ai-answer" aria-live="polite">
      <span className="courtiq-ai-eyebrow">Coach response {answer.mode === 'records-needed' ? '· Records needed' : '· AI-assisted'}</span>
      <p className="courtiq-ai-asked">{lastQuestion}</p>
      <p className="courtiq-ai-response">{answer.answer}</p>
      <div className="courtiq-ai-evidence">
        <strong>Evidence behind this answer</strong>
        <p>{answer.evidence?.eligibleGames ?? 0} confirmed completed games · {answer.evidence?.gameFieldGoals?.makes ?? 0}/{answer.evidence?.gameFieldGoals?.attempts ?? 0} recorded field goals · {answer.evidence?.practiceGroups ?? 0} drill groups</p>
        <small>Self-reported results, not independently verified. AI explanations may contain errors. They are not scouting or future-success predictions.</small>
      </div>
    </div>}
    <p className="courtiq-ai-footer">This experimental feature is not a substitute for a qualified basketball coach or medical professional. Requests are limited to prevent misuse.</p>
  </section>;
}
