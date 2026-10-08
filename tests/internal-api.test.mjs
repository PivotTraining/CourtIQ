import test from 'node:test';
import assert from 'node:assert/strict';
import { internalApi } from '../src/lib/internalApi.mjs';

test('internal requests are same-origin, private, nonredirecting and preserve GET/POST/PATCH payloads', async () => {
  for (const method of ['GET','POST','PATCH']) {
    let captured;
    const body = method === 'GET' ? undefined : { confirmed: true };
    const result = await internalApi('/api/analytics', { body, method }, async (path, options) => { captured = { path, options }; return Response.json({ ok: true }); });
    assert.deepEqual(result, { ok: true }); assert.equal(captured.options.method, method);
    assert.equal(captured.options.cache, 'no-store'); assert.equal(captured.options.credentials, 'same-origin'); assert.equal(captured.options.redirect, 'error');
    assert.equal(captured.options.body, body ? JSON.stringify(body) : undefined);
  }
});

test('stalled write times out with uncertain-outcome guidance and is never automatically retried', async () => {
  let calls = 0;
  await assert.rejects(internalApi('/api/billing/trial', { body: {}, timeoutMs: 20 }, (_path, { signal }) => {
    calls++; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  }), /may already have completed/);
  assert.equal(calls, 1);
});

test('caller aborts cancel the request and already-aborted calls never fetch', async () => {
  const controller = new AbortController(), reason = new DOMException('Owner departed', 'AbortError');
  const pending = internalApi('/api/starter', { signal: controller.signal }, (_path, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))));
  controller.abort(reason); await assert.rejects(pending, error => error === reason);
  let calls = 0; await assert.rejects(internalApi('/api/starter', { signal: controller.signal }, () => { calls++; }), error => error === reason); assert.equal(calls, 0);
});

test('malformed responses and network failures produce understandable messages, not success', async () => {
  await assert.rejects(internalApi('/api/starter', {}, async () => new Response('<html>gateway error</html>', { status: 502 })), /unreadable response/);
  for (const value of [null, [], 'wrong shape']) await assert.rejects(internalApi('/api/starter', {}, async () => Response.json(value)), /invalid response/);
  await assert.rejects(internalApi('/api/starter', {}, async () => Response.json({ error: 'Verify your email' }, { status: 403 })), /Verify your email/);
  await assert.rejects(internalApi('/api/starter', {}, async () => { throw new TypeError('Failed to fetch'); }), /Check your connection/);
});

test('external, redirected and traversal destinations or unbounded timeouts are rejected before fetch', async () => {
  let calls = 0;
  for (const path of ['https://foreign.test/api/starter','//foreign.test/api/starter','/api/../secrets','/api/starter?redirect=foreign','/api/starter#fragment'])
    await assert.rejects(internalApi(path, {}, () => { calls++; }), /Unsupported/);
  for (const timeoutMs of [0,-1,Infinity,60001]) await assert.rejects(internalApi('/api/starter', { timeoutMs }, () => { calls++; }), /timeout/);
  assert.equal(calls, 0);
});

test('timeout covers stalled response bodies as well as headers', async () => {
  await assert.rejects(internalApi('/api/starter', { timeoutMs: 20 }, async (_path, { signal }) => ({ ok: true,
    json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))) })), /took too long/);
});
