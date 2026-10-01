import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { BillingError, sameOrigin } from '../src/lib/billingPolicy.mjs';
import { readAll } from '../src/lib/dataSafety.mjs';
async function premiumRuntime(overrides={}){
  const source=(await readFile(new URL('../src/lib/premiumRuntime.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
  const context={process:{env:{COURTIQ_PREMIUM_ANALYTICS_ENABLED:'true'}},BillingError,readAll,
    billingIdentity:async()=>({client:{},user:{id:'verified-owner'}}),readBilling:async()=>({access:'player'}),...overrides};
  vm.runInNewContext(`${source};this.identity=premiumIdentity;this.dataset=premiumDataset;`,context);return context;
}
test('premium uses verified server membership, failing closed when disabled, expired, unknown or Auth fails',async()=>{
  await assert.rejects((await premiumRuntime({process:{env:{}}})).identity(),/not activated/);
  for(const access of ['read_only','free','unknown',null]) await assert.rejects((await premiumRuntime({readBilling:async()=>({access})})).identity(),/membership/);
  await assert.rejects((await premiumRuntime({billingIdentity:async()=>{throw new BillingError('Sign in',401);}})).identity(),/Sign in/);
  for(const access of ['legacy','trial','player','coach'])assert.equal((await (await premiumRuntime({readBilling:async()=>({access})})).identity()).access,access);
});
test('owner dataset paginates, restricts Player to primary profile and never returns private auth or cross-account fields',async()=>{
  const calls=[];
  const tables={players:[{id:'own',name:'Fixture',position:'PG',firebase_uid:'verified-owner'},{id:'managed',name:'Managed',position:'C'}],sessions:[{id:'game',player_id:'own',type:'game',tracker_status:'completed'}],shot_logs:[{id:'shot',player_id:'own',session_id:'game',zone_id:'paint',made:true}]};
  const client={from:table=>{const filters=[];return{select(fields){calls.push([table,'select',fields]);return this;},eq(field,value){filters.push([field,value]);calls.push([table,'eq',field,value]);return this;},in(field,value){filters.push([field,value]);calls.push([table,'in',field,value]);return this;},order(){return this;},async range(start,end){let rows=tables[table];if(table==='players'&&filters.some(([field])=>field==='firebase_uid'))rows=rows.slice(0,1);return{data:rows.slice(start,end+1)};}};}};
  const runtime=await premiumRuntime(),data=await runtime.dataset({client,user:{id:'verified-owner'},access:'player'});
  assert.equal(data.players.length,1);assert.equal(data.sessions[0].shot_logs.length,1);
  assert.equal(data.players[0].firebase_uid,undefined);assert.equal(data.community.status,'not_activated');
  assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['players','eq','manager_uid','verified-owner'])));
  assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['players','eq','firebase_uid','verified-owner'])));
  await assert.rejects(runtime.dataset({client:{from:()=>({select(){return this;},eq(){return this;},order(){return this;},range:async()=>({error:new Error('RLS denied')})})},user:{id:'verified-owner'},access:'coach'}),/RLS denied/);
});
test('coverage mutation rejects foreign origins and membership failures before writes',async()=>{
  const source=(await readFile(new URL('../src/app/api/analytics/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
  let identities=0;
  const context={BillingError,trialOrigin:request=>sameOrigin(request,{origin:'http://localhost:4312'}),billingBody:request=>request.json(),
    billingJson:Response.json,billingFailure:error=>Response.json({error:error.message},{status:error.status||503}),premiumIdentity:async()=>{identities++;throw new BillingError('Membership required',403);},premiumDataset:async()=>({})};
  vm.runInNewContext(`${source};this.patch=PATCH;`,context);
  const request=origin=>new Request('http://localhost:4312/api/analytics',{method:'PATCH',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({ownerId:'other',confirmed:true})});
  assert.equal((await context.patch(request('https://foreign.example'))).status,403);assert.equal(identities,0);
  assert.equal((await context.patch(request('http://localhost:4312'))).status,403);assert.equal(identities,1);
});
