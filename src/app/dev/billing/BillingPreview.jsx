'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import BillingScreen from '@/components/billing/BillingScreen';
import { BILLING_PLANS } from '@/lib/billingPolicy.mjs';

function fixture(kind, justStarted = false) {
  const trial = { days: 10, status: kind === 'expired' || kind === 'past_due' ? 'expired' : kind === 'active' ? 'active' : 'eligible',
    started_at: '2026-10-01T12:00:00Z', ends_at: '2026-10-11T12:00:00Z', server_now: kind === 'expired' || kind === 'past_due' ? '2026-10-12T12:00:00Z' : justStarted ? '2026-10-01T12:00:00Z' : '2026-10-06T12:00:00Z', remaining_seconds: kind === 'active' ? justStarted ? 864000 : 432000 : 0 };
  return { mode: 'inactive', checkoutAvailable: false, trialAvailable: true, proposed: true, trial,
    plans: Object.fromEntries(Object.entries(BILLING_PLANS).map(([key, value]) => [key, { ...value, month: value.monthly, year: value.annual }])),
    subscription: kind === 'past_due' ? { plan: 'coach', interval: 'month', status: 'past_due', period_end: '2026-11-01T12:00:00Z', paused: false, cancel_at_period_end: false } : null };
}
function Scenario({ kind }) {
  const state = useRef(fixture(kind));
  const api = useMemo(() => async path => {
    if (path === 'trial') { state.current = fixture('active', true); return { trial: state.current.trial }; }
    if (path !== 'status') throw new Error('Provider actions are disabled in this local sample.');
    return structuredClone(state.current);
  }, []);
  return <BillingScreen api={api} sample />;
}
export default function BillingPreview() {
  const [kind, setKind] = useState('eligible'), [dark, setDark] = useState(true);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  return <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100dvh', width: '100%' }}><header style={{ maxWidth: 600, margin: 'auto', padding: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}><label>Sample state <select aria-label="Sample state" value={kind} onChange={e => setKind(e.target.value)} style={{ background: 'var(--color-card)', color: 'var(--color-text)' }}><option value="eligible">Eligible</option><option value="active">Active trial</option><option value="expired">Expired trial</option><option value="past_due">Payment overdue</option></select></label><button style={{ minHeight: 44, padding: '8px 14px', background: 'var(--color-muted)', color: 'var(--color-text)', borderRadius: 10 }} onClick={() => setDark(!dark)}>{dark ? 'Light mode' : 'Dark mode'}</button></header><div style={{ maxWidth: 600, margin: 'auto' }}><Scenario kind={kind} key={kind} /></div></div>;
}
