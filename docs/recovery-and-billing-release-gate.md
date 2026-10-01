# CourtIQ reliability and recurring subscriptions — September 30, 2026

Later checkpoint: [coach-media-and-trials-release-gate.md](coach-media-and-trials-release-gate.md).
The October 1 work adds local owner-managed roster games, social report cards,
device video clips and an inactive 10-day trial foundation. The historical
remaining-work list below describes the September 30 checkpoint, not its new
owner-roster implementation status.

This is a local implementation checkpoint, not a completed public launch. It
supersedes the test-count and browser-permission checkpoint in
`stat-tracker-release-gate.md`. No live database rows, production configuration,
Stripe products, charges, or subscriptions were changed.

## Implemented locally

- Account/player-scoped durable tracker queue before optimistic display; stable
  command IDs, idempotent retry, version conflict stops, resumable active games,
  arbitrary recorded-entry corrections and append-only audit history.
- Non-shot stats persist through the command ledger rather than waiting for End.
  Offensive/defensive rebounds also update total rebounds consistently.
- Game date, opponent, season, competition, location, recorded period/clock and
  actual team result when supplied. Player points never stand in for team scores.
- Independently paginated session and shot history without the former 50-session
  cap; date/season filters and completed-game-only aggregates.
- Recorded workout results: actual reps, skipped drills, elapsed time, checked
  save and retry with the same identifier. These are not coach assignments or
  evidence that training caused improvement.
- Explicit sign-out refuses unsynced work. Auth expiry retains account-scoped
  pending entries for that same account to recover after signing in. Synced
  device recovery clears on logout; confirmed account deletion clears its device
  queue. Device recovery is not encrypted storage; use a trusted device.
- The unsafe multi-request Reset All Stats action is blocked for recovered-game
  mode until a checked atomic reset service is implemented. Nothing was deleted.
- Proposal/calculator for Player and Coach subscriptions, normalized MRR/ARR,
  billing-mix examples and financial definitions in `subscription-financials.md`.
  No checkout, Customer Portal, billing webhooks, finance dashboard or paid-access
  integration has been implemented.

## Verification

- 60 automated tests pass: SQL ownership and command-ledger checks, duplicate
  retries, concurrent-version rejection, cross-account isolation, corrections,
  completion, cascades, full-history pagination, auth-expiry retention, stats,
  reports, workout retries and overlapping-save prevention.
- Lint and production build pass with clearly fake local configuration.
- Production `/dev/tracker` returns HTTP 404 even when the local-preview toggle
  is set. The sample route is both development-only and explicitly opt-in.
- Approved local browser fixture: disconnected non-shot entry, leave/reload,
  restoration and retry, correction of an earlier entry, made field goal and FT,
  final report, real light/dark switching and no horizontal overflow at observed
  320×640 and 1200×833 CSS viewports. Captured viewport screenshots accompany
  this document. No errors/warnings were returned by the sample-tab console.
- Browser fixture writes sample device data only; it is not a live Supabase
  end-to-end pass. Landscape, 200% zoom, real-device, CSV download and live
  authenticated save/reload checks remain release gates.

## Database activation remains blocked

Supabase project access was denied. Do not bypass that denial through a CLI or
dashboard. The new migration is tested in a local Postgres fixture, not applied
to the project. Keep `NEXT_PUBLIC_TRACKER_RECOVERY_ENABLED=false` until all of:

1. Restore authorized project access, inventory legacy `profiles/games/shots`
   and current policies, take a verified restorable backup and check advisors.
2. Review/apply the earlier ownership migration and then
   `20260930202201_reliable_sessions_and_development.sql` in order, with post-
   queries confirming relationships, preserved rows, policies and grants.
3. Test two authenticated accounts, migration rollback/recovery, same-ID retry,
   different-device conflict, FT/box-score persistence, workout save and deletion.
4. Enable recovery only in a controlled non-production environment, repeat the
   real flow, then obtain the public-release decision.

The existing tracker remains the default until this flag is deliberately enabled.
The new reliability behavior must not be advertised as already live.

## Product roadmap still unbuilt

- Shared coach roster/game recording, rapid active-player switching and team
  outputs. The current tracker remains one player per session.
- Verified invitations and assistant-coach/player/parent roles with permissions
  enforced by the database, not just hidden buttons.
- Durable coach assignments, completion review and subsequent-game comparisons.
- Age/guardian onboarding and a verified youth privacy/consent workflow.
- Checked atomic reset for recovered sessions, including workout results.

These are substantive remaining development work, not merely missing credentials.
Do not charge for the proposed Coach offer until its advertised workflow works.

## Billing activation remains blocked

User confirmed the Pivot Stripe business. The connector needs reauthentication;
the exact account and sandbox have not yet been verified. Reconnect, complete
Stripe's implementation planner, approve the offer and build server-authenticated
Checkout, signed/deduplicated webhooks, verified entitlements, Customer Portal
and admin-only financial reporting. Test renewals, cancellations, failed and late
payments and out-of-order/replayed events before any live activation.

Pricing is a proposal: Player $9/month or $79/year; Coach $29/month or $249/year,
USD. Currency, prices, limits, trial, refunds, tax registrations and public terms
remain approval decisions. No existing Pivot billing settings were altered.
