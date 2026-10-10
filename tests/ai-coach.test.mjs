import test from 'node:test';
import assert from 'node:assert/strict';
import { coachQuestion, summarizeCoachEvidence, coachEvidenceSummary } from '../src/lib/aiCoachEvidence.mjs';
import { configuredCoach, runGroundedCoach, COACH_SYSTEM } from '../src/lib/aiCoachProvider.mjs';

const completed = (id, override={}) => ({ id, type:'game', tracker_status:'completed', coverage_confirmed:true,
  game_stats:{ ast: 3, to: 2, reb: 4 }, ...override });
const shot = (session_id, made=true, zone_id='left-wing') => ({ session_id, made, zone_id });

test('coach rejects common direct identifiers and out-of-bounds messages', () => {
  assert.equal(coachQuestion('How can I improve my shot?').ok, true);
  for (const value of ['hi','https://example.com', 'email me at a@example.com', 'Call 555-222-5555', 'x'.repeat(321)]) {
    assert.equal(coachQuestion(value).ok, false, value);
  }
});

test('coach evidence includes only confirmed complete games and excludes unknown outcomes', () => {
  const sessions=[completed('g1'), completed('g2',{ coverage_confirmed:false }),
    completed('g3',{ tracker_status:'active' }),completed('g4',{ type:'practice' }),
    completed('g5')];
  const shots=[...Array.from({length:12},(_,i)=>shot('g1',i<6)),
    shot('g2',false),shot('g3',true),shot('g4',true),
    shot('g5',true),shot('g5',null)];
  const data=summarizeCoachEvidence({sessions,shots});
  assert.equal(data.recentRecordedGames,4);
  assert.equal(data.eligibleGames,1);
  assert.equal(data.gameFieldGoals.makes,6);
  assert.equal(data.gameFieldGoals.attempts,12);
  assert.equal(data.gameFieldGoals.pct,null);
  assert.equal(data.gameAverages.assists,null);
  assert.equal(data.adequateForSpecificShotDiscussion,false);
});

test('fully measured comparable practice has meaningful trend, missing stats remain unknown', () => {
  const sessions=[completed('g1',{game_stats:{ast:3}}),completed('g2',{game_stats:{ast:5}}),
    completed('g3',{game_stats:{ast:4}})];
  const workouts=Array.from({length:6},(_,i)=>({
    completed_at:new Date(Date.UTC(2026,9,10-i)).toISOString(),
    drills:[{ drill_id:'form-shooting-close',practice_version:'skill-practice-v1',
      outcome_kind:'makes',target_reps:20,reps_completed:20,skipped:false,successful_reps:i<3?15:9 }],
  }));
  const data=summarizeCoachEvidence({sessions,workouts});
  assert.equal(data.gameAverages.assists.perGame,4);
  assert.equal(data.gameAverages.turnovers,null);
  assert.equal(data.recentPracticeAssessments.length,1);
  assert.equal(data.recentPracticeAssessments[0].recentPct,63);
  assert.deepEqual(data.recentPracticeAssessments[0].trend,{latest3:75,previous3:45});
  assert.ok(!JSON.stringify(data).includes('personal'));
});

test('empty accounts need records; not a fabricated AI answer',()=>{
  const evidence=summarizeCoachEvidence({sessions:[],shots:[],workouts:[]});
  assert.equal(evidence.eligibleGames,0);
  assert.match(coachEvidenceSummary(evidence),/No confirmed game/);
});

test('provider never sees identifying records, credentials stay in headers, output bounded',async()=>{
  const env={COURTIQ_AI_COACH_ENABLED:'true', AI_GATEWAY_MODEL:'openai/gpt-5.4',AI_GATEWAY_API_KEY:'test-secret'};
  assert.equal(configuredCoach(env),true);
  let payload,headers,url;
  const answer=await runGroundedCoach({
    question:'How can I improve?',
    evidence:{eligibleGames:3,gameFieldGoals:{attempts:60,makes:30,pct:50}},
    env,fetcher:async (endpoint,options)=>{
      url=endpoint;headers=options.headers;payload=JSON.parse(options.body);
      return {ok:true,text:async()=>JSON.stringify({ choices:[{message:{content:'Practice matched reps.'}}] })};
    },
  });
  assert.equal(answer,'Practice matched reps.');
  assert.equal(url,'https://ai-gateway.vercel.sh/v1/chat/completions');
  assert.equal(headers.Authorization,'Bearer test-secret');
  assert.equal(payload.messages.length,2);
  assert.equal(payload.stream,false);
  assert.ok(!JSON.stringify(payload).includes('test-secret'));
  assert.match(COACH_SYSTEM,/Never manufacture attempts/);
});
test('provider gated off without server flag and never exposes upstream failure body',async()=>{
  assert.equal(configuredCoach({AI_GATEWAY_MODEL:'openai/gpt-5.4',AI_GATEWAY_API_KEY:'key'}),false);
  await assert.rejects(runGroundedCoach({question:'Test question',evidence:{},env:{
    COURTIQ_AI_COACH_ENABLED:'true',AI_GATEWAY_MODEL:'openai/gpt-5.4',AI_GATEWAY_API_KEY:'key'},
    fetcher:async()=>({ok:false,text:async()=> 'secret upstream response'})}),/temporarily unavailable/);
});
