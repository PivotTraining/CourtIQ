'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FORM_STEPS, JOINT_LINKS, findBallInFrame, makeFormObservation,
  observedRiseAngle, poseMetrics, referenceState, sampleBallColour,
} from '@/lib/liveShootingAnalytics.mjs';
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

export default function LiveShootingAnalyzer({ onObservation, disabled=false }) {
  const videoRef=useRef(null),overlayRef=useRef(null),frameRef=useRef(null);
  const detectorRef=useRef(null),streamRef=useRef(null),rafRef=useRef(null);
  const generation=useRef(0),observationRef=useRef(null),ballColour=useRef(null);
  const ballPosition=useRef(null),trailRef=useRef([]),lastTime=useRef(0),lastBallAt=useRef(0),lastRiseAt=useRef(0);
  const [status,setStatus]=useState('idle'),[error,setError]=useState('');
  const [hand,setHand]=useState('right'),[metric,setMetric]=useState(null);
  const [rise,setRise]=useState(null),[ballPick,setBallPick]=useState(false);
  const [ballStatus,setBallStatus]=useState('not-calibrated'),[observations,setObservations]=useState(0);
  const [message,setMessage]=useState('');
  const handRef=useRef(hand);handRef.current=hand;
  const statusRef=useRef(status);statusRef.current=status;

  const release=useCallback((reset=true)=>{
    ++generation.current;
    if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
    rafRef.current=null;
    const stream=streamRef.current;streamRef.current=null;
    stream?.getTracks().forEach(track=>track.stop());
    const model=detectorRef.current;detectorRef.current=null;
    try{model?.dispose?.();}catch{}
    if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
    const canvas=overlayRef.current;
    if(canvas)canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
    if(reset){setStatus('idle');setBallPick(false);setMessage('Live camera stopped. Nothing was uploaded.');}
  },[]);
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
    let stream;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('This browser does not expose camera access.');
      stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:30}},
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
      const item=makeFormObservation(observationRef.current,rise);
      onObservation?.(item);
      setObservations(old=>old+1);
      setMessage('Form angles saved to this draft. They will reach Practice history when you save the session.');
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
      <label>Shot hand <select value={hand} onChange={event=>setHand(event.target.value)} disabled={disabled}>
        <option value="right">Right</option><option value="left">Left</option>
      </select></label>
      {status==='active'&&<button type="button" onClick={()=>{setBallPick(true);setMessage('Tap the orange ball in the camera view while it is still.');}}>⌖ Calibrate ball</button>}
    </div>
    <div className="formiq-measures" role="status" aria-live="off">
      <div><small>Shooting elbow</small><strong style={{color:ink(refs.elbow)}}>{show(metric?.elbow)}</strong><span>{refs.elbow==='unavailable'?'Move into frame':refs.elbow==='reference'?'In phase reference':'Review this frame'}</span></div>
      <div><small>Lead knee</small><strong style={{color:ink(refs.knee)}}>{show(metric?.knee)}</strong><span>{refs.knee==='unavailable'?'Move into frame':refs.knee==='reference'?'In phase reference':'Review this frame'}</span></div>
      <div><small>2D ball rise</small><strong>{show(rise)}</strong><span>{ballStatus==='tracking'?'Colour-tracked estimate':ballStatus==='lost'?'Ball lost; recalibrate':ballStatus==='calibrated'?'Watch the next shot':'Needs ball calibration'}</span></div>
      <div><small>Motion phase</small><strong className="formiq-phase">{metric?.visible?metric.phase:'—'}</strong><span>Pose-estimated, not a shot count</span></div>
    </div>
    <div className="formiq-legend"><span><i className="green" /> Within phase reference</span><span><i className="red" /> Review position</span><span><i className="blue" /> Tracked body</span></div>
    {status==='active'&&<div className="formiq-capture">
      <button type="button" disabled={disabled||!metric?.visible} onClick={snapshot}>Save current form observation</button>
      <span>{observations} captured in this view</span>
    </div>}
    {error&&<p className="formiq-error" role="alert">{error}</p>}
    {message&&<p className="formiq-message" role="status">{message}</p>}
    <p className="formiq-disclaimer">Green/red lines are illustrative coaching reference ranges, not a pass/fail diagnosis. The ball trace is a rough 2D image-plane rise angle, <strong>not calibrated 3D arc, release angle, entry angle, or a make/miss detector</strong>. Best results: tripod, full body and ball visible, side-on view, bright contrasting background. Camera frames stay on this device; no automatic video recording or cloud upload.</p>
    <div className="formiq-guide"><h4>Six checkpoints for a repeatable shot</h4>
      {FORM_STEPS.map((item,index)=><article className="formiq-tip" key={item.id}>
        <span className="formiq-count">{index+1}</span>
        <div><h5>{item.title}</h5><p>{item.detail}</p></div>
      </article>)}
    </div>
  </section>;
}
