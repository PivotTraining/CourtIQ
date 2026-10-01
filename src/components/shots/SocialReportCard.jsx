"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { cardPng, socialCardSvg } from '@/lib/socialCard.mjs';
import './report-media.css';

export default function SocialReportCard({report,playerName='',date='',sessionType='game',scope,defaultTitle='Player recap',onClose}) {
  const [format,setFormat]=useState('square'),[includeName,setIncludeName]=useState(false);
  const [png,setPng]=useState(null),[error,setError]=useState(''),[sharing,setSharing]=useState(false);
  const [pngUrl,setPngUrl]=useState('');
  const closeRef=useRef(null);
  const svg=useMemo(()=>socialCardSvg(report,{format,title:includeName?playerName:defaultTitle,date,type:sessionType,scope}),[report,format,includeName,playerName,defaultTitle,date,sessionType,scope]);
  useEffect(()=>{let alive=true;setPng(null);setError('');cardPng(svg).then(blob=>{if(alive)setPng(blob);}).catch(()=>{if(alive)setError('PNG could not generate. Try again in another browser. Your report is unchanged.');});return()=>{alive=false;};},[svg]);
  useEffect(()=>{if(!png){setPngUrl('');return;}const url=URL.createObjectURL(png);setPngUrl(url);return()=>URL.revokeObjectURL(url);},[png]);
  useEffect(()=>{
    const previous=document.activeElement;closeRef.current?.focus();
    const key=event=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('keydown',key);previous?.focus();};
  },[onClose]);
  async function share() {
    if(!png)return;
    setSharing(true);setError('');
    try {
      const file=new File([png],`courtiq-${format}-recap.png`,{type:'image/png'});
      if(!navigator.share||!navigator.canShare?.({files:[file]})){setError('File sharing is unavailable here. Download PNG and post it yourself.');return;}
      await navigator.share({files:[file],title:'CourtIQ recorded stats'});
    } catch(err){if(err.name!=='AbortError')setError('Sharing was not completed. You can still download the card.');}
    finally{setSharing(false);}
  }
  return <div className="report-card-overlay" role="dialog" aria-modal="true" aria-label="Social stats card" onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const controls=[...event.currentTarget.querySelectorAll('button:not([disabled]),input,select,a[href]')];const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}><div className="report-card-panel">
    <div className="report-media-heading"><h3>Make your progress shareable</h3><button ref={closeRef} onClick={onClose}>Close card</button></div>
    <div className="report-media-controls"><label>Card format<select value={format} onChange={event=>setFormat(event.target.value)}><option value="square">Square · 1080 × 1080</option><option value="story">Story · 1080 × 1920</option></select></label>{playerName&&<label className="report-checkbox"><input type="checkbox" checked={includeName} onChange={event=>setIncludeName(event.target.checked)}/>Include name on card</label>}</div>
    <p className="report-media-note">Review before sharing, especially for minors. No video, location, contact details or private notes are included. This does not post automatically.</p>
    {/* Generated locally, with escaped text and no external resources. */}
    <img className={`social-card-preview ${format}`} alt="Preview of CourtIQ recorded stats card" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} width={1080} height={format==='story'?1920:1080}/>{/* eslint-disable-line @next/next/no-img-element */}
    <div className="report-media-controls">{pngUrl?<a href={pngUrl} download={`courtiq-${format}-recap.png`}>Download PNG</a>:<button disabled>Preparing PNG…</button>}<button disabled={!png||sharing} onClick={share}>{sharing?'Sharing…':'Share with an app'}</button></div>
    {error&&<p role="alert">{error}</p>}
  </div></div>;
}
