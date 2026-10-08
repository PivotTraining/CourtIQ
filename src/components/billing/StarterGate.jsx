'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { signOutUser } from '@/lib/firebase';
import { starterApi } from '@/lib/starterClient';
import { starterState } from '@/lib/starterPolicy.mjs';
import { createMembershipLoader, membershipRefreshDelay } from '@/lib/membershipRefresh.mjs';
import FreeStarter from './FreeStarter';
const BillingScreen = dynamic(() => import('./BillingScreen'));
const SavedRecords = dynamic(() => import('./SavedRecords'));

export default function StarterGate({ children }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(''), [history, setHistory] = useState(false);
  const request = useRef(null), inFlight = useRef(false), mounted = useRef(false), loader = useRef(null), workspaceMounted = useRef(false);
  const enabled = process.env.NEXT_PUBLIC_COURTIQ_FREE_STARTER_ENABLED === 'true';
  const load = useCallback(() => loader.current?.refresh() || Promise.resolve(false), []);
  useEffect(() => {
    mounted.current = true;
    if (!enabled) return () => { mounted.current = false; };
    setState(null); setError('');
    const current = createMembershipLoader({
      read: async signal => starterState(await starterApi('status', null, signal)),
      accept: next => { if (mounted.current) { if (next.mode !== 'free') workspaceMounted.current = true; setState(next); setError(''); } },
      reject: e => { if (mounted.current) { setState(null); setError(e.message); } },
    });
    loader.current = current; current.refresh();
    return () => { mounted.current = false; current.dispose(); if (loader.current === current) loader.current = null; };
  }, [enabled, load, pathname]);
  useEffect(() => {
    if (!enabled) return;
    const refreshVisible = () => { if (document.visibilityState !== 'hidden') load(); };
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [enabled, load]);
  useEffect(() => {
    const delay = membershipRefreshDelay(state);
    if (!enabled || delay === null) return;
    const timer = window.setTimeout(() => load(), delay);
    return () => window.clearTimeout(timer);
  }, [enabled, load, state]);
  const action = async kind => {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(kind); setError('');
    try {
      if (kind === 'workout') {
        request.current ??= crypto.randomUUID();
        const result = await starterApi('workout', { requestId: request.current });
        if (result.granted !== true || result.request_id !== request.current) throw new Error('Your workout allowance was not confirmed. Please retry.');
        if (mounted.current) setState(old => ({ ...old, workout: 'used' }));
      } else {
        if (kind === 'trial') await starterApi('trial', {});
        if (!await load()) return false;
      }
      return mounted.current;
    } catch (e) { if (mounted.current) { if (kind !== 'workout') setState(null); setError(e.message); } return false; }
    finally { inFlight.current = false; if (mounted.current) setBusy(''); }
  };
  if (!enabled) return children;
  let limitedView = null;
  if (!state) limitedView = <main className="membership-start"><h1>Checking your account…</h1>{error && <p role="alert">{error}</p>}<p>Your workspace is preserved while access is checked.</p><button disabled={!!busy} onClick={() => action('refresh')}>Retry access check</button></main>;
  else if (state.mode === 'free') {
    if (pathname === '/billing') limitedView = <div style={{ maxWidth: 620, margin: 'auto' }}><BillingScreen onTrialStarted={load} /></div>;
    else if (history) limitedView = <SavedRecords accountId={user.id} onBack={() => setHistory(false)} />;
    else limitedView = <FreeStarter state={state} busy={busy} error={error} onClaim={() => action('workout')} onTrial={() => action('trial')}
      onRefresh={() => action('refresh')} onHistory={() => setHistory(true)} onSignOut={() => signOutUser().catch(() => setError('Sign out could not complete. Please retry.'))} />;
  }
  // Do not discard an in-progress workspace on temporary connection failure or
  // expiry. Hide it (including from assistive technology); server/DB gates writes.
  // The authenticated parent keys this entire gate to the owner, isolating drafts.
  return <><div hidden={!state || state.mode === 'free'}>{workspaceMounted.current && children}</div>{limitedView}</>;
}
