import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findElement,loadComponent,reactHarness} from './helpers/reactHarness.mjs';

async function fixture({accept=true}={}){
 const h=reactHarness(),events=[],undos=[];
 const courtZones=[
   {id:'paint',label:'Paint',pts:2,x:50,y:55},
   {id:'top-key-3',label:'Top Key 3',pts:3,x:50,y:10},
   {id:'free-throw',label:'Free Throw',pts:1,x:50,y:40},
 ];
 const icon=({name})=>name;
 const {default:Tracker}=await loadComponent(new URL('../src/components/shots/CourtTrackerView.jsx',import.meta.url),{
   react:h.react,
   '@/components/ui/Icons':{__esModule:true,default:icon},
   '@/lib/constants':{COURT_ZONES:courtZones},
   '@/lib/utils':{getHeatColor:()=> '#abc'},
 });
 const props={
   sessionType:'game', shots:[], gameStats:{ast:0,reb:0,stl:0,blk:0,to:0,pf:0,min:0},
   updateStat:()=>true, saving:false, ending:false, tab:'court', setTab:()=>{},
   darkMode:false,onToggleTheme:()=>{},courtTheme:'tan',setCourtTheme:()=>{},
   undoCount:2,undoLast:()=>undos.push('undo'),endSession:()=>{},
   logShotAtZone:(zoneId,made)=>{events.push({zoneId,made});return accept;},
   logFreeThrow:made=>events.push({zoneId:'free-throw',made}),
 };
 h.render(Tracker,props);
 const findMode=mode=>findElement(h.output,node=>node.type==='button'&&node.props?.['data-shot-mode']===mode);
 const findZone=id=>findElement(h.output,node=>node.type==='button'&&node.props?.['aria-label']?.startsWith(id==='paint'?'Paint,':'Top Key 3,'));
 const findFT=label=>findElement(h.output,node=>node.type==='button'&&typeof node.props?.children!=='undefined' &&
  [node.props.children].flat(Infinity).some(child=>child===label));
 return {h,events,undos,findMode,findZone,findFT};
}

test('one court tap records a made shot, with no location selection or confirmation',async()=>{
 const f=await fixture();
 assert.equal(f.findMode('made').props['aria-pressed'],true);
 assert.equal(f.findMode('missed').props['aria-pressed'],false);
 f.findZone('paint').props.onClick();
 assert.deepEqual(f.events,[{zoneId:'paint',made:true}]);
 f.h.render();
 assert.match(JSON.stringify(f.h.output),/Made 2-point attempt recorded/);
 f.findZone('top-key-3').props.onClick();
 assert.deepEqual(f.events,[{zoneId:'paint',made:true},{zoneId:'top-key-3',made:true}]);
 f.h.unmount();
});

test('switching to Missed records one missed attempt per court tap and stays selected',async()=>{
 const f=await fixture();
 f.findMode('missed').props.onClick();
 f.h.render();
 assert.equal(f.findMode('missed').props['aria-pressed'],true);
 f.findZone('top-key-3').props.onClick();
 f.findZone('top-key-3').props.onClick();
 assert.deepEqual(f.events,[{zoneId:'top-key-3',made:false},{zoneId:'top-key-3',made:false}]);
 f.h.render();
 assert.match(JSON.stringify(f.h.output),/Missed 3-point attempt recorded/);
 f.findMode('made').props.onClick();
 f.h.render();
 f.findZone('paint').props.onClick();
 assert.deepEqual(f.events.at(-1),{zoneId:'paint',made:true});
 f.h.unmount();
});

test('rejected local write never tells a parent the shot was saved',async()=>{
 const f=await fixture({accept:false});
 f.findZone('paint').props.onClick();
 f.h.render();
 assert.match(JSON.stringify(f.h.output),/Shot not recorded/);
 assert.doesNotMatch(JSON.stringify(f.h.output),/Made 2-point attempt recorded/);
 f.h.unmount();
});

test('free throws stay one-step separate controls and Undo remains accessible',async()=>{
 const f=await fixture();
 const tree=f.h.output;
 const getButton=(node,label)=>findElement(node,x=>x.type==='button'&&(
  x.props?.['aria-label']===label||[x.props?.children].flat(Infinity).some(c=>typeof c==='string'&&c===label)
 ));
 // Free throws do not use court shot mode or require selecting a court zone.
 const ftMake=getButton(tree,'Made FT'),ftMiss=getButton(tree,'Missed FT');
 assert.ok(ftMake);assert.ok(ftMiss);
 ftMake.props.onClick();ftMiss.props.onClick();
 assert.deepEqual(f.events,[{zoneId:'free-throw',made:true},{zoneId:'free-throw',made:false}]);
 const undo=findElement(tree,x=>x.type==='button'&&
  [x.props?.children].flat(Infinity).includes(' Undo'));
 assert.ok(undo);
 undo.props.onClick();
 assert.deepEqual(f.undos,['undo']);
 f.h.unmount();
});

test('production tracker uses tapped zone ID directly, keeping the durable local command path',async()=>{
 const tracker=await readFile(new URL('../src/components/shots/ReliableTracker.jsx',import.meta.url),'utf8');
 const court=await readFile(new URL('../src/components/shots/CourtTrackerView.jsx',import.meta.url),'utf8');
 assert.match(tracker,/logShotAtZone=\{\(zoneId, made\) => entry\(\{ kind: 'shot', zone_id: zoneId, made \}\)\}/);
 assert.match(tracker,/Synchronous|Synchronously commit to durable device recovery/);
 assert.match(court,/if \(accepted === true\)/);
 assert.doesNotMatch(court,/onClick=\{\(\) => selectZone\(zone.id\)\}/);
});
