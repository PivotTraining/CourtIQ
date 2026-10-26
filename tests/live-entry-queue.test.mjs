import test from 'node:test';
import assert from 'node:assert/strict';
import {drainLiveEntries} from '../src/lib/liveEntryQueue.mjs';

function delayed(){
  let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve};
}
test('rapid consecutive stats are never lost while first server command is pending',async()=>{
  const first=delayed(),calls=[],persisted=[];
  let current={accountId:'account',playerId:'caleb',pending:[{id:'a',version:0}]};
  const persist=next=>{persisted.push(next);current=next;};
  const drain=drainLiveEntries({getCurrent:()=>current,persist,
    send:async command=>{calls.push(command.id);if(command.id==='a')await first.promise;return {tracker_version:command.version+1};},
    isCurrent:()=>true});
  assert.deepEqual(calls,['a']);
  current={...current,pending:[...current.pending,{id:'b',version:1},{id:'c',version:2}]};
  first.resolve();
  assert.equal(await drain,true);
  assert.deepEqual(calls,['a','b','c']);
  assert.deepEqual(current.pending,[]);
  assert.deepEqual(persisted.map(x=>x.pending.map(c=>c.id)),[['b','c'],['c'],[]]);
});
test('network failure retains every pending shot for explicit retry',async()=>{
  let current={pending:[{id:'a',version:0},{id:'b',version:1}]};
  const config={getCurrent:()=>current,persist:next=>{current=next;},
    send:async()=>{throw new Error('offline');},isCurrent:()=>true};
  await assert.rejects(drainLiveEntries(config),/offline/);
  assert.deepEqual(current.pending.map(x=>x.id),['a','b']);
  let seen=[];
  const result=await drainLiveEntries({...config,send:async c=>{seen.push(c.id);return {tracker_version:c.version+1};}});
  assert.equal(result,true);assert.deepEqual(seen,['a','b']);assert.equal(current.pending.length,0);
});
test('wrong server version never clears the local pending ledger',async()=>{
  let current={pending:[{id:'a',version:4}]};
  await assert.rejects(drainLiveEntries({getCurrent:()=>current,persist:next=>{current=next;},
    send:async()=>({tracker_version:22}),isCurrent:()=>true}),/SESSION_CONFLICT/);
  assert.equal(current.pending[0].id,'a');
});
test('account switch during an RPC never merges another player queue',async()=>{
  let active=true;const wait=delayed();
  let current={pending:[{id:'first',version:1}]};
  const promise=drainLiveEntries({getCurrent:()=>current,persist:next=>{current=next;},
    send:async()=>{await wait.promise;return {tracker_version:2};},isCurrent:()=>active});
  active=false;current={pending:[{id:'other-player',version:0}]};wait.resolve();
  await assert.rejects(promise,/Account changed/);
  assert.deepEqual(current.pending.map(x=>x.id),['other-player']);
});
