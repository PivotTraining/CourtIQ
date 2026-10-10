import { buildGameShotOutlook } from '@/lib/practiceIntelligence.mjs';

export default function GameShotOutlook({ sessions = [] }) {
  const { games, attempts, successes, forecast } = buildGameShotOutlook(sessions);
  return <section aria-label="Game shooting outlook" style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 16 }}>
    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, letterSpacing: 1.1, color: 'var(--color-text-sec)', textTransform: 'uppercase' }}>CourtIQ / Game Intelligence</p>
    <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800 }}>Your shooting outlook</h3>
    <p style={{ margin: '0 0 14px', color: 'var(--color-text-sec)', fontSize: 12, lineHeight: 1.6 }}>
      Only completed games with confirmed full-game coverage and known shot outcomes count. Practice attempts are never mixed into this model.
    </p>
    {forecast.available ? <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        <div style={{ background: 'var(--color-muted)', borderRadius: 12, padding: 12 }}><span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-sec)' }}>Tracked game field goals</span><strong style={{ fontSize: 24, fontWeight: 900 }}>{forecast.recordedRate}%</strong><small style={{ display: 'block', color: 'var(--color-text-sec)' }}>{successes} of {attempts} · {games} games</small></div>
        <div style={{ background: 'var(--color-muted)', borderRadius: 12, padding: 12 }}><span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-sec)' }}>Next 10 similar shots (estimate)</span><strong style={{ fontSize: 24, fontWeight: 900 }}>{forecast.expectedMakes}/10</strong><small style={{ display: 'block', color: 'var(--color-text-sec)' }}>Approx. 80% range: {forecast.plausibleLow}–{forecast.plausibleHigh} makes</small></div>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--color-text-sec)', lineHeight: 1.6 }}>This is an unvalidated beta-binomial statistical outlook, not trained AI or a guarantee. It assumes a similar shot mix and game context. A player's next performance can differ substantially.</p>
    </> : <p style={{ padding: 12, background: 'var(--color-muted)', borderRadius: 12, fontSize: 12, lineHeight: 1.6 }}>
      Not enough verified coverage for a defensible estimate: {games}/3 confirmed completed games and {attempts}/60 recorded field-goal attempts. No prediction is shown until both minimums are met.
    </p>}
  </section>;
}
