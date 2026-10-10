import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { coachQuestion, summarizeCoachEvidence, coachEvidenceSummary } from '../src/lib/aiCoachEvidence.mjs';

const uuid='11111111-1111-4111-8111-111111111111';
const owner='99999999-9999-4999-8999-999999999999';
const env={COURTIQ_AI_COACH_ENABLED:'true',COURTIQ_APP_URL:'http://localhost:4000'};
const request=(body,origin='http://localhost:4000')=>new Request('http://localhost:4000/api/coach',{method:'POST',
  headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
function fixtures({ age=19, profile=true, claim=true, auth=true, storageError=false }={}) {
  const accessed=[], actions=[];
  const row=(table)=> ({
    select(columns){ actions.push(['select',table,columns]);return this; },
    eq(key,val){actions.push(['eq',table,key,val]);return this;},
    order(){return this;},
    in(field,ids){actions.push(['in',table,field,ids]);return this;},
    maybeSingle:async()=>({data:profile?{id:uuid,age}:null,error:storageError?{}:null}),
    limit:async()=>({data:table==='sessions'?[{id:'game-1',type:'game',tracker_status:'completed',coverage_confirmed:true,game_stats:{ast:3}}]:
      table==='shot_logs'?Array.from({length:25},(_,i)=>({session_id:'game-1',zone_id:'left-wing',made:i<10})) :
      [{completed_at:'2026-10-01T00:00:00Z',drills:[{practice_version:'skill-practice-v1',drill_id:'mikan-drill',outcome_kind:'makes',skipped:false,target_reps:20,reps_completed:20,successful_reps:13}]}],
      error:storageError?{}:null}),
  });
  const client={auth:{getUser:async()=>({data:{user:auth?{id:owner,email_confirmed_at:'2026-10-01'}:null},error:null})},
    from:table=>{ accessed.push(table);return row(table); },
    rpc:async name=>{actions.push(['rpc',name]);return {data:claim,error:null};}};
  return {accessed,actions,client};
}
async function route(fixture=fixtures(),overrides={}) {
  const source=(await readFile(new URL('../src/app/api/coach/route.js',import.meta.url),'utf8'))
    .replace(/^import .*;\n/gm,'').replaceAll('export ','');
  let invocations=0;
  const context={
    process:{env},Response,URL,
    createServerSupabaseClient:async()=>fixture.client,
    summarizeCoachEvidence,coachQuestion,coachEvidenceSummary,
    configuredCoach:()=>true,
    runGroundedCoach:async ({question,evidence})=>{invocations++; assert.match(question,/shoot/);assert.ok(evidence.gameFieldGoals.attempts>0);return 'Based on the logged shots, repeat matched drills.';},
    ...overrides,
  };
  vm.runInNewContext(source+'\nthis.handler=POST;',context);
  return {run:context.handler,fixture,get calls(){return invocations;}};
}
const body={playerId:uuid,question:'How can my shooting improve?',consent:true};
test('AI Coach fails closed before reading records for disabled flags, wrong origin and missing consent',async()=>{
  const f=fixtures();
  assert.equal((await (await route(f,{process:{env:{...env,COURTIQ_AI_COACH_ENABLED:'false'}}})).run(request(body))).status,503);
  assert.equal((await (await route(f)).run(request(body,'https://outsider.example'))).status,403);
  assert.equal((await (await route(f)).run(request({...body,consent:false}))).status,400);
  assert.deepEqual(f.accessed,[]);
});
test('AI Coach requires server-verified ownership and adult profile',async()=>{
  const notFound=await route(fixtures({profile:false}));
  assert.equal((await notFound.run(request(body))).status,404);assert.equal(notFound.calls,0);
  const minor=await route(fixtures({age:16}));
  assert.equal((await minor.run(request(body))).status,403);assert.equal(minor.calls,0);
  const anon=await route(fixtures({auth:false}));
  assert.equal((await anon.run(request(body))).status,401);assert.equal(anon.calls,0);
});
test('AI Coach enforces database-backed quota before external model usage',async()=>{
  const denied=await route(fixtures({claim:false}));
  assert.equal((await denied.run(request(body))).status,429);
  assert.equal(denied.calls,0);
  const good=await route(fixtures());
  const response=await good.run(request(body));
  assert.equal(response.status,200);
  const result=await response.json();
  assert.match(result.answer,/repeat matched drills/);
  assert.equal(good.calls,1);
  const ownerQuery=good.fixture.actions.find(x=>x[0]==='eq'&&x[1]==='players'&&x[2]==='manager_uid');
  assert.equal(ownerQuery[3],owner);
  assert.ok(good.fixture.actions.some(x=>x[0]==='rpc'&&x[1]==='claim_courtiq_ai_request'));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('failed source records and database quota fail closed',async()=>{
  const f=fixtures({storageError:true});const app=await route(f);
  assert.equal((await app.run(request(body))).status,503);
  assert.equal(app.calls,0);
});
