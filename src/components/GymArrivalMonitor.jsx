"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { gymArrivalTransition, gymPreferenceKey, gymCustomKey, gymStateKey, safeCustomGyms } from '@/lib/gymArrival.mjs';

export default function GymArrivalMonitor({ onStartGame, onOpenFilm }) {
  const { user } = useAuth();
  const accountId = user?.id;
  const [enabled, setEnabled] = useState(false);
  const [arrival, setArrival] = useState(null);
  const stateRef = useRef({ insideId: null, notifiedAt: {} });

  useEffect(() => {
    const reload = () => {
      try { setEnabled(!!accountId && localStorage.getItem(gymPreferenceKey(accountId)) === 'true'); }
      catch { setEnabled(false); }
    };
    reload();
    window.addEventListener('courtiq:gym-reminders-change', reload);
    return () => window.removeEventListener('courtiq:gym-reminders-change', reload);
  }, [accountId]);

  useEffect(() => {
    if (!enabled || !accountId || !navigator.geolocation) { setArrival(null); return; }
    const controller = new AbortController();
    let watcher = null;
    let campuses = [];
    let alive = true;
    try { stateRef.current = JSON.parse(localStorage.getItem(gymStateKey(accountId)) || 'null') || { insideId: null, notifiedAt: {} }; }
    catch { stateRef.current = { insideId: null, notifiedAt: {} }; }

    const onPosition = position => {
      if (!alive || document.hidden) return;
      const result = gymArrivalTransition(stateRef.current, campuses,
        { lat: position.coords.latitude, lon: position.coords.longitude });
      stateRef.current = result.state;
      try { localStorage.setItem(gymStateKey(accountId), JSON.stringify(result.state)); } catch {}
      if (result.arrival) setArrival(result.arrival);
    };
    const stop = () => {
      if (watcher !== null) navigator.geolocation.clearWatch(watcher);
      watcher = null;
    };
    const syncWatch = () => {
      if (!alive || document.hidden || !campuses.length) return stop();
      if (watcher !== null) return;
      watcher = navigator.geolocation.watchPosition(onPosition, () => {}, {
        enableHighAccuracy: false, maximumAge: 60000, timeout: 20000,
      });
    };
    const updateLocations = () => {
      try {
        const custom = safeCustomGyms(JSON.parse(localStorage.getItem(gymCustomKey(accountId)) || '[]'));
        campuses = [...campuses.filter(c => !String(c.id).startsWith('custom-')), ...custom];
      } catch {}
    };
    async function load() {
      try {
        const response = await fetch('/api/gym-campuses', { signal: controller.signal });
        if (!response.ok) throw new Error('Campus list unavailable');
        const data = await response.json();
        if (!alive || !Array.isArray(data.campuses)) return;
        campuses = data.campuses.filter(c => c && c.id && c.name &&
          Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lon)));
      } catch {
        if (!alive) return;
        campuses = []; // Custom gyms continue working during campus service outages.
      }
      updateLocations();
      syncWatch();
    }
    const changed = () => { updateLocations(); syncWatch(); };
    document.addEventListener('visibilitychange', syncWatch);
    window.addEventListener('courtiq:gym-reminders-change', changed);
    load();
    return () => {
      alive = false; controller.abort(); stop();
      document.removeEventListener('visibilitychange', syncWatch);
      window.removeEventListener('courtiq:gym-reminders-change', changed);
    };
  }, [enabled, accountId]);

  if (!enabled || !arrival) return null;
  return <aside aria-label="Gym arrival reminder" role="status" style={{
    position: 'fixed', zIndex: 180, bottom: 'max(86px, env(safe-area-inset-bottom, 86px))',
    left: '50%', transform: 'translateX(-50%)', width: 'min(94vw, 450px)',
    borderRadius: 16, border: '2px solid #FF6B35', background: 'var(--color-card)',
    color: 'var(--color-text)', padding: 16, boxShadow: '0 10px 35px #0004',
  }}>
    <div style={{ fontSize: 15, fontWeight: 900 }}>🏀 Near {arrival.name}</div>
    <p style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-text-sec)', margin: '6px 0 12px' }}>
      Ready to log your game? Your location is approximate.
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" onClick={() => { setArrival(null); onStartGame(); }}
        style={{ padding: '10px 12px', minHeight: 44, border: 0, borderRadius: 10,
          background: '#FF6B35', color: '#fff', fontWeight: 800 }}>Track stats now</button>
      <button type="button" onClick={() => { setArrival(null); onOpenFilm(); }}
        style={{ padding: '10px 12px', minHeight: 44, border: '1px solid var(--color-border)', borderRadius: 10,
          background: 'var(--color-muted)', color: 'var(--color-text)', fontWeight: 750 }}>Film Lab</button>
      <button type="button" onClick={() => setArrival(null)} aria-label="Dismiss gym reminder"
        style={{ padding: '10px 12px', minHeight: 44, border: 0, borderRadius: 10,
          background: 'transparent', color: 'var(--color-text-sec)' }}>Dismiss</button>
    </div>
  </aside>;
}
