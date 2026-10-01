# CourtIQ billing checkpoint — October 1, 2026

Inactive, test-only source implementation. No live Stripe or Supabase changes.
No merge or production release authorized or performed. Prices and no-card terms
are still recommendations awaiting approval.

## Built

- Explicit 10-day no-card trial; starting it creates no Stripe subscription.
- Membership screen inside the existing profile menu (inactive flag), with
  eligibility, deadline, month/year proposals and payment-failure/cancellation state.
- Active-trial checkout blocked: after expiry, the user explicitly accepts paid
  recurring billing. This first version does not schedule an early upgrade.
- Server-verified identity/customer mapping; strict test-key/account/catalog checks;
  dedicated Customer Portal; durable retry-safe hosted Checkout and consent storage.
- Raw-signature webhooks, event leases, current-state reads under customer locks,
  subscription reconciliation and isolated owner-readable subscription rows.
- Database enforcement on new session/roster inserts only, initially disabled.
  Existing record reads/updates/exports are not gated. Device video is not cloud backup.
- Database guard preventing account deletion while a subscription can renew,
  plus a separately gated edge-function preflight before session revocation.

## Local proof — not provider or production proof

The local database fixture applies base schema, ownership, recovery, roster, trial
and billing migrations in order. Tests cover retry IDs, private consent, owner
isolation, blocked browser mutations, expiry/history preservation, paid Player
versus Coach access, failure/pause states, event claims and billing-aware deletion.
Service and actual route-handler tests cover account/price/URL/consent validation,
foreign origins/identities, Stripe SDK raw-signature/tamper checks, unrelated Pivot
customers, duplicates and out-of-order payloads. No real credentials or accounts.

Full local suite: 91 tests pass. Lint and optimized production build pass.
Browser checked the same membership component: explicit sample trial activation
shows ten days without provider actions; annual amounts are billed yearly, not
misrepresented as monthly charges; light/dark modes work. Phone viewport is
390×844; observed CSS client and scroll widths match (375 px with scrollbar).
No framework error overlay or captured browser errors. The local production server
returns 404 for `/dev/billing` even with the preview flag set; unsigned status is
401, inactive Checkout/Portal/trial requests are 503 and an unsigned webhook is
400. API responses are private/no-store. These are rejection checks, not a real
authenticated hosted-payment journey.

## Release gates

1. Approve final no-card offer, USD prices, renewal/cancellation/refund terms,
   roster/seat limits and tax obligations. Published terms are not automatically
   approved for the new subscription product. Pricing is still a proposal.
2. Obtain authorized isolated Stripe test access. The connector currently exposes
   only the live Pivot account; used read-only planning, created no live resources.
   Configure dedicated CourtIQ test products/prices/Portal and customer mappings.
   Do not alter shared Pivot defaults, products or existing webhook destinations.
3. Restore authorized Supabase access; inspect real schema/RLS and restorable
   backup evidence before reviewed inactive migrations. Verify two real accounts.
   Deploy/enable the delete-account billing preflight with its migration before
   subscriptions. Trial/new-user and grandfather cutoffs are server-owned decisions.
4. Exercise real hosted Checkout, signed provider delivery, persisted status,
   reload and independent access checks. Test renewal, failure/recovery, period-end
   cancellation, paused/incomplete states, retries/timeouts and Portal updates.
   Include replacement subscriptions while the older canceled row is unsynced,
   multiple subscriptions, lost customer-binding acknowledgements and unsupported
   provider changes. A signed local fixture is not a Stripe delivery.
5. Finish trial-ending reminders, refund/dispute handling, automatic reconciliation,
   reviewed abuse/eligibility/event-retention policies, authorized finance reports
   from discounts/invoices/payments. List prices are not net MRR or cash collected;
   profit is unavailable without full costs.
6. Verify real phone/auth/signup/recovery/youth privacy journeys. Shared assistant/
   player/parent access, coach assignments and cloud video remain unbuilt; do not
   advertise them as included in the owner-managed offer.
7. Separate approval and reviewed implementation for live mode, products, public
   terms, migrations, flags and production release. Code rejects live keys even
   if someone changes the mode flag.
