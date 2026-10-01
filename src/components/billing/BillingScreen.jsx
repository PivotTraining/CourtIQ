'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { providerUrl, hasOpenSubscription } from '@/lib/billingPolicy.mjs';
import { trialSummary } from '@/lib/trialPolicy.mjs';

const money = amount => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: amount % 100 ? 2 : 0 }).format(amount / 100);
const date = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const panel = { padding: 20, borderRadius: 20, background: 'var(--color-card)', border: '1px solid var(--color-border)' };
const button = { minHeight: 46, borderRadius: 12, padding: '10px 16px', border: '1px solid var(--color-border)', background: 'var(--color-muted)', color: 'var(--color-text)', fontWeight: 700, cursor: 'pointer' };

async function billingApi(path, body, signal) {
  const response = await fetch(`/api/billing/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Billing could not load. Please retry.');
  return result;
}

export default function BillingScreen({ api = billingApi, sample = false, onTrialStarted }) {
  const [state, setState] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState('');
  const [interval, setInterval] = useState('month'), [plan, setPlan] = useState('player'), [consent, setConsent] = useState(false);
  const mounted = useRef(false), request = useRef(null), inFlight = useRef(false);
  const load = useCallback(async signal => {
    const next = await api('status', null, signal);
    trialSummary(next.trial); // Reject invalid server deadlines rather than display an invented trial.
    if (!signal?.aborted && mounted.current) { setState(next); setConsent(false); }
  }, [api]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => { mounted.current = false; controller.abort(); };
  }, [load]);
  const action = async kind => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(kind); setError('');
    try {
      if (kind === 'checkout') {
        request.current ??= crypto.randomUUID();
        const result = await api('checkout', { plan, interval, requestId: request.current, consent,
          termsVersion: state.termsVersion, amount: state.plans[plan][interval], currency: 'usd' });
        if (mounted.current) window.location.assign(providerUrl(result.url, 'checkout'));
      } else if (kind === 'portal') {
        const result = await api('portal', {});
        if (mounted.current) window.location.assign(providerUrl(result.url, 'portal'));
      } else {
        if (kind === 'trial') { await api('trial', {}); await onTrialStarted?.(); }
        if (kind === 'refresh' && state?.checkoutAvailable && !sample) await api('reconcile', {});
        await load();
      }
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { inFlight.current = false; if (mounted.current) setBusy(''); }
  };
  if (!state) return <main style={{ padding: 20, color: 'var(--color-text)' }}><p role="status">{error || 'Checking your account…'}</p>{error ? <button style={button} onClick={() => action('refresh')}>Try again</button> : null}</main>;
  const trial = trialSummary(state.trial), subscription = state.subscription;
  const hasSubscription = hasOpenSubscription(subscription);
  const canCheckout = state.checkoutAvailable && trial.status !== 'active' && !hasSubscription && !sample;
  const selected = state.plans[plan], amount = selected[interval];
  const trialTitle = hasSubscription ? 'Manage your existing membership.' : { eligible: 'Your next 10 days start here.', active: `${trial.daysRemaining} ${trial.daysRemaining === 1 ? 'day' : 'days'} left to find your rhythm.`,
    expired: 'Trial complete. Keep your momentum.', verify_email: 'Verify your email to get started.', ineligible: 'Your account is not eligible for a new trial.', unavailable: 'Trials are not activated yet.' }[trial.status];
  return <main style={{ padding: 20, display: 'grid', gap: 16, color: 'var(--color-text)' }}>
    <div><p style={{ color: 'var(--color-accent)', fontWeight: 800, fontSize: 12, letterSpacing: 2 }}>COURTIQ · MEMBERSHIP</p><h2 style={{ fontSize: 30, lineHeight: 1.15, fontWeight: 850, marginTop: 8 }}>More game.<br />Less guesswork.</h2><p style={{ color: 'var(--color-text-sec)', marginTop: 10 }}>Track the work. See the progress. Own the next game.</p></div>
    <p role="note" style={{ ...panel, padding: 12, fontSize: 13 }}>{sample ? 'LOCAL SAMPLE · No account, database or Stripe changes.' : state.mode === 'test' ? 'STRIPE TEST MODE · No real payments. Never enter a real card.' : 'Billing is not activated. The prices below are proposals, not a purchase offer.'}</p>
    {error ? <p role="alert" style={{ ...panel, borderColor: '#EF4444' }}>{error}</p> : null}
    <section aria-label="Trial status" style={panel}>
      <h3 style={{ fontSize: 20, fontWeight: 800 }}>{trialTitle}</h3>
      {hasSubscription ? <p style={{ marginTop: 10 }}>A no-card trial is unavailable while this subscription remains open. Subscription renewals and outstanding payments are managed separately.</p> : trial.status === 'active' ? <p style={{ marginTop: 10 }}>Ends {date(trial.endsAt)}. No card on file from starting this trial. No automatic charge. Paid checkout opens after your trial ends.</p> : <p style={{ marginTop: 10 }}>10 days. No credit card. No automatic charge. One trial per eligible, verified account.</p>}
      <p style={{ color: 'var(--color-text-sec)', marginTop: 10, fontSize: 13 }}>Your saved game history and exports stay available after expiry. Attached videos stay on this device, not in a cloud library.</p>
      {trial.status === 'eligible' && !hasSubscription ? <button style={{ ...button, marginTop: 16, background: 'var(--color-accent)', color: '#fff', width: '100%', opacity: busy || !state.trialAvailable ? .5 : 1 }} disabled={!!busy || !state.trialAvailable} onClick={() => action('trial')}>{busy === 'trial' ? 'Starting…' : 'Start my 10-day trial'}</button> : null}
      {hasSubscription && <p role="note" style={{ marginTop: 12 }}>Your existing subscription can still bill. A free starter or trial does not cancel it. Use billing management for payment changes or cancellation.</p>}
      {trial.status === 'verify_email' ? <p style={{ marginTop: 12 }}>Confirm the link in your signup email, then refresh this page.</p> : null}
    </section>
    {subscription ? <section aria-label="Subscription status" style={panel}><h3 style={{ fontSize: 20, fontWeight: 800 }}>Your {subscription.plan === 'coach' ? 'Coach' : 'Player'} membership</h3><p style={{ marginTop: 10 }}>Status: {subscription.status.replaceAll('_', ' ')}{subscription.paused ? ' · payments paused' : ''}</p><p style={{ marginTop: 8 }}>{subscription.cancel_at_period_end ? 'Cancellation scheduled for' : 'Current billing period ends'} {date(subscription.period_end)}.</p>{subscription.status === 'past_due' ? <p style={{ marginTop: 10 }}>Update your payment method in billing management. Access is verified by the server, not this status label.</p> : null}<button style={{ ...button, marginTop: 16, width: '100%' }} disabled={!!busy || !state.checkoutAvailable || sample} onClick={() => action('portal')}>Manage billing & cancellation</button><p style={{ color: 'var(--color-text-sec)', fontSize: 12, marginTop: 12 }}>End your subscription before deleting your account. Deleting data must not leave a recurring payment behind.</p></section> : null}
    <section aria-label="Choose membership" style={panel}>
      <div role="group" aria-label="Billing interval" style={{ display: 'flex', gap: 8 }}>{['month', 'year'].map(value => <button key={value} aria-pressed={interval === value} style={{ ...button, flex: 1, borderColor: interval === value ? 'var(--color-accent)' : 'var(--color-border)' }} disabled={!!busy} onClick={() => { setInterval(value); setConsent(false); request.current = null; }}>{value === 'month' ? 'Monthly' : 'Annual'}</button>)}</div>
      <fieldset style={{ border: 0, margin: '16px 0', padding: 0, display: 'grid', gap: 12 }}><legend style={{ fontWeight: 700, marginBottom: 12 }}>Choose your game</legend>{Object.entries(state.plans).map(([key, offer]) => <label key={key} style={{ padding: 14, borderRadius: 14, display: 'flex', gap: 10, border: `1px solid ${plan === key ? 'var(--color-accent)' : 'var(--color-border)'}`, cursor: 'pointer' }}><input type="radio" name="membership" value={key} checked={plan === key} disabled={!!busy} onChange={() => { setPlan(key); setConsent(false); request.current = null; }} style={{ accentColor: 'var(--color-accent)', width: 18, flexShrink: 0 }} /><span><strong>{offer.name}</strong><span style={{ display: 'block', fontSize: 24, fontWeight: 850, margin: '6px 0' }}>{money(offer[interval])}<span style={{ fontSize: 13, fontWeight: 500 }}>/{interval === 'month' ? 'month' : 'year'}</span></span><span style={{ display: 'block', color: 'var(--color-text-sec)', fontSize: 13 }}>{offer.description}</span>{interval === 'year' ? <span style={{ display: 'block', marginTop: 8, fontSize: 12 }}>One annual payment; {money(offer.year / 12)}/month equivalent. Save {money(offer.month * 12 - offer.year)} versus 12 monthly payments.</span> : null}</span></label>)}</fieldset>
      {state.proposed ? <p style={{ fontSize: 13 }}>Proposed USD pricing. Final prices, taxes and terms must be approved before launch.</p> : null}
      {canCheckout ? <><label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.5, fontSize: 13 }}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={!!busy} style={{ width: 20, height: 20, flexShrink: 0 }} /><span>I agree to start recurring {selected.name} billing at {money(amount)} every {interval === 'month' ? 'month' : 'year'}, with the first payment at checkout. Tax, if applicable, is shown before confirmation. It renews until canceled. <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms</Link> · <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</Link></span></label><button disabled={!consent || !!busy} onClick={() => action('checkout')} style={{ ...button, width: '100%', marginTop: 16, background: 'var(--color-accent)', color: '#fff', opacity: !consent || busy ? .5 : 1 }}>Continue to test checkout</button></> : <p style={{ marginTop: 12, color: 'var(--color-text-sec)', fontSize: 13 }}>{trial.status === 'active' ? 'Enjoy all 10 days. Choose a paid plan after your trial ends.' : hasSubscription ? 'Use billing management to update your existing subscription; do not start a second one.' : 'Checkout is unavailable in this preview. A verified Stripe test environment is required.'}</p>}
    </section>
    <button style={button} disabled={!!busy} onClick={() => action('refresh')}>{busy === 'refresh' ? 'Checking…' : 'Refresh verified status'}</button>
    <p style={{ color: 'var(--color-text-sec)', fontSize: 12 }}>A checkout return page is not proof of payment. Membership updates only after verified provider synchronization.</p>
  </main>;
}
