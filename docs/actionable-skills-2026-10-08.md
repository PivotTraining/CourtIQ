# Actionable Skills Lab — 2026-10-08

## Change

Replaces the text-only Skills catalog with three connected views: Train a skill, Drill library, and My progress. Eight core drills have manually authored three-step diagrams and an optional cycling walkthrough. All 162 existing drills can start a timed practice with self-recorded outcomes, pause/resume, undo, an explicit finish, and an explicit save.

Shooting and finishing record made/missed attempts; other drills record clean/needs-work reps. These are self-recorded practice measurements, not camera analysis, a coach-verified skill rating, competitive-game improvement, or a player ranking. Recording targets do not replace each drill's actual instructions or required makes. Other library drills retain coaching steps without claiming a visual demonstration or video.

Progress reads the existing owner-scoped workout history. Legacy workouts contribute volume without invented accuracy. Comparisons use completed recordings of the same drill and target; partial practices are not compared. The least-recorded category is a practice-balance suggestion, not a weakness diagnosis.

## Safety

- No migration, production setting, membership flag, payment flow, or game-stat change.
- Existing StarterGate and training allowance remain in control of access.
- Save uses the existing workout result query and requires confirmation of both the player and stable result ID. Failed or ambiguous saves retain the same result for an idempotent retry.
- Optional cancellation signals and 15-second timeouts bound history/save requests. Old callers remain compatible.
- Keyed player workspaces and cleanup discard late responses. Read failures report unavailable history rather than pretending data is gone or assigning zero scores.
- The modal has keyboard focus trapping, focus restoration, explicit unsaved-exit confirmation, and reduced-motion styling.
- `/dev/skills` requires development mode AND the explicit local-preview flag. Its sample saves are in memory, never Supabase. Production returns 404 even when the preview flag is set.

## Verification

- Full local test suite: 167 passed, 0 failed.
- Lint: 0 errors; 7 pre-existing warnings.
- Full dependency security audit: 0 vulnerabilities.
- Optimized production build: passed using placeholder backend environment values in an isolated build directory.
- Local production HTTP: `/skills` 200; `/dev/skills` 404, including with the local-preview flag enabled.
- Local PostgreSQL-compatible tests: existing workout schema accepts the new flat, versioned metadata; other-owner and anonymous access are rejected. These are not live-database tests.
- Browser sample flow: shooting step changes update the diagram; 20 made + 10 missed attempts produce 67%, reject attempts past the 30-shot recording target, save to Progress, and show +7 percentage points against the earlier 60% same-target sample.
- Browser sample player switch: prior player's history does not carry across; second player has empty history.
- Library search: “tennis ball” finds one drill; Learn & practice opens its steps and Start practice action. Library initially renders 24 cards with a Show more action.
- Phone-size and desktop layout: no horizontal page overflow. Light and dark practice/progress inspected. Latest bounded browser error scan was empty.

## Release boundary

This document records local evidence only. A Git preview and CI must pass for the exact committed revision before release. No authenticated production save, live two-account isolation flow, or new production release was performed as part of this change. Actual workout persistence must still be exercised in an approved authenticated environment.
