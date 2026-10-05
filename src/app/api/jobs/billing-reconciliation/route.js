import { billingRuntime, billingJson, billingFailure } from '@/lib/billingRuntime';
import { authorizeReconciliation, reconcileDueAccount } from '@/lib/billingReconciliation.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  try {
    authorizeReconciliation(request);
    const { service, reconciliationStore } = billingRuntime({ scheduled: true });
    const result = await reconcileDueAccount({ service, store: reconciliationStore });
    return billingJson(result, result.retry || result.review ? 503 : 200);
  } catch (error) { return billingFailure(error); }
}
