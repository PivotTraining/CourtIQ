import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/components/team/CoachWorkspace.jsx',import.meta.url),'utf8');
const body=source.match(/async function finishGame\(\) \{([\s\S]*?)\n  \}\n  async function backToTeam/)[1];
function action(overrides={}){
  const state={busyRef:{current:false},finishRef:{current:null},bundle:{game:{id:'game'},members:[{session_id:'one',snapshot:{session:{tracker_version:2}}}]},scores:{team:'',opponent:''},accountId:'alice',
    window:{localStorage:{},confirm:()=>true},crypto:{randomUUID:()=> 'finish-id'},hasPendingRecovery:()=>false,
    setBusy(){},setError(){},setBundle(){},setGames(){},backend:{finishOwnedTeamGame:async()=>{},fetchOwnedTeamGame:async()=>({game:{id:'game',status:'completed'}})},...overrides};
  return {state,run:vm.runInNewContext(`(async()=>{${body}})`,state)};
}
test('pending player entries block roster completion before confirmation or network calls',async()=>{
  let message;const {run}=action({hasPendingRecovery:()=>true,window:{localStorage:{},confirm:()=>assert.fail('No completion confirmation')},setError:value=>message=value,backend:{finishOwnedTeamGame:()=>assert.fail('No network write')}});
  await run();assert.match(message,/all pending tracker entries/);
});
test('a failed completion retains the same request identifier on retry',async()=>{
  const sent=[];let confirms=0;let summaries=0;let message;
  const {run,state}=action({window:{localStorage:{},confirm:()=>{confirms++;return true;}},setError:value=>message=value,setBundle:()=>summaries++,backend:{
    finishOwnedTeamGame:async request=>{sent.push(request);if(sent.length===1)throw new Error('Lost response');},
    fetchOwnedTeamGame:async()=>({game:{id:'game',status:'completed'}}),
  }});
  await run();assert.equal(summaries,0);assert.match(message,/same completion ID/);assert.equal(state.busyRef.current,false);
  await run();assert.equal(sent[0],sent[1]);assert.equal(confirms,1);assert.equal(summaries,1);assert.equal(state.finishRef.current,null);
});
test('a version conflict keeps the board open and requires a fresh review',async()=>{
  let message;const {run,state}=action({setError:value=>message=value,setBundle:()=>assert.fail('No completed summary'),backend:{finishOwnedTeamGame:async()=>{throw Object.assign(new Error('SESSION_CONFLICT'),{code:'40001'});}}});
  await run();assert.match(message,/No roster records were completed/);assert.equal(state.finishRef.current,null);assert.equal(state.busyRef.current,false);
});
