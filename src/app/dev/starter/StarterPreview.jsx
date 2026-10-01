'use client';
import { useState } from 'react';
import FreeStarter from '@/components/billing/FreeStarter';
export default function StarterPreview() {
  const [used,setUsed]=useState(false),[trial,setTrial]=useState(false);
  const state={mode:'free',workout:used?'used':'available',trialAvailable:true,billing:{access:'read_only',trial:{status:'eligible'}}};
  return <div style={{width:'100%',background:'var(--color-bg)',minHeight:'100dvh'}}><header style={{maxWidth:620,margin:'auto',padding:20}}><button style={{minHeight:44,color:'var(--color-text)',background:'var(--color-muted)',padding:12,borderRadius:12}} onClick={()=>{setUsed(false);setTrial(false);}}>Reset sample</button></header>{trial?<main className="membership-start"><h1>Sample trial started.</h1><p>No card. No automatic charge. This demonstration did not change an account or database.</p><button onClick={()=>setTrial(false)}>Back to sample starter</button></main>:<FreeStarter state={state} sample onClaim={async()=>{if(used)return false;setUsed(true);return true;}} onTrial={()=>setTrial(true)} onRefresh={()=>{}}/>}</div>;
}
