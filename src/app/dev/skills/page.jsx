import { notFound } from 'next/navigation';
import SkillsPreview from './SkillsPreview';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default function SkillsPreviewPage() {
  if (process.env.NODE_ENV !== 'development' || process.env.COURTIQ_LOCAL_PREVIEW !== 'true') notFound();
  return <SkillsPreview />;
}
