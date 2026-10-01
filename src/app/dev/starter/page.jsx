import { notFound } from 'next/navigation';
import StarterPreview from './StarterPreview';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default function StarterPreviewPage() {
  if (process.env.NODE_ENV !== 'development' || process.env.COURTIQ_LOCAL_PREVIEW !== 'true') notFound();
  return <StarterPreview />;
}
