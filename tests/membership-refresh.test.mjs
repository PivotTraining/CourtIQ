import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMembershipLoader, membershipRefreshDelay } from '../src/lib/membershipRefresh.mjs';
test('membership refresh uses server durations, checks active access within a minute and does not poll free/legacy accounts',()=>{
  const trial=seconds=>({mode:'full',billing:{access:'trial',trial:{status:'active',remaining_seconds:seconds}}});
  assert.equal(membershipRefreshDelay(trial(864000)),60000);assert.equal(membershipRefreshDelay(trial(3)),3250);
  assert.equal(membershipRefreshDelay(trial(0)),1000);assert.equal(membershipRefreshDelay(trial('bad')),1000);
  assert.equal(membershipRefreshDelay({mode:'full',billing:{access:'legacy'}}),null);assert.equal(membershipRefreshDelay({mode:'free'}),null);
  assert.equal(membershipRefreshDelay({mode:'full',billing:{access:'player',server_now:'2026-10-01T00:00:00Z',subscription:{period_end:'2026-10-01T00:00:04Z'}}}),4250);
});
test('a late successful or failed refresh cannot overwrite the newest verified account state',async()=>{
  const pending=[],accepted=[],errors=[];
  const loader=createMembershipLoader({read:signal=>new Promise((resolve,reject)=>pending.push({resolve,reject,signal})),accept:value=>accepted.push(value),reject:e=>errors.push(e)});
  const old=loader.refresh(),latest=loader.refresh();assert.equal(pending[0].signal.aborted,true);
  pending[1].resolve({mode:'free'});assert.equal(await latest,true);
  pending[0].resolve({mode:'full'});assert.equal(await old,false);assert.deepEqual(accepted,[{mode:'free'}]);
  const failure=loader.refresh(),newer=loader.refresh();pending[3].resolve('verified');await newer;pending[2].reject(new Error('stale'));assert.equal(await failure,false);assert.deepEqual(errors,[]);
  const current=loader.refresh();pending[4].reject(new Error('connection failed'));assert.equal(await current,false);assert.equal(errors[0].message,'connection failed');
  const disposed=loader.refresh();loader.dispose();pending[5].resolve('wrong account');assert.equal(await disposed,false);assert.deepEqual(accepted,[{mode:'free'},'verified']);
});
test('gate preserves but hides the previous workspace during access failure or expiry and parent keys it to the owner',async()=>{
  const source=await readFile(new URL('../src/components/billing/StarterGate.jsx',import.meta.url),'utf8');
  const app=await readFile(new URL('../src/components/App.jsx',import.meta.url),'utf8');
  assert.match(source,/hidden=\{!state \|\| state.mode === 'free'\}/);assert.match(source,/workspaceMounted.current && children/);
  assert.match(source,/createMembershipLoader/);assert.match(source,/removeEventListener\('focus'/);assert.match(app,/StarterGate key=\{user.id\}/);
});
