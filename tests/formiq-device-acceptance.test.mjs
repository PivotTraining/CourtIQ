import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('annotated camera compositor is independent from asynchronous pose inference',async()=>{
  const src=await readFile(new URL('../src/components/train/LiveShootingAnalyzer.jsx',import.meta.url),'utf8');
  const start=src.indexOf('const compositeFrame=');
  const end=src.indexOf('const tick=async',start);
  assert.ok(start>0 && end>start,'there is a dedicated recording frame loop');
  const compositor=src.slice(start,end);
  assert.match(compositor,/requestAnimationFrame\(compositeFrame\)/);
  assert.match(compositor,/drawImage\(video,0,0,canvas\.width,canvas\.height\)/);
  assert.match(compositor,/drawImage\(overlay,0,0,canvas\.width,canvas\.height\)/);
  assert.doesNotMatch(compositor,/estimatePoses|await /);
  assert.match(src.slice(end),/await model\.estimatePoses\(video\)/);
  assert.match(src,/cancelAnimationFrame\(compositorRef\.current\)/);
  assert.match(src,/timestamp-lastComposite>=80/);
});
test('device diagnostics report honest browser support and never imply real hardware passed',async()=>{
  const src=await readFile(new URL('../src/components/train/LiveShootingAnalyzer.jsx',import.meta.url),'utf8');
  assert.match(src,/Device readiness &amp; troubleshooting/);
  assert.match(src,/typeof navigator!==['"]undefined['"]/);
  assert.match(src,/window\.isSecureContext===true/);
  assert.match(src,/recordingMime=supportedRecordingType/);
  assert.match(src,/body landmark tracking|Body landmarks/);
  assert.match(src,/Not yet visible: frame the shooter/);
  assert.match(src,/test an actual recording/);
  assert.match(src,/quota unverified/);
});
test('cloud verification independently reads owner scoped records rather than trusting the insert receipt',async()=>{
  const workspace=await readFile(new URL('../src/components/train/SkillsScreen.jsx',import.meta.url),'utf8');
  const machine=await readFile(new URL('../src/components/train/ShootingMachinePractice.jsx',import.meta.url),'utf8');
  assert.match(workspace,/verifySavedMachinePractice = async workoutId =>/);
  assert.match(workspace,/fresh=await loadResults\(playerId,\{signal:controller\.signal\}\)/);
  assert.match(workspace,/item\.id===workoutId && item\.player_id===playerId/);
  assert.match(workspace,/onVerify=\{verifySavedMachinePractice\}/);
  assert.match(machine,/Verify saved workout in cloud/);
  assert.match(machine,/await onVerify\(savedId\)/);
  assert.match(machine,/row\?\.player_id!==playerId/);
});
test('video acceptance distinguishes metadata from meaningful playback and refuses false playback claims',async()=>{
  const source=await readFile(new URL('../src/components/train/ShootingMachinePractice.jsx',import.meta.url),'utf8');
  assert.match(source,/onLoadedMetadata=\{\(\)=>setFilmPlayback/);
  assert.match(source,/onTimeUpdate=\{event=>\{if\(event\.currentTarget\.currentTime>0\.15\)setFilmPlayback\('played'\)/);
  assert.match(source,/Review the full clip/);
});
