// On-device camera measurements are perspective-dependent observations, never
// a diagnosis, shot-make detector, certified release angle or 3-D ball-flight model.
export const FORM_STEPS = Object.freeze([
  { id: 'stance', title: 'Stance & balance', detail: 'Start balanced, with a comfortable base and knees ready to load. The camera can estimate knee bend, not weight distribution.' },
  { id: 'grip', title: 'Grip & guide hand', detail: 'Keep the shooting hand under the ball and guide hand relaxed. Verify finger pressure on film; body landmarks cannot measure grip.' },
  { id: 'elbow', title: 'Elbow alignment', detail: 'Bring the ball into a repeatable pocket with a controlled shooting elbow. Compare the angle at set and at extension.' },
  { id: 'dip', title: 'Dip & rise', detail: 'Load through the legs and flow upward in rhythm. Watch for consistent knee bend before the release.' },
  { id: 'release', title: 'Release', detail: 'Reach up into a comfortable release, keeping the shooting arm extended without forcing a rigid angle.' },
  { id: 'follow', title: 'Follow-through', detail: 'Hold a relaxed finish with the shooting hand high, then review the actual ball flight if it stays in frame.' },
]);
const good = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.score ?? 0) >= .35;
export const JOINT_LINKS = Object.freeze([
  [5,6],[5,7],[7,9],[6,8],[8,10],[5,11],[6,12],[11,12],
  [11,13],[13,15],[12,14],[14,16],
]);
export function jointAngle(a,b,c) {
  if (![a,b,c].every(good)) return null;
  const x=a.x-b.x,y=a.y-b.y,p=c.x-b.x,q=c.y-b.y;
  const m=Math.hypot(x,y)*Math.hypot(p,q);
  if(m<.00001)return null;
  return Math.round(Math.acos(Math.max(-1,Math.min(1,(x*p+y*q)/m)))*180/Math.PI);
}
export function poseMetrics(points,hand='right') {
  if(!Array.isArray(points) || points.length<17)return { visible:false,elbow:null,knee:null,wristHigh:null,phase:'unavailable',score:0 };
  const right=hand==='right', shoulder=points[right?6:5],elbow=points[right?8:7],wrist=points[right?10:9],
    hip=points[right?12:11],knee=points[right?14:13],ankle=points[right?16:15];
  const e=jointAngle(shoulder,elbow,wrist),k=jointAngle(hip,knee,ankle);
  const wristHigh=good(wrist)&&good(shoulder)?wrist.y < shoulder.y : null;
  const phase=e!==null && e>=150 && wristHigh===true?'extension':'set';
  const score=[shoulder,elbow,wrist,hip,knee,ankle].filter(good).length;
  return {visible:score>=4,elbow:e,knee:k,wristHigh,phase:score>=4?phase:'unavailable',score};
}
// Colours communicate a coaching reference for a particular movement phase,
// not whether an individual's natural shooting technique is "correct".
export function referenceState(metric,phase='set'){
  if(!metric?.visible)return {elbow:'unavailable',knee:'unavailable',wrist:'unavailable'};
  const angleState=(value,lo,hi)=>value===null?'unavailable':value>=lo&&value<=hi?'reference':'review';
  return {
    elbow:angleState(metric.elbow,phase==='extension'?145:65,phase==='extension'?180:135),
    knee:angleState(metric.knee,phase==='extension'?145:100,180),
    wrist:metric.wristHigh===null?'unavailable':phase==='extension'
      ?metric.wristHigh?'reference':'review':'unavailable',
  };
}
const inFrame=(x,y,width,height)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<width&&y<height;
export function sampleBallColour(frame,x,y) {
  const {width,height,data}=frame||{};
  if(!Number.isInteger(width)||!Number.isInteger(height)||!data||!inFrame(x,y,width,height))return null;
  let r=0,g=0,b=0,n=0;
  for(let yy=Math.max(0,Math.floor(y)-2); yy<=Math.min(height-1,Math.floor(y)+2);yy++)
    for(let xx=Math.max(0,Math.floor(x)-2);xx<=Math.min(width-1,Math.floor(x)+2);xx++){
      const i=(yy*width+xx)*4;r+=data[i];g+=data[i+1];b+=data[i+2];n++;
    }
  if(!n)return null;
  const color={r:Math.round(r/n),g:Math.round(g/n),b:Math.round(b/n)};
  // Require the basketball to be visibly warm/orange. Reject generic surfaces.
  if(color.r<65||color.r<=color.g*1.08||color.g<=color.b*1.04)return null;
  return color;
}
export function findBallInFrame(frame,last,colour,radius=44) {
  if(!frame?.data||!last||!colour)return null;
  const {width,height,data}=frame;
  if(!inFrame(last.x,last.y,width,height))return null;
  const rad=Math.max(12,Math.min(90,Number(radius)||44));
  const left=Math.max(0,Math.floor(last.x-rad)),right=Math.min(width-1,Math.ceil(last.x+rad));
  const top=Math.max(0,Math.floor(last.y-rad)),bottom=Math.min(height-1,Math.ceil(last.y+rad));
  let sumX=0,sumY=0,n=0;
  const tol=52*52*3;
  for(let y=top;y<=bottom;y+=2)for(let x=left;x<=right;x+=2){
    if((x-last.x)**2+(y-last.y)**2>rad*rad)continue;
    const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    if(r<65||r<=g*1.06||g<=b*1.02)continue;
    const delta=(r-colour.r)**2+(g-colour.g)**2+(b-colour.b)**2;
    if(delta>tol)continue;
    sumX+=x;sumY+=y;n++;
  }
  // Too few candidate pixels or a gigantic matching surface are unreliable.
  if(n<6||n>250)return null;
  const center={x:Math.round(sumX/n),y:Math.round(sumY/n),pixels:n};
  if(Math.hypot(center.x-last.x,center.y-last.y)>rad*.88)return null;
  return center;
}
export function observedRiseAngle(points) {
  if(!Array.isArray(points)||points.length<3)return null;
  const last=points.slice(-16).filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)
    &&Number.isFinite(p?.time));
  // Use only a short, monotonic rising segment of the *image plane* path.
  let end=last.length-1,first=end;
  while(first>0 && last[first-1].y>last[first].y+1 && last[first].time-last[first-1].time<350)first--;
  if(end-first<2)return null;
  const rise=last[first].y-last[end].y,run=Math.abs(last[end].x-last[first].x);
  if(rise<12 || last[end].time-last[first].time<100)return null;
  return Math.round(Math.atan2(rise,run)*180/Math.PI);
}
export function makeFormObservation(metric,angle,now=new Date().toISOString()){
  if(!metric?.visible)throw new Error('Move into the camera frame before capturing a form observation.');
  if(!Number.isFinite(Date.parse(now)))throw new Error('Invalid observation timestamp.');
  return {
    at:now,phase:metric.phase,elbow_angle:metric.elbow,knee_angle:metric.knee,
    wrist_above_shoulder:metric.wristHigh,projected_rise_angle:angle??null,
    method:'on-device-movenet-v1',arc_method:angle===null?null:'2d-colour-track-uncalibrated',
  };
}

/**
 * Opt-in release-like movement detector for automatic form snapshots.
 * Recognizes a visible set-arm posture followed by extension and a high wrist.
 * This is NOT a basketball shot detector; there is no ball/hoop/make evidence.
 * Two confirmed frames in each phase and a cooldown reduce obvious duplicates.
 */
export function freshExtensionDetector() {
  return { mode: 'ready', setFrames: 0, extendFrames: 0, armedAt: 0, cooldownUntil: 0 };
}
export function trackExtensionPattern(previous, metric, time) {
  const current = previous && typeof previous === 'object' ? previous : freshExtensionDetector();
  if (!Number.isFinite(time) || time < 0) return { state: freshExtensionDetector(), capture: false };
  if (time < current.cooldownUntil) return { state: current, capture: false };
  const eligible = !!metric?.visible && metric.score >= 5 &&
    Number.isFinite(metric.elbow) && Number.isFinite(metric.knee) &&
    metric.knee >= 85 && metric.knee <= 180;
  if (!eligible) return { state: freshExtensionDetector(), capture: false };
  const set = metric.phase === 'set' && metric.elbow >= 65 && metric.elbow <= 135;
  const extended = metric.phase === 'extension' && metric.elbow >= 155 && metric.wristHigh === true;
  if (current.mode === 'ready') {
    const setFrames = set ? current.setFrames + 1 : 0;
    if (setFrames >= 2) return {
      state: { mode: 'armed', setFrames: 2, extendFrames: 0, armedAt: time, cooldownUntil: 0 },
      capture: false,
    };
    return { state: { ...current, setFrames, extendFrames: 0 }, capture: false };
  }
  if (current.mode === 'armed') {
    if (time - current.armedAt > 2200) return { state: freshExtensionDetector(), capture: false };
    if (set) return { state: { ...current, extendFrames: 0 }, capture: false };
    if (!extended) return { state: { ...current, extendFrames: 0 }, capture: false };
    const extendFrames = current.extendFrames + 1;
    if (extendFrames < 2) return { state: { ...current, extendFrames }, capture: false };
    return {
      state: { ...freshExtensionDetector(), cooldownUntil: time + 1600 },
      capture: true,
    };
  }
  return { state: freshExtensionDetector(), capture: false };
}
