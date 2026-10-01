# CourtIQ subscription and recurring-revenue design

Status: pricing proposal and tested financial calculation foundation, not live billing.
Owner-approved receiving business: Pivot (confirmed September 30, 2026).
Stripe connector requires reauthentication. No products, prices, subscriptions,
checkout, payment methods, tax settings, or live entitlements have been activated.

## Suggested starting offer — USD, subject to approval

| Offer | Monthly | Annual | What must be delivered before charging |
| --- | ---: | ---: | --- |
| Player | $9 | $79 | Reliable single-player tracking, complete history, advanced reports, recorded development work |
| Coach — one team | $29 | $249 | Shared game and roster, rapid player selection, verified assistant/player/parent access, coach assignments, team outputs |

Annual discounts: Player 26.9% versus twelve $9 payments; Coach 28.4% versus
twelve $29 payments. These are hypotheses to test, not an approved public offer.
Owner-managed roster games are now built locally (October 1), but verified
assistant/player/parent roles and coach assignments are still unbuilt. Do not
sell the complete Coach offer until its advertised workflow is delivered.
Keep customers' own existing records and a basic export available if they cancel.
Approved trial duration: **10 days for new users** (October 1). The inactive,
server-timed trial foundation is in `20261001151920_ten_day_new_user_trials.sql`.
It starts at explicit trial activation by an eligible verified account, lasts
exactly 240 hours, and is not reset by refresh, device or plan changes. Eligibility
uses a server-owned new-user cutoff; existing users are not silently re-enrolled.
Recommended terms: no card required, no automatic charge, then an explicitly
accepted paid subscription. Card requirements and conversion terms still need
approval before public billing. The current migration starts disabled and does
not grant/revoke feature access; real server-side entitlements are still pending.
One-per-account is not complete abuse prevention: account deletion/recreation and
multiple-account eligibility need a reviewed privacy-preserving policy.
Trial accounts remain excluded from paying MRR/ARR.

Stripe supports free trials with Checkout, including an optional no-payment-
method flow. A future Checkout must use the original server trial deadline,
not create a fresh ten-day period each time someone checks out or changes plans.
Implement signed lifecycle webhooks and clear conversion consent. See
[Stripe Checkout free trials](https://docs.stripe.com/payments/checkout/free-trials).

Official comparison pages reviewed September 30, 2026:

- [HomeCourt pricing](https://www.homecourt.ai/pricing): $7.99/month and $69.99/year; its features and platform differ. CourtIQ must earn a higher price through trustworthy web-based game tracking and development continuity, not unsupported AI claims.
- [Breakthrough Stats](https://www.breakthroughbasketball.com/apps/stats/): listed $19.99 with live team/player tracking and extensive statistics. A subscription therefore needs ongoing value beyond basic scorekeeping.
- [Hudl Assist club basketball](https://www.hudl.com/pricing/assist/basketball): starts at $900/team/season. Its video-breakdown service is not a like-for-like CourtIQ comparison and should not be used to imply equivalent capabilities.

## Financial examples — illustrative scenarios, not traction or forecasts

Assumptions: proposed USD prices, no discounts beyond the annual offer, no tax,
refunds, failed payments, churn, growth or grandfathered plans. All subscribers
in a row remain active at that point in time. Computed by
`src/lib/subscriptionFinance.mjs`, with regression tests.

| Active paying accounts | Billing mix | Normalized MRR | ARR run rate |
| --- | --- | ---: | ---: |
| 100 Players + 10 Coaches | All monthly | $1,190 | $14,280 |
| 500 Players + 50 Coaches | All monthly | $5,950 | $71,400 |
| 350 monthly + 150 annual Players; 35 monthly + 15 annual Coaches | 30% annual by tier | $5,463.75 | $65,565 |
| 1,000 Players + 100 Coaches | All monthly | $11,900 | $142,800 |

In the mixed example, if all annual accounts buy in month one, invoice subtotals
would be $19,750 that month: $4,165 monthly and $15,585 annual. This is neither
cash actually collected nor $19,750 of MRR. Normalized recurring revenue is
$5,463.75/month. ARR is MRR × 12, not a promised twelve-month revenue forecast.

Profit is intentionally unavailable until costs are supplied. Include hosting,
database/storage, email, payment processing and Billing fees, AI usage if any,
support, refunds, acquisition, engineering, labor and applicable tax. A small
infrastructure subtotal is not full profit. The calculator returns unknown
rather than inventing a margin when costs are missing.

## Three operating measures and safeguards

1. **Active subscription MRR and ARR:** verified active recurring amounts, net of
   recurring discounts, excluding tax/one-offs. Divide annual prices by twelve.
   Keep currencies separate. Flag pending cancellations separately. Trialing,
   unpaid, incomplete, canceled and past-due subscriptions are excluded from
   this conservative active-only definition; it may differ from Stripe's default.
   Purpose: determine whether paying demand supports continuing investment.
2. **Cash collected net of refunds:** paid invoice/payment transactions less
   refunds for the reporting period, by currency. Separate processor fees and
   payouts. Invoice creation is not collection and an invoice PDF is not proof of
   payment. Purpose: cash planning, separate from normalized recurring revenue.
3. **Monthly subscriber retention:** beginning-of-month paying accounts that
   remain paying at month end, divided by eligible beginning accounts. Annual
   non-renewals need renewal-cohort reporting, not merely login activity.
   Purpose: decide whether acquisition can scale without hiding cancellations.

Drivers: paid conversion after a completed/saved game; weekly repeat games with
finished reports; recorded workout follow-through. Guardrails: zero accepted
duplicate entries in retry tests; no silent overwrite; no unauthorized cross-
account access; visible save failures. These technical invariants are test
requirements, not claims about live customer incident rates. Establish pilot
baselines before asserting financial or retention targets.

## Mandatory billing integration boundary — still pending

- Reconnect Stripe and verify the exact Pivot account plus isolated sandbox.
- Complete Stripe's integration planner before writing payment integration code.
- Approve currency/prices, card/conversion terms for the approved 10-day trial,
  renewal/cancellation/refund policy, team roster
  and assistant-seat limits. Create separate Player and Coach Products, with
  monthly/annual Prices for each. Preserve existing Pivot products/settings.
- Server-authenticated Checkout Sessions, allowlisted configured Price IDs,
  customer mapping from the verified Auth user. Never trust client customer IDs,
  plan labels or checkout redirects to grant access.
- Signed raw-body webhooks for checkout/subscription/invoice lifecycle; durable
  event deduplication, idempotent processing, retry recovery and reconciliation.
  Derive current entitlements from verified subscription state. Test renewal,
  cancellation, payment failure, late/out-of-order events and repeated checkout.
- Server-authorized Customer Portal for cancellation, payment updates and invoice
  access. Finance/admin views require explicit server-held admin authorization;
  never expose Pivot-wide finances to CourtIQ customers.
- Decide whether cancellation only disables renewal or ends immediately. Explain
  the actual paid-through date. Do not silently delete customer data on expiry.
- Sales-tax obligations require review. Stripe Tax needs applicable registrations
  and setup; do not enable `automatic_tax` blindly. Relevant guidance:
  [Stripe subscription tax](https://docs.stripe.com/billing/taxes/collect-taxes).
- A sandbox pass is not live payment readiness. No real charge or live activation
  without the user approving the offer and release.
