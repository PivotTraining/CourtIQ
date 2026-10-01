"use client";

export default function SessionTimeline({ events, busy, reverse }) {
  const reversed = new Set(events.filter(event => event.payload.kind === 'reverse').map(event => event.payload.target));
  return <section aria-label="Session entry timeline"><h3>Entry timeline</h3><p className="tracker-hint">Reverse an incorrect entry, then record the correct value. The correction remains in your audit trail.</p>
    <ol style={{ maxHeight: 260, overflowY: 'auto', paddingLeft: 20 }}>
      {[...events].reverse().map(event => <li key={event.id} style={{ marginBottom: 10 }}>
        <span>{event.payload.kind === 'shot' ? `${event.payload.made ? 'Made' : 'Missed'} · ${event.payload.zone_id}`
          : event.payload.kind === 'stat' ? `${event.payload.key.toUpperCase()} ${event.payload.delta > 0 ? '+' : ''}${event.payload.delta}`
          : event.payload.kind === 'reverse' ? 'Correction: earlier entry reversed' : event.payload.kind === 'end' ? 'Session completed' : 'Game details updated'} · P{event.payload.period} {event.payload.clock}</span>
        {reversed.has(event.id) ? <span> · Reversed</span> : ['shot', 'stat'].includes(event.payload.kind) && <button style={{ minHeight: 44, marginLeft: 8 }} disabled={busy} onClick={() => reverse(event.id)} aria-label={`Reverse entry ${event.version}`}>Reverse</button>}
      </li>)}
    </ol></section>;
}
