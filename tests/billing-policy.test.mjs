import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { billingConfig, checkoutChoice, subscriptionSnapshot, sameOrigin, providerUrl } from '../src/lib/billingPolicy.mjs';
import { createBillingService } from '../src/lib/billingService.mjs';

const env = { COURTIQ_BILLING_ENABLED: 'true', COURTIQ_BILLING_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_local_fixture_only',
  COURTIQ_APP_URL: 'http://localhost:4312', STRIPE_EXPECTED_ACCOUNT_ID: 'acct_fixture', STRIPE_COURTIQ_PORTAL_CONFIG_ID: 'bpc_fixture', COURTIQ_BILLING_TERMS_VERSION: 'fixture-v1',
  STRIPE_PLAYER_MONTH_PRICE_ID: 'price_pm', STRIPE_PLAYER_YEAR_PRICE_ID: 'price_py', STRIPE_COACH_MONTH_PRICE_ID: 'price_cm', STRIPE_COACH_YEAR_PRICE_ID: 'price_cy' };
const config = billingConfig(env), owner = '00000000-0000-0000-0000-000000000001', requestId = '10000000-0000-0000-0000-000000000001';
const body = { plan: 'player', interval: 'month', amount: 900, currency: 'usd', requestId, consent: true, termsVersion: 'fixture-v1' };
const price = (key = 'player:month') => ({ id: config.prices[key], product: key.startsWith('player') ? 'prod_player' : 'prod_coach',
  livemode: false, active: true, type: 'recurring', currency: 'usd', unit_amount: { 'player:month': 900, 'player:year': 7900, 'coach:month': 2900, 'coach:year': 24900 }[key],
  recurring: { interval: key.split(':')[1], interval_count: 1, usage_type: 'licensed' } });
const sub = (status = 'active') => ({ id: 'sub_fixture', customer: 'cus_fixture', livemode: false, status, created: 1,
  items: { has_more: false, data: [{ quantity: 1, price: price(), current_period_end: 1800000000 }] } });
function harness({ claim = 'claimed', failCheckout = false, providerAccount = 'acct_fixture', sync = 'claimed', eventClaim = 'claimed' } = {}) {
  const calls = [], prices = Object.fromEntries(Object.keys(config.prices).map(key => [config.prices[key], price(key)]));
  const portal = { active: true, livemode: false, features: { subscription_cancel: { enabled: true, mode: 'at_period_end' }, subscription_update: { enabled: false } } };
  const stripe = { accounts: { retrieve: async () => ({ id: providerAccount }) }, prices: { retrieve: async id => prices[id] },
    billingPortal: { configurations: { retrieve: async () => portal }, sessions: { create: async params => { calls.push(['portal', params]); return { url: 'https://billing.stripe.com/p/session/fixture' }; } } },
    customers: { create: async (params, opts) => { calls.push(['customer', params, opts]); return { id: 'cus_fixture', livemode: false }; }, retrieve: async () => ({ id: 'cus_fixture', livemode: false, metadata: { app: 'courtiq' } }) },
    checkout: { sessions: { create: async (params, opts) => { calls.push(['checkout', params, opts]); if (failCheckout) throw new Error('provider timeout'); return { id: 'cs_test_fixture', customer: 'cus_fixture', livemode: false, url: 'https://checkout.stripe.com/c/pay/fixture' }; } } },
    subscriptions: { retrieve: async () => { calls.push(['providerRead']); return sub(); }, list: async () => ({ data: [sub()], has_more: false }) } };
  let account;
  const store = { claimCheckout: async () => ({ claim, request_id: requestId, expires_at: '2026-10-01T18:00:00Z', checkout_url: 'https://checkout.stripe.com/c/pay/existing' }),
    account: async () => account, bindCustomer: async (_owner, customer) => { account = { customer_id: customer }; calls.push(['bind']); },
    finishCheckout: async () => { calls.push(['finishCheckout']); }, releaseCheckout: async () => { calls.push(['releaseCheckout']); },
    claimEvent: async () => { calls.push(['eventClaim']); return eventClaim; }, beginSync: async () => { calls.push(['syncLock']); return sync; },
    applySnapshot: async (_event, _token, snapshot) => { calls.push(['snapshot', snapshot]); }, finishEvent: async (_event, _token, ignored) => { calls.push(['finishEvent', ignored]); },
    releaseEvent: async () => { calls.push(['releaseEvent']); } };
  return { calls, prices, portal, stripe, store, service: createBillingService({ config, stripe, store }) };
}

test('billing configuration rejects live keys, unsafe returns and duplicated prices; no flag can enable live payments', () => {
  for (const changes of [{ COURTIQ_BILLING_ENABLED: 'false' }, { COURTIQ_BILLING_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_fixture' }, { STRIPE_SECRET_KEY: 'sk_live_fixture' },
    { COURTIQ_APP_URL: 'http://foreign.example' }, { COURTIQ_APP_URL: 'https://court.example/redirect' }, { STRIPE_PLAYER_YEAR_PRICE_ID: 'price_pm' }, { COURTIQ_BILLING_TERMS_VERSION: '' }])
    assert.throws(() => billingConfig({ ...env, ...changes }));
  assert.throws(() => sameOrigin(new Request('http://localhost:4312/api/billing/checkout', { headers: { origin: 'https://foreign.test' } }), config), /CourtIQ/);
  assert.throws(() => providerUrl('https://checkout.stripe.com.evil.test/pay', 'checkout'));
});
test('checkout requires explicit matching consent, price and a known plan, and refuses client customer/account/access fields', () => {
  assert.equal(checkoutChoice(body, config).price, 'price_pm');
  for (const changes of [{ consent: false }, { termsVersion: 'old' }, { plan: '__proto__' }, { customer: 'cus_other' }, { owner }, { access: 'coach' }, { amount: 0 }, { currency: 'gbp' }])
    assert.throws(() => checkoutChoice({ ...body, ...changes }, config));
});
test('no-card active trial creates no customer, subscription, checkout or extra trial; expired upgrade uses retry-safe hosted checkout', async () => {
  const h = harness();
  await assert.rejects(h.service.checkout({ id: owner, email: 'fixture@example.test' }, body, { status: 'active' }), /after it ends/);
  assert.deepEqual(h.calls, []);
  await h.service.checkout({ id: owner, email: 'fixture@example.test' }, body, { status: 'expired' });
  const checkout = h.calls.find(call => call[0] === 'checkout');
  assert.equal(checkout[1].customer, 'cus_fixture'); assert.equal(checkout[1].line_items[0].price, 'price_pm');
  assert.equal(checkout[1].subscription_data.trial_end, undefined); assert.equal(checkout[1].subscription_data.trial_period_days, undefined);
  assert.equal(checkout[2].idempotencyKey, `courtiq:checkout:${owner}:${requestId}`);
  assert.equal(checkout[1].success_url, 'http://localhost:4312/billing?checkout=returned');
  assert.equal(h.calls.at(-1)[0], 'finishCheckout');
});
test('existing checkout reuses its provider URL, busy claims never create duplicates and failed creation releases only its lease', async () => {
  const open = harness({ claim: 'open' }); assert.match((await open.service.checkout({ id: owner }, body)).url, /existing$/); assert.deepEqual(open.calls, []);
  const busy = harness({ claim: 'busy' }); await assert.rejects(busy.service.checkout({ id: owner }, body), /retry/); assert.deepEqual(busy.calls, []);
  const failure = harness({ failCheckout: true }); await assert.rejects(failure.service.checkout({ id: owner }, body), /timeout/); assert.equal(failure.calls.at(-1)[0], 'releaseCheckout');
});
test('catalog blocks foreign accounts, changed displayed amounts, live prices, and wide or noncancelable portals', async () => {
  const foreign = harness({ providerAccount: 'acct_another' }); await assert.rejects(foreign.service.catalog(), /mismatch/);
  const changed = harness(); await assert.rejects(changed.service.checkout({ id: owner }, { ...body, amount: 901 }), /price changed/); assert.deepEqual(changed.calls, []);
  const live = harness(); live.prices.price_pm.livemode = true; await assert.rejects(live.service.catalog(), /price/);
  const wide = harness(); wide.portal.features.subscription_update = { enabled: true }; await assert.rejects(wide.service.catalog(), /billing management/);
  const uncancelable = harness(); uncancelable.portal.features.subscription_cancel.enabled = false; await assert.rejects(uncancelable.service.catalog(), /billing management/);
});
test('subscription snapshots reject live/multiple/foreign items and retain provider failure/cancellation/paused state without awarding access', () => {
  for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'canceled', 'paused']) assert.equal(subscriptionSnapshot(sub(status), config).status, status);
  assert.equal(subscriptionSnapshot({ ...sub(), pause_collection: { behavior: 'void' } }, config).paused, true);
  assert.throws(() => subscriptionSnapshot({ ...sub(), livemode: true }, config));
  assert.throws(() => subscriptionSnapshot({ ...sub(), items: { data: [{ quantity: 2, price: price(), current_period_end: 1800000000 }] } }, config));
});
const event = { id: 'evt_fixture', livemode: false, type: 'customer.subscription.updated', data: { object: { id: 'sub_fixture', customer: 'cus_fixture', status: 'canceled' } } };
test('out-of-order webhooks read current provider state after the durable customer lock, not event payloads', async () => {
  const h = harness(); await h.service.webhook(event);
  assert.deepEqual(h.calls.slice(0, 3).map(call => call[0]), ['eventClaim', 'syncLock', 'providerRead']);
  assert.equal(h.calls.find(call => call[0] === 'snapshot')[1].status, 'active');
});
test('duplicate events and unrelated Pivot customers cannot change access; failure releases locks for retry', async () => {
  const duplicate = harness({ eventClaim: 'done' }); assert.equal((await duplicate.service.webhook(event)).duplicate, true); assert.deepEqual(duplicate.calls, [['eventClaim']]);
  const other = harness({ sync: 'unknown' }); assert.equal((await other.service.webhook(event)).ignored, true); assert.equal(other.calls.some(call => call[0] === 'providerRead'), false);
  const busy = harness({ sync: 'busy' }); await assert.rejects(busy.service.webhook(event), /synchronized/); assert.equal(busy.calls.at(-1)[0], 'releaseEvent');
  const live = harness(); assert.equal((await live.service.webhook({ ...event, livemode: true })).ignored, true); assert.deepEqual(live.calls, []);
});
test('actual Stripe SDK accepts a signed raw fixture and rejects altered or unsigned bodies without a network call', () => {
  const stripe = new Stripe('sk_test_local_fixture_only'), payload = JSON.stringify(event), secret = 'whsec_local_fixture_only';
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(stripe.webhooks.constructEvent(payload, signature, secret).id, event.id);
  assert.throws(() => stripe.webhooks.constructEvent(payload + ' ', signature, secret));
  assert.throws(() => stripe.webhooks.constructEvent(payload, '', secret));
});
