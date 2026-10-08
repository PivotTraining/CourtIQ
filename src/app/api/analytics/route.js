import { billingBody, trialOrigin, billingJson, billingFailure } from '@/lib/billingRuntime';
import { BillingError } from '@/lib/billingPolicy.mjs';
import { premiumIdentity, premiumDataset } from '@/lib/premiumRuntime';
export const runtime = 'nodejs';
export async function GET() {
  try { return billingJson(await premiumDataset(await premiumIdentity())); }
  catch (error) { return billingFailure(error); }
}
export async function PATCH(request) {
  try {
    trialOrigin(request);
    const identity = await premiumIdentity(), body = await billingBody(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.sessionId || '') || typeof body.confirmed !== 'boolean') throw new BillingError('Invalid game coverage request.');
    // RLS both reads and checks ownership. Player membership cannot attest a managed roster profile.
    const { data: session, error: readError } = await identity.client.from('sessions').select('id,player_id').eq('id',body.sessionId).eq('type','game').eq('tracker_status','completed').maybeSingle();
    if (readError || !session) throw new BillingError('That completed game is unavailable.', 404);
    if (identity.access === 'player') {
      const { data, error } = await identity.client.from('players').select('id').eq('id',session.player_id).eq('firebase_uid',identity.user.id).maybeSingle();
      if (error || !data) throw new BillingError('Coach membership is required for managed roster analysis.', 403);
    }
    const { data, error } = await identity.client.from('sessions').update({ coverage_confirmed: body.confirmed }).eq('id',session.id).eq('player_id',session.player_id).eq('tracker_status','completed').select('id,coverage_confirmed').maybeSingle();
    if (error || !data) throw new BillingError('Coverage confirmation did not save. Please retry.', 503);
    return billingJson(data);
  } catch (error) { return billingFailure(error); }
}
