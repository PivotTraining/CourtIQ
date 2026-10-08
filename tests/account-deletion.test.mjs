import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/, '');
function harness({ valid = true, failSignOut = false, failDelete = false, billingGuard = false, canDelete = true, billingError = false } = {}) {
  let handler;
  const calls = [];
  vm.runInNewContext(source, {
    Set, Response, console,
    Deno: { serve: fn => { handler = fn; }, env: { get: key => key === 'COURTIQ_BILLING_DELETION_GUARD_ENABLED' ? String(billingGuard) : key } },
    createClient: (_url, key) => key === 'SUPABASE_SERVICE_ROLE_KEY'
      ? { rpc: async (_name, args) => { calls.push(['billing', args.p_owner]); return { data: canDelete, error: billingError ? new Error('fixture') : null }; }, auth: { admin: {
        signOut: async (token, scope) => { calls.push(['revoke', token, scope]); return { error: failSignOut ? new Error('failed') : null }; },
        deleteUser: async id => { calls.push(['delete', id]); return { error: failDelete ? new Error('failed') : null }; },
      } } }
      : { auth: { getUser: async token => { calls.push(['verify', token]); return { data: { user: valid ? { id: 'verified-owner' } : null }, error: valid ? null : new Error('invalid') }; } } },
  });
  return { handler, calls };
}
function request(body = { confirmation: 'DELETE' }, headers = {}) {
  return new Request('https://court.test/delete-account', { method: 'POST', headers: { Authorization: 'Bearer valid-token', ...headers }, body: JSON.stringify(body) });
}

test('deletion requires explicit confirmation and a verified identity, and never trusts supplied user ids', async () => {
  const h = harness();
  assert.equal((await h.handler(request({}))).status, 400);
  assert.deepEqual(h.calls, []);
  const response = await h.handler(request({ confirmation: 'DELETE', userId: 'another-person' }));
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls, [['verify','valid-token'], ['revoke','valid-token','global'], ['delete','verified-owner']]);
  assert.equal((await response.json()).deleted, true);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('invalid auth, foreign origins, and revocation errors prevent any deletion', async () => {
  const invalid = harness({ valid: false });
  assert.equal((await invalid.handler(request())).status, 401);
  assert.equal(invalid.calls.some(c => c[0] === 'delete'), false);
  const foreign = harness();
  assert.equal((await foreign.handler(request(undefined, { Origin: 'https://foreign.test' }))).status, 403);
  assert.deepEqual(foreign.calls, []);
  const revocation = harness({ failSignOut: true });
  assert.equal((await revocation.handler(request())).status, 500);
  assert.equal(revocation.calls.some(c => c[0] === 'delete'), false);
  const failure = harness({ failDelete: true });
  assert.equal((await failure.handler(request())).status, 500);
});

test('billing preflight blocks deletion before session revocation while subscription can renew, and fails closed on unavailable billing', async () => {
  const active = harness({ billingGuard: true, canDelete: false });
  assert.equal((await active.handler(request())).status, 409);
  assert.deepEqual(active.calls, [['verify', 'valid-token'], ['billing', 'verified-owner']]);
  const unavailable = harness({ billingGuard: true, billingError: true });
  assert.equal((await unavailable.handler(request())).status, 503);
  assert.equal(unavailable.calls.some(call => call[0] === 'delete' || call[0] === 'revoke'), false);
  const ended = harness({ billingGuard: true }); assert.equal((await ended.handler(request())).status, 200);
});
