import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { requireSavedRow } from '../src/lib/dataSafety.mjs';
import { deferred, findElement, loadComponent, reactHarness } from './helpers/reactHarness.mjs';

async function setup(save = async profile => ({ id: 'saved', ...profile })) {
  const harness = reactHarness(), saved = [], transitions = [];
  const { default: ProfileSetup } = await loadComponent(new URL('../src/components/auth/ProfileSetup.jsx', import.meta.url), {
    react: harness.react,
    '@/context/AuthContext': { useAuth: () => ({ user: { id: 'owner' }, setPlayerProfile: profile => transitions.push(profile), setNeedsProfile: value => transitions.push(value) }) },
    '@/lib/queries': { createPlayerProfile: profile => { saved.push(profile); return save(profile); } },
    '@/components/ui/Icons': { default: () => null },
    './SignOutButton': { default: function SignOutFixture() {} },
  });
  harness.render(ProfileSetup);
  harness.flush();
  const input = (id, value) => { findElement(harness.output, node => node.props?.id === id).props.onChange({ target: { value } }); harness.flush(); };
  const submit = () => findElement(harness.output, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  return { harness, saved, transitions, input, submit };
}

test('profile creation uses native form submission and linked labels', async () => {
  const { harness } = await setup();
  const button = findElement(harness.output, node => node.type === 'button' && node.props.type === 'submit');
  assert.equal(button.props.form, 'profile-setup-form');
  assert.equal(button.props.onClick, undefined);
  for (const id of ['profile-name', 'profile-team', 'profile-position', 'profile-jersey', 'profile-age']) {
    assert.ok(findElement(harness.output, node => node.type === 'label' && node.props.htmlFor === id));
  }
});

test('profile accepts adult players and jersey zero while suppressing duplicate submissions', async () => {
  const pending = deferred();
  const { harness, saved, transitions, input, submit } = await setup(() => pending.promise);
  input('profile-name', ' Adult Player '); input('profile-age', '42'); input('profile-jersey', '0');
  const first = submit(), duplicate = submit();
  harness.flush();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].age, 42); assert.equal(saved[0].jersey_number, 0); assert.equal(saved[0].name, 'Adult Player');
  assert.equal(findElement(harness.output, node => node.props?.id === 'profile-name').props.disabled, true);
  pending.resolve({ id: 'saved' }); await Promise.all([first, duplicate]); await harness.settle();
  assert.deepEqual(transitions, [{ id: 'saved' }, false]);
});

test('profile refuses fractional and out-of-range values without writing a record', async () => {
  for (const [id, value] of [['profile-age', '12'], ['profile-age', '101'], ['profile-age', '15.5'], ['profile-jersey', '-1'], ['profile-jersey', '100'], ['profile-jersey', '0.5']]) {
    const { harness, saved, transitions, input, submit } = await setup();
    input('profile-name', 'Player'); input(id, value); await submit(); harness.flush();
    assert.equal(saved.length, 0); assert.equal(transitions.length, 0);
    assert.match(JSON.stringify(harness.output), /whole-number jersey/);
  }
});

test('failed profile creation preserves input and does not leave onboarding', async () => {
  const { harness, transitions, input, submit } = await setup(async () => { throw new Error('Save denied'); });
  input('profile-name', 'Keep this name'); await submit(); harness.flush();
  assert.equal(findElement(harness.output, node => node.props?.id === 'profile-name').props.value, 'Keep this name');
  assert.equal(transitions.length, 0); assert.match(JSON.stringify(harness.output), /Save denied/);
});

test('late profile creation cannot change auth context after leaving that account', async () => {
  const pending = deferred();
  const { harness, transitions, input, submit } = await setup(() => pending.promise);
  input('profile-name', 'Former owner'); const save = submit(); harness.flush(); harness.unmount();
  pending.resolve({ id: 'former-owner-profile' }); await save;
  assert.deepEqual(transitions, []); assert.deepEqual(harness.changes, []);
  const source = await readFile(new URL('../src/components/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /<ProfileSetup key=\{user\.id\}/);
});

test('primary and managed profile creation require returned records and preserve jersey zero', async () => {
  const source = await readFile(new URL('../src/lib/queries.js', import.meta.url), 'utf8');
  for (const functionName of ['createPlayerProfile', 'addManagedPlayer']) {
    const declaration = source.match(new RegExp(`export async function ${functionName}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n\\}`));
    let result = { data: null, error: null }, inserted;
    const chain = { insert(value) { inserted = value; return this; }, select() { return this; }, single: async () => result };
    const fn = vm.runInNewContext(`(async (${declaration[1]}) => {${declaration[2]}})`, { getSupabase: () => ({ from: () => chain }), requireSavedRow, crypto: { randomUUID: () => 'child-id' } });
    const profile = { firebase_uid: 'owner', name: 'Player', jersey_number: 0, age: 42 };
    const args = functionName === 'createPlayerProfile' ? [profile] : ['owner', profile];
    await assert.rejects(fn(...args), /not saved/);
    result = { data: { id: 'saved' }, error: null }; await fn(...args);
    assert.equal(inserted.manager_uid, 'owner'); assert.equal(inserted.jersey_number, 0);
  }
});
