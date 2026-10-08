import { billingIdentity, billingBody, trialOrigin, billingJson, billingFailure } from '@/lib/billingRuntime';
import { BillingError, hasOpenSubscription } from '@/lib/billingPolicy.mjs';
import { starterState } from '@/lib/starterPolicy.mjs';
export const runtime = 'nodejs';
function enabled() {
  if (process.env.COURTIQ_FREE_STARTER_ENABLED !== 'true') throw new BillingError('Free starter is not activated yet.', 503);
}
export async function GET() {
  try {
    enabled();
    const { client } = await billingIdentity();
    const { data, error } = await client.rpc('get_courtiq_starter');
    if (error) throw new BillingError('Your account access could not load. Please retry.', 503);
    const state = starterState(data);
    return billingJson({ ...state, trialAvailable: process.env.COURTIQ_TRIAL_ENABLED === 'true' && !hasOpenSubscription(state.billing?.subscription) });
  } catch (error) { return billingFailure(error); }
}
export async function POST(request) {
  try {
    enabled(); trialOrigin(request);
    const { client, user } = await billingIdentity();
    if (!user.email_confirmed_at) throw new BillingError('Verify your email before starting your free workout.', 403);
    const body = await billingBody(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.requestId || '')) throw new BillingError('Invalid workout request.');
    const { data, error } = await client.rpc('claim_courtiq_starter', { p_request: body.requestId });
    if (error) throw new BillingError('The free workout is unavailable or already used. Refresh your account status.', 403);
    return billingJson(data);
  } catch (error) { return billingFailure(error); }
}
