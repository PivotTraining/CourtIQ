import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('live Gametime defaults to compact visible totals and an expandable tools panel',async()=>{
 const tracker=await readFile(new URL('../src/components/shots/ReliableTracker.jsx',import.meta.url),'utf8');
 const view=await readFile(new URL('../src/components/shots/CourtTrackerView.jsx',import.meta.url),'utf8');
 assert.match(tracker,/className="tracker-score-summary"/);
 assert.match(tracker,/className="tracker-more-tools"/);
 assert.match(tracker,/More game tools/);
 assert.match(tracker,/\{conflict&&<div className="tracker-merge-controls"/);
 assert.match(tracker,/setToolOpen\(true\)/);
 assert.match(view,/tracker-shot-options/);
 assert.match(view,/\['ast','reb','stl','to'\]/);
 assert.match(view,/Free throws/);
 assert.match(view,/Keep location/);
 assert.match(view,/Shot chart/);
 assert.match(view,/Box score/);
 assert.doesNotMatch(view,/Full box score, 2PT/);
});
test('recording always exposes record/stop and consent, but hides setup and privacy notes',async()=>{
 const cam=await readFile(new URL('../src/components/shots/GameTrackerRecorder.jsx',import.meta.url),'utf8');
 assert.match(cam,/game-video-consent/);
 assert.match(cam,/● Record game/);
 assert.match(cam,/■ Stop &amp; save clip/);
 assert.match(cam,/<details className="game-video-extra">/);
 assert.match(cam,/<details className="game-video-info-details">/);
 assert.match(cam,/game-video-camera/);
 assert.match(cam,/Download selected clip backup/);
});
test('game clock accepts numeric clock inputs, not an escaped literal backslash-d',async()=>{
 const ui=await readFile(new URL('../src/components/shots/CourtTrackerView.jsx',import.meta.url),'utf8');
 assert.match(ui,/if\(\/\^\\d\{0,2\}:\?\\d\{0,2\}\$\/\.test\(event\.target\.value\)\)/);
});
