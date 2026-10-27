"use client";
import {useEffect,useRef,useState} from 'react';
import {getSupabase} from '@/lib/supabase';
import {uploadFamilyGameClip,listFamilyGameClips,getFamilyGameClipUrl,removeFamilyGameClip} from '@/lib/cloudGameVideo.mjs';
import './family-cloud-video.css';

// A deliberately optional storage action. The server enforces player-access
// RLS for listing, upload, deletion and every signed video playback URL.
export default function FamilyCloudVideo({playerId=null,sessionId,localClip=null,onBusyChange=()=>{}}) {
  const alive=useRef(false),owner=useRef(JSON.stringify([playerId,sessionId]));
  const [open,setOpen]=useState(false),[consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false),[files,setFiles]=useState([]),[error,setError]=useState('');
  const [message,setMessage]=useState(''),[videoUrl,setVideoUrl]=useState(''),[playingPath,setPlayingPath]=useState('');
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{owner.current=JSON.stringify([playerId,sessionId]);setFiles([]);setOpen(false);setConsent(false);setVideoUrl('');setPlayingPath('');},[playerId,sessionId]);

  async function resolvePlayerId(){
    if(playerId)return playerId;
    const {data,error:reason}=await getSupabase().from('sessions').select('player_id')
      .eq('id',sessionId).single();
    if(reason||!data?.player_id)throw new Error('This game is not available to the signed-in parent.');
    return data.player_id;
  }
  async function list(){
    if(busy)return;
    setBusy(true);setError('');
    try{
      const pid=await resolvePlayerId();
      const result=await listFamilyGameClips({playerId:pid,sessionId});
      if(alive.current){setFiles(result);setMessage(result.length?result.length+' family cloud clips found.':'No shared game footage uploaded yet.');}
    }catch(cause){if(alive.current)setError(cause?.message||'Unable to load family clips.');}
    finally{if(alive.current)setBusy(false);}
  }
  async function upload(){
    if(busy||!consent||!localClip?.blob)return;
    if(!window.confirm('Upload this video to private CourtIQ cloud storage? Invited parent accounts with access to this player can view it. Uploads use your Supabase storage allowance.'))return;
    setBusy(true);onBusyChange(true);setError('');setMessage('');
    try{
      const pid=await resolvePlayerId();
      await uploadFamilyGameClip({playerId:pid,sessionId,blob:localClip.blob});
      const result=await listFamilyGameClips({playerId:pid,sessionId});
      if(alive.current){setFiles(result);setMessage('Video privately backed up for this player. Authorized parent accounts can now open it.');}
    }catch(cause){if(alive.current)setError(cause?.message||'Cloud upload did not complete. Your local clip is still available.');}
    finally{onBusyChange(false);if(alive.current)setBusy(false);}
  }
  async function play(path){
    if(busy)return;
    setBusy(true);setError('');setVideoUrl('');
    try{
      const url=await getFamilyGameClipUrl(path);
      if(alive.current){setPlayingPath(path);setVideoUrl(url);}
    }catch(cause){if(alive.current)setError(cause?.message||'Could not open shared family video.');}
    finally{if(alive.current)setBusy(false);}
  }
  async function remove(path){
    if(busy||!window.confirm('Permanently delete this clip from shared family cloud storage? Other parents will no longer be able to open it. Keep a downloaded backup.'))return;
    setBusy(true);setError('');
    try{
      await removeFamilyGameClip(path);
      if(alive.current){setFiles(list=>list.filter(file=>file.path!==path));setVideoUrl('');setMessage('Shared cloud clip deleted. Device copies remain unchanged.');}
    }catch(cause){if(alive.current)setError(cause?.message||'Cloud clip could not be deleted.');}
    finally{if(alive.current)setBusy(false);}
  }

  return <details className="game-family-cloud" open={open} onToggle={event=>{
    if(event.currentTarget.open===open)return;
    setOpen(event.currentTarget.open);
  }}>
    <summary>Family cloud video <span>Private · optional</span></summary>
    <p>Game clips stay on your phone unless you choose to back them up. Cloud clips can be viewed by your player’s invited parent accounts, and use your Supabase storage allowance. Cloud video is not public.</p>
    {localClip?.blob&&<div className="game-cloud-upload">
      <label><input type="checkbox" checked={consent} disabled={busy} onChange={event=>setConsent(event.target.checked)}/>
        I have permission to upload this footage and share it with this player’s invited parents.</label>
      <button type="button" disabled={busy||!consent} onClick={upload}>
        {busy?'Working…':'Back up selected clip to family cloud'}
      </button>
    </div>}
    <button type="button" disabled={busy} onClick={list}>Refresh family cloud clips</button>
    {files.length>0&&<ul className="game-cloud-list">
      {files.map((item,index)=><li key={item.path}>
        <span>Clip {index+1} · {item.created_at?new Date(item.created_at).toLocaleDateString():item.name}</span>
        <button type="button" disabled={busy} onClick={()=>play(item.path)}>Play</button>
        <button type="button" disabled={busy} onClick={()=>remove(item.path)}>Remove</button>
      </li>)}
    </ul>}
    {videoUrl&&<video key={playingPath} src={videoUrl} controls playsInline preload="metadata"
      aria-label="Private family cloud game video"/>}
    {message&&<p role="status">{message}</p>}
    {error&&<p role="alert" className="game-cloud-error">{error}</p>}
  </details>;
}
