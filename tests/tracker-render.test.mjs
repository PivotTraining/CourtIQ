import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as reports from '../src/lib/sessionReport.mjs';

const require = createRequire(import.meta.url);
const { transform } = require('next/dist/build/swc');
async function loadComponent(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { code } = await transform(source, { filename: path, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const compiledModule = { exports: {} };
  vm.runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require: name => {
    if (name.endsWith('.css')) return {};
    if (name in dependencies) return dependencies[name];
    return require(name);
  } });
  return compiledModule.exports;
}
const constants = await loadComponent('../src/lib/constants.js');
const utils = await loadComponent('../src/lib/utils.js');
const intelligence = await loadComponent('../src/lib/intelligence.js', { './constants': constants, './utils': utils, './sessionReport.mjs': reports });
const Icon = ({ name }) => React.createElement('span', { 'aria-hidden': true }, name);
const Tracker = (await loadComponent('../src/components/shots/CourtTrackerView.jsx', {
  '@/components/ui/Icons': { __esModule: true, default: Icon }, '@/lib/constants': constants,
  '@/lib/utils': { getHeatColor: () => '#22c55e' },
})).default;
const Report = (await loadComponent('../src/components/shots/AdvancedSessionReport.jsx', {
  '@/lib/constants': constants, '@/lib/sessionReport.mjs': reports,
})).default;
const noop = () => {};
const props = {
  sessionType: 'game', shots: [], selectedZone: null, selectZone: noop,
  gameStats: { ast: 0, reb: 0, stl: 0, blk: 0, to: 0, pf: 0, min: 0 }, updateStat: noop,
  saving: false, ending: false, tab: 'court', setTab: noop, darkMode: true, onToggleTheme: noop,
  courtTheme: 'tan', setCourtTheme: noop, undoCount: 0, undoLast: noop, endSession: noop, logShot: noop, logFreeThrow: noop,
};
const render = (component, values) => renderToStaticMarkup(React.createElement(component, values));

test('mounted court includes every keyboard-accessible zone and shared theme control', () => {
  const html = render(Tracker, props);
  assert.match(html, /role="dialog"/);
  assert.match(html, /Switch to light mode/);
  for (const zone of constants.COURT_ZONES.filter(zone => zone.pts !== 1)) assert.ok(html.includes(`aria-label="${zone.label},`), zone.id);
  assert.match(html, /Made FT/);
  assert.match(html, /Add assist, current count 0/);
  const selected = render(Tracker, { ...props, darkMode: false, selectedZone: 'top-key-3' });
  assert.match(selected, /Switch to dark mode/);
  assert.match(selected, /Top Key 3 · 3PT/);
  assert.doesNotMatch(selected, />Made FT</);
});

test('saving locks stat and shooting controls and box score exposes actual minutes', () => {
  const html = render(Tracker, { ...props, saving: true });
  assert.match(html, /class="tracker-result" data-tone="green" disabled=""/);
  assert.match(html, /class="tracker-stat-input" data-tone="green" disabled=""/);
  const box = render(Tracker, { ...props, tab: 'stats' });
  assert.match(box, /Add one minute/);
  assert.match(box, /Subtract one minute/);
  assert.match(box, /downloadable CSV/);
});

test('actual report render exposes splits and honest undefined values', () => {
  const html = render(Report, { shots: [{ zone_id: 'top-key-3', made: true }, { zone_id: 'free-throw', made: true }], gameStats: { ft_made: 1, ft_total: 1 }, sessionType: 'game' });
  assert.match(html, /1 FG attempts · 1 FT attempts/);
  assert.match(html, /150.0%/); // eFG can legitimately exceed 100%.
  assert.match(html, /Export CSV/);
  assert.match(html, /ratio undefined/);
  assert.match(html, /Record minutes to calculate/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('viewport containment and scoped dark neon styles are explicit layout contracts', async () => {
  const css = await readFile(new URL('../src/components/shots/tracker.css', import.meta.url), 'utf8');
  assert.match(css, /height: 100dvh/);
  assert.match(css, /\.tracker-content \{[^}]*min-height: 0;[^}]*overflow-y: auto/);
  assert.match(css, /aspect-ratio: 5 \/ 4/);
  assert.match(css, /calc\(\(100dvh - 360px\) \* 1.25\)/);
  assert.match(css, /html.dark \.tracker-result, html.dark \.tracker-stat-input/);
  assert.match(css, /width: 44px; height: 44px; min-height: 44px/);
});

test('season and monthly per-game averages exclude practice and do not double-count FT', () => {
  const created_at = new Date().toISOString();
  const sessions = [
    { type: 'game', created_at, shot_logs: [{ zone_id: 'paint', made: true }, { zone_id: 'free-throw', made: true }], game_stats: { ft_made: 1, ft_total: 1, ast: 2, min: 10 } },
    { type: 'game', created_at, shot_logs: Array.from({ length: 9 }, () => ({ zone_id: 'paint', made: false })), game_stats: {} },
    { type: 'practice', created_at, shot_logs: Array.from({ length: 100 }, () => ({ zone_id: 'top-key-3', made: true })), game_stats: { ast: 40, min: 60 } },
  ];
  const season = intelligence.computeSeasonStats(sessions);
  assert.equal(season.totalPts, 3);
  assert.equal(season.ppg, '1.5');
  assert.equal(season.apg, '1.0');
  assert.equal(season.fgPct, 10);
  assert.equal(season.totalShots, 10);
  assert.equal(season.practiceSessions, 1);
  const month = intelligence.computeTrends(sessions).current;
  assert.equal(month.ppg, '1.5');
  assert.equal(month.fgPct, 10);
  assert.equal(month.totalPts, 3);
  assert.equal(intelligence.computeCoachReport(sessions, {}).length, 0);
});
