import { billingIdentity, readBilling, trialOrigin, billingJson, billingFailure } from '@/lib/billingRuntime';
import { BillingError, hasOpenSubscription } from '@/lib/billingPolicy.mjs';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    if (process.env.COURTIQ_TRIAL_ENABLED !== 'true') throw new BillingError('Trials are not activated yet.', 503);
    trialOrigin(request);
    const { client, user } = await billingIdentity();
    if (!user.email_confirmed_at) throw new BillingError('Verify your email before starting your trial.', 403);
    const state = await readBilling(client);
    if (hasOpenSubscription(state.subscription)) throw new BillingError('An existing subscription can still bill. Use membership management instead of starting a new trial.', 409);
    const { data, error } = await client.rpc('start_courtiq_trial');
    if (error) throw new BillingError('A new trial is not available for this account.', 403);
    return billingJson({ trial: data });
  } catch (error) { return billingFailure(error); }
}
