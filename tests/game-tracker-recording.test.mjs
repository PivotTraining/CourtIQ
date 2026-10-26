import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadComponent, reactHarness, findElement} from './helpers/reactHarness.mjs';
import * as recording from '../src/lib/formIqRecording.mjs';

async function fixture({saved=null, fail=false, recorderSupported=true}={}) {
  const h=reactHarness(), writes=[],busy=[],downloads=[],stopped=[];
  const stream={getTracks(){return [{stop(){stopped.push('camera');}}];}};
  const video={srcObject:null,muted:false,playsInline:false,async play(){},pause(){}};
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
        return stream;
      }}},
      MediaRecorder:Recorder,
      Blob,performance:{now:()=>100},
      setInterval:()=>1,clearInterval:()=>{},
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
  return {h,button,stream,video,writes,busy,downloads,stopped};
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
