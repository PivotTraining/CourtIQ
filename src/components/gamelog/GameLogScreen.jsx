"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { fetchSessionHistory } from "@/lib/queries";
import { COURT_ZONES } from "@/lib/constants";
import { calcPct } from "@/lib/utils";
import Icon from "@/components/ui/Icons";

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function calcPoints(session) {
  const shots = session.shot_logs || [];
  const stats = session.game_stats || {};
  return shots
    .filter((s) => s.made)
    .reduce((sum, s) => {
      const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
      return sum + (zone?.pts || 2);
    }, 0) + (stats.ft_made || 0);
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
      <span style={{ fontSize: 15, fontWeight: 900, color: color || "var(--color-text)" }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
    </div>
  );
}

function GameCard({ session }) {
  const [expanded, setExpanded] = useState(false);
  const shots = session.shot_logs || [];
  const stats = session.game_stats || {};
  const made = shots.filter((s) => s.made).length;
  const total = shots.length;
  const fgPct = calcPct(made, total);
  const pts = calcPoints(session);

  const zoneBreakdown = COURT_ZONES.map((zone) => {
    const zoneShots = shots.filter((s) => s.zone_id === zone.id);
    return { ...zone, total: zoneShots.length, made: zoneShots.filter((s) => s.made).length };
  }).filter((z) => z.total > 0);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: "var(--color-card)",
        borderRadius: 18,
        border: "1px solid var(--color-border)",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.2s ease",
      }}
    >
      {/* Card Header */}
      <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: "linear-gradient(135deg, #FFF0E8, #FEF3C7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon name="trophy" size={22} color="#D97706" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>
              Game
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-sec)", fontWeight: 600 }}>
              {formatDate(session.created_at)}
            </span>
          </div>
          {session.focus && (
            <span style={{
              display: "inline-block", marginTop: 2,
              fontSize: 10, fontWeight: 700, color: "#D97706",
              background: "#FEF3C7", borderRadius: 4, padding: "1px 6px",
            }}>
              {session.focus}
            </span>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
          <Icon
            name="chevDown"
            size={14}
            color="var(--color-text-sec)"
            style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}
          />
        </div>
      </div>

      {/* Quick Stats Row */}
      <div style={{
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "10px 16px 14px",
        borderTop: "1px solid var(--color-muted)",
      }}>
        {pts > 0 && <StatPill label="PTS" value={pts} color="#FF6B35" />}
        {total > 0 && <StatPill label="FG%" value={`${fgPct}%`} color={fgPct >= 50 ? "#22C55E" : fgPct >= 40 ? "#FF6B35" : "#EF4444"} />}
        {stats.ast > 0 && <StatPill label="AST" value={stats.ast} color="#22C55E" />}
        {stats.reb > 0 && <StatPill label="REB" value={stats.reb} color="#F59E0B" />}
        {stats.stl > 0 && <StatPill label="STL" value={stats.stl} color="#10B981" />}
        {stats.blk > 0 && <StatPill label="BLK" value={stats.blk} color="#6366F1" />}
        {stats.to > 0 && <StatPill label="TO" value={stats.to} color="#EF4444" />}
        {pts === 0 && total === 0 && !stats.ast && !stats.reb && (
          <span style={{ fontSize: 12, color: "var(--color-text-sec)" }}>No stats recorded</span>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--color-border)", padding: 16 }}>

          {/* Full Stat Grid */}
          {(stats.ast > 0 || stats.reb > 0 || stats.stl > 0 || stats.blk > 0 || stats.to > 0 || stats.pf > 0 || stats.min > 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Game Stats
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { label: "MIN", value: stats.min, color: "var(--color-text-sec)" },
                  { label: "AST", value: stats.ast, color: "#22C55E" },
                  { label: "REB", value: stats.reb, color: "#F59E0B" },
                  { label: "STL", value: stats.stl, color: "#10B981" },
                  { label: "BLK", value: stats.blk, color: "#6366F1" },
                  { label: "TO", value: stats.to, color: "#EF4444" },
                  { label: "PF", value: stats.pf, color: "#F59E0B" },
                ].filter((s) => s.value > 0).map((s) => (
                  <div key={s.label} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "var(--color-muted)", borderRadius: 8, padding: "6px 12px",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: s.color }}>{s.value}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-sec)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shot Zone Breakdown */}
          {zoneBreakdown.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Shot Zones
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {zoneBreakdown.map((zone) => {
                  const pct = calcPct(zone.made, zone.total);
                  const barColor = pct >= 55 ? "#22C55E" : pct >= 40 ? "#FF6B35" : "#EF4444";
                  return (
                    <div key={zone.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {zone.label}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: barColor, flexShrink: 0, marginLeft: 8 }}>
                            {zone.made}/{zone.total} ({pct}%)
                          </span>
                        </div>
                        <div style={{ height: 4, background: "var(--color-muted)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GameLogScreen() {
  const { playerId } = useApp();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) { setLoading(false); return; }
    fetchSessionHistory(playerId)
      .then((all) => {
        const games = all.filter((s) => s.type === "game");
        setSessions(games);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 100, background: "var(--color-muted)", borderRadius: 18, animation: "pulse 1.5s ease infinite" }} />
        ))}
      </div>
    );
  }

  // Summary stats
  const totalGames = sessions.length;
  const allPts = sessions.map(calcPoints);
  const avgPPG = totalGames > 0
    ? (allPts.reduce((a, b) => a + b, 0) / totalGames).toFixed(1)
    : "0.0";
  const allFGPcts = sessions.map((s) => {
    const shots = s.shot_logs || [];
    const made = shots.filter((sh) => sh.made).length;
    return calcPct(made, shots.length);
  }).filter((p) => p > 0);
  const avgFGPct = allFGPcts.length > 0
    ? Math.round(allFGPcts.reduce((a, b) => a + b, 0) / allFGPcts.length)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 4px" }}>

      {/* Summary Header Card */}
      {totalGames > 0 && (
        <div style={{
          background: "linear-gradient(135deg, #D97706, #F59E0B)",
          borderRadius: 20,
          padding: "20px 24px",
          color: "white",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Season Summary
          </div>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{totalGames}</div>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, marginTop: 4, textTransform: "uppercase" }}>Games</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.3)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{avgPPG}</div>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, marginTop: 4, textTransform: "uppercase" }}>Avg PPG</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.3)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{avgFGPct}%</div>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, marginTop: 4, textTransform: "uppercase" }}>Avg FG%</div>
            </div>
          </div>
        </div>
      )}

      {/* Section Label */}
      {totalGames > 0 && (
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", padding: "0 4px" }}>
          Game History
        </div>
      )}

      {/* Games List */}
      {sessions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.map((s) => (
            <GameCard key={s.id} session={s} />
          ))}
        </div>
      ) : (
        <div style={{
          background: "var(--color-card)",
          borderRadius: 20,
          padding: "40px 24px",
          textAlign: "center",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 36,
            background: "#FEF3C7",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Icon name="trophy" size={32} color="#D97706" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>
            No games logged yet
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.6 }}>
            Tap + to start Gametime and track your first game.
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
