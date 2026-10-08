"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchManagedPlayers, fetchOwnedTeamGames, fetchOwnedTeamGame, createOwnedTeamGame, finishOwnedTeamGame,
  fetchActiveSessions, fetchTrackerSession, createTrackerSession, applySessionCommand } from '@/lib/queries';
import { hasPendingRecovery, loadRecovery } from '@/lib/sessionRecovery.mjs';
import { buildTeamGameReport, teamGameCsv, lastRecordingReference } from '@/lib/teamGame.mjs';
import { percent } from '@/lib/sessionReport.mjs';
import { COURT_ZONES } from '@/lib/constants';
import GameContextForm from '@/components/shots/GameContextForm';
import { ReliableTrackerWorkspace } from '@/components/shots/ReliableTracker';
import SocialReportCard from '@/components/shots/SocialReportCard';
import { downloadBlob } from '@/lib/browserDownload.mjs';
import './coach.css';

const DEFAULT_BACKEND = { fetchManagedPlayers, fetchOwnedTeamGames, fetchOwnedTeamGame, createOwnedTeamGame, finishOwnedTeamGame,
  tracker: { fetchActiveSessions, fetchTrackerSession, createTrackerSession, applySessionCommand } };

export default function CoachWorkspace({ darkMode, onToggleTheme, onManagePlayers }) {
  const { user } = useAuth();
  if (process.env.NEXT_PUBLIC_COACH_GAMES_ENABLED !== 'true' || process.env.NEXT_PUBLIC_TRACKER_RECOVERY_ENABLED !== 'true') {
    return <div className="coach-workspace"><h2>Coach workspace</h2><p>Roster games are not activated yet. Your individual tracking remains available.</p></div>;
  }
  return <CoachWorkspaceView key={user.id} accountId={user.id} darkMode={darkMode} onToggleTheme={onToggleTheme} onManagePlayers={onManagePlayers} />;
}

export function CoachWorkspaceView({ accountId, darkMode, onToggleTheme, onManagePlayers, backend = DEFAULT_BACKEND }) {
  const [roster, setRoster] = useState([]);
  const [games, setGames] = useState([]);
  const [bundle, setBundle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [context, setContext] = useState({ date: new Date().toLocaleDateString('en-CA'), opponent: '', season: '', competition: '', location: 'home', format: 'quarters', team_score: '', opponent_score: '' });
  const [period, setPeriod] = useState(1);
  const [clock, setClock] = useState('00:00');
  const [scores, setScores] = useState({ team: '', opponent: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCard,setShowCard]=useState(false);
  const busyRef = useRef(false);
  const requestRef = useRef(null);
  const finishRef = useRef(null);
  const loadVersion = useRef(0);

  async function loadIndex() {
    const version = ++loadVersion.current;
    setLoading(true); setError('');
    try {
      const [players, records] = await Promise.all([backend.fetchManagedPlayers(accountId), backend.fetchOwnedTeamGames(accountId)]);
      if (version !== loadVersion.current) return;
      setRoster(players); setGames(records);
    } catch { if (version === loadVersion.current) setError('Roster games could not load. Your records have not been cleared. Check the connection and database activation.'); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }
  useEffect(() => { loadIndex(); return () => { loadVersion.current++; }; }, [accountId, backend]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openGame(id) {
    if (busyRef.current) return;
    const version=++loadVersion.current;
    busyRef.current=true; setBusy(true); setError('');
    try {
      const record=await backend.fetchOwnedTeamGame(id, accountId);
      if(version!==loadVersion.current) return;
      setBundle(record); setSelected(null); finishRef.current=null;
      const pending=record.members.flatMap(member=>{
        try { return loadRecovery(window.localStorage,accountId,member.player_id)?.pending.filter(command=>command.sessionId===member.session_id) || []; }
        catch { return []; }
      });
      const reference=lastRecordingReference(record,pending); setPeriod(reference.period); setClock(reference.clock);
      setScores({team:record.game.context.team_score ?? '',opponent:record.game.context.opponent_score ?? ''});
    } catch(err) { if(version===loadVersion.current) setError(err.message || 'Game could not load.'); }
    finally { busyRef.current=false; setBusy(false); }
  }
  async function startGame(event) {
    event.preventDefault(); if(busyRef.current || !selectedIds.length) return;
    busyRef.current=true; setBusy(true); setError('');
    try {
      if(!requestRef.current) requestRef.current={id:crypto.randomUUID(),teamName:teamName.trim(),context:{...context,team_score:'',opponent_score:''},playerIds:[...selectedIds]};
      const game=await backend.createOwnedTeamGame(requestRef.current);
      const record=await backend.fetchOwnedTeamGame(game.id,accountId);
      setBundle(record); setSelected(null); setScores({team:'',opponent:''}); requestRef.current=null;
      setPeriod(1); setClock('00:00');
      setGames(rows=>[game,...rows.filter(row=>row.id!==game.id)]);
    } catch(err) { setError(`${err.message || 'Could not create game.'} Retry uses the same game ID; no duplicate roster game is created.`); }
    finally { busyRef.current=false; setBusy(false); }
  }
  async function finishGame() {
    if(busyRef.current) return;
    if(hasPendingRecovery(window.localStorage,accountId)) { setError('Sync or resolve all pending tracker entries before finishing. Open each affected player and choose Retry sync.'); return; }
    const team=scores.team===''?null:Number(scores.team), opponent=scores.opponent===''?null:Number(scores.opponent);
    if((team===null)!==(opponent===null) || [team,opponent].some(value=>value!==null&&(!Number.isInteger(value)||value<0||value>999))) { setError('Enter both final scores, or leave both blank.'); return; }
    if(!finishRef.current && !window.confirm('Finish this roster game? All player records will become completed together. Check your entries first.')) return;
    busyRef.current=true; setBusy(true); setError('');
    try {
      if(!finishRef.current) finishRef.current={id:crypto.randomUUID(),gameId:bundle.game.id,versions:Object.fromEntries(bundle.members.map(member=>[member.session_id,member.snapshot.session.tracker_version])),teamScore:team,opponentScore:opponent};
      await backend.finishOwnedTeamGame(finishRef.current);
      const record=await backend.fetchOwnedTeamGame(bundle.game.id,accountId);
      setBundle(record); finishRef.current=null; setGames(rows=>rows.map(game=>game.id===record.game.id?record.game:game));
    } catch(err) {
      const conflict=err.code==='40001'||String(err.message).includes('SESSION_CONFLICT');
      if(conflict) finishRef.current=null;
      setError(conflict?'The game changed. No roster records were completed by this request. Reload the game and review before finishing again.':`${err.message || 'Completion was not confirmed.'} Records are kept; retry checks the same completion ID.`);
    } finally { busyRef.current=false; setBusy(false); }
  }
  async function backToTeam() { setSelected(null); await openGame(bundle.game.id); }
  function exportReport(report) {
    try {
      downloadBlob(new Blob([teamGameCsv(bundle,report)],{type:'text/csv;charset=utf-8'}),'courtiq-roster-game.csv');
    } catch { setError('The roster report could not download. Your records are still here.'); }
  }

  if(selected && bundle) {
    const member=bundle.members.find(row=>row.player_id===selected);
    return <ReliableTrackerWorkspace key={`${accountId}:${selected}:${member.session_id}`} accountId={accountId} playerId={selected}
      gameSessionId={member.session_id} backend={backend.tracker} refreshData={async()=>true} onClose={backToTeam}
      darkMode={darkMode} onToggleTheme={onToggleTheme} teamControls={{roster:roster.filter(player=>bundle.members.some(row=>row.player_id===player.id)),period,clock,onPlayerChange:setSelected}} />;
  }

  const report=bundle?buildTeamGameReport(bundle,roster,COURT_ZONES):null;
  const pendingPlayers=bundle && typeof window!=='undefined' ? bundle.members.filter(member=>{
    try { return loadRecovery(window.localStorage,accountId,member.player_id)?.pending.length; }
    catch { return true; } // Damaged local data must not be mistaken for a synced row.
  }).map(member=>member.player_id) : [];
  return <section className="coach-workspace" aria-label="Coach roster workspace">
    <div className="coach-heading"><div><p className="coach-eyebrow">Coach workspace</p><h2>{bundle?bundle.game.team_name:'One game. Your roster.'}</h2></div>
      <button onClick={onToggleTheme} aria-label={`Switch to ${darkMode?'light':'dark'} mode`}>{darkMode?'Light mode':'Dark mode'}</button></div>
    <p className="coach-note">Owner-managed players only. Assistant, parent and player invitations are not enabled.</p>
    {error&&<p role="alert" className="coach-error">{error}</p>}
    {!bundle?<>
      <div className="coach-actions"><button disabled={loading||busy} onClick={loadIndex}>Refresh roster</button>{onManagePlayers&&<button onClick={onManagePlayers}>Manage players</button>}</div>
      {loading?<p role="status">Loading your roster…</p>:<>
        {games.length>0&&<section className="coach-games" aria-label="Saved roster games"><h3>Pick up where you left off</h3>{games.map(game=><button key={game.id} disabled={busy} onClick={()=>openGame(game.id)}><strong>{game.team_name}{game.context.opponent?` vs ${game.context.opponent}`:''}</strong><span>{game.context.date} · {game.status==='active'?'Resume game':'View report'}</span></button>)}</section>}
        <form onSubmit={startGame} aria-label="Start roster game"><h3>Start a roster game</h3>
          <fieldset disabled={busy||!!requestRef.current}><label>Team name<input required maxLength={100} value={teamName} onChange={event=>setTeamName(event.target.value)} /></label>
            <GameContextForm value={context} onChange={setContext} includeScores={false} />
            <h3>Who are you recording?</h3><p className="coach-note">Choose 1–30 of your managed players. No one is enrolled or invited by this selection.</p>
            <div className="coach-roster-options">{roster.map(player=><label key={player.id}><input type="checkbox" checked={selectedIds.includes(player.id)} onChange={event=>setSelectedIds(ids=>event.target.checked?[...ids,player.id]:ids.filter(id=>id!==player.id))} /><span><strong>#{player.jersey_number ?? '—'} {player.name}</strong><small>{player.position}{player.team_name?` · ${player.team_name}`:''}</small></span></label>)}</div>
          </fieldset>
          {!roster.length&&<p>Add a managed player from your profile before starting.</p>}
          <button className="coach-primary" disabled={busy||!teamName.trim()||!selectedIds.length||selectedIds.length>30} type="submit">{busy?'Creating…':requestRef.current?'Retry game creation':`Start with ${selectedIds.length} players`}</button>
        </form>
      </>}
    </>:<>
      <p className="coach-subheading">{bundle.game.context.opponent?`vs ${bundle.game.context.opponent} · `:''}{bundle.game.context.date} · {bundle.game.context.season || 'Season not entered'}</p>
      <div className="coach-actions"><button disabled={busy} onClick={()=>{setBundle(null);loadIndex();}}>All games</button><button disabled={busy} onClick={()=>openGame(bundle.game.id)}>Reload game</button><button onClick={()=>exportReport(report)}>Export roster CSV</button>{bundle.game.status==='completed'&&<button disabled={report.missing>0||pendingPlayers.length>0} onClick={()=>setShowCard(true)}>Social card</button>}</div>
      {report.missing>0&&<p role="alert">{report.missing} roster records are missing. These totals are incomplete; finishing is blocked.</p>}
      {pendingPlayers.length>0&&<p role="status" className="coach-error">{pendingPlayers.length} players have pending device entries. Saved totals below exclude those entries until synced. Open the marked players and choose Retry sync.</p>}
      <div className="coach-totals" aria-label="Recorded roster totals">{[['Recorded PTS',report.totals.pts],['AST',report.totals.box.ast],['REB',report.totals.box.reb],['FG',`${report.totals.fgm}/${report.totals.fga}`]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p className="coach-note">Recorded roster totals, not the official score. FG% {percent(report.totals.fgPct)} · FT {report.totals.ftm}/{report.totals.fta} · 3PT {report.totals.threeMade}/{report.totals.threeAttempts}. Unlogged events are excluded.</p>
      <p className="coach-note">eFG% {percent(report.totals.efgPct)} · Estimated TS% {percent(report.totals.tsPct)}. TS uses the conventional 0.44 free-throw approximation, not measured possessions.</p>
      {bundle.game.status==='active'&&<div className="coach-reference"><label>Recording period<input type="number" min={1} max={99} value={period} onChange={event=>setPeriod(Math.max(1,Math.min(99,Number(event.target.value))))} /></label><label>Clock reference<input value={clock} onChange={event=>{if(/^\d{0,2}:?\d{0,2}$/.test(event.target.value))setClock(event.target.value);}} onBlur={()=>{if(!/^\d{1,2}:[0-5]\d$/.test(clock))setClock('00:00');}} /></label><p className="coach-note">Manual reference shared by player inputs; not an automatic timer or player minutes.</p></div>}
      <h3>{bundle.game.status==='active'?'Choose the player making the play':'Player box scores'}</h3>
      <div className="coach-player-cards">{report.rows.map(row=><article key={row.playerId}><div><h4>#{row.jersey === '' ? '—' : row.jersey} {row.name}</h4><p>{row.report.pts} PTS · {row.report.box.ast} AST · {row.report.box.reb} REB</p><small>FG {row.report.fgm}/{row.report.fga} · FT {row.report.ftm}/{row.report.fta} · {row.report.box.min || '—'} MIN</small>{bundle.game.status==='completed'&&<p>{row.report.box.stl} STL · {row.report.box.blk} BLK · {row.report.box.to} TO · {row.report.box.pf} PF</p>}{pendingPlayers.includes(row.playerId)&&<p>Pending device entries — retry sync</p>}</div><button className={bundle.game.status==='active'?'coach-primary':''} disabled={busy} onClick={()=>setSelected(row.playerId)} aria-label={bundle.game.status==='active'?`Track ${row.name}`:`View ${row.name} report`}>{bundle.game.status==='active'?'Track':'Report'}</button></article>)}</div>
      {bundle.game.status==='active'?<section className="coach-finish"><h3>Finish together</h3><p className="coach-note">Final scores are optional. Every player must be synced; completion is one checked transaction.</p><div className="coach-reference"><label>Final team score<input type="number" min={0} max={999} value={scores.team} onChange={event=>setScores({...scores,team:event.target.value})} /></label><label>Final opponent score<input type="number" min={0} max={999} value={scores.opponent} onChange={event=>setScores({...scores,opponent:event.target.value})} /></label></div><button className="coach-primary" disabled={busy||report.missing>0} onClick={finishGame}>{busy?'Checking all player records…':'Finish roster game'}</button></section>:<p role="status">Completed game{bundle.game.context.team_score!==null&&bundle.game.context.team_score!==undefined?` · Final score ${bundle.game.context.team_score}–${bundle.game.context.opponent_score}`:' · Final score not entered'}. Player records are saved.</p>}
    </>}
    {showCard&&bundle&&<SocialReportCard kind="roster" report={report.totals} playerName={bundle.game.team_name} defaultTitle="Roster recap" date={bundle.game.context.date} scope="Recorded roster stats · not the final team score" onClose={()=>setShowCard(false)}/>}
  </section>;
}
