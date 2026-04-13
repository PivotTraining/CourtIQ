"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import ShareStoryCard from "@/components/ShareStoryCard";
import { fetchSessionHistory } from "@/lib/queries";
import { computePlayerMemory, computeTrends, computeSkillRatings, computeSeasonStats } from "@/lib/intelligence";
import Icon from "@/components/ui/Icons";

/* --- RADAR CHART (SVG) --- */
function RadarChart({ ratings }) {
  const categories = [
    { key: "shooting", label: "SHOOT", angle: -90 },
    { key: "playmaking", label: "PLAY", angle: -18 },
    { key: "efficiency", label: "EFF", angle: 54 },
    { key: "defense", label: "DEF", angle: 126 },
    { key: "rebounding", label: "REB", angle: 198 },
  ];
  const cx = 100, cy = 100, maxR = 70;

  const getPoint = (angle, pct) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * maxR * (pct / 100), y: cy + Math.sin(rad) * maxR * (pct / 100) };
  };

  const gridLevels = [25, 50, 75, 100];
  const dataPoints = categories.map((c) => getPoint(c.angle, ratings[c.key] || 0));
  const pathD = dataPoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ") + " Z";

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
      <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: 220 }}>
        {/* Grid */}
        {gridLevels.map((level) => (
          <polygon key={level} fill="none" stroke="#E2E4EB" strokeWidth="0.5"
            points={categories.map((c) => { const p = getPoint(c.angle, level); return `${p.x},${p.y}`; }).join(" ")} />
        ))}
        {/* Axes */}
        {categories.map((c) => {
          const p = getPoint(c.angle, 100);
          return <line key={c.key} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E2E4EB" strokeWidth="0.5" />;
        })}
        {/* Data polygon */}
        <polygon points={dataPoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="rgba(255, 107, 53, 0.12)" stroke="#FF6B35" strokeWidth="2.5" />
        {/* Data dots + labels */}
        {categories.map((c, i) => {
          const dp = dataPoints[i];
          const lp = getPoint(c.angle, 115);
          return (
            <g key={c.key}>
              <circle cx={dp.x} cy={dp.y} r="3.5" fill="#FF6B35" />
              <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
                fill="#6B7194" fontSize="8" fontWeight="800" fontFamily="inherit">
                {c.label}
              </text>
            </g>
          );
        })}
        {/* Center overall */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#1A1D2E" fontSize="22" fontWeight="900" fontFamily="inherit">
          {ratings.overall}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#6B7194" fontSize="7" fontWeight="700" fontFamily="inherit">
          OVERALL
        </text>
      </svg>
    </div>
  );
}

/* --- TREND ARROW --- */
function TrendArrow({ delta }) {
  if (!delta || delta.direction === "flat") return <span style={{ color: "var(--color-text-sec)", fontSize: 10 }}>--</span>;
  const up = delta.direction === "up";
  return (
    <span style={{ fontSize: 10, fontWeight: 900, color: up ? "var(--color-success)" : "var(--color-danger)" }}>
      {up ? <Icon name="trendUp" size={10} /> : <Icon name="trendDown" size={10} />} {delta.value}
    </span>
  );
}

/* --- SPARKLINE --- */
function Sparkline({ data, height = 40, color = "#FF6B35" }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * (height - 4)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={(i / (data.length - 1)) * w} cy={height - (v / max) * (height - 4)} r="2.5" fill={color} />
      ))}
    </svg>
  );
}

/* --- card wrapper --- */
const cardStyle = {
  background: "var(--color-card)",
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-card)",
  padding: 16,
};

/* --- MAIN COMPONENT --- */
export default function PlayerInsights() {
  const { playerId, setScreen } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview"); // overview | season | trends
  const [showStoryCard, setShowStoryCard] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    fetchSessionHistory(playerId).then((sessions) => {
      if (sessions.length === 0) { setLoading(false); return; }
      setData({
        memory: computePlayerMemory(sessions),
        trends: computeTrends(sessions),
        ratings: computeSkillRatings(sessions),
        season: computeSeasonStats(sessions),
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [playerId]);

  if (loading) return <div style={{ height: 192, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />;
  if (!data) return null;

  const { memory, trends, ratings, season } = data;

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", background: "var(--color-muted)", borderRadius: 12, padding: 3, marginBottom: 16 }}>
        {[
          { id: "overview", label: "IQ", icon: "brain" },
          { id: "season", label: "Season", icon: "barChart" },
          { id: "trends", label: "Trends", icon: "trending" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              minHeight: 44,
              transition: "all 0.2s",
              background: tab === t.id ? "var(--color-card)" : "transparent",
              color: tab === t.id ? "var(--color-accent)" : "var(--color-text-sec)",
              boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
            <Icon name={t.icon} size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* -- OVERVIEW TAB -- */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Skill Radar */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 8, textAlign: "center" }}>Player Rating</h3>
            <RadarChart ratings={ratings} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginTop: 12 }}>
              {[
                { label: "SHOOT", value: ratings.shooting, color: "#FF6B35" },
                { label: "PLAY", value: ratings.playmaking, color: "#22C55E" },
                { label: "REB", value: ratings.rebounding, color: "#F59E0B" },
                { label: "DEF", value: ratings.defense, color: "#6366F1" },
                { label: "EFF", value: ratings.efficiency, color: "#0EA5E9" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 8, color: "var(--color-text-sec)", fontWeight: 700 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Player Memory Insights */}
          {(memory.insights.length > 0 || memory.tendencies.length > 0) && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="brain" size={16} color="#FF6B35" /> Court IQ Knows You
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...memory.insights, ...memory.tendencies].slice(0, 5).map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0 }}>{item.iconName ? <Icon name={item.iconName} size={16} /> : <Icon name="info" size={16} />}</span>
                    <p style={{ fontSize: 12, color: "var(--color-text-sec)", lineHeight: 1.6, margin: 0 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strong/Weak Zones */}
          {(memory.strongZones.length > 0 || memory.weakZones.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {memory.strongZones.length > 0 && (
                <div style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-success)", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="fire" size={12} color="#22C55E" /> Strong Zones
                  </div>
                  {memory.strongZones.map((z) => (
                    <div key={z.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.label}</span>
                      <span style={{ fontWeight: 700, color: "var(--color-success)" }}>{z.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
              {memory.weakZones.length > 0 && (
                <div style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-danger)", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="snowflake" size={12} color="#EF4444" /> Drill Zones
                  </div>
                  {memory.weakZones.map((z) => (
                    <div key={z.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.label}</span>
                      <span style={{ fontWeight: 700, color: "var(--color-danger)" }}>{z.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -- SEASON TAB -- */}
      {tab === "season" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Overview */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>Season Overview</h3>
              <span style={{ fontSize: 10, color: "var(--color-text-sec)", fontWeight: 600 }}>{season.gamesPlayed}G / {season.practiceSessions}P</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { label: "PPG", value: season.ppg, color: "#FF6B35" },
                { label: "APG", value: season.apg, color: "#22C55E" },
                { label: "RPG", value: season.rpg, color: "#F59E0B" },
                { label: "SPG", value: season.spg, color: "#10B981" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center", background: "var(--color-muted)", borderRadius: 12, padding: "10px 0" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 8, color: "var(--color-text-sec)", fontWeight: 700, textTransform: "uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Shooting Splits */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 12 }}>Shooting Splits</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { label: "FG%", value: season.fgPct, color: "var(--color-accent)" },
                { label: "3PT%", value: season.threePct, color: "#8B5CF6" },
                { label: "2PT%", value: season.twoPct, color: "#0EA5E9" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}%</div>
                  <div style={{ fontSize: 9, color: "var(--color-text-sec)", fontWeight: 700, textTransform: "uppercase" }}>{s.label}</div>
                  <div style={{ height: 6, background: "var(--color-muted)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: s.color, width: `${s.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Career Highs */}
          {(season.highs.pts > 0 || season.highs.ast > 0 || season.highs.reb > 0) && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 12 }}>Career Highs</h3>
              <div style={{ display: "flex", gap: 12 }}>
                {season.highs.pts > 0 && (
                  <div style={{ flex: 1, textAlign: "center", background: "rgba(255,107,53,0.08)", borderRadius: 12, padding: "12px 0" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "var(--color-accent)" }}>{season.highs.pts}</div>
                    <div style={{ fontSize: 9, color: "var(--color-text-sec)", fontWeight: 700, textTransform: "uppercase" }}>PTS</div>
                  </div>
                )}
                {season.highs.ast > 0 && (
                  <div style={{ flex: 1, textAlign: "center", background: "rgba(34,197,94,0.08)", borderRadius: 12, padding: "12px 0" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "var(--color-success)" }}>{season.highs.ast}</div>
                    <div style={{ fontSize: 9, color: "var(--color-text-sec)", fontWeight: 700, textTransform: "uppercase" }}>AST</div>
                  </div>
                )}
                {season.highs.reb > 0 && (
                  <div style={{ flex: 1, textAlign: "center", background: "rgba(245,158,11,0.08)", borderRadius: 12, padding: "12px 0" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#F59E0B" }}>{season.highs.reb}</div>
                    <div style={{ fontSize: 9, color: "var(--color-text-sec)", fontWeight: 700, textTransform: "uppercase" }}>REB</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Points Sparkline */}
          {season.last10.length >= 2 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>Points Trend (Last {season.last10.length} Games)</h3>
              <Sparkline data={season.last10.map((g) => g.pts)} height={50} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, color: "var(--color-text-sec)" }}>{season.last10[0]?.date}</span>
                <span style={{ fontSize: 9, color: "var(--color-text-sec)" }}>{season.last10[season.last10.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -- TRENDS TAB -- */}
      {tab === "trends" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 4 }}>This Month vs Last Month</h3>
            <p style={{ fontSize: 10, color: "var(--color-text-sec)", marginBottom: 16, marginTop: 0 }}>
              {trends.current.sessions} sessions this month / {trends.previous.sessions} last month
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "FG%", curr: `${trends.current.fgPct}%`, prev: `${trends.previous.fgPct}%`, delta: trends.deltas.fgPct },
                { label: "3PT%", curr: `${trends.current.threePct}%`, prev: `${trends.previous.threePct}%`, delta: trends.deltas.threePct },
                { label: "PPG", curr: trends.current.ppg, prev: trends.previous.ppg, delta: trends.deltas.ppg },
                { label: "APG", curr: trends.current.apg, prev: trends.previous.apg, delta: trends.deltas.apg },
                { label: "RPG", curr: trends.current.rpg, prev: trends.previous.rpg, delta: trends.deltas.rpg },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-sec)", width: 40 }}>{row.label}</span>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: "var(--color-muted)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 4, background: "rgba(255,107,53,0.3)", width: `${Math.min(parseFloat(row.prev) || 0, 100)}%` }} />
                    </div>
                    <div style={{ flex: 1, height: 8, background: "var(--color-muted)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 4, background: "var(--color-accent)", width: `${Math.min(parseFloat(row.curr) || 0, 100)}%` }} />
                    </div>
                  </div>
                  <div style={{ width: 64, textAlign: "right" }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text)" }}>{row.curr}</span>
                    <div style={{ marginTop: 2 }}><TrendArrow delta={row.delta} /></div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--color-border)", fontSize: 9, color: "var(--color-text-sec)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 6, background: "rgba(255,107,53,0.3)", borderRadius: 3 }} /> Last Month
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 6, background: "var(--color-accent)", borderRadius: 3 }} /> This Month
              </span>
            </div>
          </div>

          {/* Volume comparison */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", marginBottom: 12 }}>Activity</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--color-text)" }}>{trends.current.sessions}</div>
                <div style={{ fontSize: 8, color: "var(--color-text-sec)", fontWeight: 700, textTransform: "uppercase" }}>Sessions</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--color-accent)" }}>{trends.current.games}</div>
                <div style={{ fontSize: 8, color: "var(--color-text-sec)", fontWeight: 700, textTransform: "uppercase" }}>Games</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--color-text)" }}>{trends.current.totalShots}</div>
                <div style={{ fontSize: 8, color: "var(--color-text-sec)", fontWeight: 700, textTransform: "uppercase" }}>Shots</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Buttons */}
      {data && (
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button onClick={() => setShowStoryCard(true)}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 16,
              background: "rgba(255,107,53,0.1)",
              color: "var(--color-accent)",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}>
            <Icon name="share" size={14} /> Share Story
          </button>
          <button onClick={async () => {
            const { generateSeasonReport } = await import("@/lib/exportPdf");
            generateSeasonReport(
              { name: "Player", position: "", team: "", number: 0 },
              season,
              ratings
            );
          }}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 16,
              background: "var(--color-muted)",
              color: "var(--color-text-sec)",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}>
            <Icon name="download" size={14} /> Export PDF
          </button>
        </div>
      )}

      {/* Story Card Modal */}
      {showStoryCard && data && (
        <ShareStoryCard
          stats={{ totalPts: season.totalPts, fgPct: season.fgPct, threePct: season.threePct, ast: parseFloat(season.apg) * season.gamesPlayed, reb: parseFloat(season.rpg) * season.gamesPlayed, eff: ratings?.overall || 0 }}
          playerName="Player"
          onClose={() => setShowStoryCard(false)}
        />
      )}
    </div>
  );
}
