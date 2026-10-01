import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/, '');
function harness({ valid = true, failSignOut = false, failDelete = false } = {}) {
  let handler;
  const calls = [];
  vm.runInNewContext(source, {
    Set, Response, console,
    Deno: { serve: fn => { handler = fn; }, env: { get: key => key } },
    createClient: (_url, key) => key === 'SUPABASE_SERVICE_ROLE_KEY'
      ? { auth: { admin: {
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
