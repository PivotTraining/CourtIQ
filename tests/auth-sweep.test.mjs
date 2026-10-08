import test from 'node:test';
import assert from 'node:assert/strict';
import { reactHarness, loadComponent, deferred, findElement } from './helpers/reactHarness.mjs';

const action = (tree, type, predicate = () => true) => findElement(tree, node => node.type === type && predicate(node.props));
const submit = { preventDefault() {} };

async function loginFixture(overrides = {}) {
  const h = reactHarness(), pending = deferred(), calls = [];
  const provider = Object.fromEntries(['signInWithEmail', 'signUpWithEmail', 'signInWithGoogle', 'resetPassword'].map(name => [name, (...args) => {
    calls.push({ name, args }); return pending.promise;
  }]));
  const { default: Login } = await loadComponent(new URL('../src/components/auth/LoginScreen.jsx', import.meta.url), {
    react: h.react, '@/lib/firebase': { ...provider, ...overrides }, '@/components/ui/Icons': { default: () => null, __esModule: true },
  });
  h.render(Login); h.flush();
  const change = (id, value) => { action(h.output, 'input', p => p.id === id).props.onChange({ target: { value } }); h.flush(); };
  change('login-email', 'player@example.test'); change('login-password', 'not-a-real-password');
  return { h, calls, pending, change };
}

test('email submit and Google cannot overlap before the next render', async () => {
  const f = await loginFixture();
  const form = action(f.h.output, 'form');
  const google = action(f.h.output, 'button', p => p.onClick?.name === 'handleGoogle');
  const first = form.props.onSubmit(submit);
  const second = form.props.onSubmit(submit);
  const third = google.props.onClick();
  assert.equal(f.calls.length, 1);
  f.pending.resolve({ session: { user: { id: 'sample' } } });
  await Promise.all([first, second, third]); await f.h.settle();
  assert.equal(action(f.h.output, 'button', p => p.type === 'submit').props.disabled, false);
});

test('pending login freezes credentials and the sign-up toggle', async () => {
  const f = await loginFixture();
  const request = action(f.h.output, 'form').props.onSubmit(submit); f.h.flush();
  assert.equal(action(f.h.output, 'input', p => p.id === 'login-email').props.disabled, true);
  assert.equal(action(f.h.output, 'input', p => p.id === 'login-password').props.disabled, true);
  assert.equal(action(f.h.output, 'button', p => p.children === 'Sign Up').props.disabled, true);
  f.pending.resolve({}); await request;
});

test('reset feedback belongs to the requested email, not later edits', async () => {
  const f = await loginFixture();
  const forgot = action(f.h.output, 'button', p => p.onClick?.name === 'handleForgotPassword');
  const request = forgot.props.onClick(); f.pending.resolve({}); await request; await f.h.settle();
  const feedback = action(f.h.output, 'div', p => p.role === 'status');
  assert.ok(feedback);
  assert.ok(JSON.stringify(feedback.props.children).includes('player@example.test'));
  f.change('login-email', 'other@example.test');
  assert.equal(action(f.h.output, 'div', p => p.role === 'status'), null);
});

test('failed login restores controls and exposes an accessible error', async () => {
  const f = await loginFixture();
  const request = action(f.h.output, 'form').props.onSubmit(submit);
  f.pending.reject(new Error('Invalid login credentials')); await request; await f.h.settle();
  assert.equal(action(f.h.output, 'div', p => p.role === 'alert').props.children, 'Invalid login credentials');
  assert.equal(action(f.h.output, 'button', p => p.type === 'submit').props.disabled, false);
});

test('pending login does not update the removed screen', async () => {
  const f = await loginFixture();
  const request = action(f.h.output, 'form').props.onSubmit(submit); f.h.unmount();
  f.pending.reject(new Error('Connection interrupted')); await request; await f.h.settle();
  assert.deepEqual(f.h.changes, []);
});

async function callbackFixture(search, result = { data: { session: { user: { id: 'sample' } } } }) {
  const h = reactHarness(), exchange = deferred(), updates = deferred(), timers = new Map(), redirects = [], calls = [];
  const { safeNextPath, passwordError } = await import('../src/lib/webAuth.mjs');
  const { default: Callback } = await loadComponent(new URL('../src/components/auth/AuthCallback.jsx', import.meta.url), {
    react: h.react, '@/lib/webAuth.mjs': { safeNextPath, passwordError },
    '@/lib/supabase': { supabase: { auth: {
      exchangeCodeForSession(code) { calls.push(['exchange', code]); return exchange.promise; },
      updateUser(data) { calls.push(['update', data]); return updates.promise; },
    } } },
  }, { URLSearchParams, console: { error() {} }, setTimeout: fn => { timers.set(timers.size + 1, fn); return timers.size; }, clearTimeout: id => timers.delete(id),
    window: { location: { search, replace: next => redirects.push(next) } } });
  h.render(Callback); h.flush();
  if (result) { exchange.resolve(result); await h.settle(); }
  return { h, exchange, updates, calls, redirects, timers };
}

test('OAuth callback completes one exchange and rejects an external next URL', async () => {
  const f = await callbackFixture('?code=sample&next=https://evil.example');
  assert.deepEqual(f.calls, [['exchange', 'sample']]);
  assert.deepEqual(f.redirects, ['/dashboard']);
});

test('cancelled, incomplete and expired callback links offer a return path', async () => {
  for (const [search, result, text] of [
    ['?error=access_denied', null, /not completed/],
    ['?mode=reset', null, /incomplete/],
    ['?code=expired', { error: { message: 'Expired link' } }, /Expired link/],
  ]) {
    const f = await callbackFixture(search, result);
    assert.match(JSON.stringify(f.h.output), text);
    assert.equal(action(f.h.output, 'a').props.href, '/dashboard');
    assert.deepEqual(f.redirects, []);
  }
});

test('slow callback exposes an escape without consuming the code a second time', async () => {
  const f = await callbackFixture('?code=slow', null);
  [...f.timers.values()].forEach(fn => fn()); f.h.flush();
  assert.match(JSON.stringify(f.h.output), /longer than expected/);
  assert.equal(action(f.h.output, 'a').props.href, '/dashboard');
  assert.equal(f.calls.length, 1);
  f.h.unmount(); f.exchange.resolve({ data: { session: {} } }); await f.h.settle();
  assert.deepEqual(f.redirects, []); assert.deepEqual(f.h.changes, []);
});

test('recovery validates matching passwords and locks repeated saves', async () => {
  const f = await callbackFixture('?code=sample&mode=reset');
  assert.deepEqual(f.redirects, []);
  const change = (id, value) => { action(f.h.output, 'input', p => p.id === id).props.onChange({ target: { value } }); f.h.flush(); };
  change('new-password', 'fake-password'); change('confirm-password', 'different');
  await action(f.h.output, 'form').props.onSubmit(submit); f.h.flush();
  assert.equal(f.calls.length, 1);
  assert.match(JSON.stringify(f.h.output), /don't match/);
  change('confirm-password', 'fake-password');
  const form = action(f.h.output, 'form');
  const first = form.props.onSubmit(submit), second = form.props.onSubmit(submit); f.h.flush();
  assert.equal(f.calls.length, 2);
  assert.equal(action(f.h.output, 'input', p => p.id === 'new-password').props.disabled, true);
  f.updates.resolve({ error: null }); await Promise.all([first, second]); await f.h.settle();
  assert.deepEqual(f.redirects, ['/dashboard']);
});

async function signOutFixture({ pending = false, sessionError = null, logoutError = null, cleanupError = null } = {}) {
  const calls = [];
  const auth = { getSession: async () => ({ data: { session: { user: { id: 'owner' } } }, error: sessionError }),
    signOut: async options => { calls.push(['logout', options]); return { error: logoutError }; } };
  const authFunctions = await loadComponent(new URL('../src/lib/firebase.js', import.meta.url), {
    './authRead.mjs': await import('../src/lib/authRead.mjs'),
    './supabase': { supabase: { auth } }, './sessionRecovery.mjs': {
      hasPendingRecovery: () => typeof pending === 'function' ? pending() : pending,
      clearAccountRecovery: (_storage, id) => { calls.push(['cleanup', id]); if (cleanupError) throw cleanupError; },
    },
  }, { window: { localStorage: {} } });
  return { ...authFunctions, calls };
}

test('logout uses the current-session scope and only clears its account after success', async () => {
  const f = await signOutFixture(); await f.signOutUser();
  assert.deepEqual(structuredClone(f.calls), [['logout', { scope: 'local' }], ['cleanup', 'owner']]);
});

test('pending stats, lookup errors and provider errors never clear recovery', async () => {
  for (const config of [{ pending: true }, { sessionError: new Error('Offline') }, { logoutError: new Error('Rejected') }]) {
    const f = await signOutFixture(config); await assert.rejects(f.signOutUser());
    assert.ok(f.calls.every(call => call[0] !== 'cleanup'));
    if (config.pending || config.sessionError) assert.equal(f.calls.length, 0);
  }
});

test('storage cleanup failure cannot turn successful logout into an error', async () => {
  const f = await signOutFixture({ cleanupError: new Error('Blocked storage') });
  await assert.doesNotReject(f.signOutUser());
});

test('stats queued during provider logout are retained for the same account to recover', async () => {
  let checks = 0;
  const f = await signOutFixture({ pending: () => ++checks > 1 });
  await f.signOutUser();
  assert.equal(checks, 2);
  assert.equal(f.calls.filter(call => call[0] === 'logout').length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'cleanup').length, 0);
});

test('all logout entry points share one pending provider request', async () => {
  const f = await signOutFixture();
  const first = f.signOutUser(), second = f.signOutUser();
  assert.equal(first, second); await Promise.all([first, second]);
  assert.equal(f.calls.filter(call => call[0] === 'logout').length, 1);
});

test('sign-out button prevents overlapping logout and preserves sync error feedback', async () => {
  const h = reactHarness(), result = deferred(); let count = 0;
  const { default: Button } = await loadComponent(new URL('../src/components/auth/SignOutButton.jsx', import.meta.url), {
    react: h.react, '@/lib/firebase': { signOutUser: () => { count++; return result.promise; } },
  });
  h.render(Button, {}); h.flush(); const button = action(h.output, 'button');
  const first = button.props.onClick(), second = button.props.onClick(); h.flush();
  assert.equal(count, 1); assert.equal(action(h.output, 'button').props.disabled, true);
  result.reject(new Error('Sync your unsaved game entries before signing out.')); await Promise.all([first, second]); await h.settle();
  assert.match(action(h.output, 'p', p => p.role === 'alert').props.children, /Sync your unsaved/);
  assert.equal(action(h.output, 'button').props.disabled, false);
});
