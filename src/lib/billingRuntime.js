import 'server-only';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './supabase-server';
import { BillingError, BILLING_PLANS, billingConfig, sameOrigin } from './billingPolicy.mjs';
import { createBillingService } from './billingService.mjs';

export const billingJson = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' } });
export const billingFailure = error => billingJson({ error: error instanceof BillingError ? error.message : 'Billing could not complete. Your records are unchanged. Please retry.' }, error instanceof BillingError ? error.status : 503);
const checked = result => { if (result.error) throw new BillingError('Billing storage could not complete safely. Please retry.', 503); return result.data; };

export async function billingIdentity() {
  const client = await createServerSupabaseClient();
  // getUser verifies with Auth; never authorize from a cookie/session label.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) throw new BillingError('Sign in to your CourtIQ account.', 401);
  return { client, user: data.user };
}
export async function billingBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new BillingError('JSON request required.', 415);
  const text = await request.text();
  if (text.length > 4096) throw new BillingError('Request too large.', 413);
  try { return JSON.parse(text); } catch { throw new BillingError('Invalid request.'); }
}
export function trialOrigin(request) {
  let origin;
  try { origin = new URL(process.env.COURTIQ_APP_URL).origin; } catch { throw new BillingError('Trial activation is not configured.', 503); }
  sameOrigin(request, { origin });
}
export async function readBilling(client) {
  return checked(await client.rpc('get_courtiq_billing'));
}
export function billingRuntime() {
  const config = billingConfig();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new BillingError('Server billing storage is not configured.', 503);
  const stripe = new Stripe(config.key, { apiVersion: '2026-09-30.endive', timeout: 12000, maxNetworkRetries: 1 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (name, args) => checked(await admin.rpc(name, args));
  const store = {
    account: async owner => checked(await admin.from('courtiq_billing_accounts').select('customer_id').eq('owner_id', owner).maybeSingle()),
    claimCheckout: (owner, choice, terms) => rpc('claim_courtiq_checkout', { p_owner: owner, p_request: choice.requestId,
      p_plan: choice.plan, p_interval: choice.interval, p_terms: terms, p_price: choice.price, p_amount: choice.amount }),
    bindCustomer: (owner, customer) => rpc('bind_courtiq_customer', { p_owner: owner, p_customer: customer }),
    finishCheckout: (owner, request, session, url) => rpc('finish_courtiq_checkout', { p_owner: owner, p_request: request, p_session: session, p_url: url }),
    releaseCheckout: (owner, request) => rpc('release_courtiq_checkout', { p_owner: owner, p_request: request }),
    claimEvent: (event, type, token) => rpc('claim_courtiq_event', { p_event: event, p_type: type, p_token: token }),
    beginSync: (customer, token) => rpc('begin_courtiq_sync', { p_customer: customer, p_token: token }),
    applySnapshot: (event, token, snapshot) => rpc('apply_courtiq_snapshot', { p_event: event, p_token: token, p_snapshot: snapshot }),
    finishEvent: (event, token, ignored) => rpc('finish_courtiq_event', { p_event: event, p_token: token, p_ignored: ignored }),
    releaseEvent: (event, token) => rpc('release_courtiq_event', { p_event: event, p_token: token }),
  };
  return { config, stripe, admin, service: createBillingService({ stripe, store, config }) };
}
export async function billingStatus(client) {
  const state = await readBilling(client);
  const proposed = Object.fromEntries(Object.entries(BILLING_PLANS).map(([key, plan]) => [key, { ...plan, month: plan.monthly, year: plan.annual }]));
  if (process.env.COURTIQ_BILLING_ENABLED !== 'true' || !state.enabled)
    return { ...state, trialAvailable: process.env.COURTIQ_TRIAL_ENABLED === 'true', checkoutAvailable: false, mode: 'inactive', plans: proposed, proposed: true };
  const { config, service } = billingRuntime(), catalog = await service.catalog();
  const plans = Object.fromEntries(Object.entries(BILLING_PLANS).map(([key, plan]) => [key, { ...plan,
    month: catalog[`${key}:month`].unit_amount, year: catalog[`${key}:year`].unit_amount }]));
  return { ...state, trialAvailable: process.env.COURTIQ_TRIAL_ENABLED === 'true', checkoutAvailable: true, mode: 'test', termsVersion: config.termsVersion, plans, proposed: false };
}
