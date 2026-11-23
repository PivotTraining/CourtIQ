import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadComponent,reactHarness,findElement} from './helpers/reactHarness.mjs';

const buttonNamed=(tree,label)=>findElement(tree,node=>node.type==='button'&&
  [node.props.children].flat(Infinity).filter(item=>typeof item==='string').join('')===label);

async function fixture({accountId='owner-1',hasSessions=false,historyReady=true,hasPlayer=true,saved=new Map()}={}) {
  const h=reactHarness(),events=[];
  const window={localStorage:{
    getItem:key=>saved.get(key)||null,
    setItem:(key,value)=>{saved.set(key,value);},
  }};
  const {default:Guide,guideKey}=await loadComponent(
    new URL('../src/components/dashboard/FirstGameGuide.jsx',import.meta.url),
    {react:h.react},{window});
  h.render(Guide,{accountId,hasSessions,historyReady,hasPlayer,
    onStartGame:()=>events.push('start'),onSelectPlayer:()=>events.push('select'),
    onOpenGames:()=>events.push('games')});
  h.flush();
  return {h,events,saved,guideKey};
}
test('new account without saved sessions sees a simple practical first-game guide',async()=>{
  const f=await fixture();
  const text=JSON.stringify(f.h.output);
  assert.match(text,/Choose your athlete/);
  assert.match(text,/Tap to track/);
  assert.match(text,/Block/);
  assert.match(text,/30-second clips save on this browser\/device/);
  assert.match(text,/download a copy/);
  f.h.unmount();
});
test('first-game CTA opens the existing game tracker and never creates a game or payment by itself',async()=>{
  const f=await fixture();
  buttonNamed(f.h.output,'Start tracking a game').props.onClick();
  f.h.flush();
  assert.deepEqual(f.events,['start']);
  assert.equal(f.saved.get(f.guideKey('owner-1')),'done');
  assert.ok(buttonNamed(f.h.output,'How to use CourtIQ'));
  f.h.unmount();
  const repeat=await fixture({saved:f.saved});
  assert.equal(buttonNamed(repeat.h.output,'Start tracking a game'),null,'guide stays dismissed on same account');
  buttonNamed(repeat.h.output,'How to use CourtIQ').props.onClick();
  repeat.h.flush();
  assert.ok(buttonNamed(repeat.h.output,'Start tracking a game'),'guide remains available on demand');
  repeat.h.unmount();
});
test('a missing athlete opens player selection before game tracking; other accounts have their own guide',async()=>{
  const f=await fixture({hasPlayer:false});
  buttonNamed(f.h.output,'Choose a player').props.onClick();f.h.flush();
  assert.deepEqual(f.events,['select']);
  f.h.unmount();
  const other=await fixture({accountId:'owner-2',saved:f.saved});
  assert.ok(buttonNamed(other.h.output,'Start tracking a game'));
  other.h.unmount();
});
test('the guide does not interrupt an existing history or pop up before history loads',async()=>{
  for(const args of [{hasSessions:true},{historyReady:false}]){
    const f=await fixture(args);
    assert.equal(buttonNamed(f.h.output,'Start tracking a game'),null);
    assert.ok(buttonNamed(f.h.output,'How to use CourtIQ'));
    f.h.unmount();
  }
});
test('home dashboard passes existing tracker and player selection actions into guide',async()=>{
  const home=await readFile(new URL('../src/components/dashboard/HomeDashboard.jsx',import.meta.url),'utf8');
  const shell=await readFile(new URL('../src/components/Shell.jsx',import.meta.url),'utf8');
  assert.match(home,/<FirstGameGuide accountId=\{user\?\.id\}/);
  assert.match(shell,/onStartGame=\{\(\) => setShowLogger\(true\)\}/);
  assert.match(shell,/onSelectPlayer=\{\(\) => setShowSwitcher\(true\)\}/);
});
