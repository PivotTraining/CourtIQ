import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import Stripe from 'stripe';
import { BillingError, sameOrigin } from '../src/lib/billingPolicy.mjs';

async function handler(route, overrides = {}) {
  const source = (await readFile(new URL(`../src/app/api/billing/${route}/route.js`, import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replaceAll('export ', '');
  const calls = [], context = {
    process: { env: { COURTIQ_TRIAL_ENABLED: 'true', STRIPE_COURTIQ_WEBHOOK_SECRET: 'whsec_local_fixture_only' } },
    BillingError, sameOrigin,
    billingJson: (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }),
    billingFailure: error => Response.json({ error: error instanceof BillingError ? error.message : 'Billing unavailable' }, { status: error.status || 503 }),
    billingIdentity: async () => ({ client: { rpc: async () => ({ data: { status: 'active' } }) }, user: { id: 'verified-owner', email_confirmed_at: '2026-10-01' } }),
    billingStatus: async () => ({ access: 'read_only' }), readBilling: async () => ({ enabled: true, trial: { status: 'expired' } }),
    billingBody: request => request.json(), trialOrigin: request => sameOrigin(request, { origin: 'http://localhost:4312' }),
    billingRuntime: () => ({ config: { origin: 'http://localhost:4312' }, stripe: new Stripe('sk_test_local_fixture_only'),
      service: Object.fromEntries(['checkout', 'portal', 'reconcile', 'webhook'].map(method => [method, async (...args) => { calls.push([method, ...args]); return { received: true }; }])) }),
    ...overrides,
  };
  vm.runInNewContext(`${source}\nthis.handler=${route === 'status' ? 'GET' : 'POST'};`, context);
  return { run: context.handler, calls };
}
const request = (body = {}, origin = 'http://localhost:4312') => new Request('http://localhost:4312/api/billing/checkout', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('checkout, portal and reconciliation handlers reject foreign origins and unverified accounts before provider writes', async () => {
  for (const route of ['checkout', 'portal', 'reconcile']) {
    const foreign = await handler(route); assert.equal((await foreign.run(request({}, 'https://foreign.example'))).status, 403); assert.deepEqual(foreign.calls, []);
    const invalid = await handler(route, { billingIdentity: async () => { throw new BillingError('Sign in', 401); } });
    assert.equal((await invalid.run(request())).status, 401); assert.deepEqual(invalid.calls, []);
  }
  const unconfirmed = await handler('checkout', { billingIdentity: async () => ({ client: {}, user: { id: 'unverified' } }) });
  assert.equal((await unconfirmed.run(request())).status, 403); assert.deepEqual(unconfirmed.calls, []);
});
test('portal and reconciliation use only the server-verified owner, never a supplied customer or user id', async () => {
  for (const route of ['portal', 'reconcile']) {
    const h = await handler(route); assert.equal((await h.run(request({ userId: 'foreign', customer: 'cus_foreign' }))).status, 200);
    assert.equal(h.calls[0][1], 'verified-owner');
  }
  const status = await handler('status', { billingIdentity: async () => { throw new BillingError('Sign in', 401); } });
  assert.equal((await status.run()).status, 401);
});
test('trial handler fails closed when inactive, email unverified or storage rejects repeat activation', async () => {
  const inactive = await handler('trial', { process: { env: { COURTIQ_TRIAL_ENABLED: 'false' } } });
  assert.equal((await inactive.run(request())).status, 503);
  const denied = await handler('trial', { billingIdentity: async () => ({ client: { rpc: async () => ({ error: new Error('fixture') }) }, user: { email_confirmed_at: 'fixture' } }) });
  assert.equal((await denied.run(request())).status, 403);
});
test('actual webhook handler verifies the raw Stripe signature before synchronizing, and rejects tampering without touching storage', async () => {
  const h = await handler('webhook'), stripe = new Stripe('sk_test_local_fixture_only');
  const payload = JSON.stringify({ id: 'evt_fixture', type: 'customer.subscription.updated', livemode: false, data: { object: { id: 'sub_fixture' } } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_fixture_only' });
  const post = (raw, signed = true) => new Request('http://localhost:4312/api/billing/webhook', { method: 'POST', headers: signed ? { 'stripe-signature': signature } : {}, body: raw });
  assert.equal((await h.run(post(payload, false))).status, 400); assert.deepEqual(h.calls, []);
  assert.equal((await h.run(post(payload + ' '))).status, 400); assert.deepEqual(h.calls, []);
  const response = await h.run(post(payload)); assert.equal(response.status, 200); assert.equal(h.calls[0][1].id, 'evt_fixture');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
