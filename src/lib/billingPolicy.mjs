export const BILLING_PLANS = Object.freeze({
  player: { name: 'Player', monthly: 900, annual: 7900, description: 'Individual tracking, saved history, advanced reports and social cards.' },
  coach: { name: 'Coach · owner-managed team', monthly: 2900, annual: 24900, description: 'Player features plus owner-managed roster games and combined reports. No shared invitations or cloud video.' },
});
export class BillingError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'BillingError'; this.status = status; }
}
export function billingConfig(env = process.env) {
  const enabled = env.COURTIQ_BILLING_ENABLED === 'true';
  if (!enabled) throw new BillingError('Subscriptions are not activated yet. Your records are unchanged.', 503);
  // Live support is deliberately NOT implemented by flipping a single flag.
  if (env.COURTIQ_BILLING_MODE !== 'test' || !/^(rk|sk)_test_/.test(env.STRIPE_SECRET_KEY ?? ''))
    throw new BillingError('A verified Stripe test environment is required.', 503);
  let origin;
  try { origin = new URL(env.COURTIQ_APP_URL); } catch { throw new BillingError('Billing return address is not configured.', 503); }
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password ||
      (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))))
    throw new BillingError('Billing return address is not configured safely.', 503);
  const prices = Object.fromEntries(['player', 'coach'].flatMap(plan => ['month', 'year'].map(interval =>
    [`${plan}:${interval}`, env[`STRIPE_${plan.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`] ?? ''])));
  if (!/^acct_/.test(env.STRIPE_EXPECTED_ACCOUNT_ID ?? '') || !/^bpc_/.test(env.STRIPE_COURTIQ_PORTAL_CONFIG_ID ?? '') ||
      Object.values(prices).some(id => !/^price_/.test(id)) || new Set(Object.values(prices)).size !== 4)
    throw new BillingError('CourtIQ test prices and billing management are not configured.', 503);
  if (!env.COURTIQ_BILLING_TERMS_VERSION) throw new BillingError('Billing terms need review before checkout.', 503);
  return { origin: origin.origin, prices, account: env.STRIPE_EXPECTED_ACCOUNT_ID, termsVersion: env.COURTIQ_BILLING_TERMS_VERSION,
    portal: env.STRIPE_COURTIQ_PORTAL_CONFIG_ID, key: env.STRIPE_SECRET_KEY, mode: 'test' };
}
export function checkoutChoice(body, config) {
  if (!body || Array.isArray(body) || !Object.hasOwn(BILLING_PLANS, body.plan) || !['month', 'year'].includes(body.interval) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId ?? ''))
    throw new BillingError('Choose a plan and billing interval, then try again.');
  if (body.consent !== true || body.termsVersion !== config.termsVersion) throw new BillingError('Review and confirm the recurring billing terms.');
  if (!Number.isSafeInteger(body.amount) || body.amount <= 0 || body.currency !== 'usd') throw new BillingError('Refresh the displayed price before checkout.');
  if (Object.keys(body).some(key => !['plan', 'interval', 'requestId', 'consent', 'termsVersion', 'amount', 'currency'].includes(key)))
    throw new BillingError('Unsupported checkout fields.');
  return { plan: body.plan, interval: body.interval, requestId: body.requestId, price: config.prices[`${body.plan}:${body.interval}`], amount: body.amount };
}
export function assertPrice(price, config, plan, interval) {
  if (!price || price.id !== config.prices[`${plan}:${interval}`] || price.livemode !== false || !price.active ||
      price.type !== 'recurring' || price.currency !== 'usd' || !Number.isSafeInteger(price.unit_amount) || price.unit_amount <= 0 ||
      price.recurring?.interval !== interval || price.recurring.interval_count !== 1 ||
      (price.recurring.usage_type && price.recurring.usage_type !== 'licensed'))
    throw new BillingError('The configured test price could not be verified.', 503);
  return price;
}
const objectId = value => typeof value === 'string' ? value : value?.id;
export function subscriptionSnapshot(subscription, config) {
  if (!subscription || subscription.livemode !== false || subscription.items?.data?.length !== 1 || subscription.items.has_more)
    throw new BillingError('Unsupported subscription.', 422);
  const item = subscription.items.data[0], price = item.price;
  const entry = Object.entries(config.prices).find(([, id]) => id === objectId(price));
  if (!entry || item.quantity !== 1 || typeof price !== 'object' || price.currency !== 'usd' ||
      !Number.isSafeInteger(price.unit_amount) || price.unit_amount <= 0) throw new BillingError('Not a supported CourtIQ subscription.', 422);
  const [plan, interval] = entry[0].split(':');
  if (price.recurring?.interval !== interval || price.recurring.interval_count !== 1 || price.livemode !== false)
    throw new BillingError('Unsupported recurring price.', 422);
  const end = item.current_period_end ?? subscription.current_period_end;
  if (!Number.isSafeInteger(end) || end <= 0 || !/^sub_/.test(subscription.id) || !/^cus_/.test(objectId(subscription.customer) ?? ''))
    throw new BillingError('Incomplete subscription snapshot.', 422);
  const statuses = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'canceled', 'paused'];
  if (!statuses.includes(subscription.status)) throw new BillingError('Unknown subscription status.', 422);
  return { subscription_id: subscription.id, customer_id: objectId(subscription.customer), plan, interval,
    price_id: price.id, currency: price.currency, unit_amount: price.unit_amount, status: subscription.status,
    period_end: new Date(end * 1000).toISOString(), cancel_at_period_end: !!subscription.cancel_at_period_end,
    paused: !!subscription.pause_collection };
}
export function providerUrl(value, surface) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== (surface === 'checkout' ? 'checkout.stripe.com' : 'billing.stripe.com') || url.username || url.password)
    throw new BillingError('Billing redirect could not be verified.', 503);
  return url.href;
}
export function sameOrigin(request, config) {
  if (request.headers.get('origin') !== config.origin) throw new BillingError('Open billing from CourtIQ and try again.', 403);
}
