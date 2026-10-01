import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CARD_ENERGY_PHRASES, playerCardEnergy, resolveCardEnergy } from '../src/lib/cardEnergy.mjs';
import { buildSessionReport } from '../src/lib/sessionReport.mjs';
import { socialCardSvg } from '../src/lib/socialCard.mjs';

const report = (values = {}, box = {}) => ({ ...buildSessionReport([], {}), ...values, box: { ast: 0, reb: 0, stl: 0, blk: 0, to: 0, min: 0, ...box } });

test('player cards choose all nine energy phrases from recorded session evidence', () => {
  const cases = [
    [report({ pts: 24, fga: 12, fgm: 8 }), 'It Was Lit'],
    [report({}, { stl: 2, blk: 1 }), 'Hustle Man'],
    [report({}, { oreb: 3 }), 'Hustle Man'],
    [report({}, { reb: 10 }), 'Board Man Gets Paid'],
    [report({ pts: 20, fga: 10, fgm: 7 }, { reb: 10 }), 'Major Aura'],
    [report({ pts: 10, fga: 10, fgm: 5 }), 'Work Gone Show'],
    [report({ pts: 4, fga: 10, fgm: 2 }), 'Work To Do'],
    [report({ pts: 3, fga: 1, fgm: 1 }), 'Stay Focused'],
    [report({ pts: 12, fga: 15, fgm: 6 }), 'Only One Game'],
    [report({ pts: 4, fga: 10, fgm: 2 }, { to: 5, ast: 1 }), 'Oh Brother'],
  ];
  for (const [input, phrase] of cases) assert.equal(playerCardEnergy(input).phrase, phrase);
  assert.equal(CARD_ENERGY_PHRASES.length, 9);
});

test('small samples, practice sessions and thresholds do not invent a hot game or progress', () => {
  assert.equal(playerCardEnergy(report({ pts: 21, fga: 7, fgm: 7 })).phrase, 'Only One Game');
  assert.equal(playerCardEnergy(report({ pts: 20, fga: 8, fgm: 4 })).phrase, 'It Was Lit');
  assert.equal(playerCardEnergy(report({ fga: 10, fgm: 3 })).phrase, 'Only One Game');
  assert.equal(playerCardEnergy(report()).phrase, 'Stay Focused');
  assert.equal(playerCardEnergy(report({ pts: 30, fga: 10, fgm: 10 }, { reb: 12 }), { type: 'practice' }).phrase, 'Work Gone Show');
  assert.equal(playerCardEnergy(report({}, { reb: 10 }), { type: 'practice' }).phrase, 'Stay Focused');
  assert.equal(playerCardEnergy(report({}, { stl: 2, blk: 0 })).phrase, 'Only One Game');
  assert.equal(playerCardEnergy(report({ pts: 8, fga: 10, fgm: 4 }, { ast: 5, to: 5 })).phrase, 'Only One Game');
});

test('manual captions and off switch preserve stats; roster totals never get player labels', () => {
  const input = report({ pts: 2, fga: 1, fgm: 1 }), before = structuredClone(input);
  for (const phrase of CARD_ENERGY_PHRASES) {
    assert.equal(resolveCardEnergy(input, { choice: phrase }).phrase, phrase);
    assert.equal(resolveCardEnergy(input, { choice: phrase }).automatic, false);
    for (const format of ['square', 'story']) assert.ok(socialCardSvg(input, { energy: phrase, format }).includes(`>${phrase}</text>`));
  }
  assert.equal(resolveCardEnergy(input, { choice: 'none' }), null);
  assert.equal(resolveCardEnergy(input, { kind: 'roster' }), null);
  assert.doesNotMatch(socialCardSvg(input, { kind: 'roster' }), /Stay Focused/);
  assert.doesNotMatch(socialCardSvg(input, { energy: 'none' }), /Stay Focused/);
  assert.throws(() => resolveCardEnergy(input, { choice: '<script>' }), /Unsupported/);
  assert.deepEqual(input, before);
});

test('download and sharing cannot reuse a PNG generated for an earlier headline or format', async () => {
  const source = await readFile(new URL('../src/components/shots/SocialReportCard.jsx', import.meta.url), 'utf8');
  assert.match(source, /png\?\.svg===svg\?png\.blob:null/);
  assert.match(source, /pngUrl\?\.svg===svg\?pngUrl\.url:''/);
  assert.match(source, /new File\(\[readyPng\]/);
});
