"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchManagedPlayers, fetchSessionHistory } from "@/lib/queries";
import { computeTeamIQ, computeSkillRatings } from "@/lib/intelligence";
import Icon from "@/components/ui/Icons";

/* ── Radar chart — same structure as PlayerInsights but team-coloured ── */
function TeamRadar({ ratings }) {
  const categories = [
    { key: "shooting",   label: "SHOOT", angle: -90 },
    { key: "playmaking", label: "PLAY",  angle: -18 },
    { key: "efficiency", label: "EFF",   angle:  54 },
    { key: "defense",    label: "DEF",   angle: 126 },
    { key: "rebounding", label: "REB",   angle: 198 },
  ];
  const cx = 100, cy = 100, maxR = 70;
  const pt = (angle, pct) => {
    const r = (angle * Math.PI) / 180;
    return { x: cx + Math.cos(r) * maxR * (pct / 100), y: cy + Math.sin(r) * maxR * (pct / 100) };
  };
  const gridLevels = [25, 50, 75, 100];
  const dataPoints = categories.map((c) => pt(c.angle, ratings[c.key] || 0));
  const pathD = dataPoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ") + " Z";

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
      <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: 220 }}>
        {gridLevels.map((lv) => (
          <polygon key={lv} fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="0.5"
            points={categories.map((c) => { const p = pt(c.angle, lv); return `${p.x},${p.y}`; }).join(" ")} />
        ))}
        {categories.map((c) => {
          const p = pt(c.angle, 100);
          return <line key={c.key} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(139,92,246,0.2)" strokeWidth="0.5" />;
        })}
        <polygon points={dataPoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="rgba(139,92,246,0.15)" stroke="#8B5CF6" strokeWidth="2.5" />
        {categories.map((c, i) => {
          const dp = dataPoints[i];
          const lp = pt(c.angle, 118);
          return (
            <g key={c.key}>
              <circle cx={dp.x} cy={dp.y} r="3.5" fill="#8B5CF6" />
              <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
                fill="#8B5CF6" fontSize="8" fontWeight="800" fontFamily="inherit">{c.label}</text>
            </g>
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--color-text)" fontSize="22" fontWeight="900" fontFamily="inherit">
          {ratings.overall}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#8B5CF6" fontSize="7" fontWeight="700" fontFamily="inherit">
          TEAM IQ
        </text>
      </svg>
    </div>
  );
}

const card = {
  background: "var(--color-card)",
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-card)",
  padding: 16,
};

export default function TeamIQScreen() {
  const { user } = useAuth();
  const [teamIQ, setTeamIQ] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchManagedPlayers(user.id).then(async (managed) => {
      if (managed.length === 0) { setLoading(false); return; }
      const playerData = await Promise.all(
        managed.map(async (p) => {
          const sessions = await fetchSessionHistory(p.id);
          return { name: p.name, sessions };
        })
      );
      setTeamIQ(computeTeamIQ(playerData));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: i === 1 ? 240 : 120, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    );
  }

  if (!teamIQ) {
    return (
      <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon name="user" size={28} color="#8B5CF6" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>No Roster Yet</div>
        <div style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.6 }}>
          Add managed players from your profile to build a Team IQ report. Each player needs at least one session logged.
        </div>
      </div>
    );
  }

  const { teamRatings, players, teamSeason, insights } = teamIQ;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* TeamIQ Banner */}
      <div style={{
        background: "linear-gradient(135deg, #1E0A3C, #2D1060)",
        borderRadius: 20, padding: "20px 20px 16px",
        border: "1px solid rgba(139,92,246,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 1.2,
            background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 6, padding: "2px 8px" }}>
            Team IQ
          </span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
          Powered by {players.length} player{players.length !== 1 ? "s'" : "'s"} sessions
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { label: "Team FG%", value: `${teamSeason.fgPct}%`, color: "#22C55E" },
            { label: "Avg PPG", value: teamSeason.ppg, color: "#FF6B35" },
            { label: "Avg APG", value: teamSeason.apg, color: "#8B5CF6" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 4px" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Radar */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 8, textAlign: "center" }}>Team Skill Radar</h3>
        <TeamRadar ratings={teamRatings} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginTop: 12 }}>
          {[
            { label: "SHOOT", value: teamRatings.shooting,   color: "#FF6B35" },
            { label: "PLAY",  value: teamRatings.playmaking, color: "#22C55E" },
            { label: "REB",   value: teamRatings.rebounding, color: "#F59E0B" },
            { label: "DEF",   value: teamRatings.defense,    color: "#6366F1" },
            { label: "EFF",   value: teamRatings.efficiency, color: "#0EA5E9" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 8, color: "var(--color-text-sec)", fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Insights */}
      {insights.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="brain" size={16} color="#8B5CF6" />
            Coach Intelligence
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {insights.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Icon name={item.icon} size={16} color={item.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>{item.title}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 6px", borderRadius: 5,
                      color: item.type === "praise" ? "#22C55E" : item.type === "warning" ? "#EF4444" : "#F59E0B",
                      background: item.type === "praise" ? "rgba(34,197,94,0.1)" : item.type === "warning" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                    }}>
                      {item.type === "praise" ? "Strength" : item.type === "warning" ? "Critical" : "Note"}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text-sec)", lineHeight: 1.6, margin: 0, paddingLeft: 0 }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Roster Card */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>Roster</span>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", minWidth: 380, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Player", "OVR", "PPG", "FG%", "APG", "RPG"].map((h) => (
                  <th key={h} style={{ fontSize: 9, fontWeight: 700, color: "var(--color-text-sec)", textAlign: h === "Player" ? "left" : "center",
                    padding: h === "Player" ? "8px 8px 8px 16px" : "8px 8px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid var(--color-muted)" }}>
                  <td style={{ padding: "12px 8px 12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#8B5CF6", flexShrink: 0 }}>
                        {p.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name.split(" ")[0]}</div>
                        <div style={{ fontSize: 9, color: "var(--color-text-sec)" }}>{p.season.gamesPlayed} GP</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "center", padding: "8px", fontSize: 13, fontWeight: 900, color: (p.ratings.overall || 0) >= 60 ? "#FF6B35" : "var(--color-text-sec)" }}>
                    {p.ratings.overall || "-"}
                  </td>
                  <td style={{ textAlign: "center", padding: "8px", fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>{p.season.ppg}</td>
                  <td style={{ textAlign: "center", padding: "8px", fontSize: 12, fontWeight: 700, color: (p.season.fgPct || 0) >= 45 ? "#22C55E" : "var(--color-text-sec)" }}>
                    {p.season.fgPct ? `${p.season.fgPct}%` : "-"}
                  </td>
                  <td style={{ textAlign: "center", padding: "8px", fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>{p.season.apg}</td>
                  <td style={{ textAlign: "center", padding: "8px", fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>{p.season.rpg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Skill Comparison Bars */}
      <div style={card}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)", marginBottom: 14 }}>Individual Skill Breakdown</h4>
        {["shooting", "playmaking", "rebounding", "defense", "efficiency"].map((skill) => {
          const colors = { shooting: "#FF6B35", playmaking: "#22C55E", rebounding: "#F59E0B", defense: "#6366F1", efficiency: "#0EA5E9" };
          return (
            <div key={skill} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: "var(--color-text-sec)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>{skill}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {players.map((p, i) => {
                  const val = p.ratings?.[skill] || 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text)", width: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name.split(" ")[0]}
                      </span>
                      <div style={{ flex: 1, height: 7, background: "var(--color-muted)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 4, background: colors[skill], width: `${val}%`, transition: "width 0.5s ease" }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: colors[skill], width: 22, textAlign: "right" }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
