import { notFound } from 'next/navigation';
import CoachPreview from './CoachPreview';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default function CoachPreviewPage(){
  if(process.env.NODE_ENV!=='development'||process.env.COURTIQ_LOCAL_PREVIEW!=='true')notFound();
  return <CoachPreview />;
}
