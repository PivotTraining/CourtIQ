import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const alice = '00000000-0000-0000-0000-000000000001', bob = '00000000-0000-0000-0000-000000000002', player = '10000000-0000-0000-0000-000000000001';
const migrations = ['20260930171602_web_player_ownership_safeguards.sql', '20260930202201_reliable_sessions_and_development.sql', '20261001144325_owned_roster_games.sql', '20261001151920_ten_day_new_user_trials.sql', '20261001170545_courtiq_subscription_core.sql','20261001175225_premium_player_analytics.sql','20261001184745_trial_checkout_exclusion.sql'];
test('billing migration chain preserves history, isolates owners, gates new records only when enabled and protects accounts with recurring billing', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,created_at timestamptz not null default clock_timestamp(),email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,service_role;
      insert into auth.users(id,email_confirmed_at) values('${alice}',clock_timestamp()),('${bob}',clock_timestamp());`);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(`insert into players(id,firebase_uid,manager_uid,name) values('${player}','${alice}_one','${alice}','Local fixture');`);
    for (const file of migrations) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    const user = uid => db.exec(`reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`);
    const billing = async () => (await db.query('select get_courtiq_billing() state')).rows[0].state;
    const newSession = () => db.query("insert into sessions(player_id,type) values($1,'game') returning id", [player]);
    await user(alice); assert.equal((await billing()).access, 'legacy'); const saved = (await newSession()).rows[0].id;
    await assert.rejects(db.query(`select bind_courtiq_customer('${alice}','cus_alice')`), /permission denied/);
    await assert.rejects(db.query('select * from courtiq_billing_accounts'), /permission denied/);
    await db.exec(`reset role;update private.courtiq_billing_policy set enabled=true,enforce_access=true;update private.courtiq_trial_policy set enabled=true,new_user_since=clock_timestamp()-interval '1 day';`);
    await user(alice); assert.equal((await billing()).access, 'read_only'); await assert.rejects(newSession(), /PLAN_REQUIRED/);
    assert.equal((await db.query('select id from sessions')).rows[0].id, saved);
    await db.query('update sessions set game_stats=$2 where id=$1', [saved, { ast: 1 }]);
    await db.query('select start_courtiq_trial()'); assert.equal((await billing()).access, 'trial'); await newSession();
    await db.exec(`reset role;update account_trials set started_at=started_at-interval '11 days',ends_at=ends_at-interval '11 days';set role service_role;`);
    await db.query('select bind_courtiq_customer($1,$2)', [alice, 'cus_alice']);
    const token = randomUUID(); assert.equal((await db.query('select claim_courtiq_event($1,$2,$3) state', ['evt_one', 'fixture', token])).rows[0].state, 'claimed');
    assert.equal((await db.query('select claim_courtiq_event($1,$2,$3) state', ['evt_one', 'fixture', randomUUID()])).rows[0].state, 'busy');
    assert.equal((await db.query('select begin_courtiq_sync($1,$2) state', ['cus_alice', token])).rows[0].state, 'claimed');
    assert.equal((await db.query('select begin_courtiq_sync($1,$2) state', ['cus_alice', randomUUID()])).rows[0].state, 'busy');
    const snapshot = { subscription_id: 'sub_alice', customer_id: 'cus_alice', plan: 'player', interval: 'month', price_id: 'price_pm', currency: 'usd', unit_amount: 900, status: 'active', period_end: '2099-01-01T00:00:00Z', cancel_at_period_end: false, paused: false };
    await assert.rejects(db.query('select apply_courtiq_snapshot($1,$2,$3)', ['evt_one', randomUUID(), snapshot]), /claim changed/);
    await db.query('select apply_courtiq_snapshot($1,$2,$3)', ['evt_one', token, snapshot]);
    assert.equal((await db.query('select claim_courtiq_event($1,$2,$3) state', ['evt_one', 'fixture', randomUUID()])).rows[0].state, 'done');
    await user(alice); assert.equal((await billing()).access, 'player'); await newSession();
    await assert.rejects(db.query('select create_owned_team_game($1,$2,$3,$4)', [randomUUID(), 'Team', { date: '2026-10-01' }, [player]]), /PLAN_REQUIRED/);
    await assert.rejects(db.query("update courtiq_subscriptions set plan='coach'"), /permission denied/);
    await user(bob); assert.equal((await db.query('select * from courtiq_subscriptions')).rows.length, 0); assert.equal((await billing()).subscription, null);
    await db.exec(`reset role;`); await assert.rejects(db.query('delete from auth.users where id=$1', [alice]), /BILLING_ACTIVE/);
    for (const changes of ["status='past_due'", "status='trialing'", "status='active',paused=true", "status='active',paused=false,period_end=clock_timestamp()-interval '1 second'"]) {
      await db.exec(`reset role;update courtiq_subscriptions set ${changes};`); await user(alice); assert.equal((await billing()).access, 'read_only');
    }
    await db.exec(`reset role;update courtiq_subscriptions set status='canceled';delete from auth.users where id='${alice}';`);
    assert.equal((await db.query('select count(*)::int n from sessions')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int n from courtiq_subscriptions')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('checkout leases preserve the original request on retry, reject conflicting offers and never expose consent mutations to browsers', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,created_at timestamptz default clock_timestamp(),email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,service_role;insert into auth.users(id,email_confirmed_at) values('${alice}',clock_timestamp());`);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    for (const file of migrations) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    const request = randomUUID(), claim = (id = request, plan = 'player') => db.query('select claim_courtiq_checkout($1,$2,$3,$4,$5,$6,$7) state', [alice, id, plan, 'month', 'fixture-v1', 'price_pm', 900]);
    await db.exec('set role service_role;'); await assert.rejects(claim(), /inactive/);
    await db.exec('reset role;update private.courtiq_billing_policy set enabled=true;set role service_role;');
    const first = (await claim()).rows[0].state; assert.equal(first.claim, 'claimed'); assert.equal((await claim()).rows[0].state.claim, 'busy');
    await assert.rejects(claim(randomUUID(), 'coach'), /different checkout/);
    await db.query('select release_courtiq_checkout($1,$2)', [alice, request]);
    const retry = (await claim(randomUUID())).rows[0].state; assert.equal(retry.request_id, request); assert.equal(retry.expires_at, first.expires_at); assert.equal(retry.consent_at, first.consent_at);
    await db.query('select finish_courtiq_checkout($1,$2,$3,$4)', [alice, request, 'cs_test_fixture', 'https://checkout.stripe.com/c/pay/fixture']);
    assert.equal((await claim()).rows[0].state.claim, 'open');
    await db.exec(`reset role;set request.jwt.claim.sub='${alice}';set role authenticated;`);
    await assert.rejects(claim(), /permission denied/); await assert.rejects(db.query('select * from private.courtiq_checkout_requests'), /permission denied/);
  } finally { await db.close(); }
});
