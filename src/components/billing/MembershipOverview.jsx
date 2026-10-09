'use client';
import { BILLING_PLANS } from '@/lib/billingPolicy.mjs';
import { FREE_STARTER } from '@/lib/starterPolicy.mjs';
import './membership-overview.css';
const dollars = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);

// A transparent, non-transactional overview while launch gates are closed.
// This does not infer the signed-in account's entitlement or call Stripe.
export default function MembershipOverview() {
  return <section className="membership-overview" aria-label="VIP and membership details">
    <p className="membership-overview-eyebrow">COURTIQ / VIP & MEMBERSHIP</p>
    <h2>Know what you get.</h2>
    <p role="status" className="membership-overview-status">Paid enrollment and trials are not activated here. No payment is collected on this screen. The prices and package details below describe the proposed gated release, not your current account access.</p>
    <div className="membership-overview-grid">
      <article><h3>Free starter</h3><strong className="membership-overview-price">$0</strong><ul>
        <li>Unsaved live shot counter</li><li>{FREE_STARTER.trainingSessions} introductory training session per account</li>
        <li>{FREE_STARTER.savedGames} saved games · {FREE_STARTER.journalEntries} journal entries</li><li>No advanced analytics</li>
      </ul></article>
      <article><h3>10-day trial</h3><strong className="membership-overview-price">No card</strong><ul>
        <li>Starts only when an eligible, verified user chooses it</li><li>No automatic charge or conversion</li><li>One trial per eligible account</li><li>Saved history stays available after expiry; new writes depend on verified access</li>
      </ul></article>
      {Object.entries(BILLING_PLANS).map(([key, plan]) => <article key={key}><h3>{key === 'player' ? 'Player / premium' : 'Coach / owner-managed team'}</h3>
        <strong className="membership-overview-price">{dollars(plan.monthly)}<small>/month</small></strong><p>or {dollars(plan.annual)} billed annually</p><p>{plan.description}</p>
        <p className="membership-overview-note">Proposed USD pricing. Recurring terms, feature activation and final limits require approval.</p>
      </article>)}
    </div>
    <article><h3>What is not included</h3><p>App-wide player rankings, shared coach invitations and cloud video backup are not available. Historical NBA style comparisons are statistical heuristics, not scouting grades or predictions.</p><p>Device video attaches an existing clip to a saved session, with download for backup. It is not in-app full-game recording.</p></article>
    <p className="membership-overview-note">When billing is activated, this same Membership area will show server-verified trial and subscription status, explicit checkout, and billing management. Browsing this overview does not start a trial, create a subscription or change access.</p>
  </section>;
}
