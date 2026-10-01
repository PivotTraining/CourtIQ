import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { PGlite } from '@electric-sql/pglite';
import { createBillingService } from '../src/lib/billingService.mjs';
import { billingConfig } from '../src/lib/billingPolicy.mjs';

const alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002';
const player='10000000-0000-0000-0000-000000000001';
const migrations=['20260930171602_web_player_ownership_safeguards.sql','20260930202201_reliable_sessions_and_development.sql','20261001144325_owned_roster_games.sql','20261001151920_ten_day_new_user_trials.sql','20261001170545_courtiq_subscription_core.sql','20261001175225_premium_player_analytics.sql','20261001184745_trial_checkout_exclusion.sql'];
async function database(){
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,created_at timestamptz default clock_timestamp(),email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,service_role;
    insert into auth.users(id,email_confirmed_at) values('${alice}',clock_timestamp()),('${bob}',clock_timestamp());`);
  await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await db.exec(`insert into players(id,firebase_uid,manager_uid,name) values('${player}','${alice}','${alice}','Local fixture');`);
  for(const file of migrations)await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  await db.exec(`update private.courtiq_billing_policy set enabled=true,enforce_access=true,grandfather_before='2021-01-01';
    update private.courtiq_trial_policy set enabled=true,new_user_since='2021-01-01';update private.courtiq_starter_policy set enabled=true;`);
  const user=uid=>db.exec(`reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`);
  const rpc=async(name,params=[])=>{
    // Names are fixed internal test adapters, never supplied by an HTTP caller.
    await db.exec('reset role;set role service_role;');
    return(await db.query(`select ${name}(${params.map((_,i)=>`$${i+1}`).join(',')}) value`,params)).rows[0].value;
  };
  return{db,user,rpc};
}
const config=billingConfig({COURTIQ_BILLING_ENABLED:'true',COURTIQ_BILLING_MODE:'test',STRIPE_SECRET_KEY:'sk_test_local_fixture_only',
  COURTIQ_APP_URL:'http://localhost:4312',STRIPE_EXPECTED_ACCOUNT_ID:'acct_fixture',STRIPE_COURTIQ_PORTAL_CONFIG_ID:'bpc_fixture',COURTIQ_BILLING_TERMS_VERSION:'fixture-v1',
  STRIPE_PLAYER_MONTH_PRICE_ID:'price_pm',STRIPE_PLAYER_YEAR_PRICE_ID:'price_py',STRIPE_COACH_MONTH_PRICE_ID:'price_cm',STRIPE_COACH_YEAR_PRICE_ID:'price_cy'});
const price=key=>({id:config.prices[key],product:key.startsWith('player')?'prod_player':'prod_coach',active:true,livemode:false,type:'recurring',currency:'usd',
  unit_amount:{'player:month':900,'player:year':7900,'coach:month':2900,'coach:year':24900}[key],recurring:{interval:key.split(':')[1],interval_count:1,usage_type:'licensed'}});

test('local persisted free → no-card trial → expiry → signed test event → paid → payment failure/cancellation preserves records and isolates owners',async()=>{
  const{db,user,rpc}=await database();
  try{
    const state=async()=>(await db.query('select get_courtiq_starter() value')).rows[0].value;
    const store={
      account:async owner=>{await db.exec('reset role;set role service_role;');return(await db.query('select customer_id from courtiq_billing_accounts where owner_id=$1',[owner])).rows[0];},
      claimCheckout:(owner,choice,terms)=>rpc('claim_courtiq_checkout',[owner,choice.requestId,choice.plan,choice.interval,terms,choice.price,choice.amount]),
      bindCustomer:(...args)=>rpc('bind_courtiq_customer',args),finishCheckout:(...args)=>rpc('finish_courtiq_checkout',args),releaseCheckout:(...args)=>rpc('release_courtiq_checkout',args),
      claimEvent:(...args)=>rpc('claim_courtiq_event',args),beginSync:(...args)=>rpc('begin_courtiq_sync',args),applySnapshot:(...args)=>rpc('apply_courtiq_snapshot',args),
      finishEvent:(...args)=>rpc('finish_courtiq_event',args),releaseEvent:(...args)=>rpc('release_courtiq_event',args),
    };
    const providerWrites=[];
    let providerSub={id:'sub_fixture',customer:'cus_fixture',livemode:false,status:'active',created:1,cancel_at_period_end:false,
      items:{has_more:false,data:[{quantity:1,price:price('player:month'),current_period_end:Math.floor(Date.now()/1000)+30*86400}]}};
    // Deliberately local provider double. No credentials, hosted payment or network.
    const stripe={accounts:{retrieve:async()=>({id:config.account})},prices:{retrieve:async id=>price(Object.keys(config.prices).find(key=>config.prices[key]===id))},
      billingPortal:{configurations:{retrieve:async()=>({active:true,livemode:false,features:{subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:false}}})}},
      customers:{create:async()=>{providerWrites.push('customer');return{id:'cus_fixture',livemode:false};},retrieve:async()=>({id:'cus_fixture',livemode:false,metadata:{app:'courtiq'}})},
      checkout:{sessions:{create:async params=>{providerWrites.push('checkout');assert.equal(params.subscription_data.trial_end,undefined);assert.equal(params.subscription_data.trial_period_days,undefined);
        return{id:'cs_test_fixture',customer:'cus_fixture',livemode:false,url:'https://checkout.stripe.com/c/pay/fixture'};}}},
      subscriptions:{retrieve:async()=>providerSub,list:async()=>({data:[providerSub],has_more:false})},
    };
    const service=createBillingService({stripe,store,config}),sdk=new Stripe('sk_test_local_fixture_only');
    const signed=async(id,type='customer.subscription.updated')=>{
      // The event payload is intentionally stale. The service must use the current
      // provider snapshot under its durable lock, after SDK signature verification.
      const object=type.startsWith('invoice.')?{id:'in_fixture',customer:'cus_fixture',parent:{subscription_details:{subscription:'sub_fixture'}}}:{id:'sub_fixture',customer:'cus_fixture',status:'active'};
      const payload=JSON.stringify({id,type,livemode:false,data:{object}}),secret='whsec_local_fixture_only';
      const signature=sdk.webhooks.generateTestHeaderString({payload,secret});
      return service.webhook(sdk.webhooks.constructEvent(payload,signature,secret));
    };
    const body={requestId:randomUUID(),plan:'player',interval:'month',amount:900,currency:'usd',consent:true,termsVersion:'fixture-v1'};
    await user(alice);assert.equal((await state()).mode,'free');await assert.rejects(db.query(`insert into sessions(player_id,type) values('${player}','game')`),/PLAN_REQUIRED/);
    const claim=randomUUID();await db.query('select claim_courtiq_starter($1)',[claim]);assert.equal((await state()).workout,'used');
    const trial=(await db.query('select start_courtiq_trial() value')).rows[0].value;
    assert.equal((Date.parse(trial.ends_at)-Date.parse(trial.started_at))/3600000,240);assert.equal(trial.auto_charge,false);assert.deepEqual(providerWrites,[]);
    await assert.rejects(service.checkout({id:alice,email:'fixture@example.test'},body,trial),/after it ends/);assert.deepEqual(providerWrites,[]);
    const saved=(await db.query(`insert into sessions(player_id,type) values('${player}','game') returning id`)).rows[0].id;
    await db.query(`insert into journal_entries(player_id,type,mood,title) values('${player}','game','good','Preserved fixture')`);
    await db.exec(`reset role;update account_trials set started_at=started_at-interval '11 days',ends_at=ends_at-interval '11 days' where owner_id='${alice}';`);
    await user(alice);const expired=(await state()).billing.trial;assert.equal((await state()).mode,'free');assert.equal((await state()).workout,'used');
    await service.checkout({id:alice,email:'fixture@example.test'},body,expired);assert.deepEqual(providerWrites,['customer','checkout']);
    await user(alice);assert.equal((await state()).mode,'free'); // Return URL/checkout creation cannot grant paid access.
    await signed('evt_paid');await user(alice);assert.equal((await state()).billing.access,'player');assert.equal((await db.query('select id from sessions')).rows[0].id,saved);
    assert.equal((await signed('evt_paid')).duplicate,true);
    await user(bob);assert.equal((await state()).mode,'free');assert.equal((await db.query('select * from sessions')).rows.length,0);assert.equal((await db.query('select * from courtiq_subscriptions')).rows.length,0);
    providerSub={...providerSub,cancel_at_period_end:true};await signed('evt_cancel_scheduled');await user(alice);
    assert.equal((await state()).billing.access,'player');await assert.rejects(db.query('select start_courtiq_trial()'),/can still bill/);
    providerSub={...providerSub,status:'past_due'};await signed('evt_failure','invoice.payment_failed');
    await user(alice);assert.equal((await state()).mode,'free');assert.equal((await db.query('select * from journal_entries')).rows.length,1);
    await assert.rejects(db.query('select start_courtiq_trial()'),/can still bill/);
    providerSub={...providerSub,status:'active',cancel_at_period_end:false};await service.reconcile(alice);await user(alice);assert.equal((await state()).billing.access,'player');
    providerSub={...providerSub,status:'canceled'};await signed('evt_cancelled');await user(alice);assert.equal((await state()).mode,'free');assert.equal((await state()).workout,'used');
    await db.exec(`reset role;update private.courtiq_checkout_requests set expires_at=clock_timestamp()-interval '1 second';`);
    await user(alice);assert.equal((await db.query('select start_courtiq_trial() value')).rows[0].value.status,'expired');assert.equal((await db.query('select count(*)::int n from account_trials')).rows[0].n,1);
    assert.equal((await db.query('select * from journal_entries')).rows.length,1);assert.equal((await db.query('select id from sessions')).rows[0].id,saved);
    assert.deepEqual(providerWrites,['customer','checkout']);
  }finally{await db.close();}
});

test('direct trial RPC and atomic checkout claims reject overlapping paid, pending and active-trial states',async()=>{
  const{db,user,rpc}=await database();
  try{
    await rpc('bind_courtiq_customer',[bob,'cus_bob']);
    await db.exec(`reset role;insert into courtiq_subscriptions(subscription_id,owner_id,customer_id,plan,interval,price_id,currency,unit_amount,status,period_end)
      values('sub_bob','${bob}','cus_bob','player','month','price_pm','usd',900,'active',clock_timestamp()+interval '30 days');`);
    for(const status of ['active','past_due','unpaid','incomplete','paused','trialing']){
      await db.exec('reset role;');await db.query('update courtiq_subscriptions set status=$1',[status]);await user(bob);
      await assert.rejects(db.query('select start_courtiq_trial()'),/can still bill/);
      assert.equal((await db.query('select count(*)::int n from account_trials')).rows[0].n,0);
    }
    await db.exec("reset role;update courtiq_subscriptions set status='canceled';");
    const request=randomUUID(),args=[bob,request,'player','month','fixture-v1','price_pm',900];
    assert.equal((await rpc('claim_courtiq_checkout',args)).claim,'claimed');
    await user(bob);await assert.rejects(db.query('select start_courtiq_trial()'),/checkout is still pending/);
    await rpc('finish_courtiq_checkout',[bob,request,'cs_test_pending','https://checkout.stripe.com/c/pay/pending']);
    await user(bob);await assert.rejects(db.query('select start_courtiq_trial()'),/checkout is still pending/);
    await db.exec('reset role;update private.courtiq_checkout_requests set expires_at=clock_timestamp()-interval \'1 second\';');
    await user(bob);const trial=(await db.query('select start_courtiq_trial() value')).rows[0].value;
    const retry=(await db.query('select start_courtiq_trial() value')).rows[0].value;assert.equal(retry.started_at,trial.started_at);assert.equal(retry.ends_at,trial.ends_at);
    await assert.rejects(rpc('claim_courtiq_checkout',[bob,randomUUID(),'player','month','fixture-v1','price_pm',900]),/trial is still active/);
    await user(bob);await assert.rejects(db.query('select claim_courtiq_checkout($1,$2,$3,$4,$5,$6,$7)',args),/permission denied/);
  }finally{await db.close();}
});
