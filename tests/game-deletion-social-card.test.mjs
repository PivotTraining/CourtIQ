import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';
import { buildSessionReport } from '../src/lib/sessionReport.mjs';
import { socialCardSvg, SOCIAL_CARD_THEMES } from '../src/lib/socialCard.mjs';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';

const file = path => new URL('../' + path, import.meta.url);

test('game deletion is scoped to player, type, individual mode and non-active sessions', async () => {
  const calls = [], id = 'game123', playerId = 'player456';
  const chain = {};
  for (const name of ['delete', 'eq', 'in', 'select', 'single']) {
    chain[name] = (...args) => {
      calls.push([name, ...args]);
      return name === 'single' ? Promise.resolve({data:{id}, error:null}) : chain;
    };
  }
  const { deleteGameSession } = await loadComponent(file('src/lib/queries.js'), {
    './supabase': { getSupabase: () => ({ from: name => {calls.push(['from', name]);return chain;} }) },
    './constants': { COURT_ZONES: [], ZONE_CATEGORIES: [] },
    './dataSafety.mjs': { checked: x => x, readAll: async () => [], requireSavedRow: async x => (await x).data },
  });
  assert.deepEqual(await deleteGameSession(id, playerId), {id});
  assert.deepEqual(calls, [
    ['from','sessions'], ['delete'], ['eq','id',id], ['eq','player_id',playerId],
    ['eq','type','game'], ['eq','mode','individual'], ['in','tracker_status',['legacy','completed']],
    ['select','id'], ['single'],
  ]);
  await assert.rejects(deleteGameSession(null, playerId), /Choose a saved game/);
});

test('deleting a saved session cascades to its shots and tracker commands without affecting other games', async () => {
  const db = new PGlite();
  try {
    await db.exec("create table sessions(id uuid primary key, type text not null); create table shot_logs(id uuid primary key, session_id uuid not null references sessions(id) on delete cascade); create table session_commands(id uuid primary key, session_id uuid not null references sessions(id) on delete cascade);");
    const gone = randomUUID(), remain = randomUUID();
    await db.query("insert into sessions values($1,'game'),($2,'game')", [gone,remain]);
    await db.query("insert into shot_logs values ($1,$2),($3,$4)",[randomUUID(),gone,randomUUID(),remain]);
    await db.query("insert into session_commands values ($1,$2),($3,$4)",[randomUUID(),gone,randomUUID(),remain]);
    await db.query("delete from sessions where id=$1",[gone]);
    assert.equal((await db.query("select count(*)::int n from shot_logs")).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from session_commands")).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from sessions")).rows[0].n,1);
  } finally { await db.close(); }
});

test('delete button does not delete on cancel, and refreshes aggregate stats only after deletion', async () => {
  const events = [], h = reactHarness(), accountId = 'account1', playerId = 'player1';
  let allowed = false;
  const { default: Button } = await loadComponent(file('src/components/shots/DeleteGameButton.jsx'), {
    react: h.react,
    '@/lib/queries': { deleteGameSession: async (...args) => {events.push(['delete',...args]);} },
    '@/lib/deviceVideo.mjs': { createDeviceVideoStore: () => ({remove: async (...args) => {events.push(['clip',...args]);}}) },
    '@/lib/sessionRecovery.mjs': { loadRecovery: () => null, recoveryKey: () => 'recovery' },
    '@/context/AppContext': {useApp: () => ({refreshData: async () => {events.push(['refresh']);return true;}})},
  }, {window: {confirm: () => allowed, localStorage: {removeItem(){}}}});
  let deleted = '';
  const session = {id:'game1',type:'game',mode:'individual',tracker_status:'completed',tracker_context:{}};
  h.render(Button,{session,playerId,accountId,onDeleted:id=>{deleted=id;events.push(['removed']);}});
  const button = findElement(h.output,n=>n.type==='button');
  button.props.onClick({stopPropagation(){}}); await h.settle();
  assert.deepEqual(events,[]); assert.equal(deleted,'');
  allowed=true; button.props.onClick({stopPropagation(){}}); await h.settle();
  assert.deepEqual(events,[['delete','game1',playerId],['clip',accountId,'game1'],['refresh'],['removed']]);
  assert.equal(deleted,'game1');
  h.unmount();
});

test('team sessions do not expose destructive delete action', async () => {
  const h = reactHarness();
  const {default:Button}=await loadComponent(file('src/components/shots/DeleteGameButton.jsx'),{
    react:h.react,
    '@/lib/queries':{},
    '@/lib/deviceVideo.mjs':{},
    '@/lib/sessionRecovery.mjs':{},
    '@/context/AppContext':{useApp:()=>({refreshData:()=>{}})},
  });
  h.render(Button,{session:{id:'shared',type:'game',mode:'team'},playerId:'player',accountId:'account',onDeleted(){}});
  assert.equal(findElement(h.output,x=>x.type==='button'),null);
  h.unmount();
});

test('social cards have three distinct formats, truthful percentages, safe text and no leaked private info', () => {
  const report = buildSessionReport([], {});
  assert.deepEqual(SOCIAL_CARD_THEMES.map(t=>t.id),['midnight','hardwood','light']);
  const cards = SOCIAL_CARD_THEMES.map(t => socialCardSvg(report,{theme:t.id,format:'square', title:'<script>Unsafe</script>', energy:'none'}));
  assert.equal(new Set(cards).size,3);
  for(const svg of cards) {
    assert.match(svg,/width="1080" height="1080"/);
    assert.match(svg,/&lt;script&gt;Unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(svg,/<script>/);
    assert.match(svg,/>—<\/text>/); // zero attempts do not yield an invented percentage
    assert.doesNotMatch(svg,/VS PRIVATE/);
  }
  assert.match(socialCardSvg(report,{format:'story',opponent:'PRIVATE',theme:'hardwood'}),/width="1080" height="1920"/);
  assert.throws(()=>socialCardSvg(report,{theme:'<script>'}),/Unsupported/);
  assert.throws(()=>socialCardSvg(report,{format:'banner'}),/Unsupported/);
});
