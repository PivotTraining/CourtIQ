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

export default function GameTrackerRecorder({ accountId, sessionId, playerName='', events=[], onBusyChange, storeFactory=STORE }) {
  const videoRef=useRef(null),cameraRef=useRef(null),recorderRef=useRef(null),timerRef=useRef(null);
  const requestRef=useRef(0),cameraTimeoutRef=useRef(null),autoContinueRef=useRef(false),reviewRef=useRef(null),pendingMetaRef=useRef(null);
  const aliveRef=useRef(false),ownerRef=useRef(JSON.stringify([accountId,sessionId]));
  const workingRef=useRef(false),savingRef=useRef(false);
  const storeRef=useRef(null);
  if(!storeRef.current)storeRef.current=storeFactory();
  const onBusyRef=useRef(onBusyChange);
  onBusyRef.current=onBusyChange;
  const [state,setState]=useState('idle'),[seconds,setSeconds]=useState(0),[cameraFace,setCameraFace]=useState('environment');
  const [consent,setConsent]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
  const [saved,setSaved]=useState(null),[clips,setClips]=useState([]),[pending,setPending]=useState(null),[videoUrl,setVideoUrl]=useState('');
  const [visible,setVisible]=useState(false);
  const clearCameraTimeout=useCallback(()=>{
    if(cameraTimeoutRef.current!==null)clearTimeout(cameraTimeoutRef.current);
    cameraTimeoutRef.current=null;
  },[]);

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

  const stopRecording=useCallback((continueRecording=false)=>{
    autoContinueRef.current=continueRecording;
    if(timerRef.current!==null){clearInterval(timerRef.current);timerRef.current=null;}
    const rec=recorderRef.current;
    if(rec?.state==='recording'){
      try{rec.requestData();}catch{}
      try{rec.stop();}catch{}
    }
  },[]);

  const cancelCameraStartup=()=>{
    ++requestRef.current;
    clearCameraTimeout();
    stopCamera();
    if(aliveRef.current){
      setState('idle');setVisible(false);
      markBusy(false);
      setInfo('Camera startup cancelled. Tap Record game to try again.');
    }
  };

  // Let React paint the visible video before asking Safari to play it.
  // Never block camera startup or recording on the play() promise.
  useEffect(()=>{
    if((state!=='preview' && state!=='recording') || !cameraRef.current)return;
    const node=videoRef.current;
    if(!node)return;
    node.muted=true;node.playsInline=true;
    try{
      const promise=node.play();
      if(promise?.catch)promise.catch(()=>{
        if(aliveRef.current)setInfo('Camera connected. Tap the video preview to display the live picture.');
      });
    }catch{
      setInfo('Camera connected. Tap the preview to display the live picture.');
    }
  },[state]);

  useEffect(()=>{
    aliveRef.current=true;
    const owner=ownerRef.current;
    let live=true;
    Promise.all([storeRef.current.get(accountId,sessionId),
      storeRef.current.listSegments(accountId,sessionId)]).then(([legacy,segments])=>{
      if(live&&ownerRef.current===owner){
        const videos=[...(legacy?[legacy]:[]),...segments];
        setClips(videos);setSaved(videos.at(-1)||null);
      }
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
      ++requestRef.current;clearCameraTimeout();
      document.removeEventListener('visibilitychange',handleVisibility);
      stopRecording();
      stopCamera();
      // The parent should not unmount while saving. Still release media
      // rather than leave the hardware camera on after navigation.
    };
  },[accountId,sessionId,stopCamera,stopRecording,clearCameraTimeout]);

  useEffect(()=>{
    if(!saved?.blob){setVideoUrl('');return;}
    const url=URL.createObjectURL(saved.blob);setVideoUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[saved]);

  async function enableCamera(recordNow=false){
    if(!accountId||!sessionId||workingRef.current||recorderRef.current)return;
    if(!consent){setError('Confirm you have permission to record everyone visible first.');return;}
    // Fail immediately without spinning up the iPhone camera if recording is unavailable.
    if(recordNow && !supportedRecordingType(globalThis.MediaRecorder)){
      setError('This browser cannot record live MP4/WebM video. Open CourtIQ in Safari, or use Preview camera and record in your phone Camera app.');
      return;
    }
    const startedAt=performance.now();
    const token=++requestRef.current;
    const owner=ownerRef.current;
    setError('');setInfo('Opening the camera… If prompted, allow camera access.');
    setVisible(true);setState('starting');markBusy(true);
    cameraTimeoutRef.current=setTimeout(()=>{
      if(!aliveRef.current||token!==requestRef.current)return;
      ++requestRef.current;
      stopCamera();markBusy(false);setVisible(false);setState('idle');
      setError('The camera took too long to respond. Try again in Safari, check camera permission, or close another app using your camera.');
    },10000);
    let stream=null;
    try{
      if(!navigator.mediaDevices?.getUserMedia)
        throw new Error('Camera access is unavailable here. Open https://app.getcourtiq.com in Safari or Chrome and allow camera access.');
      // Let mobile Safari choose a supported native camera format immediately.
      // Even ideal width, height and frame-rate negotiation can delay camera startup.
      const constraints={video:{facingMode:{ideal:cameraFace}},audio:false};
      try {
        stream=await navigator.mediaDevices.getUserMedia(constraints);
      }catch(cause){
        // Some iOS camera devices reject advanced constraints despite having a camera.
        if(!['OverconstrainedError','ConstraintNotSatisfiedError','NotFoundError'].includes(cause?.name))throw cause;
        stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      }
      if(!aliveRef.current||token!==requestRef.current||ownerRef.current!==owner){
        stream.getTracks().forEach(track=>track.stop());return;
      }
      cameraRef.current=stream;
      const node=videoRef.current;
      if(!node)throw new Error('Camera preview could not initialize. Close the game camera and try again.');
      node.srcObject=stream;node.muted=true;node.playsInline=true;
      // Trigger inline playback now, during the camera-start interaction, but
      // do not await Safari's play promise. The visible preview effect can retry.
      try{const playing=node.play();playing?.catch?.(()=>{
        if(aliveRef.current)setInfo('Camera connected. Tap the preview if the picture is blank.');
      });}catch{}
      clearCameraTimeout();setState('preview');markBusy(false);
      if(recordNow)startCapture();
      else setInfo('Camera connected in '+((performance.now()-startedAt)/1000).toFixed(1)+'s. The live view should appear above the stat controls.');
    }catch(cause){
      stream?.getTracks().forEach(track=>track.stop());
      if(!aliveRef.current||token!==requestRef.current)return;
      cameraRef.current=null;clearCameraTimeout();
      setVisible(false);setState('idle');setError(explain(cause));markBusy(false);
    }
  }

  function startCapture(){
    if(workingRef.current||recorderRef.current?.state==='recording'||!cameraRef.current)return;
    if(!consent){setError('Filming permission is required before recording.');return;}
    setError('');setInfo('');
    const MediaRecorderCtor=globalThis.MediaRecorder;
    const type=supportedRecordingType(MediaRecorderCtor);
    if(!type){setError('This browser cannot record MP4 or WebM here. Use the phone camera and attach the clip to the finished game report.');return;}
    const collector=createRecordingCollector();
    const recordedAt=new Date().toISOString();
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
        const continueAfterSave=autoContinueRef.current;
        autoContinueRef.current=false;
        if(!aliveRef.current)return;
        setState('saving');savingRef.current=true;
        setInfo('Finishing game clip…');
        let retainedClip=false;
        try{
          const blob=collector.finish(rec.mimeType||type);
          validateClip(blob);
          pendingMetaRef.current={recordedAt,endedAt:new Date().toISOString()};
          setPending(blob); // retained if IndexedDB quota prevents attaching
          retainedClip=true;
          const stored=await storeRef.current.putSegment(accountId,sessionId,blob,pendingMetaRef.current);
          if(!aliveRef.current||ownerRef.current!==JSON.stringify([accountId,sessionId]))return;
          setSaved(stored);setClips(existing=>[...existing,stored]);
          setPending(null);pendingMetaRef.current=null;retainedClip=false;
          setInfo('Game clip saved locally. '+(continueAfterSave?'Starting next clip…':'Review and download a backup.'));
          setError('');
        }catch(cause){
          if(aliveRef.current)setError('Game video could not be stored: '+explain(cause)+' The finished clip is kept in this open tab; download it before leaving.');
        }finally{
          savingRef.current=false;
          if(aliveRef.current){
            setState(retainedClip?'needs-backup':cameraRef.current?'preview':'idle');
            markBusy(retainedClip);
            if(!retainedClip && continueAfterSave && cameraRef.current && !document.hidden){
              startCapture();
            }
          }
        }
      };
      // Recording is bounded to four minutes. Avoid the repeating one-second
      // chunk encoding overhead that can stall iOS while logging game stats.
      rec.start();
      recorderRef.current=rec;
      setSeconds(0);setState('recording');markBusy(true);
      const started=performance.now();
      timerRef.current=setInterval(()=>{
        const elapsed=Math.floor((performance.now()-started)/1000);
        setSeconds(elapsed);
        if(elapsed>=RECORDING_LIMIT_SECONDS){
          setInfo('Four-minute segment complete. Saving clip and automatically continuing when storage succeeds.');
          stopRecording(true);
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
    let attached=false;
    try{
      const record=await storeRef.current.putSegment(accountId,sessionId,pending,pendingMetaRef.current||{});
      attached=true;
      if(!aliveRef.current)return;
      setSaved(record);setClips(existing=>[...existing,record]);setPending(null);pendingMetaRef.current=null;
      setInfo('Recovered and saved game segment locally.');
    }catch(cause){if(aliveRef.current)setError('Local video save failed: '+explain(cause));}
    finally{if(aliveRef.current){
      setState(attached?(cameraRef.current?'preview':'idle'):'needs-backup');
      markBusy(!attached);
    }}
  }

  const download=(blob)=>{
    if(!blob)return;
    try{
      const ext=blob.type==='video/mp4'?'mp4':'webm';
      downloadBlob(blob,'courtiq-game-'+sessionId.slice(0,8)+'-'+new Date().toISOString().slice(0,10)+'.'+ext);
      setInfo('Video download started. Check Files or Downloads to confirm the backup was saved.');
    }catch{setError('Download could not start. Keep this browser tab open and retry.');}
  };

  const reviewEvents=saved?.recordedAt&&saved?.endedAt?
    events.filter(event=>['shot','stat'].includes(event.payload?.kind) &&
      event.payload?.recorded_at>=saved.recordedAt&&
      event.payload?.recorded_at<=saved.endedAt):[];
  async function shareSelectedClip(){
    const blob=saved?.blob;
    if(!blob)return;
    const extension=blob.type==='video/mp4'?'mp4':blob.type==='video/quicktime'?'mov':'webm';
    const name='courtiq-game-'+sessionId.slice(0,8)+'-clip.'+extension;
    try{
      if(typeof File==='undefined' || !navigator.share){
        setInfo('This browser cannot share video files directly. Download the clip and send it privately to the other parent.');
        return;
      }
      const movie=new File([blob],name,{type:blob.type});
      if(navigator.canShare && !navigator.canShare({files:[movie]})){
        setInfo('Your phone cannot share this video file. Download it and send the saved file privately.');
        return;
      }
      await navigator.share({files:[movie],title:'CourtIQ game footage'});
      setInfo('Sharing opened. Confirm the video was received on the other phone. This is not automatic cloud synchronization.');
    }catch(error){
      if(error?.name!=='AbortError')setError('Could not share this video. Download a copy and transfer it privately.');
    }
  }

  const recording=state==='recording';
  const elapsed=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');

  return <section className="game-video-dock" aria-label="Live game recording and video preview">
    <div className="game-video-heading">
      <div><strong>GAME VIDEO</strong><span>{playerName||'Your player'} · {clips.length} saved {clips.length===1?'clip':'clips'}</span></div>
      <span className={recording?'game-video-live':''} role="status">{recording?'● REC '+elapsed:state==='saving'?'Saving clip…':cameraRef.current?'● CAMERA ON':'Camera off'}</span>
    </div>
    <div className="game-video-actions">
      <label className="game-video-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={recording||state==='saving'}/> Filming permission confirmed</label>

      {!cameraRef.current&&!recording&&<button type="button" className="game-record-primary" disabled={!consent||state==='starting'||state==='saving'}
        onClick={()=>enableCamera(true)}>{state==='starting'?'Opening camera…':'● Record game'}</button>}
      {state==='starting'&&<button type="button" onClick={cancelCameraStartup}>Cancel camera startup</button>}

      {cameraRef.current&&!recording&&<button type="button" className="game-record-primary" disabled={state==='saving'||!consent} onClick={startCapture}>● Record game</button>}
      {recording&&<button type="button" className="game-record-stop" onClick={()=>stopRecording(false)}>■ Stop &amp; save clip</button>}
    </div>
    <details className="game-video-extra">
      <summary>Camera options</summary>
      <div className="game-video-actions">
        <label>Lens <select aria-label="Choose camera" value={cameraFace}
          disabled={!!cameraRef.current||recording} onChange={e=>setCameraFace(e.target.value)}>
          <option value="environment">Rear camera</option><option value="user">Front camera</option>
        </select></label>
        {!cameraRef.current&&!recording&&<button type="button" disabled={!consent||state==='starting'||state==='saving'}
          onClick={()=>enableCamera(false)}>Preview camera</button>}
        {cameraRef.current&&!recording&&<button type="button" disabled={state==='saving'}
          onClick={()=>{stopCamera();setVisible(false);}}>Close camera</button>}
      </div>
    </details>
    <div className="game-video-camera" aria-label="What the camera is recording" hidden={!visible && state!=='starting' && !recording}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Live game recording camera preview"
        onClick={()=>{try{videoRef.current?.play()?.catch(()=>setError('Video preview could not play. Try Safari with camera permission enabled.'));}catch{setError('Live preview could not play in this browser.');}}} />
      {state==='starting'&&<p>Connecting to your camera… You can cancel and retry.</p>}
      {recording&&<span className="game-video-counter">● REC {elapsed}</span>}
    </div>
    {clips.length>0&&<details className="game-video-saved"><summary>Review game footage · {clips.length} saved {clips.length===1?'clip':'clips'}</summary>
      <label className="game-video-clip-select">Selected clip
        <select value={saved?.id||''} onChange={event=>setSaved(clips.find(item=>item.id===event.target.value)||null)}>
          {clips.map((clip,index)=><option key={clip.id} value={clip.id}>Clip {index+1} · {new Date(clip.recordedAt||clip.savedAt).toLocaleTimeString()} · {(clip.blob.size/1048576).toFixed(1)} MB</option>)}
        </select>
      </label>
      {videoUrl&&<video ref={reviewRef} src={videoUrl} controls playsInline preload="metadata" aria-label="Saved game clip playback" />}
      {reviewEvents.length>0&&<div className="game-video-events"><strong>Stats recorded during this clip</strong>
        {reviewEvents.map(event=><button type="button" key={event.id} onClick={()=>{
          const node=reviewRef.current;if(!node)return;
          const offset=(Date.parse(event.payload.recorded_at)-Date.parse(saved.recordedAt))/1000;
          if(Number.isFinite(offset))node.currentTime=Math.max(0,offset);
          node.play()?.catch?.(()=>{});
        }}>{event.payload.kind==='shot'?(event.payload.made?'Made':'Missed')+' '+event.payload.zone_id:
          event.payload.key.toUpperCase()+' +'+event.payload.delta} · {new Date(event.payload.recorded_at).toLocaleTimeString()}</button>)}
      </div>}
      <button type="button" onClick={()=>download(saved?.blob)}>Download selected clip backup</button>
      <button type="button" onClick={shareSelectedClip}>Send clip to another parent</button>
    </details>}
    {pending&&<div className="game-video-pending" role="alert"><strong>Video is in this tab only</strong>
      <p>Do not close the tracker until you download this clip or retry saving it.</p>
      <button type="button" onClick={()=>download(pending)}>Download unsaved clip</button>
      <button type="button" onClick={retryStorage} disabled={state==='saving'}>Retry video save</button>
      <button type="button" onClick={()=>{
        if(!window.confirm('Only continue if you saved the downloaded video outside CourtIQ. Remove the unsaved device-only recording from this tab?'))return;
        setPending(null);pendingMetaRef.current=null;setError('');setInfo('Unattached local video discarded after backup acknowledgment.');
        setState(cameraRef.current?'preview':'idle');markBusy(false);
      }}>I backed up my clip. Continue</button>
    </div>}
    {error&&<p className="game-video-error" role="alert">{error}</p>}
    {info&&<p className="game-video-info" role="status">{info}</p>}
    <details className="game-video-info-details">
      <summary>Recording limits &amp; privacy</summary>
      <p className="game-video-note">Video is silent and stored only on this device. Clips are up to four minutes and 100 MB each, with a 250 MB account limit. The next clip starts after the previous clip saves. Download important game film for backup. Footage is not cloud-synced and never automatically changes statistics.</p>
    </details>
  </section>;
}
