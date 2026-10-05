import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as starter from '../src/lib/starterPolicy.mjs';
import * as analytics from '../src/lib/premiumAnalytics.mjs';
import * as references from '../src/lib/nbaReferences.mjs';
import * as billing from '../src/lib/billingPolicy.mjs';
import * as internal from '../src/lib/internalApi.mjs';
import { premiumFixture } from '../src/lib/premiumFixtures.mjs';
const require=createRequire(import.meta.url),{transform}=require('next/dist/build/swc');
async function component(path,dependencies={}){
  const {code}=await transform(await readFile(new URL(path,import.meta.url),'utf8'),{filename:path,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const compiledModule={exports:{}};
  vm.runInNewContext(code,{module:compiledModule,exports:compiledModule.exports,require:name=>name.endsWith('.css')?{}:dependencies[name]||require(name)});
  return compiledModule.exports;
}
const constants=await component('../src/lib/constants.js');
const Free=(await component('../src/components/billing/FreeStarter.jsx',{
  '@/lib/starterPolicy.mjs':starter,'@/lib/billingPolicy.mjs':billing,'./ThemeToggle':{default:()=>null,__esModule:true},'next/dynamic':{default:()=>()=>null,__esModule:true},
})).default;
const Premium=(await component('../src/components/iq/PremiumAnalytics.jsx',{
  '@/lib/constants':constants,'@/lib/premiumAnalytics.mjs':analytics,'@/lib/nbaReferences.mjs':references,
  '@/lib/internalApi.mjs':internal,
  'next/link':{default:({children,...props})=>React.createElement('a',props,children),__esModule:true},
})).PremiumView;
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
test('free entry promises one unsaved workout and does not offer saved games, journal writes or automatic trial activation',()=>{
  const html=render(Free,{state:{workout:'available',billing:{trial:{status:'eligible'}},trialAvailable:true},onClaim:()=>{},onTrial:()=>{},onRefresh:()=>{},sample:true});
  assert.match(html,/Start my one free workout/);assert.match(html,/Choose my 10-day trial/);assert.match(html,/not a saved game/);assert.match(html,/allowance is used when you start/);
  assert.doesNotMatch(html,/Save result|Save game|Write journal|Stripe checkout/);
  const used=render(Free,{state:{workout:'used',billing:{trial:{status:'expired'}}}});assert.doesNotMatch(used,/Start my one free workout/);assert.match(used,/one free workout has been used/);
});
test('a still-open subscription is not presented as a no-charge trial or silently canceled by free access',()=>{
  for(const status of ['active','past_due','unpaid','incomplete','paused','trialing']) {
    const html=render(Free,{state:{workout:'used',billing:{trial:{status:'eligible'},subscription:{status}},trialAvailable:true}});
    assert.doesNotMatch(html,/Choose my 10-day trial/);assert.match(html,/can still bill/);assert.match(html,/does not stop renewals/);
  }
});
test('premium UI exposes sourced historical style patterns, truthful privacy gates and sample denominators',()=>{
  const html=render(Premium,{dataset:premiumFixture(),onCoverage:()=>{},sample:true});
  assert.match(html,/LOCAL SYNTHETIC SAMPLE/);assert.match(html,/12 confirmed games/);assert.match(html,/NBA style echoes/);assert.match(html,/2024–25 regular season/);
  assert.match(html,/not talent ratings/);assert.match(html,/not a confidence score/);assert.match(html,/Not activated\. Your stats are not being shared/);assert.doesNotMatch(html,/NaN|Infinity/);
  const small=render(Premium,{dataset:premiumFixture('small'),onCoverage:()=>{}});assert.match(small,/style needs a sample/);assert.doesNotMatch(small,/Pattern distance/);
  const unconfirmed=render(Premium,{dataset:premiumFixture('unconfirmed'),onCoverage:()=>{}});assert.match(unconfirmed,/0 confirmed games/);assert.match(unconfirmed,/Full-game coverage not confirmed/);
});
