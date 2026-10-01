"use client";

import { useEffect, useMemo, useState } from 'react';
import { ReliableTrackerWorkspace } from '@/components/shots/ReliableTracker';
import { projectCommand } from '@/lib/sessionRecovery.mjs';

function createSampleBackend(network) {
  const key = 'courtiq-local-sample-backend-v1';
  function records() { return JSON.parse(window.localStorage.getItem(key) || '{}'); }
  function write(rows) { window.localStorage.setItem(key, JSON.stringify(rows)); }
  function connected() { if (!network.current) throw new Error('Sample offline simulation'); }
  return {
    async fetchActiveSessions() { connected(); return Object.values(records()).map(row => row.session).filter(row => row.tracker_status === 'active'); },
    async fetchTrackerSession(id) { connected(); const row = records()[id]; if (!row) throw new Error('Sample session unavailable'); return row; },
    async createTrackerSession(playerId, type, context) {
      connected(); const session = { id: crypto.randomUUID(), player_id: playerId, type, date: context.date,
        tracker_context: context, tracker_status: 'active', tracker_version: 0, game_stats: {} };
      write({ ...records(), [session.id]: { session, shots: [], events: [] } }); return session;
    },
    async applySessionCommand(command) {
      connected(); const rows = records(); const snapshot = rows[command.sessionId];
      if (snapshot.events.some(event => event.id === command.id)) return snapshot.session;
      const next = projectCommand(snapshot, command); write({ ...rows, [command.sessionId]: next }); return next.session;
    },
  };
}

export default function TrackerPreview() {
  const [dark, setDark] = useState(true);
  const [open, setOpen] = useState(true);
  const [offline, setOffline] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const network = useMemo(() => ({ current: true }), []);
  const backend = useMemo(() => createSampleBackend(network), [network]);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  network.current = !offline;
  return <>
    <div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 300, display: 'flex', gap: 8, padding: showControls ? 8 : 4, background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 10 }}>
      <span>LOCAL SAMPLE ONLY · no Supabase / Stripe calls</span>
      {showControls && <button onClick={() => setOffline(!offline)} style={{ minHeight: 44 }}>{offline ? 'Reconnect sample' : 'Simulate offline'}</button>}
      <button onClick={() => setShowControls(!showControls)}>{showControls ? 'Hide sample controls' : 'Show'}</button>
      {!open && <button onClick={() => setOpen(true)}>Open tracker</button>}
    </div>
    {open && <ReliableTrackerWorkspace accountId="local-sample-account" playerId="local-sample-player"
      backend={backend} refreshData={async () => true} onClose={() => setOpen(false)} darkMode={dark} onToggleTheme={() => setDark(!dark)} />}
  </>;
}
