"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchManagedPlayers, fetchSessionHistory } from "@/lib/queries";
import { computeSkillRatings, computeSeasonStats } from "@/lib/intelligence";
import { calcPct } from "@/lib/utils";
import Icon from "@/components/ui/Icons";

const cardStyle = {
  background: "var(--color-card)",
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-card)",
  padding: 16,
};

const thStyle = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--color-text-sec)",
  textAlign: "center",
  padding: "8px 8px",
  textTransform: "uppercase",
};

const tdStyle = {
  textAlign: "center",
  padding: "12px 8px",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--color-text)",
};

export default function CoachDashboard() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchManagedPlayers(user.id).then(async (managed) => {
      if (managed.length <= 1) { setLoading(false); return; }
      // Fetch stats for each player
      const enriched = await Promise.all(managed.map(async (p) => {
        const sessions = await fetchSessionHistory(p.id);
        const ratings = sessions.length > 0 ? computeSkillRatings(sessions) : null;
        const season = sessions.length > 0 ? computeSeasonStats(sessions) : null;
        return { ...p, ratings, season, sessionCount: sessions.length };
      }));
      setPlayers(enriched);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (loading) return <div style={{ height: 192, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />;
  if (players.length <= 1) return null;

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", marginBottom: 16 }}>Player Comparison</h3>

      {/* Comparison table */}
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", minWidth: 400, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left", paddingLeft: 16 }}>Player</th>
                <th style={thStyle}>OVR</th>
                <th style={thStyle}>PPG</th>
                <th style={thStyle}>FG%</th>
                <th style={thStyle}>APG</th>
                <th style={thStyle}>RPG</th>
                <th style={thStyle}>GP</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "12px 12px 12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "rgba(255,107,53,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 900,
                        color: "var(--color-accent)",
                      }}>
                        #{p.jersey_number || 0}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: "var(--color-text-sec)" }}>{p.position}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 900, color: (p.ratings?.overall || 0) >= 60 ? "var(--color-accent)" : "var(--color-text-sec)" }}>
                      {p.ratings?.overall || "-"}
                    </span>
                  </td>
                  <td style={tdStyle}>{p.season?.ppg || "-"}</td>
                  <td style={{ ...tdStyle, color: (p.season?.fgPct || 0) >= 45 ? "var(--color-success)" : "var(--color-text-sec)" }}>
                    {p.season?.fgPct ? `${p.season.fgPct}%` : "-"}
                  </td>
                  <td style={tdStyle}>{p.season?.apg || "-"}</td>
                  <td style={tdStyle}>{p.season?.rpg || "-"}</td>
                  <td style={{ ...tdStyle, color: "var(--color-text-sec)" }}>{p.season?.gamesPlayed || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rating bars comparison */}
      <div style={{ marginTop: 24 }}>
        <h4 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 12 }}>Skill Comparison</h4>
        {["shooting", "playmaking", "rebounding", "defense", "efficiency"].map((skill) => (
          <div key={skill} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "var(--color-text-sec)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{skill}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {players.map((p) => {
                const val = p.ratings?.[skill] || 0;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text)", width: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name.split(" ")[0]}
                    </span>
                    <div style={{ flex: 1, height: 8, background: "var(--color-muted)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 4, background: "var(--color-accent)", width: `${val}%`, transition: "width 0.5s ease" }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-accent)", width: 24, textAlign: "right" }}>{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
