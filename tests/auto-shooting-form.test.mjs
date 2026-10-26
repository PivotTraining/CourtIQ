import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { freshExtensionDetector, trackExtensionPattern, makeFormObservation } from '../src/lib/liveShootingAnalytics.mjs';
import { machineWorkoutResult, newMachineDraft } from '../src/lib/shootingMachine.mjs';
const set={visible:true,score:6,phase:'set',elbow:95,knee:142,wristHigh:false};
const up={visible:true,score:6,phase:'extension',elbow:168,knee:177,wristHigh:true};
const tick=(state,metric,ms)=>trackExtensionPattern(state,metric,ms);

test('auto Form IQ accepts two confirmed set frames then two extension frames, never marks a made shot',()=>{
  let state=freshExtensionDetector(),captures=0;
  for(const [ms,metric] of [[100,set],[220,set],[330,up],[440,up]]) {
    const result=tick(state,metric,ms);state=result.state;captures+=Number(result.capture);
  }
  assert.equal(captures,1);
  assert.equal(state.cooldownUntil,2040);
  const missed=tick(state,up,600);
  assert.equal(missed.capture,false);
  const obs={...makeFormObservation(up,null,'2026-10-26T13:00:00Z'),trigger:'extension-pattern-v1'};
  const draft={...newMachineDraft('release-test'),entries:[{
    id:'shot1',zone:'top-three',style:'catch-shoot',attempts:1,makes:0,source:'tap',
  }],observations:[obs]};
  const saved=machineWorkoutResult(draft);
  assert.equal(saved.drills[0].machine.observations[0].trigger,'extension-pattern-v1');
  assert.equal(saved.drills[0].successful_reps,0);
  assert.equal(saved.drills[0].reps_completed,1);
});
test('gesture noise, invisible person, incomplete body and expired set phase never auto-capture',()=>{
  let state=freshExtensionDetector();
  let result=tick(state,up,100);assert.equal(result.capture,false);
  state=result.state;
  result=tick(state,set,200);state=result.state;
  result=tick(state,{...set,score:3},300);assert.equal(result.capture,false);
  state=result.state;
  result=tick(state,set,500);state=result.state;
  result=tick(state,set,600);state=result.state;
  result=tick(state,up,3000);
  assert.equal(result.capture,false,'set must expire after timeout');
  state=result.state;
  result=tick(state,up,3100);assert.equal(result.capture,false);
  assert.equal(tick(state,null,3200).capture,false);
  assert.equal(tick(state,{...up,knee:null},3300).capture,false);
});
test('cooldown prevents duplicate confirmations and permits a later second extension',()=>{
  let state=freshExtensionDetector(),captures=0;
  for(const [t,m] of [[0,set],[110,set],[220,up],[330,up],[440,up],[550,set],
    [650,set],[900,up],[1080,up],[1990,set],[2100,set],[2220,up],[2340,up]]) {
    const event=tick(state,m,t);state=event.state;captures+=Number(event.capture);
  }
  assert.equal(captures,2);
});
test('form observation cannot spoof a shot outcome or set an unknown capture trigger',()=>{
  const draft={...newMachineDraft('invalid-trigger'),entries:[{
    id:'shot1',zone:'left-wing',style:'catch-shoot',makes:1,attempts:1,source:'tap',
  }],observations:[{...makeFormObservation(up,null),trigger:'ai-made-shot'}]};
  assert.throws(()=>machineWorkoutResult(draft),/invalid/);
});
test('camera exposes explicit opt-in, rear/front selectors, stop and no automatic shot counting',async()=>{
  const ui=await readFile(new URL('../src/components/train/LiveShootingAnalyzer.jsx',import.meta.url),'utf8');
  const screen=await readFile(new URL('../src/components/train/ShootingMachinePractice.jsx',import.meta.url),'utf8');
  assert.match(ui,/Auto-capture release-like arm extensions/);
  assert.match(ui,/onChange=\{event=>\{setAutoCapture\(event\.target\.checked\)/);
  assert.match(ui,/freshExtensionDetector\(\)/);
  assert.match(ui,/trackExtensionPattern\(extensionRef\.current,data,time\)/);
  assert.match(ui,/stop\(\)/i);
  assert.match(ui,/value="environment">Rear/);
  assert.match(ui,/value="user">Front/);
  assert.match(ui,/onObservationRef\.current\?\.\(record\)/);
  assert.match(ui,/No automatic video recording|no automatic video recording/);
  assert.match(ui,/not a shot counter/i);
  assert.match(screen,/remaining=\{Math\.max\(0,30-\(draft\.observations \|\| \[\]\)\.length\)\}/);
});
