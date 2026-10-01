// Proposed USD prices only. This module cannot charge, grant access or call Stripe.
export const PROPOSED_PRICES = {
  player: { monthly: 900, annual: 7900 },
  coach: { monthly: 2900, annual: 24900 },
};

export function subscriptionScenario({ playerMonthly = 0, playerAnnual = 0, coachMonthly = 0, coachAnnual = 0,
  prices = PROPOSED_PRICES, fixedMonthlyCost = null, playerMonthlyCost = null, coachMonthlyCost = null } = {}) {
  for (const count of [playerMonthly, playerAnnual, coachMonthly, coachAnnual]) {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Subscriber counts must be non-negative integers.');
  }
  for (const tier of ['player', 'coach']) for (const term of ['monthly', 'annual']) {
    if (!Number.isSafeInteger(prices[tier][term]) || prices[tier][term] < 0) throw new Error('Prices must use whole currency minor units.');
  }
  const monthlyBilled = playerMonthly * prices.player.monthly + coachMonthly * prices.coach.monthly;
  const annualBookings = playerAnnual * prices.player.annual + coachAnnual * prices.coach.annual;
  const mrr = monthlyBilled + annualBookings / 12;
  const costsKnown = [fixedMonthlyCost, playerMonthlyCost, coachMonthlyCost].every(value => Number.isFinite(value) && value >= 0);
  const monthlyCosts = costsKnown ? fixedMonthlyCost + (playerMonthly + playerAnnual) * playerMonthlyCost + (coachMonthly + coachAnnual) * coachMonthlyCost : null;
  return { currency: 'USD', subscribers: playerMonthly + playerAnnual + coachMonthly + coachAnnual,
    mrrMinor: mrr, arrMinor: mrr * 12, monthlyInvoiceSubtotalMinor: monthlyBilled,
    annualInvoiceSubtotalMinor: annualBookings,
    firstMonthInvoiceSubtotalMinor: monthlyBilled + annualBookings,
    assumedMonthlyCostsMinor: monthlyCosts,
    contributionBeforeUnmodeledCostsMinor: costsKnown ? mrr - monthlyCosts : null,
  };
}

// Input must come from the future verified, server-side billing sync, not a
// browser checkout redirect. Unknown, trialing and past-due are excluded here.
// recurring_amount_minor is net of recurring discounts, excludes tax/one-offs.
export function recurringRevenue(records) {
  const byCurrency = {};
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.subscription_id)) throw new Error('Duplicate subscription in finance input.');
    seen.add(record.subscription_id);
    if (record.status !== 'active') continue;
    if (!record.subscription_id || !/^[a-z]{3}$/.test(record.currency || '') || !Number.isSafeInteger(record.recurring_amount_minor)
      || record.recurring_amount_minor < 0 || !Number.isInteger(record.interval_count) || record.interval_count < 1
      || !['month', 'year'].includes(record.interval)) throw new Error('Unverified or unsupported billing input.');
    const months = record.interval_count * (record.interval === 'year' ? 12 : 1);
    const bucket = byCurrency[record.currency] ||= { activeSubscriptions: 0, mrrMinor: 0, arrMinor: 0, endingSubscriptions: 0 };
    bucket.activeSubscriptions += 1;
    bucket.mrrMinor += record.recurring_amount_minor / months;
    bucket.arrMinor = bucket.mrrMinor * 12;
    if (record.cancel_at_period_end) bucket.endingSubscriptions += 1;
  }
  return byCurrency;
}
