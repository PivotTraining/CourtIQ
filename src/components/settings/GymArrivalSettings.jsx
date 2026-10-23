"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { gymPreferenceKey, gymCustomKey, safeCustomGyms } from '@/lib/gymArrival.mjs';

const cardStyle = { borderRadius: 12, border: '1px solid var(--color-border)', padding: 12, background: 'var(--color-muted)' };
const buttonStyle = { minHeight: 44, padding: '10px 14px', border: 0, borderRadius: 11, fontWeight: 800, cursor: 'pointer', background: '#FF6B35', color: '#fff' };
const announceChange = () => window.dispatchEvent(new Event('courtiq:gym-reminders-change'));

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available in this browser.'));
    navigator.geolocation.getCurrentPosition(position => resolve(position.coords), reject, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  });
}

export default function GymArrivalSettings() {
  const { user } = useAuth();
  const accountId = user?.id;
  const [enabled, setEnabled] = useState(false);
  const [gyms, setGyms] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!accountId) { setEnabled(false); setGyms([]); return; }
    try {
      setEnabled(window.localStorage.getItem(gymPreferenceKey(accountId)) === 'true');
      setGyms(safeCustomGyms(JSON.parse(window.localStorage.getItem(gymCustomKey(accountId)) || '[]')));
    } catch { setEnabled(false); setGyms([]); }
  }, [accountId]);

  const toggle = async () => {
    if (!accountId || busy) return;
    setBusy(true); setMessage('');
    try {
      if (enabled) {
        window.localStorage.removeItem(gymPreferenceKey(accountId));
        setEnabled(false); announceChange();
        setMessage('Arrival checks are off on this device.');
      } else {
        await getPosition(); // Request permission only after the player opts in.
        window.localStorage.setItem(gymPreferenceKey(accountId), 'true');
        setEnabled(true); announceChange();
        setMessage('Enabled. CourtIQ can recognize nearby gyms while the app is open.');
      }
    } catch (error) {
      setMessage(error?.code === 1 ? 'Location permission was denied. Allow location in device settings to enable reminders.' :
        error?.message || 'Could not enable location. Try again.');
    } finally { setBusy(false); }
  };

  const addGym = async () => {
    const gymName = name.trim().slice(0, 80);
    if (!accountId || !enabled || !gymName || busy) return;
    if (gyms.length >= 25) { setMessage('Remove a saved gym before adding another.'); return; }
    setBusy(true); setMessage('');
    try {
      const coords = await getPosition();
      const saved = [...gyms, { id: `custom-${crypto.randomUUID()}`, name: gymName,
        lat: coords.latitude, lon: coords.longitude, radius: 250 }];
      window.localStorage.setItem(gymCustomKey(accountId), JSON.stringify(saved));
      setGyms(saved); setName('');
      announceChange(); setMessage(`Saved ${gymName} on this device.`);
    } catch (error) { setMessage(error?.message || 'Could not save the current location.'); }
    finally { setBusy(false); }
  };

  const removeGym = id => {
    const next = gyms.filter(gym => gym.id !== id);
    window.localStorage.setItem(gymCustomKey(accountId), JSON.stringify(next));
    setGyms(next); announceChange();
  };

  return <section style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)',
    borderRadius: 20, padding: 18, color: 'var(--color-text)' }}>
    <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 900 }}>Gym arrival reminders</h2>
    <p style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--color-text-sec)', margin: '0 0 12px' }}>
      Optional. Recognize Georgia public school campuses and gyms you save yourself.
      In this web version, checks run only while CourtIQ is open. Closed-app notifications require a native mobile release.
    </p>
    <button type="button" disabled={!accountId || busy} onClick={toggle} aria-pressed={enabled}
      style={{ ...buttonStyle, background: enabled ? 'var(--color-muted)' : '#FF6B35', color: enabled ? 'var(--color-text)' : '#fff' }}>
      {busy ? 'Checking…' : enabled ? 'Turn off reminders' : 'Enable gym reminders'}
    </button>
    {message && <p role="status" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 9 }}>{message}</p>}
    {enabled && <>
      <div style={{ ...cardStyle, marginTop: 14 }}>
        <strong style={{ fontSize: 13 }}>Save a private gym or tournament venue</strong>
        <p style={{ margin: '4px 0 10px', fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-sec)' }}>
          When physically at the facility, enter a name and save your current location. Its coordinates stay on this device.
        </p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          Gym name
          <input value={name} maxLength={80} onChange={event => setName(event.target.value)}
            placeholder="Example: Tournament gym"
            style={{ display: 'block', width: '100%', minHeight: 44, marginTop: 5, padding: 10, borderRadius: 10,
              border: '1px solid var(--color-border)', background: 'var(--color-card)', color: 'var(--color-text)' }} />
        </label>
        <button type="button" style={buttonStyle} disabled={!name.trim() || busy} onClick={addGym}>Save current gym</button>
      </div>
      {gyms.map(gym => <div key={gym.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 12 }}>
        <span style={{ flex: 1 }}>{gym.name}</span>
        <button type="button" style={{ ...buttonStyle, background: 'var(--color-muted)', color: 'var(--color-text)' }}
          onClick={() => removeGym(gym.id)} aria-label={`Remove ${gym.name}`}>Remove</button>
      </div>)}
    </>}
    <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--color-text-sec)', margin: '12px 0 0' }}>
      The school points are approximate campus locations, not verified gym entrances. GPS can be imprecise.
      CourtIQ does not upload a continuous location trail to select arrival reminders.
    </p>
  </section>;
}
