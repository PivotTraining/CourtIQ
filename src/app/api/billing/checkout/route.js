import { billingIdentity, billingRuntime, billingBody, readBilling, billingJson, billingFailure } from '@/lib/billingRuntime';
import { BillingError, sameOrigin } from '@/lib/billingPolicy.mjs';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const { config, service } = billingRuntime(); sameOrigin(request, config);
    const { client, user } = await billingIdentity();
    if (!user.email_confirmed_at) throw new BillingError('Verify your email before choosing a subscription.', 403);
    const state = await readBilling(client);
    if (!state.enabled) throw new BillingError('Subscriptions are not activated yet.', 503);
    const body = await billingBody(request);
    return billingJson(await service.checkout(user, body, state.trial));
  } catch (error) { return billingFailure(error); }
}
