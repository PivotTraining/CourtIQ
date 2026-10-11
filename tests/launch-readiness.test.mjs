import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getAnalyticsChoice, setAnalyticsChoice, shouldMeasure,
  ANALYTICS_CHOICE_KEY,
} from '../src/lib/analyticsConsent.mjs';

const source = path => readFile(new URL('../'+path,import.meta.url),'utf8');

function storage(seed) {
  const values = new Map(seed ? [[ANALYTICS_CHOICE_KEY,seed]] : []);
  return {
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>{values.set(key,value);},
  };
}

test('optional analytics is not recorded without explicit consent', () => {
  const empty=storage();
  assert.equal(getAnalyticsChoice(empty),null);
  assert.equal(shouldMeasure(empty),false);
  assert.equal(setAnalyticsChoice(empty,'allow'),true);
  assert.equal(shouldMeasure(empty),true);
  assert.equal(shouldMeasure(empty,{doNotTrack:'1'}),false);
  assert.equal(shouldMeasure(empty,{globalPrivacyControl:true}),false);
  assert.equal(setAnalyticsChoice(empty,'essential'),true);
  assert.equal(shouldMeasure(empty),false);
  assert.equal(setAnalyticsChoice(empty,'invalid'),false);
});
test('storage failure fails closed',()=>{
  const blocked={ getItem(){throw Error('blocked');}, setItem(){throw Error('blocked');} };
  assert.equal(getAnalyticsChoice(blocked),null);
  assert.equal(setAnalyticsChoice(blocked,'allow'),false);
  assert.equal(shouldMeasure(blocked),false);
});

test('crawl manifest lists public pages, not private player routes',async()=>{
  const robots=await source('src/app/robots.js');
  const sitemap=await source('src/app/sitemap.js');
  assert.match(robots,/\/dashboard/);
  assert.match(robots,/\/journal/);
  assert.match(robots,/\/api\//);
  assert.match(robots,/sitemap\.xml/);
  assert.match(sitemap,/\/privacy/);
  assert.match(sitemap,/\/terms/);
  assert.doesNotMatch(sitemap,/\/dashboard|\/journal|\/sessions/);
  const app=await source('src/app/[section]/page.js');
  assert.match(app,/index: false/);
  assert.match(app,/Player IQ and Analytics/);
});

test('SEO assets and distinctly scoped metadata render from repository',async()=>{
  const layout=await source('src/app/layout.js');
  const root=await source('src/app/page.js');
  const social=await source('src/app/opengraph-image.jsx');
  const legal=await source('src/app/privacy/page.js');
  assert.match(layout,/metadataBase:/);
  assert.match(layout,/openGraph:/);
  assert.match(layout,/AnalyticsPreferences/);
  assert.match(root,/publicPageMetadata/);
  assert.match(root,/courtiq-mobile-cta/);
  assert.match(root,/MarketingCTA/);
  assert.match(social,/1200, height: 630/);
  assert.match(legal,/Optional Analytics Choices/);
  assert.match(legal,/analytics-preferences/);
});

test('first-party conversion events honor consent and cannot upload player stats',async()=>{
  const telemetry=await source('src/lib/telemetry.js');
  const endpoint=await source('src/app/api/telemetry/route.js');
  assert.match(telemetry,/shouldMeasure/);
  assert.match(telemetry,/marketing_cta_click/);
  assert.match(endpoint,/marketing_cta_click/);
  assert.doesNotMatch(endpoint,/user_id|player_id|shot_logs|journal_entries/);
});
