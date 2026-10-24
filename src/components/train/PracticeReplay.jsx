"use client";
import SessionVideo from "@/components/shots/SessionVideo";
import { practiceAttemptTimeline, practiceBestStreak, formatPracticeClock } from "@/lib/skillPractice.mjs";

// Optional local replay. An uploaded video is independent of the manually logged
// attempt timestamps unless its recording starts at exactly the practice clock.
export default function PracticeReplay({ entry, playerId }) {
  const timeline = practiceAttemptTimeline(entry);
  const isShooting = entry.outcome_kind === 'makes';
  const best = timeline ? practiceBestStreak(timeline.map(item => item.good)) : null;
  return <section className="skill-studio-replay" aria-label={`Practice recap for ${entry.name}`}>
    <p className="skill-eyebrow">YOUR TRAINING RECAP</p>
    <h3>{entry.name}</h3>
    <p>{new Date(entry.completed_at).toLocaleDateString()} · {entry.reps_completed} recorded {isShooting ? 'shots' : 'reps'}. This is your self-reported practice log, not an AI-measured result.</p>
    <div className="skill-studio-metrics">
      <div className="skill-studio-metric"><span className="skill-metric-icon">◷</span><strong>{formatPracticeClock(entry.elapsed_seconds)}</strong><span>Duration</span></div>
      <div className="skill-studio-metric"><span className="skill-metric-icon">◎</span><strong>{entry.successful_reps}/{entry.reps_completed}</strong><span>{isShooting ? 'Shots made' : 'Clean reps'}</span></div>
      <div className="skill-studio-metric"><span className="skill-metric-icon">↗</span><strong>{best === null ? '—' : `${best} in a row`}</strong><span>Best streak</span></div>
      <div className="skill-studio-metric"><span className="skill-metric-icon">%</span><strong>{entry.rate}%</strong><span>{isShooting ? 'Shot accuracy' : 'Clean-rep rate'}</span></div>
    </div>
    {timeline ? <section className="skill-studio-attempts" aria-label={isShooting ? 'Shot by shot' : 'Rep by rep'}>
      <div className="skill-studio-row-heading"><h3>{isShooting ? 'SHOT BY SHOT' : 'REP BY REP'}</h3><span>{timeline.length} recorded</span></div>
      <ol className="skill-studio-strip">{timeline.map(item => <li key={item.number} className={item.good ? 'is-success' : 'is-miss'}>
        <span>{isShooting ? 'SHOT' : 'REP'} {item.number}</span>
        <strong>{item.good ? (isShooting ? 'MAKE' : 'CLEAN') : (isShooting ? 'MISS' : 'RETRY')}</strong>
        <small>{item.second === null ? 'Time not recorded' : formatPracticeClock(item.second)} · manually logged</small>
      </li>)}</ol>
    </section> : <p>Shot-by-shot details are unavailable for this older session. The recorded session totals are unchanged.</p>}
    {playerId && entry.workoutId && <div className="skill-studio-video">
      <SessionVideo accountId={playerId} sessionId={entry.workoutId} />
      <p className="skill-muted">Replay is an optional video you choose to save on this device. It does not detect shots, calculate release mechanics or automatically line up video timestamps with the self-recorded timeline. Keep your own backup.</p>
    </div>}
  </section>;
}
