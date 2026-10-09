'use client';
import { useState } from 'react';
import LoginScreen from '@/components/auth/LoginScreen';
import SignOutButton from '@/components/auth/SignOutButton';

export default function AuthPreview() {
  const [signedIn, setSignedIn] = useState(false);
  const [scenario, setScenario] = useState('success');
  const [requests, setRequests] = useState(0);
  const [busy, setBusy] = useState(false);
  async function request() {
    setRequests(count => count + 1); setBusy(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 900));
      if (scenario === 'failure') throw new Error('Sample: invalid login credentials. No real request was sent.');
    } finally { setBusy(false); }
  }
  const actions = {
    signInWithEmail: async () => { await request(); setSignedIn(true); },
    signUpWithEmail: async () => { await request(); return { session: null }; },
    resetPassword: async () => { await request(); },
    signInWithGoogle: async () => { await request(); setSignedIn(true); },
  };
  return <main style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: 'var(--color-bg)' }}>
    <aside style={{ padding: 16, background: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
      <strong>Local-only login test</strong>
      <p>No real accounts, emails, passwords or Supabase writes. Sample sessions disappear on reload. This tests the real form components, not the live identity provider.</p>
      <label htmlFor="auth-scenario">Sample provider response </label>
      <select id="auth-scenario" value={scenario} disabled={busy} onChange={event => setScenario(event.target.value)}>
        <option value="success">Success</option><option value="failure">Failure</option>
      </select>
      <p role="status">Sample requests: {requests}</p>
    </aside>
    {signedIn ? <section style={{ padding: 32, textAlign: 'center' }}>
      <h1>Sample account signed in</h1>
      <p>This is a local fixture, not a real dashboard or saved login session.</p>
      <SignOutButton signOut={async () => { await request(); setSignedIn(false); }} />
    </section> : <LoginScreen actions={actions} />}
  </main>;
}
