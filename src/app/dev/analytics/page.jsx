import { notFound } from 'next/navigation';
import AnalyticsPreview from './AnalyticsPreview';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default function AnalyticsPreviewPage(){
  if(process.env.NODE_ENV!=='development'||process.env.COURTIQ_LOCAL_PREVIEW!=='true')notFound();
  return <AnalyticsPreview/>;
}
