"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { fetchManagedPlayers, fetchSessionHistory, issuePlayerInvite,
  acceptPlayerInvite, fetchPlayerShares, revokePlayerShare } from "@/lib/queries";
import { computeSkillRatings, computeSeasonStats } from "@/lib/intelligence";
import { computeNextMove } from "@/lib/nextMove.mjs";
import Icon from "@/components/ui/Icons";
import RecordsUnavailable from "@/components/ui/RecordsUnavailable";
import "./family-sharing.css";

export default function FamilyDashboard({ onManagePlayers }) {
  const { user, playerProfile, switchToManagedPlayer } = useAuth();
  const { setScreen } = useApp();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [switchingId, setSwitchingId] = useState(null);
  const [reload,setReload]=useState(0);
  const [joinCode,setJoinCode]=useState('');
  const [shareBusy,setShareBusy]=useState(false);
  const [shareError,setShareError]=useState('');
  const [shareMessage,setShareMessage]=useState('');
  const [inviteCode,setInviteCode]=useState('');
  const [sharePlayer,setSharePlayer]=useState(null);
  const [sharePanelOpen,setSharePanelOpen]=useState(false);
  const [sharedMembers,setSharedMembers]=useState([]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoading(true);
    setError(false);

    fetchManagedPlayers(user.id)
      .then(async (managed) => {
        const enriched = await Promise.all(managed.map(async (player) => {
          const sessions = await fetchSessionHistory(player.id);
          const ratings = sessions.length ? computeSkillRatings(sessions) : null;
          const season = sessions.length ? computeSeasonStats(sessions) : null;
          const nextMove = computeNextMove(sessions, ratings);
          return { ...player, sessions, ratings, season, nextMove };
        }));
        if (active) setPlayers(enriched);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [user?.id,reload]);

  const openPlayer = async player => {
    if (switchingId) return;
    setSwitchingId(player.id);
    setSwitchError("");
    try {
      await switchToManagedPlayer(player.id);
      setScreen("home");
    } catch {
      setSwitchError("Could not verify this player. The currently selected profile is unchanged.");
    } finally {
      setSwitchingId(null);
    }
  };

  const joinFamilyPlayer=async event=>{
    event.preventDefault();
    if(shareBusy)return;
    setShareBusy(true);setShareError('');setShareMessage('');
    try{
      const playerId=await acceptPlayerInvite(joinCode);
      setJoinCode('');setReload(value=>value+1);
      await switchToManagedPlayer(playerId);
      setShareMessage('Player successfully shared. You can now track the same game using your own sign-in.');
    }catch(err){setShareError(err?.message||'Unable to accept invitation. Ask the owner for a new code.');}
    finally{setShareBusy(false);}
  };
  const createInvite=async player=>{
    if(shareBusy)return;
    setShareBusy(true);setShareError('');setShareMessage('');setInviteCode('');
    try{
      const [code,members]=await Promise.all([issuePlayerInvite(player.id),fetchPlayerShares(player.id)]);
      setSharePlayer(player);setSharedMembers(members);setInviteCode(code);setSharePanelOpen(true);
      setShareMessage('Share the one-time code privately. It expires in 48 hours. Only the player manager can revoke access.');
    }catch(err){setShareError(err?.message||'Could not issue invitation.');}
    finally{setShareBusy(false);}
  };
  const removeShare=async uid=>{
    if(!sharePlayer||shareBusy)return;
    if(!window.confirm('Revoke this parent\'s access to the selected player and their game statistics?'))return;
    setShareBusy(true);setShareError('');
    try{
      await revokePlayerShare(sharePlayer.id,uid);
      setSharedMembers(current=>current.filter(row=>row.member_uid!==uid));
      setShareMessage('Access revoked on the server. Locally downloaded copies cannot be recalled.');
    }catch(err){setShareError(err?.message||'Could not revoke access.');}
    finally{setShareBusy(false);}
  };

  if (error) return <RecordsUnavailable />;
  if (loading) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {[1, 2].map((item) => <div key={item} style={{ height: 150, borderRadius: 20, background: "var(--color-muted)" }} />)}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={{ background: "linear-gradient(135deg, #1E2A44, #2F4F7F)", color: "white", borderRadius: 24, padding: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.7 }}>Family workspace</div>
        <h2 style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 950 }}>Every player in one place.</h2>
        <p style={{ margin: "8px 0 0", maxWidth: 620, fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.75)" }}>
          Switch players, compare progress and see the next development priority without signing in and out of separate accounts.
        </p>
        <button type="button" onClick={onManagePlayers} style={{ marginTop: 16, minHeight: 44, border: 0, borderRadius: 12, padding: "0 15px", background: "white", color: "#1E2A44", fontWeight: 900, cursor: "pointer" }}>
          Manage players
        </button>
      </section>

      {switchError && <p role="alert" style={{ color: "var(--color-danger)", fontSize: 13 }}>{switchError}</p>}
      <details className="family-share-panel" open={sharePanelOpen} onToggle={event=>setSharePanelOpen(event.currentTarget.open)}>
        <summary>Share a player across parent accounts</summary>
        <p>Each parent signs in separately. The player manager provides a one-time private code. Both accounts then use the same player profile and game history.</p>
        <form onSubmit={joinFamilyPlayer} className="family-share-join">
          <label>Join a shared player
            <input autoComplete="off" spellCheck="false" value={joinCode}
              onChange={event=>setJoinCode(event.target.value.trim())}
              placeholder="CI-… (code from the other parent)"
              maxLength={51} required />
          </label>
          <button type="submit" disabled={shareBusy||!joinCode}>Join player</button>
        </form>
        {sharePlayer&&<div className="family-share-access">
          <strong>Sharing {sharePlayer.name}</strong>
          {inviteCode&&<div className="family-invite-code">
            <label>Private invitation code <input readOnly value={inviteCode} onFocus={event=>event.target.select()}/></label>
            <button type="button" onClick={async()=>{
              try{await navigator.clipboard.writeText(inviteCode);setShareMessage('Invitation code copied. Send it privately to the other parent.');}
              catch{setShareMessage('Select and copy the code above.');}
            }}>Copy code</button>
          </div>}
          <p>Accepted parent accounts: {sharedMembers.length}</p>
          {sharedMembers.map(member=><div key={member.member_uid} className="family-share-member">
            <span>Parent account …{member.member_uid.slice(-6)}</span>
            <button type="button" disabled={shareBusy} onClick={()=>removeShare(member.member_uid)}>Revoke access</button>
          </div>)}
          <button type="button" disabled={shareBusy} onClick={async()=>{
            try{const people=await fetchPlayerShares(sharePlayer.id);setSharedMembers(people);}
            catch{setShareError('Unable to refresh parent access.');}
          }}>Refresh access list</button>
        </div>}
        {shareError&&<p role="alert">{shareError}</p>}
        {shareMessage&&<p role="status">{shareMessage}</p>}
      </details>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {players.map((player) => {
          const active = playerProfile?.id === player.id;
          const games = Number(player.season?.gamesPlayed || 0);
          return (
            <article key={player.id} style={{ background: "var(--color-card)", border: active ? "2px solid #FF6B35" : "1px solid var(--color-border)", borderRadius: 20, padding: 18, boxShadow: "var(--shadow-card)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", background: active ? "#FF6B35" : "var(--color-muted)", color: active ? "white" : "var(--color-text)", fontWeight: 950 }}>
                  #{player.jersey_number || 0}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 2 }}>
                    {player.position || "Player"}{player.team_name ? " · " + player.team_name : ""}{player.age ? " · " + player.age + "yr" : ""}
                  </div>
                </div>
                {active && <span style={{ fontSize: 9, fontWeight: 900, color: "#FF6B35" }}>ACTIVE</span>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginTop: 16 }}>
                {[
                  ["IQ", player.ratings?.overall ?? "—"],
                  ["Games", games],
                  ["PPG", player.season?.ppg ?? "—"],
                  ["FG%", player.season?.fgPct != null ? player.season.fgPct + "%" : "—"],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "var(--color-muted)", borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 950, color: "var(--color-text)" }}>{value}</div>
                    <div style={{ marginTop: 2, fontSize: 8, fontWeight: 800, color: "var(--color-text-sec)", textTransform: "uppercase" }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, borderRadius: 14, padding: 12, background: "rgba(139,92,246,0.08)" }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 0.8 }}>Next move</div>
                <div style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text)", marginTop: 4 }}>{player.nextMove.title}</div>
              </div>

              {player.manager_uid===user?.id
                ? <button type="button" onClick={()=>{
                    createInvite(player);
                  }} disabled={shareBusy} className="family-invite-button">
                    Invite another parent
                  </button>
                : <div className="family-shared-label">Shared by another parent · game stats available</div>}
              {!active && (
                <button type="button" onClick={() => openPlayer(player)} disabled={!!switchingId} style={{ width: "100%", marginTop: 14, minHeight: 44, border: 0, borderRadius: 12, background: "#FF6B35", color: "white", fontWeight: 900, cursor: "pointer" }}>
                  {switchingId === player.id ? "Switching…" : <>Use {player.name.split(" ")[0]}&apos;s profile</>}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {players.length === 0 && (
        <div style={{ textAlign: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 20, padding: 32 }}>
          <Icon name="user" size={32} color="#FF6B35" />
          <div style={{ marginTop: 10, fontWeight: 900, color: "var(--color-text)" }}>No player profiles yet</div>
          <button type="button" onClick={onManagePlayers} style={{ marginTop: 14, minHeight: 44, border: 0, borderRadius: 12, padding: "0 16px", background: "#FF6B35", color: "white", fontWeight: 900 }}>Add a player</button>
        </div>
      )}
    </div>
  );
}
