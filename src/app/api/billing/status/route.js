import { billingIdentity, billingStatus, billingJson, billingFailure } from '@/lib/billingRuntime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { const { client } = await billingIdentity(); return billingJson(await billingStatus(client)); }
  catch (error) { return billingFailure(error); }
}
