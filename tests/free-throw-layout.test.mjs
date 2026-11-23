import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadComponent, reactHarness, findElement} from './helpers/reactHarness.mjs';

const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

async function fixture(saving=false){
  const h=reactHarness(),recorded=[];
  const zones=[{id:'paint',label:'Paint',pts:2,x:50,y:55},{id:'free-throw',label:'Free Throw',pts:1,x:50,y:40}];
  const {default:Tracker}=await loadComponent(new URL('../src/components/shots/CourtTrackerView.jsx',import.meta.url),{
    react:h.react,
    '@/components/ui/Icons':{__esModule:true,default:({name})=>name},
    '@/lib/constants':{COURT_ZONES:zones},
    '@/lib/utils':{getHeatColor:()=> '#abc'},
  });
  h.render(Tracker,{
    sessionType:'game',shots:[],gameStats:{ast:0,reb:0,stl:0,blk:0,to:0,pf:0,min:0},
    updateStat:()=>true,saving,ending:false,tab:'court',setTab:()=>{},darkMode:false,
    onToggleTheme:()=>{},courtTheme:'tan',setCourtTheme:()=>{},undoCount:0,undoLast:()=>{},
    endSession:()=>{},logShotAtZone:()=>true,logFreeThrow:made=>{recorded.push(made);return true;}
  });
  return {h,recorded};
}

test('FT card has its own single-column container with a separate two-button grid',async()=>{
  const css=await source('src/components/shots/tracker.css');
  const view=await source('src/components/shots/CourtTrackerView.jsx');
  // The previous broad selector forced the card title and buttons into competing columns.
  assert.doesNotMatch(css,/\.tracker-shot-actions\s*>\s*div\s*\{/);
  assert.match(css,/\.tracker-free-throw-actions\s*\{[^}]*display:\s*block;/);
  assert.match(css,/\.tracker-free-throw-actions\s*>\s*\.tracker-free-throw-buttons\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css,/\.tracker-free-throw-buttons\s*>\s*\.tracker-result\s*\{[^}]*min-height:\s*52px;/);
  assert.match(css,/\.tracker-free-throw-buttons\s*>\s*\.tracker-result\s*\{[^}]*min-width:\s*0;/);
  assert.match(css,/@media\s*\(max-width:\s*359px\)\s*\{\s*\.tracker-free-throw-actions/);
  assert.match(view,/className="tracker-free-throw-actions" role="group"/);
  assert.match(view,/className="tracker-free-throw-buttons"/);
});

test('Made FT and Missed FT are distinct accessible one-tap buttons',async()=>{
  const f=await fixture();
  const ftCard=findElement(f.h.output,element=>element.props?.className==='tracker-free-throw-actions');
  assert.ok(ftCard);
  const label=findElement(ftCard,element=>element.type==='span'&&element.props?.children==='Free throws');
  const controls=findElement(ftCard,element=>element.props?.className==='tracker-free-throw-buttons');
  const made=findElement(controls,element=>element.type==='button'&&element.props?.['aria-label']==='Record a made free throw');
  const missed=findElement(controls,element=>element.type==='button'&&element.props?.['aria-label']==='Record a missed free throw');
  assert.ok(label);assert.ok(controls);assert.ok(made);assert.ok(missed);
  assert.equal(made.props.disabled,false);assert.equal(missed.props.disabled,false);
  made.props.onClick();missed.props.onClick();made.props.onClick();
  assert.deepEqual(f.recorded,[true,false,true]);
  f.h.unmount();
});

test('both free throw buttons are disabled while tracker saves',async()=>{
  const f=await fixture(true);
  const buttons=[];
  const walk=node=>{
    if(Array.isArray(node)){node.forEach(walk);return;}
    if(!node||typeof node!=='object')return;
    if(node.type==='button'&&/free throw/.test(node.props?.['aria-label']||''))buttons.push(node);
    walk(node.props?.children);
  };
  walk(f.h.output);
  assert.equal(buttons.length,2);
  assert.ok(buttons.every(item=>item.props.disabled===true));
  f.h.unmount();
});
