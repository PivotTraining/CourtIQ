"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchManagedPlayers, addManagedPlayer, deleteManagedPlayer,
  createPlayerShareInvite, joinSharedPlayer, getPlayerCollaborators,
  revokePlayerShare, fetchSessionHistory, importSharedGame,
  fuseSharedGame, undoSharedGameFusion, fetchSharedGameFusions } from "@/lib/queries";
import Icon from "@/components/ui/Icons";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const FUSION_STATS = [["ast","Assists"],["reb","Rebounds (including splits)"],["stl","Steals"],
  ["blk","Blocks"],["to","Turnovers"],["pf","Fouls"],["min","Minutes"]];
const sameGame = (source,canonical) => source?.date === canonical?.date
  && (!source?.tracker_context?.opponent || !canonical?.tracker_context?.opponent
    || source.tracker_context.opponent.trim().toLowerCase() === canonical.tracker_context.opponent.trim().toLowerCase());

const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-input-bg)",
  fontSize: 15,
  color: "var(--color-text)",
  outline: "none",
  boxSizing: "border-box",
};

export default function PlayerSwitcher({ onClose, onSwitch }) {
  const { user, playerProfile, switchToManagedPlayer } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: "", position: "PG", jersey_number: "", age: "", team_name: "" });
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [error, setError] = useState("");
  const [invitationInput, setInvitationInput] = useState("");
  const [shareTarget, setShareTarget] = useState(null);
  const [shareCode, setShareCode] = useState("");
  const [shareRole, setShareRole] = useState("editor");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [collaborators, setCollaborators] = useState([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [importSource, setImportSource] = useState("");
  const [importTarget, setImportTarget] = useState("");
  const [importGames, setImportGames] = useState([]);
  const [canonicalGames, setCanonicalGames] = useState([]);
  const [fusionSourceId, setFusionSourceId] = useState("");
  const [fusionTargetId, setFusionTargetId] = useState("");
  const [fieldSources, setFieldSources] = useState({});
  const [shootingSource, setShootingSource] = useState("canonical");
  const [lastFusionId, setLastFusionId] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchManagedPlayers(user.id).then((p) => {
      if (!active) return;
      setPlayers(p);
      setLoading(false);
    }).catch(() => { if (active) { setError("Players couldn't be loaded. Please close this panel and try again."); setLoading(false); } });
    return () => { active = false; };
  }, [user]);

  const handleAdd = async () => {
    if (saving || !newPlayer.name.trim()) return;
    const age = newPlayer.age ? parseInt(newPlayer.age) : null;
    if (age !== null && age < 13) { setError("Under-13 managed profiles are paused until CourtIQ has a verified guardian-consent workflow."); return; }
    setSaving(true);
    setError("");
    try {
      const p = await addManagedPlayer(user.id, {
        ...newPlayer,
        jersey_number: newPlayer.jersey_number ? parseInt(newPlayer.jersey_number) : null,
        age,
      });
      setPlayers((prev) => [...prev, p]);
      setNewPlayer({ name: "", position: "PG", jersey_number: "", age: "", team_name: "" });
      setShowAdd(false);
    } catch (err) {
      console.error("Failed to add player:", err);
      setError("Player wasn't added. Check your connection and permissions, then try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = async player => {
    if (switchingId || saving || !switchToManagedPlayer) return;
    setSwitchingId(player.id);
    setError("");
    try {
      const verified = await switchToManagedPlayer(player.id);
      onSwitch?.(verified);
      onClose();
    } catch {
      setError("Could not verify this player under your parent account. Your current player has not changed. Try again.");
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDelete = async (playerId) => {
    if (saving || switchingId) return;
    if (playerProfile?.id === playerId) {
      setError("Switch to a different player before removing this profile.");
      return;
    }
    if (!window.confirm("Permanently delete this player and all their games, shots, training results and other records? This cannot be undone.")) return;
    setSaving(true);
    setError("");
    try {
      await deleteManagedPlayer(playerId);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));

    } catch (err) {
      console.error("Failed to delete:", err);
      setError("Player wasn't deleted. Your records have not been cleared. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const refreshPlayers = async () => {
    const updated = await fetchManagedPlayers(user.id);
    setPlayers(updated);
    return updated;
  };

  const handleJoin = async () => {
    if (shareBusy || !user?.id) return;
    setShareBusy(true); setError(""); setMessage("");
    try {
      const linkedPlayerId = await joinSharedPlayer(invitationInput);
      setInvitationInput("");
      const updated = await refreshPlayers();
      const selected = updated.find(p => p.id === linkedPlayerId);
      if (!selected) throw new Error("The shared player could not be verified.");
      setMessage(`${selected.name} is now shared with this account. Select the profile to see synced games.`);
    } catch {
      setError("Could not accept that invite. Confirm the full code is correct, unused, and less than 24 hours old.");
    } finally { setShareBusy(false); }
  };

  const handleInvite = async (player) => {
    if (shareBusy || player.manager_uid !== user?.id) return;
    setShareBusy(true); setError(""); setMessage(""); setShareCode("");
    try {
      const code = await createPlayerShareInvite(player.id, recipientEmail, shareRole);
      setShareTarget(player.id);
      setShareCode(code);
      const members = await getPlayerCollaborators(player.id);
      setCollaborators(members);
      setMessage("Send this one-time code privately to the invited email owner. It expires in 24 hours and cannot be redeemed from a different Google account.");
    } catch {
      setError("Could not create a family invite. Check your connection and try again.");
    } finally { setShareBusy(false); }
  };

  const handleShowCollaborators = async (player) => {
    setShareTarget(player.id); setShareCode(""); setError(""); setMessage("");
    try { setCollaborators(await getPlayerCollaborators(player.id)); }
    catch { setCollaborators([]); setError("Couldn't load the linked parents."); }
  };

  const handleRevoke = async (playerId, accountId) => {
    if (shareBusy || !window.confirm("Remove this parent's access to this player? Their separate original game records will not be deleted.")) return;
    setShareBusy(true); setError("");
    try {
      await revokePlayerShare(playerId, accountId);
      setCollaborators((prev) => prev.filter(m => m.account_id !== accountId));
    } catch { setError("Could not revoke access. Try again."); }
    finally { setShareBusy(false); }
  };

  const handleLoadGames = async (sourceId) => {
    setImportSource(sourceId); setImportGames([]); setCanonicalGames([]);
    setFusionSourceId(""); setFusionTargetId(""); setLastFusionId(""); setError("");
    if (!sourceId || !importTarget) return;
    try {
      const [sourceHistory,targetHistory] = await Promise.all([
        fetchSessionHistory(sourceId),fetchSessionHistory(importTarget),
      ]);
      const oldGames = sourceHistory.filter(g => g.type === "game"
        && g.mode === "individual" && g.tracker_status !== "active");
      const alreadyFused = await fetchSharedGameFusions(oldGames.map(g => g.id));
      const fusedSourceIds = new Set(alreadyFused.map(x => x.source_session_id));
      setImportGames(oldGames.filter(g => !fusedSourceIds.has(g.id)));
      setCanonicalGames(targetHistory.filter(g => g.type === "game"
        && g.mode === "individual" && g.tracker_status !== "active"));
    } catch { setError("Couldn't load both game histories. Your existing records are unchanged."); }
  };

  const handleFuse = async () => {
    if (importBusy || !fusionSourceId || !fusionTargetId) return;
    const source = importGames.find(g => g.id === fusionSourceId);
    const target = canonicalGames.find(g => g.id === fusionTargetId);
    if (!source || !target || !sameGame(source,target)) {
      setError("Both recordings must refer to the same game date and opponent."); return;
    }
    if (!window.confirm("Fuse these two recordings into one official game? The original recording is retained for audit and Undo. Selected fields and one complete shot chart replace the existing game values, never add to them.")) return;
    setImportBusy(true); setError(""); setMessage("");
    try {
      const fusionId = await fuseSharedGame(target.id,source.id,fieldSources,shootingSource);
      setLastFusionId(fusionId);
      setImportGames(prev => prev.filter(g => g.id !== source.id));
      setFusionSourceId(""); setFusionTargetId("");
      setMessage("Game fusion saved. The shared player now uses the selected box-score fields and one authoritative shot chart. Refresh game history on either phone.");
    } catch {
      setError("Fusion wasn't saved. Check that both games are completed, the date/opponent match, and no other parent fused them first. Both records are preserved.");
    } finally { setImportBusy(false); }
  };

  const handleUndoFusion = async () => {
    if (!lastFusionId || importBusy || !window.confirm("Undo the latest game fusion and restore the exact previous shared-game stats and shots?")) return;
    setImportBusy(true);setError("");
    try {
      await undoSharedGameFusion(lastFusionId);
      setLastFusionId("");
      setFusionSourceId("");setFusionTargetId("");
      setMessage("Fusion undone. Previous shared-game values were restored. Select the original player again to reload eligible games.");
      await handleLoadGames(importSource);
    } catch {
      setError("Undo could not be completed. The game may have changed or sharing access may have been revoked.");
    } finally {setImportBusy(false);}
  };

  const handleImport = async (game) => {
    if (importBusy || !importSource || !importTarget) return;
    const source = players.find(p => p.id === importSource);
    const destination = players.find(p => p.id === importTarget);
    if (!source || source.manager_uid !== user?.id || !destination || destination.manager_uid === user?.id) {
      setError("Choose a player owned by this account and an editor-shared destination."); return;
    }
    if (!window.confirm(`Move this saved game from ${source.name} to ${destination.name}?
This transfers the record, not a copy. If both phones tracked the same game, cancel to avoid counting it twice.`)) return;
    setImportBusy(true); setError(""); setMessage("");
    try {
      await importSharedGame(source.id,destination.id,game.id);
      setImportGames(prev => prev.filter(g => g.id !== game.id));
      setMessage("Game moved to the shared player. Both linked parent accounts can now see it.");
    } catch {
      setError("Game wasn't transferred. It may match another game already saved on that date, or you may have view-only access. Nothing was deleted.");
    } finally { setImportBusy(false); }
  };

  return (
    <div role="presentation" style={{
      position: "fixed",
      inset: 0,
      zIndex: 250,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        width: "100%",
        maxWidth: 520,
        background: "var(--color-card)",
        borderRadius: "20px 20px 0 0",
        padding: 24,
        paddingBottom: 32,
        maxHeight: "85vh",
        overflowY: "auto",
      }} role="dialog" aria-modal="true" aria-label="Choose a family player" onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: "var(--color-muted)", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>Who is playing?</h2>
        <p style={{ fontSize: 13, color: "var(--color-text-sec)", margin: "0 0 16px" }}>One player history. Linked parents can record and review the same player once access is accepted.</p>
        {message && <p role="status" style={{ fontSize: 13, color: "var(--color-accent)" }}>{message}</p>}
        {error && <p role="alert" style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2].map((i) => <div key={i} style={{ height: 64, background: "var(--color-muted)", borderRadius: 16 }} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {players.map((p) => {
              const isActive = playerProfile?.id === p.id;
              return (
                <div key={p.id} style={{
                  background: "var(--color-card)",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: `${isActive ? 2 : 1}px solid ${isActive ? "var(--color-accent)" : "var(--color-border)"}`,
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 15,
                    color: isActive ? "white" : "var(--color-text-sec)",
                    background: isActive ? "var(--color-accent)" : "var(--color-muted)",
                    flexShrink: 0,
                  }}>
                    #{p.jersey_number || 0}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>{p.manager_uid !== user?.id ? "Shared by another parent · " : ""}{p.position} {p.team_name ? `· ${p.team_name}` : ""} {p.age ? `· ${p.age}yr` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {!isActive && (
                      <button onClick={() => handleSwitch(p)} disabled={!!switchingId || saving}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 12,
                          background: "var(--color-accent)",
                          color: "white",
                          fontSize: 12,
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                          minHeight: 44,
                        }}>
                        {switchingId === p.id ? "Switching…" : "Use profile"}
                      </button>
                    )}
                    {isActive && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-accent)" }}>Selected</span>
                    )}
                    {p.manager_uid === user?.id && (
                      <button type="button" onClick={() => handleShowCollaborators(p)} disabled={shareBusy}
                        title={`Share ${p.name} with another parent`}
                        style={{ minHeight: 44, padding: "8px 7px", border: "none", borderRadius: 8,
                          background: "var(--color-accent-light)", color: "var(--color-accent)",
                          cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Share</button>
                    )}
                    {players.length > 1 && !isActive && p.manager_uid === user?.id && p.firebase_uid !== user?.id && (
                      <button onClick={() => handleDelete(p.id)} disabled={saving || !!switchingId} aria-label={`Permanently delete ${p.name} and all records`}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "rgba(220,38,38,0.1)",
                          color: "#DC2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "none",
                          cursor: "pointer",
                          minHeight: 44,
                          minWidth: 44,
                        }}>
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Access belongs to an explicit named player, never the whole family. */}
        <div style={{ padding: 16, borderRadius: 16, background: "var(--color-muted)",
          border: "1px solid var(--color-border)", display: "grid", gap: 10, marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: "var(--color-text)", fontSize: 15 }}>Connect another parent&apos;s phone</h3>
          <p style={{ margin: 0, color: "var(--color-text-sec)", fontSize: 12, lineHeight: 1.55 }}>
            Already received a private player-sharing code? Paste it here to connect the same player record.
            Existing games on the original profile are not automatically combined.
          </p>
          <input value={invitationInput} onChange={e => setInvitationInput(e.target.value)}
            aria-label="Player sharing invitation code" placeholder="Paste the 64-character sharing code"
            autoComplete="off" style={inputStyle} />
          <button type="button" onClick={handleJoin}
            disabled={shareBusy || !/^[a-f0-9]{64}$/i.test(invitationInput.trim())}
            style={{ padding: 12, border: "none", borderRadius: 12, fontWeight: 750,
              background: "var(--color-accent)", color: "#fff", minHeight: 44,
              opacity: /^[a-f0-9]{64}$/i.test(invitationInput.trim()) && !shareBusy ? 1 : 0.55 }}>
            {shareBusy ? "Connecting…" : "Accept player invite"}
          </button>
          {shareTarget && players.find(p => p.id === shareTarget)?.manager_uid === user?.id && (
            <div style={{ display: "grid", gap: 9, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--color-text)" }}>
                Share {players.find(p => p.id === shareTarget)?.name}
              </div>
              <label style={{ fontSize: 12, color: "var(--color-text-sec)" }}>Other parent&apos;s Google account email
                <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
                  aria-label="Recipient parent email" autoComplete="email" type="email"
                  placeholder="parent@example.com" style={{ ...inputStyle, marginTop: 5 }} />
              </label>
              <select value={shareRole} onChange={e => setShareRole(e.target.value)}
                aria-label="Parent access level" style={inputStyle}>
                <option value="editor">Can view and track games</option>
                <option value="viewer">Can view stats only</option>
              </select>
              <button type="button" onClick={() => handleInvite(players.find(p => p.id === shareTarget))}
                disabled={shareBusy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())} style={{ minHeight: 44, borderRadius: 12,
                  background: "var(--color-accent-light)", color: "var(--color-accent)",
                  fontWeight: 800, border: "1px solid var(--color-accent)" }}>
                {shareBusy ? "Creating…" : "Generate private invite code"}
              </button>
              {shareCode && <>
                <textarea readOnly value={shareCode} aria-label="Private invitation code to copy"
                  rows={3} onFocus={e => e.target.select()}
                  style={{ ...inputStyle, fontSize: 12, wordBreak: "break-all" }} />
                <button type="button" onClick={async () => {
                  try { await navigator.clipboard.writeText(shareCode); setMessage("Copied. Send it privately to the other parent."); }
                  catch { setMessage("Select the code above to copy it manually."); }
                }} style={{ minHeight: 44, borderRadius: 12 }}>Copy invite code</button>
              </>}
              {collaborators.length > 0 && <>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Connected accounts</div>
                {collaborators.map(member => <div key={member.account_id}
                  style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center",
                    fontSize: 12, color: "var(--color-text-sec)" }}>
                  <span>{member.role === "viewer" ? "Viewer" : "Stat editor"} · account ending {member.account_id.slice(-6)}</span>
                  <button type="button" disabled={shareBusy}
                    onClick={() => handleRevoke(shareTarget,member.account_id)}
                    style={{ minHeight: 40, border: "none", borderRadius: 8,
                      background: "var(--color-card)", color: "var(--color-danger)", padding: "4px 10px" }}>
                    Remove access
                  </button>
                </div>)}
              </>}
            </div>
          )}
        </div>
        {players.some(p => p.manager_uid !== user?.id) && players.some(p => p.manager_uid === user?.id) && (
          <div style={{ display: "grid", gap: 10, marginBottom: 16, borderRadius: 16,
            padding: 16, border: "1px solid var(--color-border)" }}>
            <h3 style={{ fontSize: 15, margin: 0, color: "var(--color-text)" }}>Review older game records</h3>
            <p style={{ fontSize: 12, margin: 0, color: "var(--color-text-sec)", lineHeight: 1.5 }}>
              Two recordings of the same game can be fused into a single authoritative box score.
              Choose the source for each stat and one complete shot chart. CourtIQ never blindly adds two full-game totals.
              Games recorded on separate dates can be moved individually.
            </p>
            <label style={{ fontSize: 12 }}>Shared destination
              <select aria-label="Shared destination player" style={inputStyle} value={importTarget}
                onChange={e => { setImportTarget(e.target.value); setImportGames([]); setCanonicalGames([]); setImportSource(""); setFusionSourceId(""); setFusionTargetId(""); setLastFusionId(""); }}>
                <option value="">Choose a shared player</option>
                {players.filter(p => p.manager_uid !== user?.id).map(p =>
                  <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {importTarget && <label style={{ fontSize: 12 }}>Original player on this account
              <select aria-label="Original player profile" style={inputStyle} value={importSource}
                onChange={e => handleLoadGames(e.target.value)}>
                <option value="">Choose the source player</option>
                {players.filter(p => p.manager_uid === user?.id && p.id !== importTarget).map(p =>
                  <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>}
            {importSource && importGames.map(g => {
              const matches = canonicalGames.filter(c => sameGame(g,c));
              return <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "center",
                justifyContent: "space-between", borderBottom: "1px solid var(--color-border)", paddingBottom: 9 }}>
                <span style={{ fontSize: 12 }}>{g.date || g.created_at?.slice(0, 10)}
                  {g.tracker_context?.opponent ? ` · ${g.tracker_context.opponent}` : " · opponent not saved"}
                </span>
                {matches.length ? <button type="button" disabled={importBusy}
                    onClick={() => { setFusionSourceId(g.id); setFusionTargetId(matches[0].id);
                      setFieldSources({}); setShootingSource("canonical"); setLastFusionId(""); }}
                    style={{ minHeight: 44, padding: "8px 12px", fontSize: 12, borderRadius: 9, border: "none",
                      fontWeight: 700, background: "var(--color-accent-light)", color: "var(--color-accent)" }}>
                    Review &amp; fuse
                  </button> :
                  <button type="button" disabled={importBusy} onClick={() => handleImport(g)}
                    style={{ minHeight: 44, padding: "8px 12px", fontSize: 12, borderRadius: 9, border: "none",
                      fontWeight: 700, background: "var(--color-accent-light)", color: "var(--color-accent)" }}>
                    {importBusy ? "Moving…" : "Move game"}
                  </button>}
              </div>;
            })}
            {fusionSourceId && fusionTargetId && (() => {
              const source = importGames.find(g => g.id === fusionSourceId);
              const target = canonicalGames.find(g => g.id === fusionTargetId);
              if (!source || !target) return null;
              const options = canonicalGames.filter(c => sameGame(source,c));
              return <div style={{ padding: 14, borderRadius: 14, border: "1px solid var(--color-accent)",
                display: "grid", gap: 11, background: "var(--color-card)" }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Fuse this game: {source.date}</h4>
                <label style={{ fontSize: 12 }}>Official game to update
                  <select aria-label="Canonical game" value={fusionTargetId}
                    onChange={e => setFusionTargetId(e.target.value)} style={inputStyle}>
                    {options.map(c => <option key={c.id} value={c.id}>
                      {c.date} · {c.tracker_context?.opponent || "Opponent not recorded"} · {c.id.slice(-6)}
                    </option>)}
                  </select>
                </label>
                <p style={{ fontSize: 12, margin: 0, lineHeight: 1.55, color: "var(--color-text-sec)" }}>
                  Select whose recording is authoritative for each field. Existing values remain selected
                  unless you switch them. Rebound splits follow the rebound choice. Never add both totals.
                </p>
                {FUSION_STATS.map(([key,label]) => {
                  const current = target.game_stats?.[key];
                  const other = source.game_stats?.[key];
                  return <label key={key} style={{ display: "grid", gap: 5, fontSize: 12 }}>
                    <strong>{label}</strong>
                    <select aria-label={`Authoritative ${label}`} style={inputStyle}
                      value={fieldSources[key] || "canonical"}
                      onChange={e => setFieldSources(prev => ({ ...prev, [key]: e.target.value }))}>
                      <option value="canonical">Main phone: {current ?? "Not recorded"}</option>
                      <option value="source">Other phone: {other ?? "Not recorded"}</option>
                    </select>
                  </label>;
                })}
                <label style={{ display: "grid", gap: 5, fontSize: 12 }}>
                  <strong>Authoritative shot chart and shooting percentages</strong>
                  <select aria-label="Authoritative shooting record" value={shootingSource}
                    onChange={e => setShootingSource(e.target.value)} style={inputStyle}>
                    <option value="canonical">Main phone: {target.shot_logs?.length || 0} shot attempts</option>
                    <option value="source">Other phone: {source.shot_logs?.length || 0} shot attempts</option>
                  </select>
                </label>
                <p style={{ fontSize: 11, lineHeight: 1.5, margin: 0, color: "var(--color-text-sec)" }}>
                  Only one shot ledger is used; overlapping shots are not added together. The original is
                  preserved for review. Stats can be restored using Undo after saving.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" disabled={importBusy} onClick={() => {setFusionSourceId("");setFusionTargetId("");}}
                    style={{ minHeight: 44, padding: 10, flex: 1 }}>Cancel</button>
                  <button type="button" disabled={importBusy} onClick={handleFuse}
                    style={{ minHeight: 44, border: "none", borderRadius: 10, flex: 2, fontWeight: 800,
                      background: "var(--color-accent)", color: "white" }}>
                    {importBusy ? "Saving…" : "Save fused game"}
                  </button>
                </div>
              </div>;
            })()}
            {lastFusionId && <button type="button" onClick={handleUndoFusion} disabled={importBusy}
              style={{ minHeight: 44, border: "1px solid var(--color-border)", borderRadius: 10,
                padding: 10, background: "var(--color-card)", fontWeight: 700 }}>
              Undo latest game fusion
            </button>}
            {importSource && importGames.length === 0 && <p role="status" style={{ fontSize: 12 }}>
              No eligible saved individual games remain on that source profile.
            </p>}
          </div>
        )}

        {/* Add new player */}
        {showAdd ? (
          <div style={{
            background: "var(--color-card)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid var(--color-border)",
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", margin: "0 0 12px" }}>Add a player profile</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                placeholder="Child or player name" required style={inputStyle} />
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <select value={newPlayer.position} onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                    style={inputStyle}>
                    {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ width: 72 }}>
                  <input type="number" value={newPlayer.jersey_number} onChange={(e) => setNewPlayer({ ...newPlayer, jersey_number: e.target.value })}
                    placeholder="#" style={inputStyle} />
                </div>
                <div style={{ width: 64 }}>
                  <input type="number" value={newPlayer.age} onChange={(e) => setNewPlayer({ ...newPlayer, age: e.target.value })}
                    placeholder="Age" min="13" max="30" style={inputStyle} />
                </div>
              </div>
              <input value={newPlayer.team_name} onChange={(e) => setNewPlayer({ ...newPlayer, team_name: e.target.value })}
                placeholder="Team name (optional)" style={inputStyle} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowAdd(false)} style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  background: "var(--color-muted)",
                  color: "var(--color-text-sec)",
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  minHeight: 44,
                }}>Cancel</button>
                <button onClick={handleAdd} disabled={saving || !newPlayer.name.trim()} style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  background: "var(--color-accent)",
                  color: "white",
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  minHeight: 44,
                  opacity: saving || !newPlayer.name.trim() ? 0.5 : 1,
                }}>{saving ? "Adding..." : "Add Player"}</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)}
            style={{
              width: "100%",
              padding: "16px 0",
              borderRadius: 16,
              border: "2px dashed rgba(255,107,53,0.3)",
              background: "var(--color-accent-light)",
              color: "var(--color-accent)",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 44,
            }}>
            <Icon name="plus" size={16} /> Add another player
          </button>
        )}
        <p style={{ fontSize: 11, lineHeight: 1.6, color: "var(--color-text-sec)", marginTop: 14 }}>Parents control switching. New under-13 profiles require a verified guardian-consent workflow and cannot be created yet. Do not use an incorrect age to bypass that restriction.</p>
      </div>
    </div>
  );
}
