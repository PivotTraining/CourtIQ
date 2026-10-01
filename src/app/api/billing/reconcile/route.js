import { billingIdentity, billingRuntime, readBilling, billingJson, billingFailure } from '@/lib/billingRuntime';
import { BillingError, sameOrigin } from '@/lib/billingPolicy.mjs';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const { config, service } = billingRuntime(); sameOrigin(request, config);
    const { client, user } = await billingIdentity();
    if (!(await readBilling(client)).enabled) throw new BillingError('Billing synchronization is not activated yet.', 503);
    return billingJson(await service.reconcile(user.id));
  } catch (error) { return billingFailure(error); }
}
