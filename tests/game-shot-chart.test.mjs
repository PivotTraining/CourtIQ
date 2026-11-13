import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGameShotChartData } from '../src/lib/gameShotChart.mjs';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';

const ZONES = [
  {id:'left-wing-3',label:'L Wing 3',pts:3,x:8,y:25},
  {id:'paint',label:'Paint',pts:2,x:50,y:58},
  {id:'free-throw',label:'Free Throw',pts:1,x:50,y:42},
];
const attempts = [
  {zone_id:'left-wing-3',made:false},
  {zone_id:'left-wing-3',made:false},
  {zone_id:'left-wing-3',made:true},
  {zone_id:'paint',made:true},
  {zone_id:'free-throw',made:false},
  {zone_id:'free-throw',made:true},
];

test('chart counts saved makes, misses, and free throws without inventing individual coordinates', () => {
  const data = buildGameShotChartData(attempts,ZONES);
  assert.deepEqual({made:data.made,missed:data.missed,attempts:data.attempts},{made:2,missed:2,attempts:4});
  assert.equal(data.freeThrows.made,1);
  assert.equal(data.freeThrows.missed,1);
  assert.deepEqual(data.zones.map(z=>[z.id,z.made,z.missed]),[['left-wing-3',1,2],['paint',1,0]]);
  assert.equal(data.unmapped,0);
});

test('chart does not count unknown zones, malformed outcomes, or free throws as field goals', () => {
  const data = buildGameShotChartData([
    {zone_id:'old-invalid',made:false}, {zone_id:'paint',made:'false'},
    {zone_id:'free-throw',made:false}, null,
  ],ZONES);
  assert.equal(data.attempts,0);
  assert.equal(data.freeThrows.missed,1);
  assert.equal(data.unmapped,3);
  assert.deepEqual(data.zones,[]);
});

async function chartFixture(shots=attempts) {
  const h = reactHarness();
  const mod = await loadComponent(new URL('../src/components/shots/GameShotChart.jsx',import.meta.url), {
    react:h.react,
    '@/lib/constants':{COURT_ZONES:ZONES},
    '@/lib/gameShotChart.mjs':{buildGameShotChartData},
  });
  h.render(mod.default,{shots}); h.flush();
  return h;
}
const findFilter = (output,name) => findElement(output,
  node => node.type === 'button' && node.props?.children?.[0] === name);

test('completed-game chart filters all, misses, and makes without altering source attempts',async()=>{
  const h=await chartFixture();
  assert.equal(findFilter(h.output,'All shots').props['aria-pressed'],true);
  findFilter(h.output,'Misses').props.onClick();h.flush();
  assert.equal(findFilter(h.output,'Misses').props['aria-pressed'],true);
  assert.match(JSON.stringify(h.output),/Missed-shot locations/);
  assert.match(JSON.stringify(h.output),/2 missed/);
  assert.doesNotMatch(JSON.stringify(h.output),/1 made · 2 missed/);
  findFilter(h.output,'Makes').props.onClick();h.flush();
  assert.equal(findFilter(h.output,'Makes').props['aria-pressed'],true);
  assert.match(JSON.stringify(h.output),/Made-shot locations/);
  assert.doesNotMatch(JSON.stringify(h.output),/2 missed/);
  findFilter(h.output,'All shots').props.onClick();h.flush();
  assert.equal(findFilter(h.output,'All shots').props['aria-pressed'],true);
  assert.match(JSON.stringify(h.output),/1 made · 2 missed/);
  h.unmount();
});

test('finished games with no recorded court shots get a truthful empty state',async()=>{
  const h=await chartFixture([{zone_id:'free-throw',made:false}]);
  const text=JSON.stringify(h.output);
  assert.match(text,/No field-goal locations were recorded/);
  assert.match(text,/0 made · 1 missed/);
  assert.equal(findFilter(h.output,'Misses'),null);
  h.unmount();
});

test('game details place the shot court below numbers and do not collapse on filter taps',async()=>{
  const gameLog=await readFile(new URL('../src/components/gamelog/GameLogScreen.jsx',import.meta.url),'utf8');
  const sessionHistory=await readFile(new URL('../src/components/shots/SessionHistory.jsx',import.meta.url),'utf8');
  assert.ok(gameLog.indexOf('<GameShotChart shots={session.shot_logs || []}')>gameLog.indexOf('{/* Full Stat Grid */}'));
  assert.ok(gameLog.indexOf('<GameShotChart shots={session.shot_logs || []}')<gameLog.indexOf('{/* Shot Zone Breakdown */}'));
  assert.match(gameLog,/type="button" aria-expanded=\{expanded\}/);
  assert.doesNotMatch(gameLog,/onClick=\{\(\) => setExpanded\(!expanded\)\}/);
  assert.match(sessionHistory,/showReport && session.type === "game" && <GameShotChart/);
});
