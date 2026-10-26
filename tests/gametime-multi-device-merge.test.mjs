import test from 'node:test';
import assert from 'node:assert/strict';
import {rebasePendingGame} from '../src/lib/rebasePendingGame.mjs';
import {projectCommand,EMPTY_GAME_STATS} from '../src/lib/sessionRecovery.mjs';

function snapshot(version=0,shots=[],events=[]){
  return {session:{id:'game-a',player_id:'caleb',type:'game',tracker_status:'active',
    tracker_version:version,game_stats:{...EMPTY_GAME_STATS},tracker_context:{}},
    shots,events};
}
function command(id,version,payload={kind:'stat',key:'ast',delta:1}){
  return {id,sessionId:'game-a',version,payload:{...payload,period:2,clock:'03:20',
    recorded_at:'2026-10-26T20:00:00.000Z'}};
}
test('pending stats from second phone can be rebased without overwriting server events',()=>{
  const server=projectCommand(snapshot(),command('remote-one',0));
  const a=command('local-a',0,{kind:'stat',key:'stl',delta:1});
  const b=command('local-b',1,{kind:'stat',key:'ast',delta:1});
  const localSnapshot=projectCommand(projectCommand(snapshot(),a),b);
  const result=rebasePendingGame({local:{accountId:'parent',playerId:'caleb',snapshot:localSnapshot,pending:[a,b]},
    remote:server,projectCommand});
  assert.deepEqual(result.pending.map(c=>[c.id,c.version]),[['local-a',1],['local-b',2]]);
  assert.equal(result.snapshot.session.game_stats.ast,2);
  assert.equal(result.snapshot.session.game_stats.stl,1);
  assert.equal(result.snapshot.session.tracker_version,3);
  assert.deepEqual(result.snapshot.events.map(e=>e.id),['remote-one','local-a','local-b']);
});
test('already accepted RPC command ID is not replayed or double-counted',()=>{
  const a=command('accepted',0);
  const b=command('still-pending',1);
  const server=projectCommand(snapshot(),a);
  const local=projectCommand(projectCommand(snapshot(),a),b);
  const result=rebasePendingGame({local:{snapshot:local,pending:[a,b]},remote:server,projectCommand});
  assert.deepEqual(result.pending.map(x=>x.id),['still-pending']);
  assert.equal(result.snapshot.session.game_stats.ast,2);
});
test('bad session, ended game and unsafe commands cannot silently discard local pending records',()=>{
  const a=command('a',0);
  const original={snapshot:projectCommand(snapshot(),a),pending:[a]};
  assert.throws(()=>rebasePendingGame({local:original,remote:{...snapshot(),session:{...snapshot().session,id:'other'}},projectCommand}),/does not match/);
  assert.throws(()=>rebasePendingGame({local:original,remote:{...snapshot(),session:{...snapshot().session,tracker_status:'completed'}},projectCommand}),/already ended/);
  const invalid=command('invalid',0,{kind:'stat',key:'reb',delta:-1});
  assert.throws(()=>rebasePendingGame({local:{snapshot:snapshot(),pending:[invalid]},remote:snapshot(),projectCommand}),/negative/);
  assert.deepEqual(original.pending.map(x=>x.id),['a']);
});
