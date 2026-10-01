import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { buildTeamGameReport, teamGameCsv, lastRecordingReference } from '../src/lib/teamGame.mjs';

const alice='00000000-0000-0000-0000-000000000001', bob='00000000-0000-0000-0000-000000000002';
const first='10000000-0000-0000-0000-000000000001', second='10000000-0000-0000-0000-000000000002', foreign='10000000-0000-0000-0000-000000000003';

test('resuming a roster game restores the latest play reference, not a completion or context event',()=>{
  const ref=lastRecordingReference({members:[{snapshot:{events:[
    {payload:{kind:'shot',period:2,clock:'05:20',recorded_at:'2026-10-01T14:00:00Z'}},
    {payload:{kind:'end',period:1,clock:'00:00',recorded_at:'2026-10-01T14:01:00Z'}},
  ]}},{snapshot:{events:[{payload:{kind:'stat',period:3,clock:'07:00',recorded_at:'2026-10-01T14:00:30Z'}}]}}]});
  assert.deepEqual(ref,{period:3,clock:'07:00'});
});

test('team totals weight attempts, count FT once and do not infer a team clock or final score', () => {
  const bundle={ game:{team_name:'=EVIL()',context:{date:'2026-10-01'},status:'active',create_request:{players:[first,second,foreign]}}, members:[
    {player_id:first,session_id:'a',snapshot:{session:{player_id:first,game_stats:{ast:2,min:10}},shots:[{zone_id:'paint',made:true},{zone_id:'free-throw',made:true}]}},
    {player_id:second,session_id:'b',snapshot:{session:{player_id:second,game_stats:{reb:3,min:20}},shots:Array.from({length:9},()=>({zone_id:'paint',made:false}))}},
  ]};
  const report=buildTeamGameReport(bundle,[{id:first,name:'Alice'},{id:second,name:'Bob'}],[{id:'paint',pts:2},{id:'free-throw',pts:1}]);
  assert.equal(report.totals.pts,3); assert.equal(report.totals.fga,10); assert.equal(report.totals.fgPct,10);
  assert.equal(report.totals.box.min,0); assert.equal(report.missing,1);
  const csv=teamGameCsv(bundle,report); assert.match(csv,/"'=EVIL\(\)"/); assert.match(csv,/Not a team clock/); assert.match(csv,/Actual final team score","Not entered/);
  assert.throws(()=>buildTeamGameReport({...bundle,members:[bundle.members[0],bundle.members[0]]},[],[]),/Inconsistent/);
});

test('owned roster creation and completion are atomic, retryable and inaccessible to other accounts', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; insert into auth.users values('${alice}'),('${bob}');`);
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    await db.exec(`insert into players(id,firebase_uid,manager_uid,name) values('${first}','${alice}_one','${alice}','One'),('${second}','${alice}_two','${alice}','Two'),('${foreign}','${bob}_one','${bob}','Foreign');`);
    for(const file of ['20260930171602_web_player_ownership_safeguards.sql','20260930202201_reliable_sessions_and_development.sql','20261001144325_owned_roster_games.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
    const user=async uid=>db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`);
    await user(alice);
    const gid=randomUUID(); const context={date:'2026-10-01',opponent:'Panthers',season:'26/27',team_score:'',opponent_score:''};
    const create=(id,players)=>db.query('select create_owned_team_game($1,$2,$3,$4) game',[id,'Falcons',context,players]);
    await assert.rejects(create(randomUUID(),[first,foreign]),/unavailable player/);
    assert.equal((await db.query('select count(*)::int n from team_games')).rows[0].n,0);
    await assert.rejects(create(randomUUID(),[first,first]),/Duplicate/);
    await create(gid,[first,second]); await create(gid,[second,first]);
    assert.equal((await db.query('select count(*)::int n from sessions')).rows[0].n,2);
    await assert.rejects(create(gid,[first]),/reused/);
    await assert.rejects(db.query(`update team_games set team_name='Changed' where id='${gid}'`),/permission denied/);
    await assert.rejects(db.query(`insert into team_game_players(game_id,player_id,session_id) values('${gid}','${foreign}',gen_random_uuid())`),/permission denied/);
    const links=(await db.query('select * from team_game_players order by player_id')).rows;
    const sid=links[0].session_id;
    await db.query('select apply_session_command($1,$2,0,$3)',[sid,randomUUID(),{kind:'stat',key:'ast',delta:1,period:2,clock:'05:00',recorded_at:new Date().toISOString()}]);
    const versions=Object.fromEntries(links.map(link=>[link.session_id,0])); const finishId=randomUUID();
    const finish=()=>db.query('select finish_owned_team_game($1,$2,$3,$4,$5) game',[gid,finishId,versions,60,55]);
    await assert.rejects(finish(),/SESSION_CONFLICT/);
    await assert.rejects(db.query('select finish_owned_team_game($1,$2,$3,$4,$5)',[gid,randomUUID(),versions,60,null]),/Both scores/);
    await assert.rejects(db.query('select finish_owned_team_game($1,$2,$3,$4,$5)',[gid,randomUUID(),Object.fromEntries(links.map(link=>[link.session_id,null])),60,55]),/SESSION_CONFLICT/);
    assert.equal((await db.query("select count(*)::int n from sessions where tracker_status='completed'")).rows[0].n,0);
    versions[sid]=1;
    await user(bob);
    assert.equal((await db.query('select * from team_games')).rows.length,0);
    assert.equal((await db.query('select * from team_game_players')).rows.length,0);
    await assert.rejects(finish(),/unavailable/);
    await assert.rejects(create(gid,[foreign]),/unavailable/);
    await user(alice);
    await finish(); await finish();
    const sessions=(await db.query('select * from sessions')).rows;
    assert.ok(sessions.every(row=>row.tracker_status==='completed' && row.tracker_context.team_score===60));
    assert.equal((await db.query('select count(*)::int n from session_commands')).rows[0].n,5);
    assert.equal(sessions.find(row=>row.id===sid).game_stats.ast,1);
    await db.exec('reset role; set role anon;');
    await assert.rejects(create(randomUUID(),[first]),/permission denied/);
    await db.exec(`reset role; delete from auth.users where id='${alice}';`);
    assert.equal((await db.query('select count(*)::int n from team_games')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int n from team_game_players')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int n from players')).rows[0].n,1);
  } finally { await db.close(); }
});
