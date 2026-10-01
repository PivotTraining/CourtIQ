import { notFound } from 'next/navigation';
import TrackerPreview from './TrackerPreview';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function TrackerPreviewPage() {
  // No production auth bypass. A deliberately enabled development server only.
  if (process.env.NODE_ENV !== 'development' || process.env.COURTIQ_LOCAL_PREVIEW !== 'true') notFound();
  return <TrackerPreview />;
}
