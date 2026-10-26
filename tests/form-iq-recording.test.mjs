import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  cleanRecordingType, createRecordingCollector, recordingFileExtension,
  supportedRecordingType,FORM_IQ_RECORD_LIMIT,FORM_IQ_RECORD_MAX_MS,
} from '../src/lib/formIqRecording.mjs';

test('Safari MP4 is preferred when supported; browser capability failure stays explicit',()=>{
  const safari={isTypeSupported:type=>type.startsWith('video/mp4')};
  const chrome={isTypeSupported:type=>type.startsWith('video/webm')};
  assert.match(supportedRecordingType(safari),/^video\/mp4/);
  assert.match(supportedRecordingType(chrome),/^video\/webm/);
  assert.equal(supportedRecordingType(null),null);
  assert.equal(supportedRecordingType({isTypeSupported:()=>false}),null);
  assert.equal(cleanRecordingType('video/mp4;codecs=avc1'),'video/mp4');
  assert.equal(cleanRecordingType('video/webm;codecs=vp8'),'video/webm');
  assert.equal(cleanRecordingType('video/avi'),null);
  assert.equal(recordingFileExtension('video/mp4'),'mp4');
  assert.equal(recordingFileExtension('video/webm'),'webm');
});
test('bounded video collector retains chunks, refuses overflow and does not export invalid data',async()=>{
  const collector=createRecordingCollector(12);
  assert.equal(collector.push(new Blob(['abc'])),true);
  assert.equal(collector.push(new Blob(['def'])),true);
  assert.equal(collector.size,6);
  const film=collector.finish('video/mp4;codecs=avc1');
  assert.equal(film.type,'video/mp4');
  assert.equal(await film.text(),'abcdef');
  assert.equal(collector.push(new Blob(['123456789'])),false);
  assert.equal(collector.overflow,true);
  assert.throws(()=>collector.finish('video/mp4'),/exceeded/);
  assert.throws(()=>createRecordingCollector().finish('video/mp4'),/playable/);
  assert.throws(()=>{const c=createRecordingCollector();c.push(new Blob(['data']));c.finish('video/avi');},/playable/);
  assert.equal(FORM_IQ_RECORD_LIMIT,100*1024*1024);
  assert.equal(FORM_IQ_RECORD_MAX_MS,4*60*1000);
});
test('camera recorder is opt-in, composites video+angles, records no audio, and has a downloadable fallback',async()=>{
  const code=await readFile(new URL('../src/components/train/LiveShootingAnalyzer.jsx',import.meta.url),'utf8');
  const parent=await readFile(new URL('../src/components/train/ShootingMachinePractice.jsx',import.meta.url),'utf8');
  assert.match(code,/recordConsent/);
  assert.match(code,/canvas\.captureStream\(12\)/);
  assert.match(code,/context\.drawImage\(video,0,0,canvas\.width,canvas\.height\)/);
  assert.match(code,/context\.drawImage\(overlay,0,0,canvas\.width,canvas\.height\)/);
  assert.match(code,/new Recording\(stream,\{mimeType:mime,videoBitsPerSecond:1500000\}\)/);
  assert.match(code,/item\.recorder\.stop\(\)/);
  assert.match(code,/stream\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
  assert.match(code,/video:\{facingMode/);
  assert.match(code,/audio:false/);
  assert.match(code,/onRecordingChange/);
  assert.match(code,/onClipReady/);
  assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|FormData\(/);
  assert.match(parent,/createDeviceVideoStore\(\)\.put\(accountId,result\.id,filmed\.blob\)/);
  assert.match(parent,/downloadPendingFilm/);
  assert.match(parent,/cameraRecording/);
});
