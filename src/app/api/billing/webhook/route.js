import { billingRuntime, billingJson, billingFailure } from '@/lib/billingRuntime';
import { BillingError } from '@/lib/billingPolicy.mjs';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) throw new BillingError('Signature required.', 400);
    const { stripe, service } = billingRuntime();
    const secret = process.env.STRIPE_COURTIQ_WEBHOOK_SECRET;
    if (!secret) throw new BillingError('Webhook is not configured.', 503);
    const raw = await request.text();
    if (raw.length > 1024 * 1024) throw new BillingError('Event too large.', 413);
    let event;
    try { event = stripe.webhooks.constructEvent(raw, signature, secret); }
    catch { throw new BillingError('Invalid signature.', 400); }
    return billingJson(await service.webhook(event));
  } catch (error) { return billingFailure(error); }
}
