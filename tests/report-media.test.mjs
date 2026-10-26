import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory } from 'fake-indexeddb';
import { buildSessionReport } from '../src/lib/sessionReport.mjs';
import { socialCardSvg } from '../src/lib/socialCard.mjs';
import { createDeviceVideoStore,clipKey,validateClip,MAX_CLIP_BYTES } from '../src/lib/deviceVideo.mjs';

test('social cards use recorded stats, safe text, actual dates and true export dimensions',()=>{
  const report=buildSessionReport([],{});const square=socialCardSvg(report,{title:'<script>alert(1)</script>',date:'2026-10-01'});
  assert.match(square,/width="1080" height="1080"/);assert.match(square,/&lt;script&gt;/);assert.doesNotMatch(square,/<script>/);assert.match(square,/2026-10-01/);assert.match(square,/>—<\/text>/);
  assert.match(socialCardSvg(report,{format:'story'}),/width="1080" height="1920"/);assert.throws(()=>socialCardSvg(report,{format:'banner'}),/Unsupported/);
});
test('device video persists blobs by account and session, rejects unsafe input and keeps previous clip on failure',async()=>{
  const store=createDeviceVideoStore(new IDBFactory()),clip=new Blob(['sample-only-not-real-video'],{type:'video/mp4'});
  await store.put('alice','session',clip);assert.equal((await store.get('alice','session')).blob.size,clip.size);
  assert.equal(await store.get('bob','session'),null);assert.equal(await store.get('alice','other'),null);
  assert.throws(()=>clipKey('','id'),/signed-in/);assert.throws(()=>validateClip(new Blob(['x'],{type:'text/html'})),/Choose/);
  await assert.rejects(store.put('alice','session',new Blob([''],{type:'video/mp4'})),/100 MB/);
  assert.equal((await store.get('alice','session')).blob.size,clip.size);
  assert.equal(MAX_CLIP_BYTES,104857600);await store.put('bob','session',clip);
  await store.clearAccount('alice');assert.equal(await store.get('alice','session'),null);assert.ok(await store.get('bob','session'));
  await store.remove('bob','session');assert.equal(await store.get('bob','session'),null);
});
test('base-layer reset cannot override utility padding and modal privacy starts with names hidden',async()=>{
  const css=await readFile(new URL('../src/app/globals.css',import.meta.url),'utf8');
  assert.match(css,/@layer base\s*\{\s*\*, \*::before, \*::after \{[^}]*margin: 0; padding: 0;/);
  const source=await readFile(new URL('../src/components/shots/SocialReportCard.jsx',import.meta.url),'utf8');assert.match(source,/\[includeName,\s*setIncludeName\]\s*=\s*useState\(false\)/);
});

test('timestamped game segments persist independently under their original account and game',async()=>{
  const store=createDeviceVideoStore(new IDBFactory());
  const movie=new Blob(['recorded segment'],{type:'video/mp4'});
  const a=await store.putSegment('parent-a','game-1',movie,
    {recordedAt:'2026-10-26T18:00:00.000Z',endedAt:'2026-10-26T18:03:55.000Z'});
  const b=await store.putSegment('parent-a','game-1',movie,
    {recordedAt:'2026-10-26T18:04:00.000Z',endedAt:'2026-10-26T18:07:55.000Z'});
  assert.notEqual(a.id,b.id,'segments must never replace previous footage');
  const segments=await store.listSegments('parent-a','game-1');
  assert.deepEqual(segments.map(x=>x.id),[a.id,b.id]);
  assert.equal((await store.listSegments('parent-b','game-1')).length,0);
  assert.equal((await store.listSegments('parent-a','other-game')).length,0);
  await assert.rejects(store.removeSegment('parent-b','game-1',a.id),/does not belong/);
  assert.equal((await store.listSegments('parent-a','game-1')).length,2);
  await store.removeSegment('parent-a','game-1',a.id);
  assert.deepEqual((await store.listSegments('parent-a','game-1')).map(x=>x.id),[b.id]);
  await store.clearAccount('parent-a');
  assert.equal((await store.listSegments('parent-a','game-1')).length,0);
});
