import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FINISHING_TARGET, FINISHING_STAGES, FINISHING_VERSION, finishingStage,
  finishStageRecord, finishingResult, summarizeFinishing, finishingHistory,
} from '../src/lib/adaptiveFinishing.mjs';
import { loadComponent, reactHarness, findElement, deferred } from './helpers/reactHarness.mjs';

const set = (index, makes, controlled = true, records = []) =>
  finishStageRecord(finishingStage(index, records), Array.from({ length: FINISHING_TARGET }, (_,i)=> i < makes), controlled);
const completed = (baseline=4,build=5,adapt=6,retest=5,controls=[true,true,true,true]) => {
  const stages=[];
  for (const [i,makes] of [baseline,build,adapt,retest].entries()) stages.push(set(i,makes,controls[i],stages));
  return stages;
};

test('adaptive plan has four distinct, measurable stages with identical first/last assessment conditions',()=>{
  assert.equal(FINISHING_STAGES.length,4);
  assert.equal(FINISHING_STAGES[0].condition,FINISHING_STAGES[3].condition);
  assert.equal(FINISHING_TARGET,8);
  assert.equal(finishingStage(99),null);
});
test('adaptive difficulty progresses only after BOTH controlled sets meet threshold',()=>{
  const weak=[set(0,5,true),set(1,8,true)];
  assert.equal(finishingStage(2,weak).mode,'support');
  assert.equal(finishingStage(2,[set(0,8,false),set(1,8,true)]).mode,'support');
  assert.equal(finishingStage(2,[set(0,6,true),set(1,6,true)]).mode,'progress');
  const supported=completed();
  assert.equal(supported[2].path,'support');
  assert.equal(completed(7,6)[2].path,'progress');
});
test('retest measures baseline difference, does not claim performance forecast or game transfer',()=>{
  const stages=completed(3,5,6,6);
  const summary=summarizeFinishing(stages);
  assert.equal(summary.deltaMakes,3);
  assert.equal(summary.deltaPoints,38); // 3/8 rounded to nearest whole point
  assert.equal(summary.comparableConditions,true);
  assert.match(summary.next,/later session/);
  const result=finishingResult({stages,elapsedSeconds:173.9,id:'id-1'});
  assert.equal(result.id,'id-1');
  assert.equal(result.elapsed_seconds,173);
  assert.equal(result.drills.length,4);
  assert.equal(result.drills[0].practice_version,FINISHING_VERSION);
  assert.equal('game_stats' in result,false);
});
test('incomplete, tampered or misleading workouts never become measured finishing missions',()=>{
  const stages=completed();
  assert.throws(()=>finishStageRecord(finishingStage(0),[true,false],true));
  assert.throws(()=>finishStageRecord(finishingStage(0),Array(8).fill(true),null));
  assert.throws(()=>finishingResult({stages:stages.slice(0,3),elapsedSeconds:70,id:'foo'}));
  assert.equal(summarizeFinishing(stages.map((r,i)=>i===3?{...r,condition:'moving-defender'}:r)),null);
  assert.equal(summarizeFinishing(stages.map((r,i)=>i===2?{...r,path:'progress'}:r)),null);
  assert.equal(summarizeFinishing(stages.map((r,i)=>i===1?{...r,successful_reps:9}:r)),null);
  const rows=[
    {id:'legit',completed_at:'2026-10-10T14:00:00Z',drills:stages},
    {id:'legit',completed_at:'2026-10-10T15:00:00Z',drills:stages},
    {id:'legacy',completed_at:'2026-10-09T10:00:00Z',drills:[{drill_id:'mikan-drill',reps_completed:32}]},
  ];
  assert.equal(finishingHistory(rows).length,1);
});

function words(node){
  if (node==null || typeof node==='boolean')return '';
  if (typeof node==='string'||typeof node==='number')return String(node);
  return [node.props?.children].flat(Infinity).map(words).join(' ').replace(/\s+/g,' ').trim();
}
function btn(h,txt){return findElement(h.output,node=>node.type==='button'&&words(node).includes(txt));}
async function session({onSave=async()=>{},canSave=true}={}){
  const h=reactHarness();let closed=0;
  const source=new URL('../src/components/train/AdaptiveFinishingSession.jsx',import.meta.url);
  const {default:Comp}=await loadComponent(source,{
    react:h.react,'@/lib/adaptiveFinishing.mjs':await import('../src/lib/adaptiveFinishing.mjs')
  },{Date,crypto:{randomUUID:()=> 'stable-mission-id'},window:{confirm:()=>true},
    setInterval:()=>1,clearInterval(){},document:{activeElement:null}});
  h.render(Comp,{canSave,onSave,onClose:()=>{closed++;}});h.flush();
  const click=t=>{const b=btn(h,t);assert.ok(b,`Button not found: ${t}`);assert.equal(Boolean(b.props.disabled),false,t);b.props.onClick();h.flush();};
  return {h,click,get closed(){return closed;}};
}
test('UI records eight attempts per stage, requires control answer, offers rest and adaptive variation',async()=>{
  const x=await session();
  for(let i=0;i<8;i++) x.click(i<7?'+ Made':'+ Missed');
  assert.equal(btn(x.h,'Finish this set').props.disabled,true,'Cannot continue without control acknowledgement');
  const controls=findElement(x.h.output,node=>node.type==='input'&&node.props.type==='radio');
  assert.ok(controls);
  controls.props.onChange();x.h.flush();
  x.click('Finish this set');
  assert.match(words(x.h.output),/Rest and reset/);
  x.click('Continue this stage');
  for(let i=0;i<8;i++)x.click('+ Made');
  findElement(x.h.output,node=>node.type==='input'&&node.props.type==='radio').props.onChange();x.h.flush();
  x.click('Finish this set');
  assert.match(words(x.h.output),/Add a read, not a rush/);
  x.h.unmount();
});
test('save retries reuse the same immutable result and never double-submit simultaneously',async()=>{
  const sent=[], pending=deferred();
  const x=await session({onSave:async result=>{sent.push(result);if(sent.length===1)throw Error('offline');return pending.promise;}});
  for (let stage=0;stage<4;stage++) {
    if(stage>0)x.click('Continue this stage');
    for(let i=0;i<8;i++)x.click(i<5?'+ Made':'+ Missed');
    findElement(x.h.output,node=>node.type==='input'&&node.props.type==='radio').props.onChange();x.h.flush();
    x.click(stage===3?'See my results':'Finish this set');
  }
  assert.match(words(x.h.output),/Now you have a measurable baseline/);
  await btn(x.h,'Save my training results').props.onClick();await x.h.settle();
  assert.equal(x.closed,0);
  assert.match(words(x.h.output),/Saving could not be confirmed/);
  const retry=btn(x.h,'Retry saving this result').props.onClick;
  const first=retry();await retry();x.h.flush();
  assert.equal(sent.length,2);
  assert.equal(sent[0],sent[1]);
  assert.equal(sent[0].id,'stable-mission-id');
  pending.resolve();await first;await x.h.settle();
  assert.equal(x.closed,1);
});
test('Skills and Train screens link to adaptive mission; no unverified AI/video claims',async()=>{
  const skills=await readFile(new URL('../src/components/train/SkillsScreen.jsx',import.meta.url),'utf8');
  const train=await readFile(new URL('../src/components/train/TrainScreen.jsx',import.meta.url),'utf8');
  assert.match(skills,/<FinishingLab/);
  assert.match(skills,/skill-other-drills/);
  assert.match(train,/Open Finishing Lab/);
  const mod=await readFile(new URL('../src/components/train/FinishingLab.jsx',import.meta.url),'utf8');
  assert.match(mod,/No coaching video, camera, or subscription is required/);
});
