import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { BillingError, sameOrigin, hasOpenSubscription } from '../src/lib/billingPolicy.mjs';
import { starterState } from '../src/lib/starterPolicy.mjs';
async function route(overrides={}){
  const source=(await readFile(new URL('../src/app/api/starter/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
  const calls=[],context={process:{env:{COURTIQ_FREE_STARTER_ENABLED:'true',COURTIQ_TRIAL_ENABLED:'true'}},BillingError,starterState,hasOpenSubscription,
    billingJson:(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}}),
    billingFailure:error=>Response.json({error:error.message},{status:error.status||503}),
    trialOrigin:request=>sameOrigin(request,{origin:'http://localhost:4312'}),billingBody:request=>request.json(),
    billingIdentity:async()=>({user:{id:'verified-owner',email_confirmed_at:'fixture'},client:{rpc:async(name,args)=>{calls.push([name,args]);return{data:name==='get_courtiq_starter'?{mode:'free',workout:'available',billing:{access:'read_only'}}:{granted:true,request_id:args.p_request}};}}}),...overrides};
  vm.runInNewContext(`${source};this.get=GET;this.post=POST;`,context);return{get:context.get,post:context.post,calls};
}
const request=(body,origin='http://localhost:4312')=>new Request('http://localhost:4312/api/starter',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('starter routes fail closed on feature flags, foreign origin, invalid auth and invalid allowance request',async()=>{
  let h=await route({process:{env:{COURTIQ_FREE_STARTER_ENABLED:'false'}}});assert.equal((await h.get()).status,503);assert.equal(h.calls.length,0);
  h=await route();assert.equal((await h.post(request({},'https://foreign.example'))).status,403);assert.equal(h.calls.length,0);
  h=await route({billingIdentity:async()=>{throw new BillingError('Sign in',401);}});assert.equal((await h.get()).status,401);
  h=await route();assert.equal((await h.post(request({requestId:'invalid'}))).status,400);assert.equal(h.calls.length,0);
});
test('only the authenticated RPC determines owner and allowance; status is private and a workout creates no trial',async()=>{
  const h=await route(),id='00000000-0000-0000-0000-000000000001';
  const status=await h.get();assert.equal(status.headers.get('cache-control'),'private, no-store');
  assert.equal((await h.post(request({requestId:id,ownerId:'another-account',trial:true}))).status,200);
  assert.equal(JSON.stringify(h.calls[1]),JSON.stringify(['claim_courtiq_starter',{p_request:id}]));
  assert.ok(h.calls.every(([name])=>name!=='start_courtiq_trial'));
});
