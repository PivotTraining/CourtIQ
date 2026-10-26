"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDeviceVideoStore, validateClip } from '@/lib/deviceVideo.mjs';
import { createRecordingCollector, supportedRecordingType, FORM_IQ_RECORD_MAX_MS } from '@/lib/formIqRecording.mjs';
import { downloadBlob } from '@/lib/browserDownload.mjs';
import './game-tracker-recorder.css';

// A parent/coach films from the same phone that is logging stats. Media is
// device-only, silent, and separate from the authoritative game-stat events.
const STORE = createDeviceVideoStore;
const RECORDING_LIMIT_SECONDS = FORM_IQ_RECORD_MAX_MS / 1000;
const explain = cause => {
  if(cause?.name==='NotAllowedError')return 'Camera permission was denied. Allow camera access in your browser settings.';
  if(cause?.name==='NotFoundError')return 'No camera was found on this device.';
  if(cause?.name==='NotReadableError')return 'Another app is using the camera. Close it and try again.';
  return (cause?.message || 'Unable to start the game camera.').slice(0,200);
};

export default function GameTrackerRecorder({ accountId, sessionId, playerName='', onBusyChange, storeFactory=STORE }) {
  const videoRef=useRef(null),cameraRef=useRef(null),recorderRef=useRef(null),timerRef=useRef(null);
  const aliveRef=useRef(false),ownerRef=useRef(JSON.stringify([accountId,sessionId]));
  const workingRef=useRef(false),savingRef=useRef(false);
  const storeRef=useRef(null);
  if(!storeRef.current)storeRef.current=storeFactory();
  const onBusyRef=useRef(onBusyChange);
  onBusyRef.current=onBusyChange;
  const [state,setState]=useState('idle'),[seconds,setSeconds]=useState(0),[cameraFace,setCameraFace]=useState('environment');
  const [consent,setConsent]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
  const [saved,setSaved]=useState(null),[pending,setPending]=useState(null),[videoUrl,setVideoUrl]=useState('');
  const [visible,setVisible]=useState(false);

  const markBusy=useCallback(value=>{
    workingRef.current=value;
    onBusyRef.current?.(value);
  },[]);

  const stopCamera=useCallback(()=>{
    const stream=cameraRef.current;cameraRef.current=null;
    stream?.getTracks().forEach(track=>track.stop());
    if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
    if(aliveRef.current)setState(previous=>previous==='recording'||previous==='saving'?previous:'idle');
  },[]);

  const stopRecording=useCallback(()=>{
    if(timerRef.current!==null){clearInterval(timerRef.current);timerRef.current=null;}
    const rec=recorderRef.current;
    if(rec?.state==='recording'){
      try{rec.requestData();}catch{}
      try{rec.stop();}catch{}
    }
  },[]);

  useEffect(()=>{
    aliveRef.current=true;
    const owner=ownerRef.current;
    let live=true;
    storeRef.current.get(accountId,sessionId).then(record=>{
      if(live&&ownerRef.current===owner)setSaved(record);
    }).catch(cause=>{
      if(live)setError('Could not check previously saved game video: '+explain(cause));
    });
    const handleVisibility=()=>{
      if(document.hidden && recorderRef.current?.state==='recording'){
        stopRecording();
        if(aliveRef.current)setInfo('Recording stopped when CourtIQ moved to the background. Reopen the app and start the next clip.');
      }
    };
    document.addEventListener('visibilitychange',handleVisibility);
    return ()=>{
      live=false;aliveRef.current=false;
      document.removeEventListener('visibilitychange',handleVisibility);
      stopRecording();
      stopCamera();
      // The parent should not unmount while saving. Still release media
      // rather than leave the hardware camera on after navigation.
    };
  },[accountId,sessionId,stopCamera,stopRecording]);

  useEffect(()=>{
    if(!saved?.blob){setVideoUrl('');return;}
    const url=URL.createObjectURL(saved.blob);setVideoUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[saved]);

  async function enableCamera(recordNow=false){
    if(!accountId||!sessionId||workingRef.current||recorderRef.current)return;
    if(!consent){setError('Confirm you have permission to record everyone visible first.');return;}
    if(recordNow && saved &&
        !window.confirm('This game already has a saved video clip on this device. A new successful recording replaces its device copy. Download the existing video first. Continue?'))return;
    setError('');setInfo('');
    markBusy(true);setState('starting');setVisible(true);
    let stream=null;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('The camera is unavailable. Open the app over HTTPS in Safari or Chrome.');
      stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:cameraFace},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}},
        audio:false,
      });
      if(!aliveRef.current){stream.getTracks().forEach(track=>track.stop());return;}
      cameraRef.current=stream;
      const node=videoRef.current;
      if(!node)throw new Error('The live camera preview could not initialize.');
      node.srcObject=stream;node.muted=true;node.playsInline=true;
      await node.play();
      if(!aliveRef.current){stopCamera();return;}
      setState('preview');
      markBusy(false);
      if(recordNow)startCapture();
      else setInfo('Live camera preview on. Frame the court, then press Record game.');
    }catch(cause){
      stream?.getTracks().forEach(track=>track.stop());
      if(aliveRef.current){setState('idle');setError(explain(cause));markBusy(false);}
    }
  }

  function startCapture(){
    if(workingRef.current||recorderRef.current?.state==='recording'||!cameraRef.current)return;
    if(!consent){setError('Filming permission is required before recording.');return;}
    if(saved&&!window.confirm('Replace the existing device-only game clip after the new recording is safely saved? Download the current clip first.'))return;
    setError('');setInfo('');
    const MediaRecorderCtor=globalThis.MediaRecorder;
    const type=supportedRecordingType(MediaRecorderCtor);
    if(!type){setError('This browser cannot record MP4 or WebM here. Use the phone camera and attach the clip to the finished game report.');return;}
    const collector=createRecordingCollector();
    let rec;
    try{
      rec=new MediaRecorderCtor(cameraRef.current,{mimeType:type,videoBitsPerSecond:900000});
      rec.ondataavailable=event=>{
        if(!collector.push(event.data)){
          setError('Game clip reached the 100 MB device limit. Save this clip and start another.');
          stopRecording();
        }
      };
      rec.onerror=event=>{
        if(aliveRef.current)setError('Camera recording failed: '+explain(event?.error));
        stopRecording();
      };
      rec.onstop=async()=>{
        if(timerRef.current!==null){clearInterval(timerRef.current);timerRef.current=null;}
        recorderRef.current=null;
        if(!aliveRef.current)return;
        setState('saving');savingRef.current=true;
        setInfo('Finishing game recording…');
        try{
          const blob=collector.finish(rec.mimeType||type);
          validateClip(blob);
          setPending(blob); // retained if IndexedDB quota prevents attaching
          const stored=await storeRef.current.put(accountId,sessionId,blob);
          if(!aliveRef.current||ownerRef.current!==JSON.stringify([accountId,sessionId]))return;
          setSaved(stored);setPending(null);
          setInfo('Game clip saved locally with this session. Review it and download a backup. Stats remain separate.');
          setError('');
        }catch(cause){
          if(aliveRef.current)setError('Game video could not be stored: '+explain(cause)+' The finished clip is kept in this open tab; download it before leaving.');
        }finally{
          savingRef.current=false;
          if(aliveRef.current){setState(cameraRef.current?'preview':'idle');markBusy(false);}
        }
      };
      rec.start(1000);
      recorderRef.current=rec;
      setSeconds(0);setState('recording');markBusy(true);
      const started=performance.now();
      timerRef.current=setInterval(()=>{
        const elapsed=Math.floor((performance.now()-started)/1000);
        setSeconds(elapsed);
        if(elapsed>=RECORDING_LIMIT_SECONDS){
          setInfo('Four-minute game clip limit reached. Stop/save completed; press Record game again for the next segment.');
          stopRecording();
        }
      },1000);
    }catch(cause){
      if(rec?.state==='recording')try{rec.stop();}catch{}
      recorderRef.current=null;
      setError(explain(cause));markBusy(false);setState(cameraRef.current?'preview':'idle');
    }
  }

  async function retryStorage(){
    if(!pending||savingRef.current)return;
    markBusy(true);setState('saving');setError('');
    try{
      const record=await storeRef.current.put(accountId,sessionId,pending);
      if(!aliveRef.current)return;
      setSaved(record);setPending(null);
      setInfo('Recovered and saved game video locally.');
    }catch(cause){if(aliveRef.current)setError('Local video save failed: '+explain(cause));}
    finally{if(aliveRef.current){setState(cameraRef.current?'preview':'idle');markBusy(false);}}
  }

  const download=(blob)=>{
    if(!blob)return;
    try{
      const ext=blob.type==='video/mp4'?'mp4':'webm';
      downloadBlob(blob,'courtiq-game-'+sessionId.slice(0,8)+'-'+new Date().toISOString().slice(0,10)+'.'+ext);
      setInfo('Video download started. Check Files or Downloads to confirm the backup was saved.');
    }catch{setError('Download could not start. Keep this browser tab open and retry.');}
  };

  const recording=state==='recording';
  const elapsed=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');

  return <section className="game-video-dock" aria-label="Live game recording and video preview">
    <div className="game-video-heading">
      <div><strong>GAME VIDEO</strong><span>See the court while tracking {playerName||'your player'}.</span></div>
      <span className={recording?'game-video-live':''} role="status">{recording?'● REC '+elapsed:state==='saving'?'Saving clip…':cameraRef.current?'● CAMERA ON':'Camera off'}</span>
    </div>
    <div className="game-video-actions">
      <label className="game-video-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={recording||state==='saving'}/> Filming permission confirmed</label>
      <select aria-label="Choose camera" value={cameraFace} disabled={!!cameraRef.current||recording} onChange={e=>setCameraFace(e.target.value)}>
        <option value="environment">Rear camera</option><option value="user">Front camera</option>
      </select>
      {!cameraRef.current&&!recording&&<button type="button" className="game-record-primary" disabled={!consent||state==='starting'||state==='saving'}
        onClick={()=>enableCamera(true)}>● Record game</button>}
      {!cameraRef.current&&!recording&&<button type="button" disabled={!consent||state==='starting'||state==='saving'} onClick={()=>enableCamera(false)}>Preview camera</button>}
      {cameraRef.current&&!recording&&<button type="button" className="game-record-primary" disabled={state==='saving'||!consent} onClick={startCapture}>● Record game</button>}
      {recording&&<button type="button" className="game-record-stop" onClick={stopRecording}>■ Stop &amp; save clip</button>}
      {cameraRef.current&&!recording&&<button type="button" onClick={()=>{stopCamera();setVisible(false);}} disabled={state==='saving'}>Close camera</button>}
    </div>
    {(visible||state==='starting'||recording)&&<div className="game-video-camera" aria-label="What the camera is recording">
      <video ref={videoRef} autoPlay muted playsInline aria-label="Live game recording camera preview" />
      {state==='starting'&&<p>Opening camera…</p>}
      {recording&&<span className="game-video-counter">● REC {elapsed}</span>}
    </div>}
    {saved?.blob&&<details className="game-video-saved"><summary>Review saved game video · {(saved.blob.size/1048576).toFixed(1)} MB</summary>
      {videoUrl&&<video src={videoUrl} controls playsInline preload="metadata" aria-label="Saved game clip playback" />}
      <button type="button" onClick={()=>download(saved.blob)}>Download saved video backup</button>
    </details>}
    {pending&&<div className="game-video-pending" role="alert"><strong>Video is in this tab only</strong>
      <p>Do not close the tracker until you download this clip or retry saving it.</p>
      <button type="button" onClick={()=>download(pending)}>Download unsaved clip</button>
      <button type="button" onClick={retryStorage} disabled={state==='saving'}>Retry video save</button>
    </div>}
    {error&&<p className="game-video-error" role="alert">{error}</p>}
    {info&&<p className="game-video-info" role="status">{info}</p>}
    <p className="game-video-note">Live video is visible while shot-chart and box-score buttons remain usable. Recording is silent and device-only (4-minute clips, 100 MB each, 250 MB account total). One locally saved clip per game; recording again replaces that copy only after a successful save. Save longer footage externally. Not a cloud recording or automatic stat analysis.</p>
  </section>;
}
