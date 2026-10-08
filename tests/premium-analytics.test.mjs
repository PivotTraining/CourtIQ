import test from 'node:test';
import assert from 'node:assert/strict';
import { premiumAnalysis, nbaStyle, styleVector, styleDistance, aggregateGames } from '../src/lib/premiumAnalytics.mjs';
import { NBA_REFERENCES } from '../src/lib/nbaReferences.mjs';
import { premiumFixture } from '../src/lib/premiumFixtures.mjs';
const zones=[{id:'top-key-3',label:'Top key',pts:3},{id:'paint',label:'Paint',pts:2},{id:'left-elbow',label:'Elbow',pts:2},{id:'free-throw',label:'FT',pts:1}];
test('aggregates use denominators, exclude practice and split non-overlapping trend windows without mutating history',()=>{
  const sessions=premiumFixture().sessions.filter(game=>game.player_id==='sample-one'),clone=structuredClone(sessions);
  sessions.push({...sessions[0],id:'practice',type:'practice'});
  const result=premiumAnalysis(sessions,zones);
  assert.equal(result.games.length,12);assert.equal(result.aggregate.fga,216);assert.equal(result.aggregate.threeAttempts,120);
  assert.equal(result.aggregate.pts,12*(6*2+6*3+3));
  assert.equal(result.trendAvailable,true);assert.equal(result.priorIds.filter(id=>result.recentIds.includes(id)).length,0);
  assert.deepEqual(sessions.slice(0,12),clone);assert.equal(result.nba.matches.length,3);assert.ok(result.styleTrend);
  const a=aggregateGames([{report:{...result.games[0].report,fgm:1,fga:1,threeMade:0,threeAttempts:0}},{report:{...result.games[0].report,fgm:0,fga:9,threeMade:0,threeAttempts:0}}]);
  assert.equal(a.fgPct,10);
});
test('coverage starts unknown; invalid minutes, shot zones, partial box scores and dates cannot produce NBA matches',()=>{
  assert.equal(premiumAnalysis(premiumFixture('unconfirmed').sessions,zones).nba.available,false);
  for(const mutate of [game=>delete game.game_stats.min,game=>game.game_stats.min=0,game=>game.game_stats.ast=-1,game=>game.game_stats.stl=.5,game=>game.date='bad',game=>game.shot_logs.push({zone_id:'unmapped',made:true}),game=>game.shot_logs[0].made='true']){
    const games=structuredClone(premiumFixture().sessions);games.forEach(mutate);const report=premiumAnalysis(games,zones);assert.equal(report.aggregate.games,0);assert.equal(report.nba.available,false);assert.ok(report.excluded.length);
  }
});
test('minimum guardrails, zero denominators and dissimilar patterns never fabricate confidence or zero-divide',()=>{
  assert.equal(premiumAnalysis(premiumFixture('small').sessions.filter(game=>game.player_id==='sample-one'),zones).nba.available,false);
  const empty=aggregateGames([]);assert.equal(empty.tsPct,null);assert.equal(empty.astTo,null);assert.equal(empty.per36.pts,null);
  const odd=nbaStyle({games:5,min:100,fga:50,threeAttempts:50,fta:500,ast:1,reb:0,stl:0,blk:100});assert.equal(odd.available,true);assert.equal(odd.weakMatch,true);
  assert.equal(styleVector({fga:0,ast:0,reb:0,stl:0,blk:0}),null);
  assert.equal(styleDistance(styleVector(NBA_REFERENCES[0]),styleVector(NBA_REFERENCES[0])),0);
  assert.ok(NBA_REFERENCES.every(ref=>ref.fga>0&&ref.threeAttempts<=ref.fga&&styleVector(ref)));
});
