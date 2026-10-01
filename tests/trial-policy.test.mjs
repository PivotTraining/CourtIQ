import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { trialSummary, NEW_USER_TRIAL_SECONDS } from '../src/lib/trialPolicy.mjs';

test('trial display uses the original ten-day server window and never local device time',()=>{
  const state={status:'active',days:10,started_at:'2026-10-01T12:00:00Z',ends_at:'2026-10-11T12:00:00Z',server_now:'2026-10-10T13:00:00Z',remaining_seconds:82800};
  assert.equal(NEW_USER_TRIAL_SECONDS,864000);assert.equal(trialSummary(state).daysRemaining,1);assert.equal(trialSummary(state).autoCharge,false);
  assert.throws(()=>trialSummary({...state,ends_at:'2026-10-15T12:00:00Z'}),/Inconsistent/);
  assert.throws(()=>trialSummary({...state,status:'expired'}),/Inconsistent/);
});

test('new-user trials last exactly ten days, are private and cannot be reset on retry',async()=>{
  const db=new PGlite();const alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002',old='00000000-0000-0000-0000-000000000003';
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create table auth.users(id uuid primary key,created_at timestamptz not null,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users values('${alice}',clock_timestamp(),clock_timestamp()),('${bob}',clock_timestamp(),null),('${old}',clock_timestamp()-interval '2 days',clock_timestamp());`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261001151920_ten_day_new_user_trials.sql',import.meta.url),'utf8'));
    const user=async id=>db.exec(`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`);
    const status=async()=> (await db.query('select get_courtiq_trial() state')).rows[0].state;
    const start=async()=> (await db.query('select start_courtiq_trial() state')).rows[0].state;
    await user(alice);assert.equal((await status()).status,'unavailable');await assert.rejects(start(),/not available/);
    await db.exec(`reset role;update private.courtiq_trial_policy set enabled=true,new_user_since=clock_timestamp()-interval '1 day';`);
    await user(old);assert.equal((await status()).status,'ineligible');await assert.rejects(start(),/not available/);
    await user(bob);assert.equal((await status()).status,'verify_email');await assert.rejects(start(),/not available/);
    await user(alice);assert.equal((await status()).status,'eligible');const first=await start(),second=await start();
    assert.equal(first.started_at,second.started_at);assert.equal(first.ends_at,second.ends_at);assert.equal(first.status,'active');
    assert.equal(Date.parse(first.ends_at)-Date.parse(first.started_at),864000000);assert.equal(trialSummary(first).daysRemaining,10);
    await assert.rejects(db.query("update account_trials set ends_at=ends_at+interval '10 days'"),/permission denied/);
    await assert.rejects(db.query('delete from account_trials'),/permission denied/);
    await assert.rejects(db.query('select * from private.courtiq_trial_policy'),/permission denied/);
    await user(bob);assert.equal((await db.query('select * from account_trials')).rows.length,0);
    await db.exec(`reset role;update account_trials set started_at=started_at-interval '11 days',ends_at=ends_at-interval '11 days' where owner_id='${alice}';`);
    await user(alice);assert.equal((await start()).status,'expired');assert.equal((await db.query('select count(*)::int n from account_trials')).rows[0].n,1);
    await db.exec('reset role;set role anon;');await assert.rejects(status(),/permission denied/);
    await db.exec(`reset role;delete from auth.users where id='${alice}';`);await user(alice);await assert.rejects(start(),/Authenticated account/);
  }finally{await db.close();}
});
