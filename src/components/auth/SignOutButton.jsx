"use client";

import { useEffect, useRef, useState } from 'react';
import { signOutUser } from '@/lib/firebase';

export default function SignOutButton({ signOut = signOutUser }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  async function leave() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await signOut(); }
    catch (failure) { if (alive.current) setError(failure.message || 'Could not sign out. Please try again.'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <div style={{ marginTop: 16, textAlign: 'center' }}>
    <button type="button" disabled={busy} onClick={leave} style={{ minHeight: 44, padding: '8px 20px', border: 0, background: 'transparent', color: 'var(--color-text-sec)', fontWeight: 700 }}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
    {error && <p role="alert" style={{ color: 'var(--color-danger, #DC2626)', maxWidth: 360 }}>{error}</p>}
  </div>;
}
