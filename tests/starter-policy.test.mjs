import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_STARTER, INTRO_DRILLS, starterState } from '../src/lib/starterPolicy.mjs';
test('free tier is distinct from a timed trial and has exactly the approved limits',()=>{
  assert.deepEqual(FREE_STARTER,{savedGames:0,trainingSessions:1,journalEntries:0,advancedAnalytics:false});
  assert.equal(INTRO_DRILLS.length,3);
  assert.equal(starterState({mode:'free',workout:'available',billing:{access:'read_only'}}).mode,'free');
  assert.throws(()=>starterState({mode:'free',workout:'available',billing:{access:'coach'}}));
  for(const value of [null,{}, {mode:'premium',workout:'available'},{mode:'free',workout:'unlimited'}]) assert.throws(()=>starterState(value));
});
