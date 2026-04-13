"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchManagedPlayers, addManagedPlayer, deleteManagedPlayer } from "@/lib/queries";
import Icon from "@/components/ui/Icons";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

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
  const { user, playerProfile, setPlayerProfile } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: "", position: "PG", jersey_number: "", age: "", team_name: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchManagedPlayers(user.id).then((p) => {
      setPlayers(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const handleAdd = async () => {
    if (!newPlayer.name.trim()) return;
    setSaving(true);
    try {
      const p = await addManagedPlayer(user.id, {
        ...newPlayer,
        jersey_number: newPlayer.jersey_number ? parseInt(newPlayer.jersey_number) : null,
        age: newPlayer.age ? parseInt(newPlayer.age) : null,
      });
      setPlayers((prev) => [...prev, p]);
      setNewPlayer({ name: "", position: "PG", jersey_number: "", age: "", team_name: "" });
      setShowAdd(false);
    } catch (err) {
      console.error("Failed to add player:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = (player) => {
    setPlayerProfile(player);
    if (onSwitch) onSwitch(player);
    onClose();
  };

  const handleDelete = async (playerId) => {
    if (!window.confirm("Delete this player and all their data?")) return;
    try {
      await deleteManagedPlayer(playerId);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      // If deleted the active player, switch to first remaining
      if (playerProfile?.id === playerId && players.length > 1) {
        const remaining = players.find((p) => p.id !== playerId);
        if (remaining) handleSwitch(remaining);
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  return (
    <div style={{
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
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: "var(--color-muted)", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>Players</h2>
        <p style={{ fontSize: 13, color: "var(--color-text-sec)", margin: "0 0 16px" }}>Switch between players or add a new one</p>

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
                    <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>{p.position} {p.team_name ? `· ${p.team_name}` : ""} {p.age ? `· ${p.age}yr` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {!isActive && (
                      <button onClick={() => handleSwitch(p)}
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
                        Switch
                      </button>
                    )}
                    {isActive && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-accent)" }}>Active</span>
                    )}
                    {players.length > 1 && (
                      <button onClick={() => handleDelete(p.id)}
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

        {/* Add new player */}
        {showAdd ? (
          <div style={{
            background: "var(--color-card)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid var(--color-border)",
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", margin: "0 0 12px" }}>Add Player</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                placeholder="Player name" required style={inputStyle} />
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
                    placeholder="Age" style={inputStyle} />
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
            <Icon name="plus" size={16} /> Add Another Player
          </button>
        )}
      </div>
    </div>
  );
}
