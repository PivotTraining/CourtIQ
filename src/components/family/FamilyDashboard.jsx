"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { fetchManagedPlayers, fetchSessionHistory } from "@/lib/queries";
import { computeSkillRatings, computeSeasonStats } from "@/lib/intelligence";
import { computeNextMove } from "@/lib/nextMove.mjs";
import Icon from "@/components/ui/Icons";
import RecordsUnavailable from "@/components/ui/RecordsUnavailable";

export default function FamilyDashboard({ onManagePlayers }) {
  const { user, playerProfile, setPlayerProfile } = useAuth();
  const { setScreen } = useApp();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
  }, [user?.id]);

  const openPlayer = (player) => {
    setPlayerProfile(player);
    setScreen("home");
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

              {!active && (
                <button type="button" onClick={() => openPlayer(player)} style={{ width: "100%", marginTop: 14, minHeight: 44, border: 0, borderRadius: 12, background: "#FF6B35", color: "white", fontWeight: 900, cursor: "pointer" }}>
                  Open {player.name.split(" ")[0]}'s dashboard
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
