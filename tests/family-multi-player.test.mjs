import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';

const root = new URL('../src/', import.meta.url);
const alice = { id: 'child-a', name: 'Child A', manager_uid: 'parent', jersey_number: 3, age: 13 };
const bob = { id: 'child-b', name: 'Child B', manager_uid: 'parent', jersey_number: 9, age: 14 };
const Empty = () => null;

function hasText(node, search) {
  if (node == null) return false;
  if (typeof node === 'string') return node.includes(search);
  return [node?.props?.children].flat(Infinity).some(child => hasText(child, search));
}

test('parent picker switches child through server verification and never bypasses the owner function', async () => {
  const h = reactHarness(), actions = [];
  const auth = {user: { id:'parent' }, playerProfile: alice,
    switchToManagedPlayer: async id => {
      actions.push(['verify',id]);
      if (id !== bob.id) throw new Error('Not managed');
      auth.playerProfile = bob;
      return bob;
    }};
  const {default: Picker} = await loadComponent(new URL('components/PlayerSwitcher.jsx', root),{
    react: h.react,
    '@/context/AuthContext': {useAuth:()=>auth},
    '@/lib/queries': {fetchManagedPlayers: async ()=>[alice,bob],addManagedPlayer:async()=>{},deleteManagedPlayer:async()=>{}},
    '@/components/ui/Icons':Empty,
  });
  h.render(Picker,{onClose:()=>actions.push(['close'])});
  await h.settle();
  assert.ok(hasText(h.output, 'Who is playing?'));
  const choice=findElement(h.output,node=>node.type==='button'&&hasText(node,'Use profile'));
  assert.ok(choice);
  await choice.props.onClick();
  await h.settle();
  assert.deepEqual(actions,[['verify',bob.id],['close']]);
});

test('parent picker fails closed and keeps current child when switching cannot be verified', async () => {
  const h=reactHarness();
  let closes=0;
  const auth={user:{id:'parent'},playerProfile:alice,
    switchToManagedPlayer:async()=>{throw new Error('Forbidden');}};
  const {default: Picker}=await loadComponent(new URL('components/PlayerSwitcher.jsx',root),{
    react:h.react,'@/context/AuthContext':{useAuth:()=>auth},
    '@/lib/queries':{fetchManagedPlayers:async()=>[alice,bob],deleteManagedPlayer:async()=>{throw new Error('must not run');},addManagedPlayer:async()=>{}},
    '@/components/ui/Icons':Empty,
  });
  h.render(Picker,{onClose:()=>closes++});await h.settle();
  await findElement(h.output,node=>node.type==='button'&&hasText(node,'Use profile')).props.onClick();
  await h.settle();
  assert.equal(closes,0);
  assert.equal(auth.playerProfile.id,alice.id);
  assert.ok(findElement(h.output,node=>node.props?.role==='alert'));
  assert.equal(findElement(h.output,node=>node.type==='button'&&node.props?.['aria-label']==='Permanently delete Child A and all records'),null);
});

test('parent-scoped app state never shows an older child\'s stats while switching', async () => {
  const h=reactHarness();
  let selected=alice;
  const deferred=[];
  const fetchShotData=id=>new Promise(resolve=>deferred.push({id,resolve}));
  const empty={total:0,made:0,threes:{total:0,made:0},midRange:{total:0,made:0},paint:{total:0,made:0},freeThrows:{total:0,made:0}};
  const {AppProvider}=await loadComponent(new URL('context/AppContext.jsx',root),{
    react:h.react,
    'next/navigation':{useRouter:()=>({push(){},replace(){}}),usePathname:()=>'/home'},
    '@/context/AuthContext':{useAuth:()=>({playerProfile:selected})},
    '@/lib/routes':{screenFromPath:()=> 'home',pathForScreen:()=>'/home'},
    '@/lib/telemetry':{trackEvent(){}},
    '@/lib/queries':{
      fetchShotData,fetchWeeklyTrend:async()=>[],fetchHeatZones:async()=>[],
      fetchJournalEntries:async()=>[],insertJournalEntry:async()=>{},
      fetchTeamData:async()=>[],fetchTeamInfo:async()=>({}),fetchStreak:async()=>0,
    },
  },{console:{error(){}},setTimeout,clearTimeout});
  h.render(AppProvider,{children:'family'});h.flush();
  deferred[0].resolve({game:{...empty,total:7},practice:empty});
  await h.settle();
  assert.equal(h.output.props.value.player.name,alice.name);
  assert.equal(h.output.props.value.shotData.game.total,7);
  selected=bob;h.render(); // Render before any effects: prior-child stats are immediately masked.
  assert.equal(h.output.props.value.player,null);
  assert.equal(h.output.props.value.shotData.game.total,0);
  assert.equal(h.output.props.value.loading,true);
  h.flush();
  assert.equal(deferred[1].id,bob.id);
  deferred[1].resolve({game:{...empty,total:3},practice:empty});
  await h.settle();
  assert.equal(h.output.props.value.player.name,bob.name);
  assert.equal(h.output.props.value.shotData.game.total,3);
  h.unmount();
});

test('parent picker visibly keeps new under-13 profile creation blocked pending consent workflow', async () => {
  const h=reactHarness(),children=[alice];
  let inserts=0;
  const auth={user:{id:'parent'},playerProfile:alice,switchToManagedPlayer:async()=>alice};
  const {default: Picker}=await loadComponent(new URL('components/PlayerSwitcher.jsx',root),{
    react:h.react,'@/context/AuthContext':{useAuth:()=>auth},
    '@/lib/queries':{fetchManagedPlayers:async()=>children,addManagedPlayer:async()=>{inserts++;},deleteManagedPlayer:async()=>{}},
    '@/components/ui/Icons':Empty
  });
  h.render(Picker,{onClose() {}});await h.settle();
  assert.ok(hasText(h.output,'verified guardian-consent'));
  findElement(h.output,node=>node.type==='button'&&hasText(node,'Add another player')).props.onClick();
  h.flush();
  const inputs=[];
  const collect=node=>{if(!node || typeof node!=='object')return;
    if(node.type==='input')inputs.push(node);
    for(const c of [node.props?.children].flat(Infinity))collect(c);
  };
  collect(h.output);
  const name=inputs.find(input=>input.props?.placeholder==='Child or player name');
  name.props.onChange({target:{value:'Young child'}});
  h.flush();
  const refreshedInputs=[];
  const collectAgain=node=>{if(!node || typeof node!=='object')return;
    if(node.type==='input')refreshedInputs.push(node);
    for(const part of [node.props?.children].flat(Infinity))collectAgain(part);
  };
  collectAgain(h.output);
  refreshedInputs.find(input=>input.props?.placeholder==='Age').props.onChange({target:{value:'10'}});
  h.flush();
  findElement(h.output,node=>node.type==='button'&&hasText(node,'Add Player')).props.onClick();
  h.flush();
  assert.equal(inserts,0);
  assert.ok(findElement(h.output,node=>node.props?.role==='alert'));
});
