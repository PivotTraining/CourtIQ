# CourtIQ seven-day card-on-file trial — release checklist

**Status: SUBSCRIPTION CHARGES DISABLED.** This branch safely stages opt-in subscription code. It may be merged only with live billing activation gates disabled; do not enable production billing until all remaining prerequisites pass.

## Completed implementation and production checks — November 22, 2026

- Found and verified the original CourtIQ player's account under signed-in owner RLS: 2 players, 12 sessions and 94 recorded shots; all remain accessible and were not altered.
- Production subscription foundation and paid-trialing migrations installed in dependency order after a successful transactional dry run. Database tables and service-only billing RPC grants verified; **billing policy.enabled=false**, **enforce_access=false**, zero newly created subscriptions. Existing records unaffected.
- Ohio (OH) Stripe Tax registration active. Independent CourtIQ Player and Coach live products and $9 / $79 / $29 / $249 recurring prices are configured. Existing CourtIQ $4.99 recurring product unchanged.
- Dedicated CourtIQ live billing portal allows payment method updates and cancellation at period end; Vercel production portal/price IDs and automatic-tax flag staged.
- Dedicated Stripe webhook **disabled** until launch, with its signing secret stored as an encrypted production-only variable. All other Pivot webhooks are unchanged.
- Patched Next.js and dependency security audit merged to main with zero vulnerabilities; latest CI for this branch passes lint, tests, build, and security audit. An end-to-end real Stripe test-mode checkout, signed event processing, trial expiration, payment failure and cancellation verification is still required.
- Public Terms page updated to describe the seven-day card-on-file trial, automatic renewal, exact prices, taxes, and cancellation instructions. Keep COURTIQ_BILLING_ENABLED=false and COURTIQ_LIVE_BILLING_APPROVED=false until full release checks pass.

## Remaining manual/secure prerequisites

1. Provision a **least-privilege Stripe live secret or restricted key** directly in Vercel production as `STRIPE_SECRET_KEY`. This cannot be retrieved or generated from the connected Stripe tools. Do not paste the secret into any chat or code repository.
2. Provision CourtIQ's Supabase server service-role key directly in Vercel production as `SUPABASE_SERVICE_ROLE_KEY`; never expose it with a NEXT_PUBLIC prefix. The connected Supabase project tools do not expose this secret.
3. Run Stripe **test-mode end-to-end** Checkout using an isolated test account/test products/test webhook secret and test database or safe fixture. Validate signed and duplicate/reordered events, successful charge after day seven, payment failure, and cancellation before conversion.
4. Confirm trial-ending reminder emails and all required customer notices in the Stripe Dashboard: https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance
5. Verify production user authorization, privacy and billing access gating with separate real accounts; independently enable the CourtIQ webhook only after the server endpoint is live with valid keys and test verification.
6. Finally set billing policy and rollout gates only when all remaining checks pass; watch logs and event delivery.



## Approved offer to confirm before launch

| Plan | Free period | Automatic recurring price afterward |
|---|---|---|
| Player monthly | First 7 days | $9/month (USD) |
| Player annual | First 7 days | $79/year (USD) |
| Coach monthly | First 7 days | $29/month (USD) |
| Coach annual | First 7 days | $249/year (USD) |

Card required at new subscription checkout; no subscription charge during seven-day trial. After trial, the selected full amount is automatically billed, plus applicable taxes, unless canceled before the trial ends. Existing user subscriptions must remain unchanged.

**Existing live Stripe product caveat:** the Pivot Stripe account already contains a CourtIQ Pro Tier priced at $4.99/month. Do not repurpose, disable, or migrate its subscribers without verifying its existing obligations. Create distinct CourtIQ Player and CourtIQ Coach products/prices only after the merchant confirms its tax obligations and accepts the four prices above.

## Do not skip these deployment prerequisites

1. **Database**: the currently connected production CourtIQ Supabase project is missing `public.account_trials`, `private.courtiq_billing_policy`, `public.courtiq_billing_accounts`, `public.courtiq_subscriptions`, and `public.get_courtiq_billing()`. The canonical core billing migration requires an earlier roster `public.team_games` table. Reconcile production schema against repository migrations on a safe copy; apply in dependency order and confirm grants, RLS, and plan enforcement against *existing* account data. Do not switch `private.courtiq_billing_policy.enabled` or `enforce_access` on before this.
2. **Stripe catalog**: two dedicated products (Player and Coach), each with two verified recurring `price_` IDs matching the amounts, interval, currency, tax behavior, and same live Stripe account. Keep the older $4.99 product intact.
3. **Tax**: the connected Stripe account has active Stripe Tax settings with exclusive behavior, but as of this check has *no Stripe Tax registrations*. Merchant must confirm jurisdictions where registered and whether to collect sales tax/VAT/GST. Configure automatic tax at checkout only after these decisions; never infer registration from a Georgia address.
4. **Customer portal**: a live portal configuration currently exists and offers `at_period_end` cancellation. Confirm it is appropriate for CourtIQ trial cancellation, does not permit changes to unrelated Pivot products, and provides an accessible way to cancel before day seven.
5. **Stripe webhook**: there is **no CourtIQ-specific live webhook endpoint** currently registered. After deployment, register `https://app.getcourtiq.com/api/billing/webhook` to receive `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, and relevant subscription/invoice events. Keep other Pivot webhook endpoints untouched. Store the unique `whsec_` as a Vercel secret, never in GitHub or the client bundle.
6. **Vercel**: configure the following keys in the **court-iq** production environment only after staging tests and secret management are ready. Values marked secrets must be inserted directly through a secure provider UI/secret store, not pasted into chat:
   - `COURTIQ_BILLING_ENABLED=true`
   - `COURTIQ_BILLING_MODE=live`
   - `COURTIQ_LIVE_BILLING_APPROVED=true` (independent live activation gate)
   - `COURTIQ_TRIAL_ENABLED=false` (disable separate no-card enrollment; previous existing trial rows remain)
   - `COURTIQ_APP_URL=https://app.getcourtiq.com`
   - `COURTIQ_BILLING_TERMS_VERSION=<approved legal terms revision>`
   - `STRIPE_EXPECTED_ACCOUNT_ID=acct_1MYXwyERWdPcDJ1Z`
   - `STRIPE_PLAYER_MONTH_PRICE_ID=<verified live price id>`
   - `STRIPE_PLAYER_YEAR_PRICE_ID=<verified live price id>`
   - `STRIPE_COACH_MONTH_PRICE_ID=<verified live price id>`
   - `STRIPE_COACH_YEAR_PRICE_ID=<verified live price id>`
   - `STRIPE_COURTIQ_PORTAL_CONFIG_ID=<CourtIQ-restricted live configuration id>`
   - `STRIPE_SECRET_KEY=<live server-only Stripe secret>`
   - `STRIPE_COURTIQ_WEBHOOK_SECRET=<CourtIQ-only whsec>`
   - `SUPABASE_SERVICE_ROLE_KEY=<server-only CourtIQ service role secret>`
   - `NEXT_PUBLIC_SUPABASE_URL` should point to the correct production project (already present).
   - Reconciliation, when enabled later, requires `CRON_SECRET`, `COURTIQ_BILLING_RECONCILIATION_ENABLED=true`, and its database policy.
7. **Terms, disclosures, cancellation**: publish approved terms with exact billing rate, first charge timing, recurring cadence, how to cancel before trial expiration, tax behavior, and a clear opt-in consent. Configure compliant reminder messaging before automatic conversion.
8. **End-to-end testing**: before accepting live cards, run real Stripe test-mode checkout and verify signed webhooks and server entitlement transitions: eligible → trialing access → canceled before trial means no charge; trial expires → invoice paid → active; payment failure → no new paid access; cancellation and account deletion guards; duplicate/reordered events; wrong-owner privacy checks; refunds or disputes as applicable.
9. **Supply-chain & deployment**: fix the failing dependency audit without disabling its CI step, revalidate lint/unit/integration tests and production build, then review the final diff and deploy safely. Verify `/api/billing/status`, checkout, portal, webhook and game saving from separate user test accounts. Roll back the site and disable billing flags if any invariants fail. Do not grant premium based on a checkout redirect.

## Current implementation
- `src/lib/billingPolicy.mjs`: fixed 7-day duration, explicit test/live separation, live credential/webhook/origin checks and planned Player/Coach rates.
- `src/lib/billingService.mjs`: first-time verified eligibility checks and Stripe Checkout subscription trial with card collection. Signed provider synchronization for paid access.
- `src/components/billing/BillingScreen.jsx`: price, free period, future recurring charge and cancellation disclosure before accepting checkout consent.
- `supabase/migrations/20261122234500_courtiq_seven_day_trialing_access.sql`: provider-verified `trialing` status counts as time-limited paid access; existing legacy/no-card rules remain unchanged.
- All production activation remains OFF; there are no live checkout URLs or customer charges from this change.
