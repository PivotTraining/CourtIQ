import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FORM_STEPS, findBallInFrame, jointAngle, makeFormObservation,
  observedRiseAngle, poseMetrics, referenceState, sampleBallColour,
} from '../src/lib/liveShootingAnalytics.mjs';
import { machineWorkoutResult, newMachineDraft } from '../src/lib/shootingMachine.mjs';

const p=(x,y)=>({x,y,score:.96});
function samplePose() {
  const points=Array.from({length:17},()=>({x:0,y:0,score:0}));
  points[6]=p(100,100);points[8]=p(100,80);points[10]=p(100,60);
  points[12]=p(130,200);points[14]=p(130,240);points[16]=p(130,280);
  return points;
}
test('the dark form lab presents six technique checkpoints without claiming grip is measurable', () => {
  assert.equal(FORM_STEPS.length,6);
  assert.deepEqual(FORM_STEPS.map(x=>x.id),['stance','grip','elbow','dip','release','follow']);
  assert.match(FORM_STEPS.find(x=>x.id==='grip').detail,/cannot measure grip/);
});
test('tracked 2D joints generate phase-specific references and never guess hidden measurements', () => {
  const points=samplePose();
  const stats=poseMetrics(points,'right');
  assert.equal(stats.phase,'extension');
  assert.equal(stats.elbow,180);
  assert.equal(stats.knee,180);
  assert.equal(stats.wristHigh,true);
  assert.equal(referenceState(stats,stats.phase).elbow,'reference');
  assert.equal(jointAngle(null,p(0,0),p(1,1)),null);
  assert.equal(poseMetrics([]).visible,false);
  assert.equal(referenceState(poseMetrics([])).elbow,'unavailable');
  points[10].score=.1;
  assert.equal(poseMetrics(points).elbow,null);
  assert.equal(referenceState(poseMetrics(points)).elbow,'unavailable');
});
function pixels(x=80,y=80) {
  const width=320,height=240,data=new Uint8ClampedArray(width*height*4);
  for(let j=y-11;j<=y+11;j++)for(let i=x-11;i<=x+11;i++){
    if(Math.hypot(i-x,j-y)>11)continue;
    const n=(j*width+i)*4;data[n]=220;data[n+1]=105;data[n+2]=35;data[n+3]=255;
  }
  return {width,height,data};
}
test('ball tracker requires explicit colour calibration and a local image match', () => {
  const image=pixels();
  const colour=sampleBallColour(image,80,80);
  assert.deepEqual(colour,{r:220,g:105,b:35});
  const found=findBallInFrame(image,{x:80,y:80},colour,42);
  assert.ok(found);
  assert.ok(Math.hypot(found.x-80,found.y-80)<3);
  assert.equal(findBallInFrame(image,{x:240,y:100},colour,35),null);
  assert.equal(sampleBallColour(image,-1,80),null);
  assert.equal(sampleBallColour(image,30,30),null);
});
test('projected ball-rise estimate requires a continuous rising image sequence, never claims 3-D arc',()=>{
  const path=[{x:80,y:200,time:0},{x:88,y:179,time:130},{x:96,y:158,time:260},{x:104,y:137,time:390}];
  assert.equal(observedRiseAngle(path),69);
  assert.equal(observedRiseAngle(path.slice(0,2)),null);
  assert.equal(observedRiseAngle(path.map(p=>({...p,y:150}))),null);
  assert.equal(observedRiseAngle([{x:1,y:10,time:0},...path.slice(1).map(p=>({...p,time:2000+p.time}))]),null);
});
test('only bounded numerical observations persist with a player machine workout, never frames',()=>{
  const stats=poseMetrics(samplePose());
  const obs=makeFormObservation(stats,69,'2026-10-26T12:00:00Z');
  const draft={...newMachineDraft('form-iq-test'),entries:[{
    id:'attempt1',zone:'left-corner',style:'catch-shoot',attempts:1,makes:0,source:'tap',
  }],observations:[obs]};
  const result=machineWorkoutResult(draft);
  assert.equal(result.drills[0].machine.observations[0].projected_rise_angle,69);
  assert.equal(result.drills[0].machine.observations[0].method,'on-device-movenet-v1');
  assert.ok(!('image' in result.drills[0].machine.observations[0]));
  assert.ok(!('video' in result.drills[0].machine));
  assert.throws(()=>machineWorkoutResult({...draft,observations:Array(31).fill(obs)}),/invalid/);
  assert.throws(()=>machineWorkoutResult({...draft,observations:[{...obs,elbow_angle:'180'}]}),/invalid/);
});
test('on-device camera is native, opt-in, stopped on hidden view, and has no remote upload',async()=>{
  const file=await readFile(new URL('../src/components/train/LiveShootingAnalyzer.jsx',import.meta.url),'utf8');
  const parent=await readFile(new URL('../src/components/train/ShootingMachinePractice.jsx',import.meta.url),'utf8');
  assert.match(file,/navigator\.mediaDevices\.getUserMedia/);
  assert.match(file,/pose\.createDetector/);
  assert.match(file,/visibilitychange/);
  assert.match(file,/\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
  assert.match(file,/onPointerDown=\{ballPick\?calibrate:undefined\}/);
  assert.match(file,/Save current form observation/);
  assert.match(file,/3D arc/);
  assert.doesNotMatch(file,/fetch\(|XMLHttpRequest|FormData\(/);
  assert.match(parent,/<LiveShootingAnalyzer onObservation=\{captureFormObservation\}/);
});
