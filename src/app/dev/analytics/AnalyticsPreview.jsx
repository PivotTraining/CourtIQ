'use client';
import { useEffect, useState } from 'react';
import { PremiumView } from '@/components/iq/PremiumAnalytics';
import { premiumFixture } from '@/lib/premiumFixtures.mjs';
export default function AnalyticsPreview(){
  const [dark,setDark]=useState(true),[kind,setKind]=useState('complete'),[data,setData]=useState(()=>premiumFixture());
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);},[dark]);
  return <div style={{width:'100%',minHeight:'100dvh',background:'var(--color-bg)',color:'var(--color-text)',padding:'20px'}}><header style={{maxWidth:620,margin:'auto',display:'flex',gap:12,flexWrap:'wrap',paddingBottom:20}}><label>Sample data <select aria-label="Sample data" value={kind} style={{background:'var(--color-card)',color:'var(--color-text)',minHeight:44}} onChange={e=>{setKind(e.target.value);setData(premiumFixture(e.target.value));}}><option value="complete">Full confirmed sample</option><option value="small">Small sample</option><option value="unconfirmed">Unconfirmed coverage</option></select></label><button style={{minHeight:44,padding:12,borderRadius:12,background:'var(--color-muted)',color:'var(--color-text)'}} onClick={()=>setDark(!dark)}>{dark?'Light mode':'Dark mode'}</button></header><main style={{maxWidth:620,margin:'auto'}}><PremiumView key={kind} dataset={data} sample onCoverage={(id,confirmed)=>setData(old=>({...old,sessions:old.sessions.map(session=>session.id===id?{...session,coverage_confirmed:confirmed}:session)}))}/></main></div>;
}
