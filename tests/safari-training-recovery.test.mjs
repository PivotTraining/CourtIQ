import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { loadComponent, reactHarness } from './helpers/reactHarness.mjs';

test('training route does not crash on unsupported historical workout record', async () => {
  const h = reactHarness();
  const Empty = () => null;
  const rows = [
    { id: 'legacy', completed_at: '2026-10-26T10:00:00Z', drills: { old: true }, elapsed_seconds: null },
    { id: 'verified', completed_at: '2026-10-26T10:20:00Z', drills: [
      { name: 'Shots', skipped: false }, { name: 'Passes', skipped: true },
    ], elapsed_seconds: 120 },
  ];
  const { default: TrainScreen } = await loadComponent(
    new URL('../src/components/train/TrainScreen.jsx', import.meta.url),
    {
      react: h.react,
      '@/context/AppContext': { useApp: () => ({ playerId: 'player', player: { age: 13 }, setScreen() {} }) },
      '@/context/AuthContext': { useAuth: () => ({ playerProfile: { age: 13 } }) },
      '@/components/ui/Icons': Empty,
      '@/components/ui/RecordsUnavailable': Empty,
      '@/components/ui/Card': Empty,
      '@/components/ui/SectionDivider': Empty,
      '@/lib/drills': { DRILLS: [], DRILL_CATEGORIES: [] },
      '@/lib/drillBank': { DRILL_BANK: [], DRILL_CATEGORIES: [] },
      '@/lib/prescriptions.mjs': { buildTrainingPrescription: () => ({
        drills: [], reason: 'No sessions', evidence: 'No evidence', confidence: 'low', totalDuration: 0,
      }) },
      '@/lib/telemetry': { trackEvent() {} },
      '@/lib/queries': {
        fetchWorkoutResults: async () => rows,
        fetchSessionHistory: async () => [],
        saveWorkoutResult: async () => ({}),
      },
      '@/lib/intelligence': { computeSkillRatings: () => null },
      './WorkoutTimer': Empty,
      './DrillCamera': Empty,
    },
    { process: { env: { NEXT_PUBLIC_TRACKER_RECOVERY_ENABLED: 'true' } } },
  );
  h.render(TrainScreen);
  await h.settle();
  const html = renderToStaticMarkup(h.output);
  assert.match(html, /unsupported record format/);
  assert.match(html, /1 finished \/ 2 drills/);
  assert.doesNotMatch(html, /NaN min/);
  h.unmount();
});

test('a failed view is contained within navigation, and diagnostics stay local', async () => {
  const shell = await readFile(new URL('../src/components/Shell.jsx', import.meta.url), 'utf8');
  const boundary = await readFile(new URL('../src/components/ErrorBoundary.jsx', import.meta.url), 'utf8');
  assert.match(shell, /<ErrorBoundary contained key=/);
  assert.match(shell, /\{renderScreen\(\)\}/);
  assert.match(boundary, /Troubleshooting details/);
  assert.match(boundary, /Return to dashboard/);
});
