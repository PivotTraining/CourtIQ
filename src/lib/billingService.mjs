import { randomUUID } from 'node:crypto';
import { BillingError, assertPrice, checkoutChoice, providerUrl, subscriptionSnapshot } from './billingPolicy.mjs';

const id = value => typeof value === 'string' ? value : value?.id;
const supportedEvents = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'invoice.paid', 'invoice.payment_failed',
  'invoice.payment_action_required', 'invoice.voided', 'invoice.marked_uncollectible']);

// Provider and persistence are injected so retries/failures can be tested without credentials.
export function createBillingService({ stripe, store, config }) {
  async function catalog() {
    const account = await stripe.accounts.retrieve();
    if (account.id !== config.account) throw new BillingError('Stripe account mismatch. No billing action was taken.', 503);
    const entries = await Promise.all(Object.entries(config.prices).map(async ([key, priceId]) => {
      const [plan, interval] = key.split(':');
      return [key, assertPrice(await stripe.prices.retrieve(priceId), config, plan, interval)];
    }));
    const prices = Object.fromEntries(entries);
    if (id(prices['player:month'].product) !== id(prices['player:year'].product) ||
        id(prices['coach:month'].product) !== id(prices['coach:year'].product) ||
        id(prices['player:month'].product) === id(prices['coach:month'].product))
      throw new BillingError('Player and Coach must have separate CourtIQ products.', 503);
    const portal = await stripe.billingPortal.configurations.retrieve(config.portal);
    const allowedProducts = new Set(entries.map(([, price]) => id(price.product)));
    const updates = portal.features?.subscription_update;
    if (portal.livemode !== false || !portal.active || !portal.features?.subscription_cancel?.enabled || portal.features.subscription_cancel.mode !== 'at_period_end' ||
        (updates?.enabled && (!Array.isArray(updates.products) || !updates.products.length || updates.products.some(product =>
          !allowedProducts.has(product.product) || !Array.isArray(product.prices) || !product.prices.length || product.prices.some(price => !Object.values(config.prices).includes(price))))))
      throw new BillingError('CourtIQ-only billing management could not be verified.', 503);
    return prices;
  }
  async function checkout(user, body, trial) {
    // A no-card application trial is never converted automatically or extended by Checkout.
    if (trial?.status === 'active') throw new BillingError('Enjoy the rest of your trial. Paid checkout opens after it ends.', 409);
    const choice = checkoutChoice(body, config), prices = await catalog();
    if (prices[`${choice.plan}:${choice.interval}`].unit_amount !== choice.amount)
      throw new BillingError('The price changed. Refresh and confirm it before checkout.', 409);
    const claim = await store.claimCheckout(user.id, choice, config.termsVersion);
    if (claim.claim === 'busy') throw new BillingError('Checkout is being prepared. Please retry in a moment.', 409);
    if (claim.claim === 'open') return { url: providerUrl(claim.checkout_url, 'checkout') };
    try {
      let account = await store.account(user.id);
      if (!account?.customer_id) {
        const customer = await stripe.customers.create({ email: user.email, metadata: { app: 'courtiq' } },
          { idempotencyKey: `courtiq:customer:${user.id}` });
        if (customer.livemode !== false || !/^cus_/.test(customer.id)) throw new BillingError('Test customer could not be verified.', 503);
        await store.bindCustomer(user.id, customer.id);
        account = { customer_id: customer.id };
      }
      const customer = await stripe.customers.retrieve(account.customer_id);
      if (customer.deleted || customer.livemode !== false || customer.metadata?.app !== 'courtiq')
        throw new BillingError('CourtIQ customer could not be verified.', 503);
      const subscriptionData = { billing_mode: { type: 'flexible' } };
      const session = await stripe.checkout.sessions.create({ mode: 'subscription', customer: account.customer_id,
        line_items: [{ price: choice.price, quantity: 1 }], subscription_data: subscriptionData,
        expires_at: Math.floor(Date.parse(claim.expires_at) / 1000),
        integration_identifier: `courtiq-${claim.request_id.replaceAll('-', '').slice(0, 8).replace(/[0-9]/g, digit => String.fromCharCode(97 + Number(digit)))}`,
        success_url: `${config.origin}/billing?checkout=returned`, cancel_url: `${config.origin}/billing?checkout=canceled` },
      { idempotencyKey: `courtiq:checkout:${user.id}:${claim.request_id}` });
      const url = providerUrl(session.url, 'checkout');
      if (session.livemode !== false || id(session.customer) !== account.customer_id) throw new BillingError('Test checkout could not be verified.', 503);
      await store.finishCheckout(user.id, claim.request_id, session.id, url);
      return { url };
    } catch (error) {
      await store.releaseCheckout(user.id, claim.request_id).catch(() => {});
      throw error;
    }
  }
  async function portal(owner) {
    await catalog();
    const account = await store.account(owner);
    if (!account?.customer_id) throw new BillingError('No CourtIQ billing account exists yet.', 404);
    const customer = await stripe.customers.retrieve(account.customer_id);
    if (customer.deleted || customer.livemode !== false || customer.metadata?.app !== 'courtiq') throw new BillingError('CourtIQ customer could not be verified.', 503);
    const session = await stripe.billingPortal.sessions.create({ customer: account.customer_id,
      configuration: config.portal, return_url: `${config.origin}/billing` });
    return { url: providerUrl(session.url, 'portal') };
  }
  async function synchronize(eventId, eventType, customerId, getSubscription) {
    const token = randomUUID();
    const claim = await store.claimEvent(eventId, eventType, token);
    if (claim === 'done') return { received: true, duplicate: true };
    if (claim === 'busy') throw new BillingError('Billing event is already being processed.', 503);
    try {
      const lock = customerId ? await store.beginSync(customerId, token) : 'unknown';
      if (lock === 'unknown') { await store.finishEvent(eventId, token, true); return { received: true, ignored: true }; }
      if (lock === 'busy') throw new BillingError('Billing account is being synchronized.', 503);
      // Read current provider state AFTER the durable per-customer lock. Old events cannot replay an old payload.
      const sub = await getSubscription();
      if (!sub) { await store.finishEvent(eventId, token, true); return { received: true, ignored: true }; }
      const snapshot = subscriptionSnapshot(sub, config);
      if (snapshot.customer_id !== customerId) throw new BillingError('Subscription customer mismatch.', 503);
      await store.applySnapshot(eventId, token, snapshot);
      return { received: true };
    } catch (error) {
      await store.releaseEvent(eventId, token).catch(() => {});
      throw error;
    }
  }
  async function webhook(event) {
    if (event.livemode !== false || (event.account && event.account !== config.account) || !supportedEvents.has(event.type))
      return { received: true, ignored: true };
    const object = event.data?.object;
    let subscriptionId, customerId = id(object?.customer);
    if (event.type.startsWith('customer.subscription.')) subscriptionId = object?.id;
    else if (event.type.startsWith('checkout.session.')) subscriptionId = id(object?.subscription);
    else subscriptionId = id(object?.parent?.subscription_details?.subscription ?? object?.subscription);
    return synchronize(event.id, event.type, customerId, async () => {
      if (!/^sub_/.test(subscriptionId ?? '')) return null;
      await catalog();
      return stripe.subscriptions.retrieve(subscriptionId);
    });
  }
  async function reconcile(owner) {
    await catalog();
    const account = await store.account(owner);
    if (!account?.customer_id) return { received: true, noSubscription: true };
    return synchronize(`reconcile_${randomUUID()}`, 'reconcile', account.customer_id, async () => {
      const customer = await stripe.customers.retrieve(account.customer_id);
      if (customer.id !== account.customer_id || customer.deleted || customer.livemode !== false || customer.metadata?.app !== 'courtiq')
        throw new BillingError('CourtIQ customer needs billing review.', 422);
      const subscriptions = [];
      let cursor;
      for (let page = 0; page < 10; page++) {
        const result = await stripe.subscriptions.list({ customer: account.customer_id, status: 'all', limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
        subscriptions.push(...result.data);
        if (!result.has_more) break;
        if (!result.data.length || page === 9) throw new BillingError('Incomplete billing history; synchronization stopped.', 503);
        cursor = result.data.at(-1).id;
      }
      const ours = subscriptions.filter(sub => sub.items?.data?.some(item => Object.values(config.prices).includes(id(item.price))));
      const open = ours.filter(sub => !['canceled', 'incomplete_expired'].includes(sub.status));
      if (open.length > 1) throw new BillingError('Multiple subscriptions need billing review; no access change was made.', 409);
      const sub = open[0] ?? ours.sort((a, b) => b.created - a.created)[0];
      return sub ? stripe.subscriptions.retrieve(sub.id) : null;
    });
  }
  return { catalog, checkout, portal, webhook, reconcile };
}
