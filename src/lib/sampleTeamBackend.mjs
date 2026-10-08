// Development-only caller. No network, Auth, Stripe or real players.
import { projectCommand } from './sessionRecovery.mjs';
export const SAMPLE_COACH_ACCOUNT='local-coach-account';
export const SAMPLE_ROSTER=[{id:'sample-jordan',name:'Jordan Ellis',jersey_number:0,position:'PG'}, {id:'sample-casey',name:'Casey Brooks',jersey_number:12,position:'SG'}, {id:'sample-morgan',name:'Morgan Reed',jersey_number:24,position:'C'}];

export function createSampleTeamBackend(storage, network) {
  const key='courtiq-local-coach-backend-v1';
  const connected=()=>{if(!network.current)throw new Error('Sample disconnected');};
  const write=rows=>storage.setItem(key,JSON.stringify(rows));
  function makeGame(id,teamName,context,playerIds) {
    return {game:{id,owner_id:SAMPLE_COACH_ACCOUNT,team_name:teamName,context,status:'active',create_request:{players:[...playerIds]}},members:playerIds.map(player_id=>{
      const session_id=crypto.randomUUID(); return {game_id:id,player_id,session_id,snapshot:{session:{id:session_id,player_id,type:'game',mode:'team',date:context.date,tracker_context:context,tracker_status:'active',tracker_version:0,game_stats:{}},shots:[],events:[]}};
    })};
  }
  function records() {
    const existing=storage.getItem(key); if(existing)return JSON.parse(existing);
    const game=makeGame('sample-falcons','Sample Falcons',{date:'2026-10-01',opponent:'Sample Panthers',season:'2026–27',format:'quarters',location:'home'},SAMPLE_ROSTER.map(player=>player.id));
    game.members.forEach((member,index)=>{
      const payloads=index===0?[{kind:'shot',zone_id:'top-key-3',made:true},{kind:'stat',key:'ast',delta:1}]:index===1?[{kind:'shot',zone_id:'paint',made:false}]:[{kind:'shot',zone_id:'paint',made:true},{kind:'stat',key:'reb',delta:1}];
      payloads.forEach(payload=>{member.snapshot=projectCommand(member.snapshot,{id:crypto.randomUUID(),sessionId:member.session_id,version:member.snapshot.session.tracker_version,payload:{...payload,period:1,clock:'06:00',recorded_at:new Date().toISOString()}});});
    });
    const rows={[game.game.id]:game};write(rows);return rows;
  }
  const tracker={
    async fetchTrackerSession(id,playerId){connected();const member=Object.values(records()).flatMap(row=>row.members).find(row=>row.session_id===id&&row.player_id===playerId);if(!member)throw new Error('Sample session unavailable');return member.snapshot;},
    async applySessionCommand(command){connected();const rows=records();const member=Object.values(rows).flatMap(row=>row.members).find(row=>row.session_id===command.sessionId);if(!member)throw new Error('Sample session unavailable');if(member.snapshot.events.some(event=>event.id===command.id))return member.snapshot.session;member.snapshot=projectCommand(member.snapshot,command);write(rows);return member.snapshot.session;},
  };
  return {
    tracker,
    async fetchManagedPlayers(){connected();return SAMPLE_ROSTER;},
    async fetchOwnedTeamGames(){connected();return Object.values(records()).map(row=>row.game);},
    async fetchOwnedTeamGame(id){connected();const row=records()[id];if(!row)throw new Error('Sample game unavailable');return row;},
    async createOwnedTeamGame(request){connected();const rows=records();if(rows[request.id])return rows[request.id].game;if(request.playerIds.some(id=>!SAMPLE_ROSTER.some(player=>player.id===id)))throw new Error('Sample player unavailable');const row=makeGame(request.id,request.teamName,request.context,request.playerIds);rows[request.id]=row;write(rows);return row.game;},
    async finishOwnedTeamGame(request){connected();const rows=records();const row=rows[request.gameId];if(!row)throw new Error('Sample game unavailable');if(row.game.finish_id===request.id)return row.game;
      if(row.members.some(member=>request.versions[member.session_id]!==member.snapshot.session.tracker_version))throw Object.assign(new Error('SESSION_CONFLICT'),{code:'40001'});
      const context={...row.game.context,team_score:request.teamScore,opponent_score:request.opponentScore};
      for(const member of row.members)for(const payload of [{kind:'context',context},{kind:'end'}])member.snapshot=projectCommand(member.snapshot,{id:crypto.randomUUID(),sessionId:member.session_id,version:member.snapshot.session.tracker_version,payload:{...payload,period:1,clock:'00:00',recorded_at:new Date().toISOString()}});
      row.game={...row.game,status:'completed',context,finish_id:request.id};write(rows);return row.game;
    },
  };
}
