"use client";
import { useEffect, useMemo, useState } from 'react';
import { CoachWorkspaceView } from '@/components/team/CoachWorkspace';
import { createSampleTeamBackend, SAMPLE_COACH_ACCOUNT } from '@/lib/sampleTeamBackend.mjs';
export default function CoachPreview(){
  const [dark,setDark]=useState(true);const [offline,setOffline]=useState(false);
  const network=useMemo(()=>({current:true}),[]);
  const backend=useMemo(()=>createSampleTeamBackend({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)},network),[network]);
  network.current=!offline;
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);},[dark]);
  return <main style={{width:'100%',padding:'24px 20px 80px',minHeight:'100dvh',background:'var(--color-bg)'}}>
    <p style={{fontSize:12,color:'var(--color-text-sec)',marginBottom:16}}>LOCAL SAMPLE · synthetic roster · no live database or billing calls</p>
    <CoachWorkspaceView accountId={SAMPLE_COACH_ACCOUNT} backend={backend} darkMode={dark} onToggleTheme={()=>setDark(!dark)} />
    <button style={{position:'fixed',right:12,bottom:12,zIndex:300,minHeight:44,padding:12,borderRadius:10,background:'var(--color-card)',color:'var(--color-text)',border:'1px solid var(--color-border)'}} onClick={()=>setOffline(!offline)}>{offline?'Reconnect sample':'Simulate offline'}</button>
  </main>;
}
