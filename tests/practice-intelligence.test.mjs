import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastNextAttempts } from '../src/lib/forecastModel.mjs';
import { buildPracticeIntelligence, buildGameShotOutlook } from '../src/lib/practiceIntelligence.mjs';

const entry = (index, good = 12, options = {}) => ({
  drill_id: 'mikan-drill', name: 'Mikan Drill', target_reps: 20,
  reps_completed: 20, successful_reps: good, outcome_kind: 'makes',
  completed_at: new Date(Date.UTC(2026, 9, 10 - index)).toISOString(),
  skipped: false, ...options,
});

test('statistical outlook refuses missing data, bad records and thin samples', () => {
  assert.equal(forecastNextAttempts({ successes: 30, attempts: 30, sessions: 3 }).available, false);
  assert.equal(forecastNextAttempts({ successes: 45, attempts: 60, sessions: 2 }).available, false);
  assert.equal(forecastNextAttempts({ successes: 61, attempts: 60, sessions: 3 }).available, false);
  assert.equal(forecastNextAttempts({ successes: -1, attempts: 60, sessions: 3 }).available, false);
});

test('outlook expresses an uncertain next-ten projection without claiming trained AI', () => {
  const result = forecastNextAttempts({ successes: 36, attempts: 60, sessions: 3 });
  assert.equal(result.available, true);
  assert.equal(result.recordedRate, 60);
  assert.ok(result.expectedMakes >= 5 && result.expectedMakes <= 7);
  assert.ok(result.plausibleLow < result.plausibleHigh);
  assert.equal(result.trainedModel, false);
  assert.equal(result.validatedForecast, false);
  assert.ok(result.plausibleLow >= 0 && result.plausibleHigh <= 10);
  const perfect = forecastNextAttempts({ successes: 60, attempts: 60, sessions: 3 });
  assert.ok(perfect.estimatedRate < 100);
});

test('matched practice groups exclude partial, different-target and subjective clean reps', () => {
  const rows = [
    entry(0, 15), entry(1, 14), entry(2, 13),
    entry(3, 12, { reps_completed: 15, skipped: true }),
    entry(4, 18, { target_reps: 25, reps_completed: 25 }),
    entry(5, 14, { outcome_kind: 'clean-reps' }),
  ];
  const result = buildPracticeIntelligence(rows);
  assert.equal(result.length, 2);
  const main = result.find(item => item.target === 20);
  assert.equal(main.totalSessions, 3);
  assert.equal(main.attempts, 60);
  assert.equal(main.successes, 42);
  assert.equal(main.forecast.available, true);
  assert.equal(main.trend, null);
});

test('change compares balanced same-target windows and never calls it causation', () => {
  const result = buildPracticeIntelligence([
    entry(0, 18), entry(1, 17), entry(2, 16),
    entry(3, 10), entry(4, 9), entry(5, 8),
  ]);
  assert.equal(result[0].trend.recentRate, 85);
  assert.equal(result[0].trend.previousRate, 45);
  assert.equal(result[0].trend.deltaPoints, 40);
});

test('game intelligence never silently mixes practices or incomplete games', () => {
  const game = (count, override = {}) => ({
    type: 'game', coverage_confirmed: true, tracker_status: 'completed',
    shot_logs: Array.from({ length: count }, (_, i) => ({ made: i % 2 === 0, zone_id: 'mid-range' })),
    ...override,
  });
  const games = [
    game(20), game(20), game(20),
    game(80, { type: 'practice' }),
    game(80, { coverage_confirmed: false }),
    game(80, { tracker_status: 'active' }),
    game(80, { shot_logs: [{ made: null, zone_id: 'mid-range' }] }),
  ];
  const outlook = buildGameShotOutlook(games);
  assert.equal(outlook.games, 3);
  assert.equal(outlook.attempts, 60);
  assert.equal(outlook.successes, 30);
  assert.equal(outlook.forecast.available, true);
});
