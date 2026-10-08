# Billing recovery and bounded requests — October 5, 2026

Inactive local implementation. Supplements the [October 5 repair checkpoint](launch-readiness-2026-10-05.md).
No Supabase migration was applied, no payment provider was called, no scheduler
was configured, and no production deployment was made.

## What is built

- `/api/jobs/billing-reconciliation`: authenticated server-only GET job. Requires a
  configured random `CRON_SECRET` of at least 32 characters and the explicit
  `COURTIQ_BILLING_RECONCILIATION_ENABLED=true` switch. No caller-supplied account,
  customer, cursor or filter is accepted. Responses are aggregate counts and
  private/no-store, never customer identities, credentials or provider error bodies.
- An additive migration, `20261005140000_billing_reconciliation_queue.sql`, keeps
  `private.courtiq_billing_policy.reconciliation_enabled=false` initially. The
  database's existing billing flag must also be enabled before claiming work.
- Service-role-only claim/finish RPCs select **one** oldest due mapped CourtIQ
  account. Row locks with `SKIP LOCKED` and a five-minute tokenized lease prevent
  overlapping workers from claiming the same account. Expired leases are reclaimable;
  stale or expired completions are refused. Authenticated/anonymous clients have
  no access to these operations or the operational account columns.
- The existing reconciler still acquires the durable per-customer billing lock,
  then reads current provider state rather than old webhook payloads. Added explicit
  rejection of deleted, different-ID, live-mode and non-CourtIQ customers.
- Successful checks become due in six hours; transient failures in five minutes;
  unsupported/ambiguous/missing history is marked `review`, due again in one day.
  Review does not erase or invent membership state. A retry/review job returns 503,
  not a misleading success response. A failed result write leaves the durable
  lease for recovery rather than pretending the operation completed.
- Scheduled provider calls have three-second per-call timeouts with no SDK retry;
  scheduled database calls have five-second per-call timeouts. The route has a
  60-second execution limit. A hard platform termination can still interrupt it;
  the database lease is the recovery mechanism, not proof every run finishes.
- Starter, trial, billing and premium analytics use a shared 15-second same-origin
  request helper. It covers response-body reads, respects caller cancellation,
  clears timers/listeners, rejects redirects/unexpected response shapes and gives
  readable network/timeout messages. Writes are **never retried automatically**:
  an interrupted response may already have saved an action. The user is told to
  refresh verified status before trying again.

This job never creates a charge, subscription, customer, checkout, refund or portal
session. It repairs membership snapshots using provider reads and scoped database
writes. Signed subscription webhooks remain required, not replaced by polling.

## Verification

- Full local suite: **142 tests passed**, including real embedded PostgreSQL
  migration/RLS/lease tests and actual route-handler tests.
- The existing persisted lifecycle now recovers a missed payment-recovery event
  through the actual queue and billing service. It uses a local provider double;
  no Stripe network request or hosted checkout is implied.
- An actual membership component/hook test verifies a stalled request produces
  retry guidance and recovers after an explicit retry.
- Lint, diff whitespace check and isolated optimized production build passed.
- Production-mode runtime rejects the unconfigured job with 503, unsigned billing
  status with 401, inactive billing writes with 503, and sample billing/analytics
  routes with 404. API responses remain private/no-store.
- Rendered local membership preview: expected free/trial/proposed-price boundaries,
  no captured console warnings/errors. Sample data only.
- Production dependency audit: no reported vulnerabilities. The previously recorded
  unpatched development-only advisory is not resolved by this iteration.

## Activation and capacity gates

1. Restore authorized read-only CourtIQ backend access. Inspect current schema,
   role grants and backups before any approved migration application. Verify the
   entire migration chain and two-account isolation in a permitted test environment.
2. Retain isolated test billing. Live-key rejection remains intact. Real provider
   verification or live mode still needs separate authorization and implementation.
   Use a least-privilege restricted provider key; keep job/provider secrets in
   sensitive server configuration, never client variables or committed files.
3. Validate behavior under real concurrent workers, platform terminations, rate
   limits and database connection failures. Confirm customer-lock interaction with
   signed webhooks. Confirm operations can see review/retry state and monitor backlog.
4. Only then select a schedule appropriate to the hosting plan and mapped account
   count. **No `crons` entry was added to `vercel.json`.** One account per invocation
   is intentionally conservative and not a large-scale worker. At one invocation
   per minute, the nominal ceiling is 1,440 checks/day (at most 360 accounts checked
   four times daily before failures/overhead); once-daily scheduling is insufficient
   for a growing customer base. Monitor due backlog and design batching/queues
   before exceeding capacity. Do not promise a six-hour SLA from the due timestamp.
5. Review operational data/event retention. Records use fixed result codes, not
   sensitive exception text. An owner/admin monitoring interface and alerts remain
   unbuilt; 503 alone does not notify an operator or automatically retry on Vercel.

## Still not completed

Trial-ending emails, refunds/disputes, verified finance ingestion/admin views,
community comparisons, collaborative invitations and cloud video remain open.
Pricing and recurring terms require approval. Tax setup/registrations require
review before paid enrollment; automatic tax was not enabled. Latest repairs and
this migration/job are local-only, not online at `app.getcourtiq.com`.

References:

- [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe API-key permissions](https://docs.stripe.com/keys)
- [Vercel job authentication, concurrency and error handling](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
