import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadComponent, reactHarness, findElement} from './helpers/reactHarness.mjs';
import * as recording from '../src/lib/formIqRecording.mjs';

async function fixture({saved=null, fail=false, recorderSupported=true, neverPlay=false, pendingCamera=false}={}) {
  const h=reactHarness(), writes=[],busy=[],downloads=[],stopped=[];
  let allowCamera;
  const waitForCamera=new Promise(resolve=>{allowCamera=resolve;});
  const stream={getTracks(){return [{stop(){stopped.push('camera');}}];}};
  const video={srcObject:null,muted:false,playsInline:false,
    play(){return neverPlay?new Promise(()=>{}):Promise.resolve();},pause(){}};
  class Recorder {
    static isTypeSupported(type){return recorderSupported && type.startsWith('video/mp4');}
    constructor(source,options){this.stream=source;this.mimeType=options.mimeType;this.state='inactive';}
    start(){this.state='recording';}
    requestData(){}
    stop(){
      this.state='inactive';
      this.ondataavailable?.({data:new Blob(['recorded-game'],{type:'video/mp4'})});
      this.onstop?.();
    }
  }
  const store={
    async get(){return saved;},
    async put(account,session,blob){
      writes.push([account,session,blob]);
      if(fail)throw new Error('Quota reached');
      return {accountId:account,sessionId:session,blob};
    },
  };
  const {default: RecorderDock}=await loadComponent(
    new URL('../src/components/shots/GameTrackerRecorder.jsx',import.meta.url),
    {
      react:h.react,
      '@/lib/deviceVideo.mjs': {
        createDeviceVideoStore:()=>store,
        validateClip:blob=>{if(!blob || blob.type!=='video/mp4' || blob.size>104857600)throw new Error('Invalid video');},
      },
      '@/lib/formIqRecording.mjs':recording,
      '@/lib/browserDownload.mjs':{downloadBlob:(...args)=>downloads.push(args)},
    },
    {
      navigator:{mediaDevices:{getUserMedia:async constraints=>{
        assert.equal(constraints.audio,false);
        return pendingCamera?waitForCamera:stream;
      }}},
      MediaRecorder:Recorder,
      Blob,performance:{now:()=>100},
      setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>2,clearTimeout:()=>{},
      URL:{createObjectURL:()=> 'blob:game-video',revokeObjectURL(){}},
      document:{hidden:false,addEventListener(){},removeEventListener(){}},
      window:{confirm:()=>true},
    },
  );
  h.render(RecorderDock,{accountId:'parent-1',sessionId:'session-1',playerName:'Player',
    onBusyChange:value=>busy.push(value),storeFactory:()=>store});
  await h.settle();
  const live=findElement(h.output,node=>node.type==='video'&&node.props?.['aria-label']==='Live game recording camera preview');
  assert.ok(live);live.props.ref.current=video;
  const consent=findElement(h.output,node=>node.type==='input'&&node.props.type==='checkbox');
  consent.props.onChange({target:{checked:true}});h.flush();
  const button=label=>findElement(h.output,node=>node.type==='button' &&
    [node.props.children].flat(Infinity).join('')===label);
  return {h,button,stream,video,writes,busy,downloads,stopped,allowCamera};
}

test('in-game recording opens visible preview and captures silent clip while tracking session stays open',async()=>{
  const f=await fixture();
  assert.ok(f.button('● Record game'));
  await f.button('● Record game').props.onClick();await f.h.settle();
  assert.equal(f.video.srcObject,f.stream);
  assert.ok(f.button('■ Stop & save clip'));
  const view=findElement(f.h.output,node=>node.props?.['aria-label']==='What the camera is recording');
  assert.ok(view);
  assert.equal(view.props.hidden,false);
  f.button('■ Stop & save clip').props.onClick();
  await f.h.settle();
  assert.equal(f.writes.length,1,'video is saved under active account and game');
  assert.deepEqual(f.writes[0].slice(0,2),['parent-1','session-1']);
  assert.ok(f.button('Download saved video backup'));
  assert.equal(f.busy.at(-1),false,'the parent can finish the game after the video save resolves');
  f.h.unmount();
  assert.ok(f.stopped.length>0,'leaving the tracker releases camera tracks');
});
test('failed device video save blocks game exit until retry or explicit backup acknowledgment',async()=>{
  const f=await fixture({fail:true});
  await f.button('● Record game').props.onClick();await f.h.settle();
  f.button('■ Stop & save clip').props.onClick();await f.h.settle();
  assert.equal(f.writes.length,1);
  assert.equal(f.busy.at(-1),true);
  assert.ok(f.button('Download unsaved clip'));
  f.button('Download unsaved clip').props.onClick();
  assert.equal(f.downloads.length,1);
  f.button('I backed up my clip. Continue').props.onClick();f.h.flush();
  assert.equal(f.busy.at(-1),false);
  f.h.unmount();
});
test('in-game view mounts game video outside court and stats conditional',async()=>{
  const view=await readFile(new URL('../src/components/shots/CourtTrackerView.jsx',import.meta.url),'utf8');
  const screen=await readFile(new URL('../src/components/shots/ReliableTracker.jsx',import.meta.url),'utf8');
  assert.match(view,/\{videoDock\}[\s\S]*tracker-tabs/);
  assert.match(screen,/GameTrackerRecorder/);
  assert.match(screen,/onBusyChange=\{setMediaBusy\}/);
  assert.match(screen,/if\(mediaBusy\).*Stop the game recording/);
  assert.match(screen,/snapshot\.session\.type==='game'/);
  assert.match(screen,/logShot=\{made =>/);
  assert.match(screen,/logFreeThrow=\{made =>/);
});

test('a stalled Safari video.play promise does not block recording or stat controls',async()=>{
  const f=await fixture({neverPlay:true});
  await f.button('● Record game').props.onClick();await f.h.settle();
  assert.equal(f.video.srcObject,f.stream);
  assert.ok(f.button('■ Stop & save clip'),'recording starts without awaiting video.play');
  f.button('■ Stop & save clip').props.onClick();await f.h.settle();
  assert.equal(f.writes.length,1);
  f.h.unmount();
});
test('cancel slow camera request releases a late arriving stream and restores controls',async()=>{
  const f=await fixture({pendingCamera:true});
  const connect=f.button('● Record game').props.onClick();
  f.h.flush();
  assert.ok(f.button('Cancel camera startup'));
  f.button('Cancel camera startup').props.onClick();
  f.h.flush();
  assert.ok(f.button('● Record game'),'user is allowed to try again');
  f.allowCamera(f.stream);
  await connect;await f.h.settle();
  assert.ok(f.stopped.length>0,'cancelled camera request releases late hardware stream');
  assert.equal(f.video.srcObject,null);
  f.h.unmount();
});
test('fast camera constraints, visible playback effect, and UI recovery are explicit',async()=>{
  const ui=await readFile(new URL('../src/components/shots/GameTrackerRecorder.jsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/components/shots/game-tracker-recorder.css',import.meta.url),'utf8');
  assert.match(ui,/video:\{facingMode:\{ideal:cameraFace\}\},audio:false/);
  assert.doesNotMatch(ui,/width:\{ideal:|height:\{ideal:|frameRate:\{ideal:/);
  assert.match(ui,/rec\.start\(\)/);
  assert.match(ui,/playing=node\.play\(\)/);
  assert.doesNotMatch(ui,/await node\.play\(\)/);
  assert.match(ui,/state!=='preview' && state!=='recording'/);
  assert.match(ui,/Cancel camera startup/);
  assert.match(ui,/requestRef\.current/);
  assert.match(css,/\.game-video-camera\[hidden\]\{display:none!important\}/);
});

test('unsupported recorder fails before requesting camera or showing a stalled spinner',async()=>{
  const f=await fixture({recorderSupported:false});
  await f.button('● Record game').props.onClick();f.h.flush();
  const errors=findElement(f.h.output,node=>node.props?.role==='alert');
  assert.ok(errors);
  assert.match([errors.props.children].flat(Infinity).join(''),/cannot record live MP4\/WebM/);
  assert.equal(f.video.srcObject,null);
  assert.equal(f.busy.length,0);
  f.h.unmount();
});

test('landscape game tracking uses independently scrollable camera and stat columns',async()=>{
  const css=await readFile(new URL('../src/components/shots/tracker.css',import.meta.url),'utf8');
  const view=await readFile(new URL('../src/components/shots/CourtTrackerView.jsx',import.meta.url),'utf8');
  assert.match(view,/tracker-workspace-video/);
  assert.match(view,/tracker-tracking-column/);
  assert.match(view,/\{videoDock\}/);
  assert.match(css,/@media \(orientation: landscape\) and \(max-height: 600px\)/);
  assert.match(css,/\.tracker-workspace\.tracker-workspace-video\s*\{/);
  assert.match(css,/grid-template-columns: minmax\(0, 43%\) minmax\(0, 57%\)/);
  assert.match(css,/\.tracker-workspace-video > \.game-video-dock\s*\{/);
  assert.match(css,/\.tracker-content\s*\{\s*flex: 1; min-height: 0; height: 100%;/);
  assert.match(css,/touch-action: pan-y/);
  assert.match(css,/-webkit-overflow-scrolling: touch/);
});
