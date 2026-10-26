'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FORM_STEPS, JOINT_LINKS, findBallInFrame, freshExtensionDetector,
  makeFormObservation, observedRiseAngle, poseMetrics, referenceState,
  sampleBallColour, trackExtensionPattern,
} from '@/lib/liveShootingAnalytics.mjs';
import {
  createRecordingCollector, supportedRecordingType, FORM_IQ_RECORD_MAX_MS,
  FORM_IQ_RECORD_LIMIT,
} from '@/lib/formIqRecording.mjs';
import './live-shooting.css';

const show = value => Number.isFinite(value) ? value + '°' : '—';
const strip = message => String(message || 'Camera could not start.')
  .replace(/https?:\/\/\S+/g, '[url]').slice(0, 190);
const ink = value => value === 'reference' ? '#44D784' : value === 'review' ? '#FF5D5D' : '#DDE5F5';

function drawOverlay(canvas,points,metric,ball,trail,stage) {
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const width=canvas.width,height=canvas.height;
  ctx.clearRect(0,0,width,height);
  if(points?.length===17){
    const right=stage.hand==='right';
    const reference=referenceState(metric,stage.phase);
    ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(3,width/180);
    for(const [a,b] of JOINT_LINKS){
      const p=points[a],q=points[b];
      if(!p||!q||p.score<.35||q.score<.35)continue;
      const shootingArm=(right && (a===6&&b===8 || a===8&&b===10))||
                        (!right && (a===5&&b===7 || a===7&&b===9));
      const shootingLeg=(right && (a===12&&b===14 || a===14&&b===16))||
                        (!right && (a===11&&b===13 || a===13&&b===15));
      ctx.strokeStyle=shootingArm?ink(reference.elbow):shootingLeg?ink(reference.knee):'#7ED4FF';
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    }
    for(const point of points){
      if(!point||point.score<.35)continue;
      ctx.beginPath();ctx.fillStyle='#FFFFFF';ctx.arc(point.x,point.y,Math.max(3,width/220),0,Math.PI*2);ctx.fill();
    }
    const elbowPoint=points[right?8:7],kneePoint=points[right?14:13];
    ctx.font='bold '+Math.max(13,Math.round(width/40))+'px system-ui';
    for(const [p,value,state] of [[elbowPoint,metric.elbow,reference.elbow],[kneePoint,metric.knee,reference.knee]]){
      if(!p||p.score<.35||value===null)continue;
      ctx.fillStyle='rgba(8,12,20,.85)';ctx.fillRect(p.x+8,p.y-25,58,23);
      ctx.fillStyle=ink(state);ctx.fillText(show(value),p.x+12,p.y-8);
    }
  }
  if(trail?.length>1){
    ctx.strokeStyle='#9DFF56';ctx.lineWidth=Math.max(2,width/230);
    ctx.setLineDash([7,5]);ctx.beginPath();
    trail.forEach((p,i)=>i?ctx.lineTo(p.x*width/320,p.y*height/240):
      ctx.moveTo(p.x*width/320,p.y*height/240));
    ctx.stroke();ctx.setLineDash([]);
  }
  if(ball){
    const x=ball.x*width/320,y=ball.y*height/240;
    ctx.strokeStyle='#B3FF59';ctx.lineWidth=3;ctx.beginPath();
    ctx.arc(x,y,Math.max(9,width/75),0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-18,y);ctx.lineTo(x+18,y);ctx.moveTo(x,y-18);ctx.lineTo(x,y+18);ctx.stroke();
  }
}

export default function LiveShootingAnalyzer({ onObservation, onClipReady, onRecordingChange, disabled=false, remaining=30 }) {
  const videoRef=useRef(null),overlayRef=useRef(null),frameRef=useRef(null);
  const detectorRef=useRef(null),streamRef=useRef(null),rafRef=useRef(null);
  const recorderRef=useRef(null),recordCanvasRef=useRef(null),recordLimitRef=useRef(null),compositorRef=useRef(null);
  const generation=useRef(0),observationRef=useRef(null),ballColour=useRef(null);
  const extensionRef=useRef(freshExtensionDetector()),onObservationRef=useRef(onObservation);
  onObservationRef.current=onObservation;
  const remainingRef=useRef(remaining),autoRef=useRef(false);
  const clipReadyRef=useRef(onClipReady),recordingChangedRef=useRef(onRecordingChange);
  clipReadyRef.current=onClipReady;recordingChangedRef.current=onRecordingChange;
  remainingRef.current=remaining;
  const disabledRef=useRef(disabled);disabledRef.current=disabled;
  const ballPosition=useRef(null),trailRef=useRef([]),lastTime=useRef(0),lastBallAt=useRef(0),lastRiseAt=useRef(0);
  const [status,setStatus]=useState('idle'),[error,setError]=useState('');
  const [hand,setHand]=useState('right'),[metric,setMetric]=useState(null);
  const [rise,setRise]=useState(null),[ballPick,setBallPick]=useState(false);
  const [ballStatus,setBallStatus]=useState('not-calibrated'),[observations,setObservations]=useState(0);
  const [message,setMessage]=useState('');
  const [autoCapture,setAutoCapture]=useState(false),[facing,setFacing]=useState('environment');
  const [recording,setRecording]=useState(false),[recordConsent,setRecordConsent]=useState(false);
  const [recordSeconds,setRecordSeconds]=useState(0),[recordNote,setRecordNote]=useState('');
  const [lastCapture,setLastCapture]=useState(null);autoRef.current=autoCapture;
  const handRef=useRef(hand);handRef.current=hand;
  const statusRef=useRef(status);statusRef.current=status;

  const stopRecording=useCallback(()=>{
    const item=recorderRef.current;
    if(!item || item.recorder.state==='inactive')return;
    try{item.recorder.stop();}catch{}
  },[]);
  const release=useCallback((reset=true)=>{
    stopRecording();
    ++generation.current;
    extensionRef.current=freshExtensionDetector();
    if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
    if(compositorRef.current!==null)cancelAnimationFrame(compositorRef.current);
    rafRef.current=null;compositorRef.current=null;
    const stream=streamRef.current;streamRef.current=null;
    stream?.getTracks().forEach(track=>track.stop());
    const model=detectorRef.current;detectorRef.current=null;
    try{model?.dispose?.();}catch{}
    if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
    const canvas=overlayRef.current;
    if(canvas)canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
    setRecordConsent(false);
    if(reset){setStatus('idle');setBallPick(false);setMessage('Live camera stopped. Nothing was uploaded.');}
  },[stopRecording]);
  useEffect(()=>()=>release(false),[release]);
  useEffect(()=>{if(disabled && streamRef.current)release();},[disabled,release]);
  useEffect(()=>{
    const hide=()=>{if(document.hidden && streamRef.current)release();};
    document.addEventListener('visibilitychange',hide);
    return ()=>document.removeEventListener('visibilitychange',hide);
  },[release]);

  const start=async()=>{
    if(disabled||statusRef.current==='starting'||statusRef.current==='active')return;
    release(false);
    const id=++generation.current;
    setStatus('starting');setError('');setMessage('Requesting camera and preparing pose tracking…');
    observationRef.current=null;ballColour.current=null;ballPosition.current=null;
    trailRef.current=[];lastBallAt.current=0;lastRiseAt.current=0;setRise(null);setBallStatus('not-calibrated');
    extensionRef.current=freshExtensionDetector();
    setMetric(null);
    let stream;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('This browser does not expose camera access.');
      stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:facing},width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:30}},
        audio:false,
      });
      if(id!==generation.current){stream.getTracks().forEach(t=>t.stop());return;}
      streamRef.current=stream;
      const video=videoRef.current;if(!video)throw new Error('Video view is not available.');
      video.srcObject=stream;video.muted=true;video.playsInline=true;
      await video.play();
      if(id!==generation.current)return;
      const tf=await import('@tensorflow/tfjs');
      await import('@tensorflow/tfjs-backend-webgl');
      const pose=await import('@tensorflow-models/pose-detection');
      try{await tf.setBackend('webgl');await tf.ready();}
      catch{await tf.setBackend('cpu');await tf.ready();}
      const model=await pose.createDetector(pose.SupportedModels.MoveNet,{
        modelType:pose.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing:true,
      });
      if(id!==generation.current){model.dispose?.();return;}
      detectorRef.current=model;
      const overlay=overlayRef.current;
      if(overlay){overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;}
      const frame=document.createElement('canvas');frame.width=320;frame.height=240;frameRef.current=frame;
      setStatus('active');setMessage('Pose tracking runs on this device. Tap Calibrate ball to trace visible ball movement.');
      lastTime.current=0;
      // Composite real camera frames independently from TensorFlow inference.
      // If the pose model is slow or a frame estimate fails, the video must keep moving.
      let lastComposite=0;
      const compositeFrame=(timestamp)=>{
        if(id!==generation.current)return;
        const active=recorderRef.current?.recorder?.state==='recording';
        if(active && video.readyState>=2 && !document.hidden && timestamp-lastComposite>=80){
          lastComposite=timestamp;
          try{
            const canvas=recordCanvasRef.current,context=canvas?.getContext('2d');
            if(!canvas || !context)throw new Error('Camera compositor unavailable');
            context.drawImage(video,0,0,canvas.width,canvas.height);
            if(overlay)context.drawImage(overlay,0,0,canvas.width,canvas.height);
          }catch{
            setError('Annotated video rendering stopped. Your previous frames are retained; download a backup if a clip is created.');
            stopRecording();
          }
        }
        if(id===generation.current)compositorRef.current=requestAnimationFrame(compositeFrame);
      };
      compositorRef.current=requestAnimationFrame(compositeFrame);
      const tick=async(time)=>{
        if(id!==generation.current)return;
        if(time-lastTime.current<110){rafRef.current=requestAnimationFrame(tick);return;}
        lastTime.current=time;
        try{
          if(video.readyState>=2 && !document.hidden){
            const found=await model.estimatePoses(video);
            if(id!==generation.current)return;
            const points=found[0]?.keypoints||null;
            const data=poseMetrics(points,handRef.current);
            observationRef.current=data;
            setMetric(data);
            const event=trackExtensionPattern(extensionRef.current,data,time);
            extensionRef.current=event.state;
            if(event.capture && autoRef.current && !disabledRef.current && remainingRef.current>0){
              try{
                const record={ ...makeFormObservation(data,null), trigger:'extension-pattern-v1' };
                onObservationRef.current?.(record);
                remainingRef.current-=1;
                setObservations(old=>old+1);
                setLastCapture({type:'Possible release-like extension',at:record.at});
              }catch{setAutoCapture(false);autoRef.current=false;setError('Automatic capture stopped. Review the draft and use manual capture.');}
            }
            const surface=frame.getContext('2d',{willReadFrequently:true});
            let ball=null,trail=trailRef.current;
            if(surface&&ballColour.current){
              surface.drawImage(video,0,0,320,240);
              const pixels=surface.getImageData(0,0,320,240);
              const old=ballPosition.current;
              const guess=findBallInFrame(pixels,old,ballColour.current,old?58:44);
              if(guess){
                ball={x:guess.x,y:guess.y};
                ballPosition.current=ball;lastBallAt.current=time;
                const previous=trail.at(-1);
                if(!previous||Math.hypot(previous.x-ball.x,previous.y-ball.y)>2){
                  trail=[...trail,{...ball,time}].filter(p=>time-p.time<2600).slice(-32);
                  trailRef.current=trail;
                }
                const angle=observedRiseAngle(trail);
                if(angle!==null){setRise(angle);lastRiseAt.current=time;}
                else if(time-lastRiseAt.current>3000)setRise(null);
                setBallStatus('tracking');
              }else{
                setBallStatus('lost');
                if(time-lastBallAt.current>1000){setRise(null);trailRef.current=[];}
              }
            }
            const stage={hand:handRef.current,phase:data.phase};
            drawOverlay(overlay,points,data,ball,trail,stage);
            // The independently scheduled compositor keeps the recorded video live
            // even if pose estimation stalls or briefly loses landmarks.
          }
        }catch(cause){
          if(id===generation.current){setError('Frame analysis paused: '+strip(cause?.message));}
        }
        if(id===generation.current)rafRef.current=requestAnimationFrame(tick);
      };
      rafRef.current=requestAnimationFrame(tick);
    }catch(cause){
      if(id!==generation.current){stream?.getTracks().forEach(t=>t.stop());return;}
      release(false);setStatus('error');
      const message=cause?.name==='NotAllowedError'?'Camera access was denied. Allow camera permission in Safari and try again.':
        cause?.name==='NotFoundError'?'No usable camera was found.':strip(cause?.message);
      setError(message);
    }
  };
  const beginRecording=()=>{
    if(disabled || statusRef.current!=='active'||!recordConsent||recorderRef.current)return;
    try{
      const Recording=globalThis.MediaRecorder;
      const mime=supportedRecordingType(Recording);
      if(!mime || !HTMLCanvasElement.prototype.captureStream){
        throw new Error('This browser cannot record annotated video. Use the built-in Camera app, then attach the clip after saving the workout.');
      }
      const source=videoRef.current,overlay=overlayRef.current;
      if(!source?.videoWidth||!overlay)throw new Error('Camera frames are not ready. Try again.');
      const canvas=document.createElement('canvas');
      canvas.width=overlay.width;canvas.height=overlay.height;
      const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Video composition is unavailable.');
      ctx.drawImage(source,0,0,canvas.width,canvas.height);
      ctx.drawImage(overlay,0,0,canvas.width,canvas.height);
      const stream=canvas.captureStream(12);
      const recorder=new Recording(stream,{mimeType:mime,videoBitsPerSecond:1500000});
      const collector=createRecordingCollector();
      const item={recorder,stream,collector,startedAt:performance.now(),mime,stopped:false};
      recorderRef.current=item;
      recordCanvasRef.current=canvas;
      const finish=()=>{
        if(item.stopped)return;item.stopped=true;
        if(recordLimitRef.current!==null)clearInterval(recordLimitRef.current);
        recordLimitRef.current=null;
        stream.getTracks().forEach(track=>track.stop());
        if(recorderRef.current===item){recorderRef.current=null;recordCanvasRef.current=null;}
        setRecording(false);recordingChangedRef.current?.(false);
        try{
          const blob=collector.finish(recorder.mimeType||mime);
          if(blob.size>FORM_IQ_RECORD_LIMIT)throw new Error('Clip exceeded the 100 MB local limit.');
          clipReadyRef.current?.(blob);
          setRecordNote('Annotated clip ready. Save the workout to attach it to this session. Download a backup after saving.');
          setError('');
        }catch(cause){setError(strip(cause?.message));}
      };
      recorder.ondataavailable=event=>{
        if(!collector.push(event.data)){
          setRecordNote('Recording reached the 100 MB size limit.');
          stopRecording();
        }
      };
      recorder.onerror=event=>{
        setError('Video recording failed. '+strip(event?.error?.message));
        stopRecording();
      };
      recorder.onstop=finish;
      recorder.start(1000);
      setRecording(true);recordingChangedRef.current?.(true);
      setRecordSeconds(0);setRecordNote('Recording annotated video locally. No microphone or cloud transfer.');
      recordLimitRef.current=setInterval(()=>{
        const seconds=Math.max(0,Math.floor((performance.now()-item.startedAt)/1000));
        setRecordSeconds(seconds);
        if(seconds*1000>=FORM_IQ_RECORD_MAX_MS)stopRecording();
      },1000);
    }catch(cause){
      setError(strip(cause?.message));
      const item=recorderRef.current;
      if(item){try{item.recorder.stop();}catch{}item.stream.getTracks().forEach(track=>track.stop());}
      recorderRef.current=null;recordCanvasRef.current=null;
      setRecording(false);recordingChangedRef.current?.(false);
    }
  };
  const calibrate=event=>{
    if(statusRef.current!=='active'||!frameRef.current||!videoRef.current)return;
    const frame=frameRef.current,ctx=frame.getContext('2d',{willReadFrequently:true});
    if(!ctx)return;
    ctx.drawImage(videoRef.current,0,0,320,240);
    const box=event.currentTarget.getBoundingClientRect();
    if(!box.width||!box.height)return;
    const x=Math.min(319,Math.max(0,Math.floor((event.clientX-box.left)*320/box.width)));
    const y=Math.min(239,Math.max(0,Math.floor((event.clientY-box.top)*240/box.height)));
    const colour=sampleBallColour(ctx.getImageData(0,0,320,240),x,y);
    if(!colour){setError('Tap directly on the orange basketball in clear light. Try a side view.');return;}
    ballColour.current=colour;ballPosition.current={x,y};trailRef.current=[];
    setRise(null);lastRiseAt.current=0;lastBallAt.current=0;setBallPick(false);setBallStatus('calibrated');
    setError('');setMessage('Ball colour sampled. CourtIQ is tracing screen-space movement; it cannot verify shot makes.');
  };
  const snapshot=()=>{
    try{
      if(disabledRef.current || remainingRef.current<=0)throw new Error('This draft has reached its 30-observation limit.');
      const item={...makeFormObservation(observationRef.current,rise),trigger:'manual'};
      onObservationRef.current?.(item);
      remainingRef.current-=1;
      setObservations(old=>old+1);
      setLastCapture({type:'Manual form frame',at:item.at});
      setMessage('Form angles captured in this draft. Save the machine workout to add them to history.');
      setError('');
    }catch(cause){setError(strip(cause?.message));}
  };
  const refs=referenceState(metric,metric?.phase);
  return <section className="formiq" aria-label="Live shooting form analyzer">
    <div className="formiq-heading">
      <div><span className="formiq-kicker">COURTIQ / FORM IQ LIVE</span>
        <h4>See the mechanics behind the reps.</h4>
        <p>On-device body landmarks, red/green coaching rails, and optional ball-flight tracing.</p></div>
      <span className={'formiq-badge '+(status==='active'?'on':'')}>{status==='active'?'● LIVE':status==='starting'?'STARTING':'CAMERA OFF'}</span>
    </div>
    <div className="formiq-camera">
      <video ref={videoRef} muted playsInline autoPlay={false} aria-label="Live on-device basketball shooting camera" />
      <canvas ref={overlayRef} aria-label="Overlay of tracked joint angles and basketball trajectory"
        onPointerDown={ballPick?calibrate:undefined} style={{pointerEvents:ballPick?'auto':'none',cursor:ballPick?'crosshair':'default'}} />
      {status!=='active'&&<div className="formiq-placeholder" aria-hidden="true">
        <span>⌖</span><strong>LIVE FORM TRACKER</strong>
        <small>Camera activates only when you choose Start camera.</small>
      </div>}
      {ballPick&&status==='active'&&<div className="formiq-target-instruction">Tap the basketball to calibrate its colour</div>}
    </div>
    <div className="formiq-controls">
      {status==='active'||status==='starting'?<button type="button" className="formiq-stop" onClick={()=>release()}>Stop camera</button>:
        <button type="button" className="formiq-start" disabled={disabled||status==='starting'} onClick={start}>
          {status==='starting'?'Loading pose model…':'Start camera & live analysis'}</button>}
      <label>Shot hand <select value={hand} onChange={event=>{setHand(event.target.value);extensionRef.current=freshExtensionDetector();}} disabled={disabled}>
        <option value="right">Right</option><option value="left">Left</option>
      </select></label>
      <label>Camera <select value={facing} onChange={event=>setFacing(event.target.value)} disabled={status==='active'||status==='starting'}>
        <option value="environment">Rear</option><option value="user">Front</option>
      </select></label>
      {status==='active'&&<button type="button" onClick={()=>{setBallPick(true);setMessage('Tap the orange ball in the camera view while it is still.');}}>⌖ Calibrate ball</button>}
    </div>
    <div className="formiq-native-record">
      <label className="formiq-record-consent">
        <input type="checkbox" checked={recordConsent} disabled={recording||disabled||status!=='active'}
          onChange={event=>setRecordConsent(event.target.checked)} />
        I have permission to record everyone visible (video only, no audio).
      </label>
      <div className="formiq-record-controls">
        {!recording?
          <button type="button" onClick={beginRecording} disabled={disabled||status!=='active'||!recordConsent}>● Record annotated clip</button>:
          <button type="button" onClick={stopRecording} className="formiq-record-stop">■ Stop & keep clip</button>}
        <span role="status">{recording?'● REC '+Math.floor(recordSeconds/60)+':'+String(recordSeconds%60).padStart(2,'0'):'Video recording OFF'}</span>
      </div>
      {recordNote&&<p role="status">{recordNote}</p>}
      <small>Local device recording requires browser support and explicit consent. Limited to 4 minutes / 100 MB. Stop recording before saving the workout. Saving will attach the clip only to this player&apos;s workout on this device.</small>
    </div>
    <div className="formiq-autocapture">
      <label><input type="checkbox" checked={autoCapture} onChange={event=>{setAutoCapture(event.target.checked);extensionRef.current=freshExtensionDetector();}} disabled={disabled||remaining<=0} />
        <span><strong>Auto-capture release-like arm extensions</strong><small>Opt-in · requires a visible set posture, then extended shooting arm. Captures form snapshots only. Not a shot counter.</small></span>
      </label>
      <span className="formiq-capacity">{remaining} of 30 draft slots left</span>
      {lastCapture && <p role="status">{lastCapture.type} captured · {new Date(lastCapture.at).toLocaleTimeString()}</p>}
    </div>
    <div className="formiq-measures" role="status" aria-live="off">
      <div><small>Shooting elbow</small><strong style={{color:ink(refs.elbow)}}>{show(metric?.elbow)}</strong><span>{refs.elbow==='unavailable'?'Move into frame':refs.elbow==='reference'?'In phase reference':'Review this frame'}</span></div>
      <div><small>Lead knee</small><strong style={{color:ink(refs.knee)}}>{show(metric?.knee)}</strong><span>{refs.knee==='unavailable'?'Move into frame':refs.knee==='reference'?'In phase reference':'Review this frame'}</span></div>
      <div><small>2D ball rise</small><strong>{show(rise)}</strong><span>{ballStatus==='tracking'?'Colour-tracked estimate':ballStatus==='lost'?'Ball lost; recalibrate':ballStatus==='calibrated'?'Watch the next shot':'Needs ball calibration'}</span></div>
      <div><small>Motion phase</small><strong className="formiq-phase">{metric?.visible?metric.phase:'—'}</strong><span>Pose-estimated, not a shot count</span></div>
    </div>
    <div className="formiq-legend"><span><i className="green" /> Within phase reference</span><span><i className="red" /> Review position</span><span><i className="blue" /> Tracked body</span></div>
    {status==='active'&&<div className="formiq-capture">
      <button type="button" disabled={disabled||!metric?.visible||remaining<=0} onClick={snapshot}>Save current form observation</button>
      <span>{observations} captured in this view · {remaining} available in draft</span>
    </div>}
    {error&&<p className="formiq-error" role="alert">{error}</p>}
    {message&&<p className="formiq-message" role="status">{message}</p>}
    <p className="formiq-disclaimer">Green/red lines are illustrative coaching reference ranges, not a pass/fail diagnosis. The ball trace is a rough 2D image-plane rise angle, <strong>not calibrated 3D arc, release angle, entry angle, or a make/miss detector</strong>. Best results: tripod, full body and ball visible, side-on view, bright contrasting background. Release-like automatic observations do not represent makes, attempts, or verified shots. Camera frames stay on this device; no automatic video recording or cloud upload.</p>
    <div className="formiq-guide"><h4>Six checkpoints for a repeatable shot</h4>
      {FORM_STEPS.map((item,index)=><article className="formiq-tip" key={item.id}>
        <span className="formiq-count">{index+1}</span>
        <div><h5>{item.title}</h5><p>{item.detail}</p></div>
      </article>)}
    </div>
  </section>;
}
