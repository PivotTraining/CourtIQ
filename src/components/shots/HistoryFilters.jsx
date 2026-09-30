"use client";

export default function HistoryFilters({ sessions, value, onChange }) {
  const seasons = [...new Set(sessions.map(session => session.tracker_context?.season).filter(Boolean))].sort();
  const style = { minHeight: 44, width: '100%', minWidth: 0, padding: 8, borderRadius: 10, background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' };
  return <fieldset style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginBottom: 16, border: 0, padding: 0 }}>
    <legend className="text-sm font-bold mb-2">Season & dates</legend>
    <label style={{ gridColumn: '1 / -1', fontSize: 12 }}>Season<select style={style} value={value.season} onChange={event => onChange({ ...value, season: event.target.value })}><option value="">All seasons / unlabeled legacy games</option>{seasons.map(season => <option key={season}>{season}</option>)}</select></label>
    <label style={{ fontSize: 12 }}>From<input style={style} type="date" value={value.from} onChange={event => onChange({ ...value, from: event.target.value })} /></label>
    <label style={{ fontSize: 12 }}>Through<input style={style} type="date" value={value.to} onChange={event => onChange({ ...value, to: event.target.value })} /></label>
    {value.from && value.to && value.from > value.to && <p role="alert">The start date must be before the end date.</p>}
  </fieldset>;
}
