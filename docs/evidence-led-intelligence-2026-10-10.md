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
