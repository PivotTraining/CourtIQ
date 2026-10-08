import { notFound } from 'next/navigation';
import BillingPreview from './BillingPreview';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default function BillingPreviewPage() {
  if (process.env.NODE_ENV !== 'development' || process.env.COURTIQ_LOCAL_PREVIEW !== 'true') notFound();
  return <BillingPreview />;
}
