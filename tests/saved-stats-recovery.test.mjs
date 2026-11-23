import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadComponent,reactHarness,findElement} from './helpers/reactHarness.mjs';

const button=(tree,label)=>findElement(tree,node=>node.type==='button' &&
  node.props.children===label);

test('saved-stats recovery checks only current signed-in account and opens real athlete histories',async()=>{
  const h=reactHarness(),calls=[],nav=[];
  const player1={id:'caleb-1',name:'Caleb'},player2={id:'jaxon-2',name:'Jaxon'};
  const {default:Recovery}=await loadComponent(
    new URL('../src/components/settings/SavedStatsRecovery.jsx',import.meta.url),{
      react:h.react,
      '@/context/AuthContext':{useAuth:()=>({
        user:{id:'owner-1',email:'chrisdavism@gmail.com'},playerProfile:player1,
        switchToManagedPlayer:async id=>calls.push(['switch',id]),
      })},
      '@/context/AppContext':{useApp:()=>({setScreen:screen=>nav.push(screen)})},
      '@/lib/queries':{
        fetchManagedPlayers:async id=>{calls.push(['players',id]);return [player1,player2];},
        fetchSessionHistory:async id=>{calls.push(['history',id]);return id==='caleb-1'?
          [{type:'game',shot_logs:[{},{}]},{type:'practice',shot_logs:[]}]:
          [{type:'game',shot_logs:[{}]}];}
      },
    });
  h.render(Recovery);h.flush();
  assert.match(JSON.stringify(h.output),/chrisdavism@gmail.com/);
  await button(h.output,'Find my saved games').props.onClick();await h.settle();
  const html=JSON.stringify(h.output);
  assert.match(html,/Caleb/);assert.match(html,/Jaxon/);
  assert.deepEqual(calls,[['players','owner-1'],['history','caleb-1'],['history','jaxon-2']]);
  const openButtons=[];
  const walk=node=>{
    if(Array.isArray(node))return node.forEach(walk);
    if(!node || typeof node!=='object')return;
    if(node.type==='button'&&node.props.children==='Open games')openButtons.push(node);
    walk(node.props?.children);
  };
  walk(h.output);assert.equal(openButtons.length,2);
  const counts=[];
  const collect=node=>{
    if(Array.isArray(node))return node.forEach(collect);
    if(!node || typeof node!=='object')return;
    const parts=node.props?.children;
    if(node.type==='span' && Array.isArray(parts) &&
      parts.some(item=>typeof item==='string'&&item.includes('shot entries')))
      counts.push(parts.at(-2));
    collect(parts);
  };
  collect(h.output);
  assert.deepEqual(counts,[2,1]);
  await openButtons[1].props.onClick();await h.settle();
  assert.deepEqual(calls.at(-1),['switch','jaxon-2']);
  assert.deepEqual(nav,['gamelog']);
  h.unmount();
});

test('account mismatch and read failures never create or delete player records',async()=>{
  const source=await readFile(new URL('../src/components/settings/SavedStatsRecovery.jsx',import.meta.url),'utf8');
  const settings=await readFile(new URL('../src/components/settings/SettingsScreen.jsx',import.meta.url),'utf8');
  assert.match(source,/fetchManagedPlayers\(id\)/);
  assert.match(source,/fetchSessionHistory\(profile.id\)/);
  assert.match(source,/No players were found under this signed-in account/);
  assert.match(source,/Local recordings and unsynced game entries/);
  assert.doesNotMatch(source,/deleteManagedPlayer|addManagedPlayer|service_role|\.insert\(|\.delete\(/);
  assert.match(settings,/<SavedStatsRecovery \/>/);
});
