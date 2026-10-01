"use client";

export default function GameContextForm({ value, onChange, includeScores = true }) {
  const update = (key, data) => onChange({ ...value, [key]: data });
  return <fieldset className="tracker-game-details" style={{ border: 0, padding: 0, margin: '16px 0', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
    <legend style={{ fontWeight: 800, marginBottom: 12 }}>Game / practice details</legend>
    {[['date','Date','date'],['opponent','Opponent','text'],['season','Season label','text'],['competition','Competition','text'],...(includeScores ? [['team_score','Final team score','number'],['opponent_score','Final opponent score','number']] : [])].map(([key, label, type]) => <label key={key} style={{ display: 'grid', gap: 4, fontSize: 12 }}>{label}
      <input type={type} min={type === 'number' ? 0 : undefined} maxLength={type === 'text' ? 100 : undefined} value={value[key] ?? ''}
        onChange={event => update(key, event.target.value)} style={{ minWidth: 0, minHeight: 44, borderRadius: 10, padding: 8, background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} /></label>)}
    <label>Location<select value={value.location || 'home'} onChange={event => update('location', event.target.value)}><option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option></select></label>
    <label>Periods<select value={value.format || 'quarters'} onChange={event => update('format', event.target.value)}><option value="quarters">4 quarters</option><option value="halves">2 halves</option></select></label>
    <p style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--color-text-sec)' }}>Leave scores blank until known. Player points do not stand in for team scores.</p>
  </fieldset>;
}
