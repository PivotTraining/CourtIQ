// Synthetic local QA only. Not customer records or real CourtIQ benchmarks.
export function premiumFixture(kind='complete') {
  const players=[{id:'sample-one',name:'Demo Guard',position:'PG'},{id:'sample-two',name:'Demo Forward',position:'SF'}];
  const sessions=[];
  for(const [index,player] of players.entries()) for(let game=0;game<12;game++) {
    const shot_logs=Array.from({length:18},(_,shot)=>({id:`${player.id}-${game}-${shot}`,zone_id:shot<10?'top-key-3':shot<14?'paint':'left-elbow',made:shot%3!==0}));
    for(let ft=0;ft<4;ft++)shot_logs.push({id:`${player.id}-${game}-ft-${ft}`,zone_id:'free-throw',made:ft!==0});
    sessions.push({id:`${player.id}-game-${game}`,player_id:player.id,date:`2026-09-${String(game+1).padStart(2,'0')}`,type:'game',tracker_status:'completed',coverage_confirmed:kind!=='unconfirmed',
      game_stats:{ast:index?3:game>5?8:5,reb:index?10:4,stl:1,blk:index?2:0,to:2,pf:2,min:30},shot_logs});
  }
  return {players,sessions:kind==='small'?sessions.filter(session=>session.date<'2026-09-04'):sessions,community:{status:'not_activated'}};
}
