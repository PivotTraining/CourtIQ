import test from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionScenario, recurringRevenue } from '../src/lib/subscriptionFinance.mjs';

test('annual subscriptions normalize into MRR and upfront invoices are not profit', () => {
  const scenario = subscriptionScenario({ playerMonthly: 350, playerAnnual: 150, coachMonthly: 35, coachAnnual: 15 });
  assert.equal(scenario.mrrMinor, 546375);
  assert.equal(scenario.arrMinor, 6556500);
  assert.equal(scenario.firstMonthInvoiceSubtotalMinor, 1975000);
  assert.equal(scenario.contributionBeforeUnmodeledCostsMinor, null);
  assert.equal(scenario.assumedMonthlyCostsMinor, null);
  assert.throws(() => subscriptionScenario({ playerMonthly: -1 }), /non-negative/);
  assert.throws(() => subscriptionScenario({ coachAnnual: 1.5 }), /integers/);
});

test('recurring reporting deduplicates, separates currencies and excludes unverified states', () => {
  const base = { subscription_id: 'sub_player', status: 'active', currency: 'usd', recurring_amount_minor: 7900, interval: 'year', interval_count: 1 };
  const records = [base, { ...base, subscription_id: 'sub_coach', recurring_amount_minor: 2900, interval: 'month', cancel_at_period_end: true },
    { ...base, subscription_id: 'sub_trial', status: 'trialing' }, { ...base, subscription_id: 'sub_late', status: 'past_due' },
    { ...base, subscription_id: 'sub_gbp', currency: 'gbp', recurring_amount_minor: 6000 }];
  const totals = recurringRevenue(records);
  assert.equal(totals.usd.activeSubscriptions, 2);
  assert.equal(totals.usd.mrrMinor, 7900 / 12 + 2900);
  assert.equal(totals.usd.endingSubscriptions, 1);
  assert.equal(totals.gbp.mrrMinor, 500);
  assert.throws(() => recurringRevenue([base, base]), /Duplicate/);
  assert.throws(() => recurringRevenue([{ ...base, interval: 'week' }]), /unsupported/);
});
