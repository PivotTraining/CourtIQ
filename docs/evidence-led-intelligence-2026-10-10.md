# CourtIQ — evidence-led skill intelligence (October 10, 2026)

## Delivered in this branch

- Practice Evidence Lab: group only **complete same-drill, same-target** shooting/finishing assessments, compare last three versus preceding three when both windows exist, display self-recorded numerators/denominators, and produce an evidence-based repeat/reassess next step.
- Experimental beta-binomial outlook for the **next ten comparable attempts**, only after >=3 completed matched sessions and >=60 recorded attempts. Reports expected makes and approximate central 80% predictive range. Weak prior Beta(2,2) prevents absolute 0/100% predictions. This is a **statistical estimate, not trained machine learning, not validated on held-out athletes**.
- Game Shooting Outlook in My IQ: only completed games with owner-confirmed full-game coverage, all known shot outcomes and >=3 games/60 non-free-throw shot attempts. No mixing game and practice attempts. Shot mix and context are material limitations.
- Every non-featured drill gets a *category-level concept animation* clearly labeled as not technique-accurate for that drill; all drills state how self-recorded scoring works. The eight authored guides continue to show drill-specific three-step diagrams.
- A link to FIBA WABC's **public coaching-development library**, clearly labeled external and general. We do not copy, redistribute or imply any license to third-party videos.

## Live safeguards and limits

1. Actual persistence, player ownership, consent and user authentication must be verified on production backend using isolated test accounts before broad rollout.
2. Do not use these outlooks for scouting, scholarships, injury/health predictions, professional prospects, or comparisons between athletes.
3. Historical self-reported performance is not proof of technique quality; statistical correlations do not prove that a drill caused an improvement.
4. All forecasts are suppressed when sample or coverage requirements are not met.
5. Neither camera pose detection nor these estimates are a trained sports-AI predictor. Genuine ML must undergo data provenance review, training/test separation by player and date, calibration, fairness/age-segment reviews and outcome holdout validation.
6. No AI chat provider, video storage, third-party video scraping, subscription or feature flags are enabled by this branch.
7. Future model training and video analysis of minors require consent, minimization, retention and access policies, and independent policy/legal review.

## Next implementation milestones

- **Video and drills**: secure licenses/permissions for a vetted drill-specific video library; map exact clips with attributions to drill IDs. Until then, external reference links are not represented as licensed CourtIQ instruction.
- **Structured assessment schema**: record drill setup, hand, location, distance, defense pressure, source, camera verification status and equipment so repeats are genuinely comparable.
- **AI Coach**: design a *server-authorized* provider integration, explicit parent/guardian consent where required, retrieval from player-owned aggregated stats, deterministic tool-calculated facts, grounded explanations, and low-confidence disclaimers. Never accept client-submitted unverified ratings as trusted model evidence.
- **Real predictions**: train and validate an outcome model on longitudinal athlete records (with held-out-player and forward-in-time tests); measure predictive interval coverage, calibration and error against simple baselines; suppress unsupported forecasts.
- **Skill transfer**: connect practice prescriptions to later comparable game measurements without claiming causation from observational data.
- **Performance Lab activation**: release only after verifying actual migrations, owner-scoped reads and lifecycle gates.

## Verification

Node regression tests are in `tests/practice-intelligence.test.mjs`; existing skills-screen React harness mocks the new evidence view. CI, browser smoke tests on phone/desktop, and signed-in Supabase testing are separate required gates. This document is not evidence that production is deployed.

## AI Coach pilot implementation (same draft PR)

- My IQ shows the opt-in AI Coach panel only when `NEXT_PUBLIC_COURTIQ_AI_COACH_ENABLED=true` and the selected profile reports age 18+.
- The server `POST /api/coach` independently verifies signed-in Supabase Auth identity, confirmed email, selected player ownership through manager_uid and row-level security, adult-profile age, strict configured same-origin POST, explicit per-question opt-in, and bounded question size.
- Only aggregates from 12 or fewer completed, owner-confirmed game sessions and at most 75 saved workout results are included. Journals, profiles, identifiers and raw film are not sent. The user's question IS sent as entered after rejecting common phone/email/link patterns; the UI warns not to type identifying or sensitive details.
- Missing or invalid made/missed records exclude the entire affected game's shooting evidence. Missing box-score stats are null, never assumed zero. Drill comparisons match version, complete reps, drill ID and target.
- The model receives a server-generated system policy and aggregate evidence JSON. The response is rendered as plain React text, not trusted HTML. It is not a validated ML predictor and cannot be assumed fully reliable.
- The AI provider call uses Vercel AI Gateway's documented OpenAI-compatible Chat Completions REST API, with a server-only `AI_GATEWAY_API_KEY` or Vercel `VERCEL_OIDC_TOKEN` and an explicitly configured `AI_GATEWAY_MODEL`. No app-scoped secret is required in source.
- The separate unapplied SQL migration `supabase/migrations/20261010230000_courtiq_ai_coach_quota.sql` creates an atomic per-account UTC-day usage claim, 10 calls/day and 12-second cooldown. No in-memory bypass is permitted. This database migration must be reviewed and applied in the correct verified environment before activation.
- There is no persistent chat history, no messages written to Supabase, no upload, no browser-side gateway key, and no paid enrollment change.
- Feature remains disabled by default. A healthy source build is NOT permission to activate AI calls.

### Mandatory manual release gates
1. Legal/privacy and provider-data-retention review, especially whether a chat provider is permissible for minor-related data. Adult self-reported age does not constitute legal age verification.
2. Back up and audit Supabase policies, then apply/test quota migration on isolated development storage.
3. Confirm with two signed-in real test accounts that another account's player UUID always returns 404, and managed youth profiles (even with older account guardians) always return 403.
4. Test concurrent quota requests, 10/day limit, 12-second cooldown, failed provider requests, and requests without Origin header.
5. Configure an approved AI Gateway model and server-only credentials; set a provider budget, review logs/retention, run a bounded real provider call only after authorized.
6. Browser test on phone and desktop (including dark mode, focus, loading, error and changing between player profiles).
7. Update published privacy and terms before public activation. For youth access, build verifiable guardian consent first.
