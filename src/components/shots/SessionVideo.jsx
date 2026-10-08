"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createDeviceVideoStore, validateClip, clipKey } from '@/lib/deviceVideo.mjs';
import { downloadBlob } from '@/lib/browserDownload.mjs';
import './report-media.css';

export default function SessionVideo({accountId,sessionId}) {
  // Switching accounts/sessions must unmount the previous clip UI, including its
  // pending save callbacks. Never reuse an alive flag for a different owner.
  return <DeviceSessionVideo key={clipKey(accountId,sessionId)} accountId={accountId} sessionId={sessionId} />;
}

export function DeviceSessionVideo({accountId,sessionId}) {
  const store=useMemo(()=>createDeviceVideoStore(),[]);
  const [record,setRecord]=useState(null),[url,setUrl]=useState(''),[consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
  const alive=useRef(false);
  useEffect(()=>{
    alive.current=true;let current=true;setBusy(true);setRecord(null);setError('');setConsent(false);
    store.get(accountId,sessionId).then(value=>{if(current)setRecord(value);}).catch(err=>{if(current)setError(err.message);}).finally(()=>{if(current)setBusy(false);});
    return()=>{current=false;alive.current=false;};
  },[accountId,sessionId,store]);
  useEffect(()=>{
    if(!record){setUrl('');return;}
    const next=URL.createObjectURL(record.blob);setUrl(next);return()=>URL.revokeObjectURL(next);
  },[record]);
  async function save(event) {
    const file=event.target.files?.[0];event.target.value='';if(!file||!consent||busy)return;
    setBusy(true);setError('');setMessage('');
    try {
      validateClip(file);
      // Probe browser playback before replacing the user's existing local clip.
      const video=document.createElement('video'),probe=URL.createObjectURL(file);
      try {
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('Could not read this video. Try an MP4 or WebM encoded for browser playback.')),10000);
          video.onloadedmetadata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(new Error('This browser cannot play the selected video. Your previous clip was kept.'));};video.preload='metadata';video.src=probe;
        });
      } finally {video.removeAttribute('src');video.load();URL.revokeObjectURL(probe);}
      if(!alive.current)return;
      const saved=await store.put(accountId,sessionId,file);
      if(alive.current){setRecord(saved);setMessage('Saved with this session on this device. Download a backup to keep it.');}
    } catch(err){if(alive.current)setError(err.message || 'Video save failed. Your previous clip was kept.');}
    finally{if(alive.current)setBusy(false);}
  }
  async function remove() {
    if(!window.confirm('Delete the video copy stored on this device? This cannot be undone here. Download a backup first. Your stats and original file will not be deleted.'))return;
    setBusy(true);setError('');
    try{await store.remove(accountId,sessionId);if(alive.current){setRecord(null);setMessage('Device copy deleted. Stats and the original file were not changed.');}}
    catch(err){if(alive.current)setError(err.message);}
    finally{if(alive.current)setBusy(false);}
  }
  const extension=record?.blob.type==='video/webm'?'webm':record?.blob.type==='video/quicktime'?'mov':'mp4';
  return <section className="report-media" aria-label="Session video on this device"><h3>Keep a clip with this session</h3>
    <p className="report-media-note">Device-only · no cloud upload. One MP4, WebM or MOV clip per session, up to 100 MB; 250 MB per account on this device. This is not full-game recording or AI video analysis.</p>
    <p className="report-media-note">Browser storage can be cleared or evicted and is not encrypted by CourtIQ. Avoid shared devices and download a backup. The clip will not appear on another phone or computer.</p>
    <label className="report-checkbox"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>I have permission to store this footage, including people shown.</label>
    <label>{record?'Replace device clip':'Choose a video clip'}<input aria-label="Choose session video" type="file" accept="video/mp4,video/webm,video/quicktime" disabled={!consent||busy} onChange={save}/></label>
    {url&&<><video controls playsInline preload="metadata" src={url} onError={()=>setError('This clip cannot play in this browser. Download it and try another compatible player.')}/><p className="report-media-note">Saved locally · {(record.blob.size/1024/1024).toFixed(1)} MB</p><div className="report-media-controls"><button disabled={busy} onClick={()=>{try{downloadBlob(record.blob,`courtiq-session-video.${extension}`);}catch{setError('Video download did not start. Please try again.');}}}>Download video</button><button disabled={busy} onClick={remove}>Delete device copy</button></div></>}
    {busy&&<p role="status">Checking device video storage…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
