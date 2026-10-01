# Free starter and Performance Lab — October 1, 2026

Local implementation, inactive switches. No push, merge, deployment, live migration,
Stripe object or customer-data access performed for this checkpoint.

## Offer flow

1. Verified signup and profile → free starter, not automatic trial enrollment.
2. Unsaved shot counter, one introductory workout total per account. No new saved
   game, workout result, journal entry or advanced analytics. No time expiry or card.
3. Explicit 10-day no-card trial, once per eligible verified account. No Stripe
   subscription is created by starting either free access or the trial.
4. Explicit paid opt-in after trial expiry. The existing implementation is test-only;
   prices, contracts and live launch are still unapproved.

No new trial is offered while any subscription remains open (including past-due,
paused, unpaid or incomplete), because it may still bill. Free access does not
cancel a subscription. The database also refuses trials with unexpired pending
checkouts and refuses checkout claims during an active trial. Both claims share
the same owner lock, with state/deadlines reread inside that lock. This additive
guard is in `20261001184745_trial_checkout_exclusion.sql`; no history is replaced.

The entry gate refreshes on focus/visibility and at server-issued deadlines, at
most a minute apart while premium access is active. Superseded requests cannot
overwrite newer state. Failed verification hides the premium workspace rather
than granting access. Its existing component tree is retained while hidden, not
discarded on a temporary error. Signing out/changing owners unmounts that tree.
Server and database checks, not the timer or the hidden DOM, authorize writes.

Starting the free workout consumes its allowance. Keep that screen open: closing,
refreshing or ending it does not save progress/results or grant another workout.
Retries with the same request UUID recover a lost claim acknowledgement; they do
not mint a second allowance. This limits app-issued starts, not copying/running
public client-side workout code independently. Multiple-account abuse prevention
is a separate launch requirement; no device fingerprinting has been introduced.

Account metadata retains only the allowance request ID and start time, not a free
game or workout result. Existing sessions, journal and workout history stay readable
through a read-only view with saved-report downloads after expiry. Nothing is
deleted or reassigned. Direct new journal/workout inserts now use the existing
database membership enforcement, in addition to the session/roster guards.

## Premium analytics

- Owner-scoped completed-game dataset using the authenticated, RLS-protected client.
  No service key, supplied owner ID or cross-account customer records.
- Weighted eFG%, estimated TS%, AST/TO, 3PT%, normalized per-36 metrics, shot zones,
  two non-overlapping five-game trend windows and private managed-player comparisons.
- Player membership reads its primary profile; trial, Coach and retained legacy
  access can read their owned profiles. Shared access/invitations are not implied.
- Historical NBA-pattern matching across eight curated 2024–25 regular-season
  references. Published rounded values, fixed six-feature mean scaled absolute
  distance, no AI guess, confidence percentage, full-league ranking or endorsement.
- Matching requires 5 owner-confirmed full games, 100 minutes, 50 FG attempts and
  nonzero AST+REB+STL+BLK. These thresholds/scales are product guardrails, not validated
  statistical confidence. Weak nearest matches are explicitly flagged.
- All historical coverage defaults to unknown. Owner confirmation cannot substitute
  for independent validation and must not be auto-filled to make matches appear.
- Community comparison is NOT implemented or activated. It requires reviewed opt-in,
  sufficiently sized anonymous cohorts, release-resistant aggregates, data quality,
  and youth/guardian protections before launch. No names or fabricated percentiles.

Sources:

- https://www.nba.com/stats/leaders?Season=2024-25&SeasonType=Regular+Season&StatCategory=MIN
- https://www.nba.com/stats/leaders?Season=2024-25&SeasonType=Regular+Season&StatCategory=AST
- https://www.nba.com/stats/help/glossary

Review commercial data/name usage rights before public release. No player photos,
team logos or claims of affiliation are included. This is not scouting, NBA potential,
an ability score, opponent-adjusted impact or a validated predictive model.

## Activation gates

- Inspect current live schema, ownership/RLS, permissions and restorable backup;
  authorized live Supabase access is still required. Do not bypass the prior denial.
- Apply the ordered inactive migration chain in an authorized test environment.
  Run Supabase advisors and two-account RLS/reload/expiry tests there. Local fixtures
  are not proof of live permissions, delivery or a paid customer journey.
- Review an exact grandfather cutoff retaining every existing account. The starter
  policy refuses activation without enforced billing and a non-null cutoff; further
  cutoff changes still require human review. Never backdate it to restrict old users.
- Coordinate private database starter policy and enforcement, server
  `COURTIQ_FREE_STARTER_ENABLED`, browser `NEXT_PUBLIC_COURTIQ_FREE_STARTER_ENABLED`,
  trial policy/server switch, billing visibility and canonical `COURTIQ_APP_URL`.
- Coordinate server/browser premium analytics switches after the coverage column
  exists and authenticated test QA passes. Every new switch defaults to false.
- Finish abuse prevention, accessibility, real signup/expired-history checks,
  cancellation/finance requirements and existing billing release gates.
- Separate human authorization is required to push/release/activate live changes.

Local sample routes `/dev/starter` and `/dev/analytics` use synthetic data and are
development-only with `COURTIQ_LOCAL_PREVIEW=true`. They are 404 in production.
Local QA turns off regenerable webpack disk caching to reduce disk pressure.

## Local checkpoint evidence

- 110 automated tests passed, including the additive migration chain, direct-RPC
  overlap rejection, account isolation, preserved history, and free allowance.
- A persisted local lifecycle exercised free → no-card trial → expiry → checkout
  creation (still no access) → SDK-verified signed event → paid → payment failure →
  reconciliation → cancellation. Provider responses were local doubles, not a real
  Stripe sandbox or a completed hosted Checkout.
- Lint and optimized production build passed. Production sample routes returned
  404 even with the sample flag on; inactive APIs returned private/no-store 503.
- Local sample browser checks passed for shot counting, a workout ending with its
  allowance used, small/unconfirmed analytics safeguards, private comparisons and
  light/dark themes. Mobile and desktop widths had no document horizontal overflow
  or framework error overlay; browser warnings/errors were empty on these routes.
- These are synthetic sample and local database results. Real signup/Google OAuth,
  authenticated deployed permissions, provider delivery, checkout, refunds and
  cancellation are still launch gates, not verified by this checkpoint.
