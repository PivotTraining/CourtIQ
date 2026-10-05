import test from 'node:test';
import assert from 'node:assert/strict';
import { reactHarness, loadComponent, deferred, findElement } from './helpers/reactHarness.mjs';
import { selectPlayer } from '../src/lib/playerSelection.mjs';

async function authFixture(readProfile) {
  const h = reactHarness(), bootstrap = deferred(), timers = new Map();
  let callback, sequence = 0;
  const fetched = [];
  const auth = {
    getSession: () => bootstrap.promise,
    onAuthStateChange: next => { callback = next; return { data: { subscription: { unsubscribe() {} } } }; },
  };
  const { AuthProvider } = await loadComponent(new URL('../src/context/AuthContext.jsx', import.meta.url), {
    react: h.react, '@/lib/supabase': { supabase: { auth } },
    '@/lib/queries': { fetchManagedPlayers: async owner => { fetched.push(owner); return readProfile ? readProfile(owner) : [{ id: `${owner}-player`, firebase_uid: owner }]; } },
    '@/lib/playerSelection.mjs': { selectPlayer, preferredPlayer: () => null, rememberPlayer() {} },
    '@/lib/sessionRecovery.mjs': { hasPendingRecovery: () => false, clearAccountRecovery() {} },
  }, {
    setTimeout: fn => { timers.set(++sequence, fn); return sequence; }, clearTimeout: id => timers.delete(id), window: { localStorage: {} },
  });
  h.render(AuthProvider, { children: null }); h.flush();
  return { h, bootstrap, fetched, event: (event, session) => { callback(event, session); h.flush(); },
    runTimers: async () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } await h.settle(); } };
}

test('late initial session cannot resurrect a user after sign-out', async () => {
  const f = await authFixture();
  f.event('SIGNED_OUT', null);
  f.bootstrap.resolve({ data: { session: { user: { id: 'old-owner' } } } });
  await f.h.settle(); await f.runTimers();
  assert.equal(f.h.output.props.value.user, null);
  assert.deepEqual(f.fetched, []);
});

test('late initial session cannot replace a newer signed-in identity', async () => {
  const f = await authFixture();
  f.event('SIGNED_IN', { user: { id: 'current-owner' } });
  f.bootstrap.resolve({ data: { session: { user: { id: 'old-owner' } } } });
  await f.h.settle(); await f.runTimers();
  assert.equal(f.h.output.props.value.user.id, 'current-owner');
  assert.equal(f.h.output.props.value.playerProfile.id, 'current-owner-player');
  assert.deepEqual(f.fetched, ['current-owner']);
});

test('blocked optional onboarding storage cannot prevent skipping to sign-in', async () => {
  const h = reactHarness(), auth = { user: null, loading: false };
  const nothing = { default: () => null, __esModule: true };
  const dependencies = { react: h.react,
    '@/context/AuthContext': { AuthProvider: () => null, useAuth: () => auth },
    '@/lib/notifications': { registerServiceWorker() {} }, '@/context/AppContext': { AppProvider: () => null },
    '@/components/ui/Toast': { ToastProvider: () => null }, '@/components/ErrorBoundary': nothing,
    '@/components/ui/OfflineBanner': nothing, '@/components/Onboarding': nothing, '@/components/Shell': nothing,
    '@/components/auth/LoginScreen': { ...nothing, default: function LoginFixture() {} },
    '@/components/auth/ProfileSetup': nothing, '@/components/billing/StarterGate': nothing,
  };
  const source = new URL('../src/components/App.jsx', import.meta.url);
  // Export the otherwise private gate for this source-based test only.
  const { readFile } = await import('node:fs/promises');
  const { createRequire } = await import('node:module');
  const { default: vm } = await import('node:vm');
  const require = createRequire(import.meta.url), compiled = { exports: {} };
  const { code } = await require('next/dist/build/swc').transform((await readFile(source, 'utf8')).replace('function AuthGate()', 'export function AuthGate()'), {
    filename: source.pathname, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require: name => dependencies[name] || require(name),
    window: {}, localStorage: { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } } });
  h.render(compiled.exports.AuthGate); h.flush();
  const onboarding = findElement(h.output, element => typeof element.props?.onComplete === 'function');
  assert.ok(onboarding);
  assert.doesNotThrow(() => onboarding.props.onComplete()); h.flush();
  assert.equal(h.output.type.name, 'LoginFixture');
});

test('an older profile request cannot clear the loading state of a newer retry', async () => {
  const reads = [];
  const f = await authFixture(() => { const request = deferred(); reads.push(request); return request.promise; });
  f.event('SIGNED_IN', { user: { id: 'owner' } }); await f.runTimers();
  const retry = f.h.output.props.value.retryProfile(); await f.h.settle();
  assert.equal(reads.length, 2);
  reads[0].resolve([{ id: 'stale', firebase_uid: 'owner' }]); await f.h.settle();
  assert.equal(f.h.output.props.value.loading, true);
  assert.equal(f.h.output.props.value.playerProfile, null);
  reads[1].resolve([{ id: 'current', firebase_uid: 'owner' }]); await retry; await f.h.settle();
  assert.equal(f.h.output.props.value.loading, false);
  assert.equal(f.h.output.props.value.playerProfile.id, 'current');
});
