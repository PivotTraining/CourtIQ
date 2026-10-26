import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, reactHarness, findElement } from './helpers/reactHarness.mjs';

const url = new URL('../src/components/shots/LiveSessionRecorder.jsx', import.meta.url);
const button = (tree, label) => findElement(tree, node => node.type === 'button' && JSON.stringify(node.props.children).includes(label));

async function fixture({ blocked = false, oldClip = false, denied = false } = {}) {
  const h = reactHarness(), writes = [], states = [], stopped = [], instances = [];
  let confirm = true, recorder, onRequest = 0;
  const store = {
    async get() { return oldClip ? { blob: new Blob(['old'], { type: 'video/mp4' }) } : null; },
    async put(account, session, blob) { if (blocked) throw new Error('Device storage full'); writes.push({account,session,blob}); },
  };
  const stream = {
    getTracks: () => [{stop:()=>stopped.push('camera')}],
    getVideoTracks: () => [{}],
  };
  class FakeRecorder {
    static isTypeSupported(mime) { return mime.startsWith('video/mp4'); }
    constructor(a,options) { assert.equal(a,stream); assert.match(options.mimeType,/mp4/); this.state='inactive'; instances.push(this); recorder=this; }
    start() { this.state='recording'; }
    stop() {
      if(this.state==='inactive') return;
      this.state='inactive';
      this.ondataavailable({data:new Blob(['sample video bytes'],{type:'video/mp4'})});
      this.onstop?.();
    }
  }
  const fakeWindow={confirm:()=>confirm,addEventListener(){},removeEventListener(){},
    setInterval:()=>1,clearInterval(){},setTimeout:()=>1};
  const {default:Recorder}=await loadComponent(url, {
    react:h.react,
    '@/lib/deviceVideo.mjs':{createDeviceVideoStore:()=>store,MAX_CLIP_BYTES:100*1024*1024},
  },{window:fakeWindow,navigator:{mediaDevices:{async getUserMedia(){onRequest++;if(denied){const err=new Error('denied');err.name='NotAllowedError';throw err;}return stream;}}},MediaRecorder:FakeRecorder,Blob,URL,Date,document:{createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},console:{error(){} }});
  h.render(Recorder,{accountId:'parent',sessionId:'game-one',onBusyChange:v=>states.push(v)});
  await h.settle();
  return {h,store,writes,states,stopped,instances,get recorder(){return recorder;},get requests(){return onRequest;},set confirm(v){confirm=v;}};
}

test('video records in the same tracker view without touching shot or box score writes', async () => {
  const f=await fixture();
  assert.ok(button(f.h.output,'Record video'));
  await button(f.h.output,'Record video').props.onClick();
  await f.h.settle();
  assert.ok(button(f.h.output,'Stop & save video'));
  assert.equal(f.requests,1);
  assert.equal(f.recorder.state,'recording');
  assert.ok(f.states.includes(true),'ending game must be disabled while recording');
  button(f.h.output,'Stop & save video').props.onClick();
  await f.h.settle();
  assert.equal(f.recorder.state,'inactive');
  assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].account,'parent');
  assert.equal(f.writes[0].session,'game-one');
  assert.equal(f.writes[0].blob.type,'video/mp4');
  assert.ok(f.stopped.includes('camera'));
  assert.ok(f.states.includes(false));
  assert.ok(button(f.h.output,'Record video'));
  f.h.unmount();
});

test('permission denial leaves manual stats intact and offers a clear camera error', async () => {
  const f=await fixture({denied:true});
  await button(f.h.output,'Record video').props.onClick();
  await f.h.settle();
  assert.equal(f.writes.length,0);
  assert.match(JSON.stringify(f.h.output),/Camera permission was denied/);
  assert.ok(button(f.h.output,'Record video'));
  f.h.unmount();
});

test('existing clip requires explicit replacement approval', async () => {
  const f=await fixture({oldClip:true});
  f.confirm=false;
  await button(f.h.output,'Record video').props.onClick();
  assert.equal(f.requests,0);
  f.confirm=true;
  await button(f.h.output,'Record video').props.onClick();
  await f.h.settle();
  assert.equal(f.requests,1);
  button(f.h.output,'Stop & save video').props.onClick();
  await f.h.settle();
  f.h.unmount();
});

test('failed device save retains video for retry/download instead of claiming save', async () => {
  const f=await fixture({blocked:true});
  await button(f.h.output,'Record video').props.onClick();
  await f.h.settle();
  button(f.h.output,'Stop & save video').props.onClick();
  await f.h.settle();
  assert.ok(button(f.h.output,'Retry save'));
  assert.ok(button(f.h.output,'Download video'));
  assert.match(JSON.stringify(f.h.output),/Device storage full/);
  assert.ok(f.states.at(-1)===true,'leaving must remain blocked while unsaved video is held');
  f.h.unmount();
});
