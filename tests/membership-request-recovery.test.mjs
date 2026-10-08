import test from 'node:test';
import assert from 'node:assert/strict';
import { findElement, loadComponent, reactHarness } from './helpers/reactHarness.mjs';
import { internalApi } from '../src/lib/internalApi.mjs';
import * as billing from '../src/lib/billingPolicy.mjs';
import * as trial from '../src/lib/trialPolicy.mjs';

test('actual membership screen exits a stalled load with retry guidance and recovers on an explicit retry', async () => {
  const h = reactHarness(), calls = [];
  const state = { mode: 'inactive', proposed: true, trial: { status: 'eligible', days: 10 }, checkoutAvailable: false,
    plans: Object.fromEntries(Object.entries(billing.BILLING_PLANS).map(([key, plan]) => [key, { ...plan, month: plan.monthly, year: plan.annual }])) };
  const fetcher = async (path, options) => {
    calls.push({ path, method: options.method });
    if (calls.length === 1) return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason)));
    return Response.json(state);
  };
  const { default: BillingScreen } = await loadComponent(new URL('../src/components/billing/BillingScreen.jsx', import.meta.url), {
    react: h.react, 'next/link': { default: () => null, __esModule: true }, '@/lib/billingPolicy.mjs': billing, '@/lib/trialPolicy.mjs': trial,
    '@/lib/internalApi.mjs': { internalApi: (path, options) => internalApi(path, { ...options, timeoutMs: 20 }, fetcher) },
  }, { AbortController });
  h.render(BillingScreen, { sample: true }); h.flush();
  await new Promise(resolve => setTimeout(resolve, 35)); await h.settle();
  assert.match(JSON.stringify(h.output), /took too long/); assert.equal(calls.length, 1);
  const retry = findElement(h.output, node => node.type === 'button' && node.props.children === 'Try again'); assert.ok(retry);
  await retry.props.onClick(); await h.settle();
  assert.equal(findElement(h.output, node => node.props?.role === 'alert'), null);
  assert.ok(findElement(h.output, node => node.props?.['aria-label'] === 'Trial status'));
  assert.deepEqual(calls, [{ path: '/api/billing/status', method: 'GET' }, { path: '/api/billing/status', method: 'GET' }]);
});
