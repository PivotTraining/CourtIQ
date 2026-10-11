import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadComponent } from './helpers/reactHarness.mjs';

test('IQ snapshot never treats incomplete or uncovered games as an adequate measured sample', async () => {
  const { iqReadiness } = await loadComponent(
    new URL('../src/components/iq/IQSpotlight.jsx', import.meta.url),
    { '@/context/AppContext': { useApp: () => ({ setScreen() {} }) } },
  );
  const attempts = n => Array.from({ length: n }, (_, index) => ({ made: index % 2 === 0, zone_id: 'paint' }));
  const game = (n, overrides = {}) => ({
    type: 'game', coverage_confirmed: true, tracker_status: 'completed', shot_logs: attempts(n), ...overrides,
  });
  assert.equal(iqReadiness([]).sufficient, false);
  assert.equal(iqReadiness([game(40), game(40)]).sufficient, false);
  assert.equal(iqReadiness([game(10), game(10), game(10)]).sufficient, true);
  assert.equal(iqReadiness([game(20), game(20), game(20,{coverage_confirmed:false})]).sufficient, false);
  assert.equal(iqReadiness([game(20), game(20), game(20,{shot_logs:[{made:null}]})]).sufficient, false);
  assert.equal(iqReadiness([game(10), game(10), game(10)]).recordedAttempts,30);
});

test('My IQ is a high-priority snapshot with optional depth and no redundant unavailable Team IQ tab', async () => {
  const insights = await readFile(new URL('../src/components/dashboard/PlayerInsights.jsx', import.meta.url),'utf8');
  const iq = await readFile(new URL('../src/components/iq/IQScreen.jsx', import.meta.url),'utf8');
  const shell = await readFile(new URL('../src/components/Shell.jsx', import.meta.url),'utf8');
  assert.match(insights,/IQSpotlight/);
  assert.match(insights,/Explore your shooting outlook/);
  assert.match(insights,/Coach notes & deeper insights/);
  assert.doesNotMatch(insights,/Player Rating|RadarChart/);
  assert.doesNotMatch(iq,/Powered by your Gametime sessions/);
  assert.match(iq,/isTeamIQ && <button/);
  assert.match(shell,/screen !== "iq"/);
  assert.match(iq,/Ask CourtIQ AI Coach/);
});

test('marketing consent banner never covers signed-in IQ screen',async()=>{
  const source = await readFile(new URL('../src/components/marketing/AnalyticsPreferences.jsx',import.meta.url),'utf8');
  assert.match(source,/pathname !== "\/"/);
});
