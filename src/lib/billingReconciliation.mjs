import { randomUUID, timingSafeEqual } from 'node:crypto';
import { BillingError } from './billingPolicy.mjs';

export function authorizeReconciliation(request, env = process.env) {
  const secret = env.CRON_SECRET;
  if (typeof secret !== 'string' || secret.length < 32 || secret.length > 256 || /\s/.test(secret))
    throw new BillingError('Scheduled billing recovery is not configured.', 503);
  const expected = Buffer.from(`Bearer ${secret}`), supplied = Buffer.from(request.headers.get('authorization') || '');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    throw new BillingError('Unauthorized.', 401);
  if (env.COURTIQ_BILLING_RECONCILIATION_ENABLED !== 'true')
    throw new BillingError('Scheduled billing recovery is not activated.', 503);
  if (new URL(request.url).search)
    throw new BillingError('Scheduled recovery does not accept account or cursor parameters.');
}

// One server-selected due account per invocation. This is recovery of membership
// snapshots, not a renewal/charge loop and not a replacement for signed webhooks.
export async function reconcileDueAccount({ store, service }) {
  const token = randomUUID();
  const claim = await store.claim(token);
  if (!claim) return { checked: 0, synchronized: 0, retry: 0, review: 0 };
  if (!/^[0-9a-f-]{36}$/i.test(claim.owner_id || '') || !/^cus_/.test(claim.customer_id || ''))
    throw new BillingError('Invalid scheduled billing claim.', 503);
  let result = 'retry';
  try {
    const outcome = await service.reconcile(claim.owner_id);
    // Empty/unsupported provider history is not proof that existing access should
    // be removed. Persist a review marker and leave the subscription untouched.
    result = outcome?.ignored || outcome?.noSubscription ? 'review' : outcome?.received === true ? 'synchronized' : 'retry';
  } catch (error) {
    result = error instanceof BillingError && [409, 422].includes(error.status) ? 'review' : 'retry';
  }
  // Failure to persist the result is a failed job, never a success response. The
  // durable lease expires for recovery; no in-memory lock or silent release.
  await store.finish(claim.owner_id, token, result);
  return { checked: 1, synchronized: Number(result === 'synchronized'), retry: Number(result === 'retry'), review: Number(result === 'review') };
}
