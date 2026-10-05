import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { BillingError } from '../src/lib/billingPolicy.mjs';
import { authorizeReconciliation, reconcileDueAccount } from '../src/lib/billingReconciliation.mjs';

const owner = '00000000-0000-0000-0000-000000000001', second = '00000000-0000-0000-0000-000000000002';
const secret = 'local-fixture-not-a-credential-123456789';
const env = { CRON_SECRET: secret, COURTIQ_BILLING_RECONCILIATION_ENABLED: 'true' };
const request = (authorization = `Bearer ${secret}`, search = '') => new Request(`http://localhost:4312/api/jobs/billing-reconciliation${search}`, { headers: { authorization } });

test('scheduled recovery requires a configured secret and explicit flag; identities cannot be supplied in query parameters', () => {
  assert.doesNotThrow(() => authorizeReconciliation(request(), env));
  for (const value of ['', 'Bearer undefined', 'Bearer someone-else', `bearer ${secret}`, secret])
    assert.throws(() => authorizeReconciliation(request(value), env), error => error.status === 401);
  for (const CRON_SECRET of [undefined, '', 'short', 'invalid with spaces'.repeat(3)])
    assert.throws(() => authorizeReconciliation(request(), { ...env, CRON_SECRET }), error => error.status === 503);
  assert.throws(() => authorizeReconciliation(request(), { ...env, COURTIQ_BILLING_RECONCILIATION_ENABLED: 'false' }), error => error.status === 503);
  assert.throws(() => authorizeReconciliation(request(undefined, '?owner=foreign'), env), error => error.status === 400);
});

test('recovery only passes the claimed owner to reconciliation and exposes aggregate counts', async () => {
  const calls = [];
  const result = await reconcileDueAccount({ store: {
    claim: async token => { calls.push(['claim', token]); return { owner_id: owner, customer_id: 'cus_fixture' }; },
    finish: async (...args) => calls.push(['finish', ...args]),
  }, service: { reconcile: async id => { calls.push(['reconcile', id]); return { received: true }; } } });
  assert.deepEqual(result, { checked: 1, synchronized: 1, retry: 0, review: 0 });
  assert.equal(calls[1][1], owner); assert.equal(calls[2][1], owner); assert.equal(calls[2][2], calls[0][1]); assert.equal(calls[2][3], 'synchronized');
  assert.doesNotMatch(JSON.stringify(result), /cus_|owner|secret|token/);
});

test('empty queue makes no provider call, transient failures retry, and ambiguous history requires review', async () => {
  let providerReads = 0;
  assert.equal((await reconcileDueAccount({ store: { claim: async () => null }, service: { reconcile: async () => providerReads++ } })).checked, 0);
  assert.equal(providerReads, 0);
  for (const [outcome, expected] of [[new Error('sensitive provider details'), 'retry'], [new BillingError('Multiple subscriptions', 409), 'review'], [{ received: true, ignored: true }, 'review'], [{ received: true, noSubscription: true }, 'review'], [undefined, 'retry']]) {
    let saved;
    const result = await reconcileDueAccount({ store: { claim: async () => ({ owner_id: owner, customer_id: 'cus_fixture' }), finish: async (_id, _token, value) => { saved = value; } },
      service: { reconcile: async () => { if (outcome instanceof Error) throw outcome; return outcome; } } });
    assert.equal(saved, expected); assert.equal(result[expected], 1); assert.doesNotMatch(JSON.stringify(result), /sensitive|Multiple/);
  }
});

test('queue or completion persistence failure cannot be reported as success', async () => {
  await assert.rejects(reconcileDueAccount({ store: { claim: async () => { throw new Error('queue unavailable'); } }, service: {} }), /queue unavailable/);
  await assert.rejects(reconcileDueAccount({ store: { claim: async () => ({ owner_id: owner, customer_id: 'cus_fixture' }), finish: async () => { throw new Error('lease changed'); } },
    service: { reconcile: async () => ({ received: true }) } }), /lease changed/);
});

test('actual scheduled handler rejects requests before runtime creation and reports failures without private data', async () => {
  const source = (await readFile(new URL('../src/app/api/jobs/billing-reconciliation/route.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '').replaceAll('export ', '');
  let runtimeCalls = 0, fail = false, finishFail = false;
  const context = { authorizeReconciliation: req => authorizeReconciliation(req, env), reconcileDueAccount,
    billingRuntime: options => { assert.equal(options.scheduled, true); runtimeCalls++; return {
      reconciliationStore: { claim: async () => ({ owner_id: owner, customer_id: 'cus_fixture' }), finish: async () => { if (finishFail) throw new Error('private storage details'); } },
      service: { reconcile: async () => { if (fail) throw new Error('private payment details'); return { received: true }; } },
    }; },
    billingJson: (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store' } }),
  };
  const failureSource = (await readFile(new URL('../src/lib/billingRuntime.js', import.meta.url), 'utf8')).split('\n').find(line => line.startsWith('export const billingFailure'));
  context.billingFailure = vm.runInNewContext(`${failureSource.replace('export ', '')}\nbillingFailure;`, { BillingError, billingJson: context.billingJson });
  vm.runInNewContext(`${source}\nthis.run=GET;`, context);
  assert.equal((await context.run(request('Bearer incorrect'))).status, 401); assert.equal(runtimeCalls, 0);
  assert.equal((await context.run(request(undefined, '?customer=cus_foreign'))).status, 400); assert.equal(runtimeCalls, 0);
  const passed = await context.run(request()); assert.equal(passed.status, 200); assert.equal(passed.headers.get('cache-control'), 'private, no-store');
  fail = true; const failed = await context.run(request()); assert.equal(failed.status, 503); assert.deepEqual(await failed.json(), { checked: 1, synchronized: 0, retry: 1, review: 0 });
  fail = false; finishFail = true; const uncertain = await context.run(request()); assert.equal(uncertain.status, 503);
  const message = (await uncertain.json()).error;
  assert.match(message, /may already have finished/); assert.match(message, /Refresh verified status/); assert.doesNotMatch(message, /private|unchanged/);
});

test('real local PostgreSQL queue is inactive, service-only, exclusive and recoverable without touching subscription history', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,created_at timestamptz default clock_timestamp(),email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,service_role;
      insert into auth.users(id,email_confirmed_at) values('${owner}',clock_timestamp()),('${second}',clock_timestamp());`);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    for (const file of ['20260930171602_web_player_ownership_safeguards.sql','20260930202201_reliable_sessions_and_development.sql','20261001144325_owned_roster_games.sql','20261001151920_ten_day_new_user_trials.sql','20261001170545_courtiq_subscription_core.sql','20261001175225_premium_player_analytics.sql','20261001184745_trial_checkout_exclusion.sql','20261005140000_billing_reconciliation_queue.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    const claim = async token => (await db.query('select claim_courtiq_reconciliation($1) value', [token])).rows[0].value;
    const finish = (id, token, result) => db.query('select finish_courtiq_reconciliation($1,$2,$3)', [id, token, result]);
    await db.exec('set role service_role;'); await assert.rejects(claim(randomUUID()), /inactive/);
    await db.exec(`reset role;update private.courtiq_billing_policy set enabled=true,reconciliation_enabled=true;set role service_role;`);
    assert.equal(await claim(randomUUID()), null);
    for (const [id, customer] of [[owner,'cus_first'],[second,'cus_second']]) await db.query('select bind_courtiq_customer($1,$2)', [id, customer]);
    await db.exec(`reset role;update courtiq_billing_accounts set reconciliation_due_at=clock_timestamp()-interval '1 hour';
      insert into courtiq_subscriptions(subscription_id,owner_id,customer_id,plan,interval,price_id,currency,unit_amount,status,period_end)
      values('sub_saved','${owner}','cus_first','player','month','price_pm','usd',900,'active',clock_timestamp()+interval '30 days');set role service_role;`);
    const firstToken = randomUUID(), secondToken = randomUUID();
    assert.equal((await claim(firstToken)).owner_id, owner); assert.equal((await claim(secondToken)).owner_id, second); assert.equal(await claim(randomUUID()), null);
    await assert.rejects(finish(owner, randomUUID(), 'synchronized'), /lease changed/);
    await assert.rejects(finish(owner, firstToken, null), /Invalid recovery result/);
    await finish(owner, firstToken, 'review');
    const row = (await db.query('select * from courtiq_billing_accounts where owner_id=$1', [owner])).rows[0];
    assert.equal(row.reconciliation_result, 'review'); assert.equal(row.reconciliation_token, null); assert.ok(new Date(row.reconciliation_due_at) > new Date(row.reconciliation_checked_at));
    assert.equal((await db.query('select status from courtiq_subscriptions')).rows[0].status, 'active');
    await db.exec(`reset role;update courtiq_billing_accounts set reconciliation_until=clock_timestamp()-interval '1 second' where owner_id='${second}';set role service_role;`);
    await assert.rejects(finish(second, secondToken, 'synchronized'), /lease changed/);
    const replacement = randomUUID(); assert.equal((await claim(replacement)).owner_id, second);
    await assert.rejects(finish(second, secondToken, 'retry'), /lease changed/); await finish(second, replacement, 'retry');
    for (const role of ['anon','authenticated']) {
      await db.exec(`reset role;set role ${role};`);
      await assert.rejects(claim(randomUUID()), /permission denied/);
      await assert.rejects(finish(owner, randomUUID(), 'synchronized'), /permission denied/);
      await assert.rejects(db.query('select reconciliation_result from courtiq_billing_accounts'), /permission denied/);
    }
  } finally { await db.close(); }
});

test('no scheduler is registered by this inactive source change', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(!config.crons?.some(job => job.path === '/api/jobs/billing-reconciliation'));
});
