import { useState, useEffect, useRef } from "react";

// ─── COURT IQ: Player Stat Tracking App ───
// Mobile-first basketball analytics for youth/AAU players

const ACCENT = "#FF6B35";
const ACCENT_LIGHT = "#FFF0E8";
const ACCENT_DARK = "#E85A2A";
const BG = "#FAFBFD";
const CARD = "#FFFFFF";
const TEXT = "#1A1D2E";
const TEXT_SEC = "#6B7194";
const SUCCESS = "#22C55E";
const WARNING = "#F59E0B";
const DANGER = "#EF4444";
const COURT_GREEN = "#2D8B4E";

// ─── MOCK DATA ───
const PLAYER = {
  name: "Jaylen Carter",
  team: "Cleveland Elite AAU",
  number: 3,
  position: "Point Guard",
  age: 16,
  avatar: null,
  streak: 7,
};

const SHOT_DATA = {
  game: {
    total: 142, made: 78, threes: { total: 48, made: 22 },
    midRange: { total: 38, made: 20 }, paint: { total: 56, made: 36 },
    freeThrows: { total: 32, made: 26 },
  },
  practice: {
    total: 680, made: 428, threes: { total: 220, made: 143 },
    midRange: { total: 180, made: 118 }, paint: { total: 180, made: 121 },
    freeThrows: { total: 100, made: 86 },
  },
};

const WEEKLY_TREND = [
  { day: "Mon", pct: 52, shots: 80 },
  { day: "Tue", pct: 58, shots: 95 },
  { day: "Wed", pct: 45, shots: 60 },
  { day: "Thu", pct: 63, shots: 110 },
  { day: "Fri", pct: 55, shots: 75 },
  { day: "Sat", pct: 68, shots: 120 },
  { day: "Sun", pct: 61, shots: 90 },
];

const HEAT_ZONES = [
  { id: "left-corner-3", x: 8, y: 72, pct: 42, shots: 28, label: "L Corner 3" },
  { id: "left-wing-3", x: 12, y: 35, pct: 38, shots: 32, label: "L Wing 3" },
  { id: "top-key-3", x: 50, y: 10, pct: 35, shots: 24, label: "Top Key 3" },
  { id: "right-wing-3", x: 88, y: 35, pct: 41, shots: 30, label: "R Wing 3" },
  { id: "right-corner-3", x: 92, y: 72, pct: 48, shots: 26, label: "R Corner 3" },
  { id: "left-elbow", x: 28, y: 45, pct: 52, shots: 20, label: "L Elbow" },
  { id: "right-elbow", x: 72, y: 45, pct: 55, shots: 18, label: "R Elbow" },
  { id: "free-throw", x: 50, y: 42, pct: 58, shots: 22, label: "Free Throw" },
  { id: "left-block", x: 32, y: 68, pct: 62, shots: 16, label: "L Block" },
  { id: "right-block", x: 68, y: 68, pct: 65, shots: 14, label: "R Block" },
  { id: "paint", x: 50, y: 62, pct: 72, shots: 40, label: "Paint" },
  { id: "left-mid", x: 20, y: 55, pct: 44, shots: 12, label: "L Mid" },
  { id: "right-mid", x: 80, y: 55, pct: 47, shots: 14, label: "R Mid" },
];

const JOURNAL_ENTRIES = [
  {
    id: 1, date: "Mar 22, 2026", type: "game", mood: "fire",
    title: "Tournament Semifinals W",
    body: "Dropped 22 pts, 6 assists. My pull-up mid-range was automatic today. Need to work on left hand drives — got stripped twice going left in the 3rd quarter.",
    stats: { pts: 22, ast: 6, reb: 3, stl: 2, fgPct: 58 },
  },
  {
    id: 2, date: "Mar 21, 2026", type: "practice", mood: "focused",
    title: "Shooting Session — 200 shots",
    body: "Focused on catch-and-shoot 3s from both wings. Hit 62% from the right wing but only 41% from the left. Coach wants me at 50%+ from both sides by regionals.",
    stats: { shotsTaken: 200, shotsMade: 118, fgPct: 59 },
  },
  {
    id: 3, date: "Mar 19, 2026", type: "game", mood: "tough",
    title: "League Game — Tough L",
    body: "Only scored 8 points. Their press rattled me in the first half. Turned it over 5 times. Gotta stay composed under pressure. Film study tomorrow.",
    stats: { pts: 8, ast: 3, reb: 2, to: 5, fgPct: 28 },
  },
];

const TEAM_DATA = [
  { name: "Jaylen C.", pts: 18.5, ast: 5.2, reb: 3.1, fgPct: 54, role: "PG", isUser: true },
  { name: "Marcus T.", pts: 15.8, ast: 2.1, reb: 7.4, fgPct: 48, role: "PF" },
  { name: "DeShawn W.", pts: 14.2, ast: 1.8, reb: 8.9, fgPct: 52, role: "C" },
  { name: "Tre H.", pts: 12.6, ast: 6.8, reb: 2.5, fgPct: 45, role: "SG" },
  { name: "Cam J.", pts: 10.4, ast: 3.2, reb: 4.1, fgPct: 41, role: "SF" },
];

// ─── UTILITY COMPONENTS ───

const getHeatColor = (pct) => {
  if (pct >= 60) return "rgba(34, 197, 94, 0.85)";
  if (pct >= 50) return "rgba(34, 197, 94, 0.55)";
  if (pct >= 40) return "rgba(255, 107, 53, 0.65)";
  if (pct >= 30) return "rgba(255, 107, 53, 0.4)";
  return "rgba(239, 68, 68, 0.6)";
};

const getMoodEmoji = (mood) => {
  const moods = { fire: "🔥", focused: "🎯", tough: "💪", chill: "😎", grind: "⚡" };
  return moods[mood] || "🏀";
};

const StatPill = ({ label, value, sub, color }) => (
  <div style={{
    background: CARD, borderRadius: 16, padding: "14px 10px", textAlign: "center",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", flex: 1, minWidth: 0,
    borderTop: `3px solid ${color || ACCENT}`,
  }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: TEXT_SEC, marginTop: 2 }}>{sub}</div>}
  </div>
);

const SectionHeader = ({ icon, title, action, onAction }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 2px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{title}</span>
    </div>
    {action && (
      <button onClick={onAction} style={{
        background: "none", border: "none", color: ACCENT, fontSize: 13,
        fontWeight: 600, cursor: "pointer", padding: "4px 8px",
      }}>{action}</button>
    )}
  </div>
);

const TabBar = ({ tabs, active, onChange }) => (
  <div style={{
    display: "flex", background: "#F0F1F5", borderRadius: 12, padding: 3, marginBottom: 16,
  }}>
    {tabs.map((tab) => (
      <button key={tab.id} onClick={() => onChange(tab.id)} style={{
        flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer",
        fontSize: 13, fontWeight: 700, transition: "all 0.2s ease",
        background: active === tab.id ? CARD : "transparent",
        color: active === tab.id ? ACCENT : TEXT_SEC,
        boxShadow: active === tab.id ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
      }}>
        {tab.icon && <span style={{ marginRight: 4 }}>{tab.icon}</span>}
        {tab.label}
      </button>
    ))}
  </div>
);

// ─── BOTTOM NAVIGATION ───
const BottomNav = ({ active, onChange }) => {
  const items = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "shots", icon: "🏀", label: "Shots" },
    { id: "heatmap", icon: "🔥", label: "Heat Map" },
    { id: "journal", icon: "📓", label: "Journal" },
    { id: "team", icon: "👥", label: "Team" },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: CARD, borderTop: "1px solid #E8E9F0",
      display: "flex", justifyContent: "space-around", padding: "6px 0 18px",
      zIndex: 100, maxWidth: 480, margin: "0 auto",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
    }}>
      {items.map((item) => (
        <button key={item.id} onClick={() => onChange(item.id)} style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          background: "none", border: "none", cursor: "pointer",
          padding: "4px 12px", gap: 2, transition: "all 0.2s",
        }}>
          <span style={{
            fontSize: 20, filter: active === item.id ? "none" : "grayscale(0.8)",
            opacity: active === item.id ? 1 : 0.5,
          }}>{item.icon}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
            color: active === item.id ? ACCENT : TEXT_SEC,
            textTransform: "uppercase",
          }}>{item.label}</span>
          {active === item.id && (
            <div style={{
              width: 4, height: 4, borderRadius: 2, background: ACCENT, marginTop: 1,
            }} />
          )}
        </button>
      ))}
    </div>
  );
};

// ─── HOME DASHBOARD ───
const HomeDashboard = ({ onNavigate }) => {
  const data = SHOT_DATA.game;
  const fgPct = Math.round((data.made / data.total) * 100);
  const threePct = Math.round((data.threes.made / data.threes.total) * 100);
  const ftPct = Math.round((data.freeThrows.made / data.freeThrows.total) * 100);

  return (
    <div>
      {/* Player Card */}
      <div style={{
        background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
        borderRadius: 20, padding: 20, marginBottom: 20, color: "white",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -20, right: -20, width: 120, height: 120,
          borderRadius: "50%", background: "rgba(255,255,255,0.1)",
        }} />
        <div style={{
          position: "absolute", bottom: -30, left: -10, width: 80, height: 80,
          borderRadius: "50%", background: "rgba(255,255,255,0.08)",
        }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 900, backdropFilter: "blur(10px)",
          }}>#{PLAYER.number}</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>{PLAYER.name}</div>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 500 }}>{PLAYER.position} · {PLAYER.team}</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
              background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "3px 10px",
              fontSize: 11, fontWeight: 700, backdropFilter: "blur(10px)",
            }}>
              🔥 {PLAYER.streak}-day streak
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <SectionHeader icon="📊" title="Season Averages" action="Details →" onAction={() => onNavigate("shots")} />
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <StatPill label="FG%" value={`${fgPct}%`} sub={`${data.made}/${data.total}`} color={SUCCESS} />
        <StatPill label="3PT%" value={`${threePct}%`} sub={`${data.threes.made}/${data.threes.total}`} color={ACCENT} />
        <StatPill label="FT%" value={`${ftPct}%`} sub={`${data.freeThrows.made}/${data.freeThrows.total}`} color="#8B5CF6" />
      </div>

      {/* Weekly Trend Mini Chart */}
      <SectionHeader icon="📈" title="This Week's Trend" />
      <div style={{
        background: CARD, borderRadius: 16, padding: 16, marginBottom: 24,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
          {WEEKLY_TREND.map((d, i) => {
            const h = (d.pct / 100) * 80;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: d.pct >= 55 ? SUCCESS : d.pct >= 45 ? ACCENT : DANGER }}>
                  {d.pct}%
                </span>
                <div style={{
                  width: "100%", height: h, borderRadius: 8,
                  background: d.pct >= 55
                    ? `linear-gradient(180deg, ${SUCCESS}, rgba(34,197,94,0.4))`
                    : d.pct >= 45
                    ? `linear-gradient(180deg, ${ACCENT}, rgba(255,107,53,0.4))`
                    : `linear-gradient(180deg, ${DANGER}, rgba(239,68,68,0.4))`,
                  transition: "height 0.5s ease",
                }} />
                <span style={{ fontSize: 10, color: TEXT_SEC, fontWeight: 600 }}>{d.day}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "8px 0 0", borderTop: "1px solid #F0F1F5" }}>
          <span style={{ fontSize: 11, color: TEXT_SEC }}>Total shots: {WEEKLY_TREND.reduce((a, d) => a + d.shots, 0)}</span>
          <span style={{ fontSize: 11, color: SUCCESS, fontWeight: 700 }}>
            Avg: {Math.round(WEEKLY_TREND.reduce((a, d) => a + d.pct, 0) / 7)}%
          </span>
        </div>
      </div>

      {/* Recent Journal */}
      <SectionHeader icon="📓" title="Latest Entry" action="View All →" onAction={() => onNavigate("journal")} />
      <div style={{
        background: CARD, borderRadius: 16, padding: 16, marginBottom: 24,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)", cursor: "pointer",
        borderLeft: `4px solid ${JOURNAL_ENTRIES[0].type === "game" ? ACCENT : "#8B5CF6"}`,
      }} onClick={() => onNavigate("journal")}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>{getMoodEmoji(JOURNAL_ENTRIES[0].mood)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{JOURNAL_ENTRIES[0].title}</span>
          </div>
          <span style={{
            fontSize: 10, background: JOURNAL_ENTRIES[0].type === "game" ? ACCENT_LIGHT : "#F3F0FF",
            color: JOURNAL_ENTRIES[0].type === "game" ? ACCENT : "#8B5CF6",
            padding: "3px 8px", borderRadius: 8, fontWeight: 700, textTransform: "uppercase",
          }}>{JOURNAL_ENTRIES[0].type}</span>
        </div>
        <p style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, margin: 0 }}>
          {JOURNAL_ENTRIES[0].body.slice(0, 100)}...
        </p>
      </div>

      {/* Hot Zones Teaser */}
      <SectionHeader icon="🔥" title="Hottest Zones" action="Full Map →" onAction={() => onNavigate("heatmap")} />
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {HEAT_ZONES.filter(z => z.pct >= 60).slice(0, 3).map((z) => (
          <div key={z.id} style={{
            flex: 1, background: CARD, borderRadius: 14, padding: 12, textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderTop: `3px solid ${SUCCESS}`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: SUCCESS }}>{z.pct}%</div>
            <div style={{ fontSize: 11, color: TEXT_SEC, fontWeight: 600, marginTop: 2 }}>{z.label}</div>
            <div style={{ fontSize: 10, color: TEXT_SEC }}>{z.shots} shots</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── SHOT TRACKING SCREEN ───
const ShotTracking = () => {
  const [mode, setMode] = useState("game");
  const data = mode === "game" ? SHOT_DATA.game : SHOT_DATA.practice;
  const fgPct = Math.round((data.made / data.total) * 100);

  const zones = [
    { label: "3-Pointers", ...data.threes, color: ACCENT, icon: "🎯" },
    { label: "Mid-Range", ...data.midRange, color: "#8B5CF6", icon: "📐" },
    { label: "Paint", ...data.paint, color: SUCCESS, icon: "🎨" },
    { label: "Free Throws", ...data.freeThrows, color: WARNING, icon: "🏁" },
  ];

  return (
    <div>
      <TabBar
        tabs={[
          { id: "game", label: "Game Shots", icon: "🏟️" },
          { id: "practice", label: "Practice", icon: "⚡" },
        ]}
        active={mode}
        onChange={setMode}
      />

      {/* Overall percentage ring */}
      <div style={{
        background: CARD, borderRadius: 20, padding: 24, marginBottom: 20, textAlign: "center",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}>
        <div style={{ position: "relative", width: 130, height: 130, margin: "0 auto 16px" }}>
          <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#F0F1F5" strokeWidth="10" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={ACCENT} strokeWidth="10"
              strokeDasharray={`${(fgPct / 100) * 327} 327`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          </svg>
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: TEXT, lineHeight: 1 }}>{fgPct}%</div>
            <div style={{ fontSize: 11, color: TEXT_SEC, fontWeight: 600 }}>FG%</div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: TEXT_SEC }}>
          <span style={{ fontWeight: 800, color: TEXT }}>{data.made}</span> made out of{" "}
          <span style={{ fontWeight: 800, color: TEXT }}>{data.total}</span> attempts
        </div>
        <div style={{
          display: "inline-block", marginTop: 8, background: mode === "game" ? ACCENT_LIGHT : "#F3F0FF",
          color: mode === "game" ? ACCENT : "#8B5CF6",
          padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
        }}>
          {mode === "game" ? "🏟️ Game Stats" : "⚡ Practice Stats"}
        </div>
      </div>

      {/* Zone Breakdown */}
      <SectionHeader icon="📍" title="Shot Zone Breakdown" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {zones.map((z) => {
          const pct = Math.round((z.made / z.total) * 100);
          return (
            <div key={z.label} style={{
              background: CARD, borderRadius: 14, padding: 14,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: `${z.color}15`, display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>{z.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{z.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: z.color }}>{pct}%</span>
                </div>
                <div style={{ height: 6, background: "#F0F1F5", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`, borderRadius: 3,
                    background: `linear-gradient(90deg, ${z.color}, ${z.color}AA)`,
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <div style={{ fontSize: 10, color: TEXT_SEC, marginTop: 4 }}>
                  {z.made}/{z.total} shots
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison badge */}
      {mode === "game" && (
        <div style={{
          background: `linear-gradient(135deg, #F0F9FF, #E0F2FE)`,
          borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 10,
          border: "1px solid #BAE6FD",
        }}>
          <span style={{ fontSize: 22 }}>💡</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0369A1" }}>Practice vs Game Insight</div>
            <div style={{ fontSize: 11, color: "#0284C7", lineHeight: 1.4 }}>
              Your practice FG% is {Math.round((SHOT_DATA.practice.made / SHOT_DATA.practice.total) * 100)}% vs {fgPct}% in games.
              {Math.round((SHOT_DATA.practice.made / SHOT_DATA.practice.total) * 100) > fgPct
                ? " Focus on game-speed reps to close the gap!"
                : " You're clutch under pressure — keep it up!"
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── HEAT MAP SCREEN ───
const HeatMapScreen = () => {
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("all");

  return (
    <div>
      <TabBar
        tabs={[
          { id: "all", label: "All Shots", icon: "🏀" },
          { id: "game", label: "Games", icon: "🏟️" },
          { id: "practice", label: "Practice", icon: "⚡" },
        ]}
        active={mode}
        onChange={setMode}
      />

      {/* Court with Heat Zones */}
      <div style={{
        background: CARD, borderRadius: 20, padding: 16, marginBottom: 16,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)", position: "relative",
      }}>
        <div style={{
          position: "relative", width: "100%", paddingBottom: "95%",
          background: "#F8F6F0", borderRadius: 14, overflow: "hidden",
          border: "2px solid #E5E2D9",
        }}>
          {/* Court Lines */}
          <svg viewBox="0 0 500 470" style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          }}>
            {/* Court outline */}
            <rect x="25" y="15" width="450" height="440" fill="none" stroke="#D4D0C5" strokeWidth="2" rx="4" />

            {/* Three-point arc */}
            <path d="M 60 440 L 60 340 Q 60 100 250 60 Q 440 100 440 340 L 440 440"
              fill="none" stroke="#C4C0B5" strokeWidth="2" />

            {/* Paint / Key */}
            <rect x="160" y="280" width="180" height="175" fill="none" stroke="#C4C0B5" strokeWidth="2" rx="2" />

            {/* Free throw circle */}
            <circle cx="250" cy="280" r="60" fill="none" stroke="#C4C0B5" strokeWidth="1.5" strokeDasharray="6 4" />

            {/* Basket */}
            <circle cx="250" cy="420" r="8" fill="none" stroke="#C4C0B5" strokeWidth="2" />
            <rect x="220" y="425" width="60" height="3" fill="#C4C0B5" rx="1.5" />

            {/* Restricted area arc */}
            <path d="M 218 440 Q 218 390 250 380 Q 282 390 282 440"
              fill="none" stroke="#C4C0B5" strokeWidth="1.5" />

            {/* Center line */}
            <line x1="25" y1="15" x2="475" y2="15" stroke="#C4C0B5" strokeWidth="2" />
          </svg>

          {/* Heat Zone Dots */}
          {HEAT_ZONES.map((zone) => {
            const isSelected = selected?.id === zone.id;
            const size = isSelected ? 48 : 36;
            return (
              <div
                key={zone.id}
                onClick={() => setSelected(isSelected ? null : zone)}
                style={{
                  position: "absolute",
                  left: `${zone.x}%`, top: `${zone.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: size, height: size,
                  borderRadius: "50%",
                  background: getHeatColor(zone.pct),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  border: isSelected ? "3px solid white" : "2px solid rgba(255,255,255,0.5)",
                  boxShadow: isSelected
                    ? "0 0 20px rgba(0,0,0,0.25)"
                    : "0 2px 8px rgba(0,0,0,0.15)",
                  zIndex: isSelected ? 10 : 1,
                }}
              >
                <span style={{
                  fontSize: isSelected ? 14 : 11,
                  fontWeight: 900, color: "white",
                  textShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }}>{zone.pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Selected Zone Detail */}
        {selected && (
          <div style={{
            marginTop: 12, background: "#F8F9FC", borderRadius: 12, padding: 14,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            border: "1px solid #E8E9F0",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{selected.label}</div>
              <div style={{ fontSize: 12, color: TEXT_SEC }}>{selected.shots} total shots</div>
            </div>
            <div style={{
              fontSize: 28, fontWeight: 900,
              color: selected.pct >= 50 ? SUCCESS : selected.pct >= 40 ? ACCENT : DANGER,
            }}>
              {selected.pct}%
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 16, marginBottom: 16,
      }}>
        {[
          { label: "Cold", color: "rgba(239, 68, 68, 0.6)" },
          { label: "Warm", color: "rgba(255, 107, 53, 0.55)" },
          { label: "Hot", color: "rgba(34, 197, 94, 0.55)" },
          { label: "Fire", color: "rgba(34, 197, 94, 0.85)" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: l.color }} />
            <span style={{ fontSize: 11, color: TEXT_SEC, fontWeight: 600 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Zone Rankings */}
      <SectionHeader icon="🏆" title="Zone Rankings" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...HEAT_ZONES].sort((a, b) => b.pct - a.pct).slice(0, 5).map((z, i) => (
          <div key={z.id} style={{
            background: CARD, borderRadius: 12, padding: "10px 14px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: i === 0 ? "#FEF3C7" : i === 1 ? "#F3F4F6" : i === 2 ? "#FED7AA" : "#F8F9FC",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: TEXT,
            }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{z.label}</span>
            </div>
            <span style={{
              fontSize: 14, fontWeight: 800,
              color: z.pct >= 50 ? SUCCESS : ACCENT,
            }}>{z.pct}%</span>
            <span style={{ fontSize: 11, color: TEXT_SEC }}>{z.shots}s</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── JOURNAL SCREEN ───
const JournalScreen = () => {
  const [showNew, setShowNew] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: "", body: "", type: "practice", mood: "focused" });

  return (
    <div>
      {/* New Entry Button */}
      <button onClick={() => setShowNew(!showNew)} style={{
        width: "100%", padding: 14, borderRadius: 14, border: `2px dashed ${ACCENT}`,
        background: ACCENT_LIGHT, color: ACCENT, fontSize: 14, fontWeight: 700,
        cursor: "pointer", marginBottom: 16, display: "flex",
        alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        {showNew ? "✕ Cancel" : "✍️ New Journal Entry"}
      </button>

      {/* New Entry Form */}
      {showNew && (
        <div style={{
          background: CARD, borderRadius: 16, padding: 16, marginBottom: 20,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          border: `1px solid ${ACCENT}30`,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["game", "practice"].map((t) => (
              <button key={t} onClick={() => setNewEntry({ ...newEntry, type: t })} style={{
                flex: 1, padding: "8px 12px", borderRadius: 10, border: "none",
                cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                background: newEntry.type === t ? (t === "game" ? ACCENT : "#8B5CF6") : "#F0F1F5",
                color: newEntry.type === t ? "white" : TEXT_SEC,
              }}>{t === "game" ? "🏟️ Game" : "⚡ Practice"}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { id: "fire", emoji: "🔥" }, { id: "focused", emoji: "🎯" },
              { id: "tough", emoji: "💪" }, { id: "chill", emoji: "😎" },
              { id: "grind", emoji: "⚡" },
            ].map((m) => (
              <button key={m.id} onClick={() => setNewEntry({ ...newEntry, mood: m.id })} style={{
                flex: 1, padding: 8, borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: 18, background: newEntry.mood === m.id ? ACCENT_LIGHT : "#F8F9FC",
                boxShadow: newEntry.mood === m.id ? `0 0 0 2px ${ACCENT}` : "none",
              }}>{m.emoji}</button>
            ))}
          </div>
          <input
            value={newEntry.title} onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
            placeholder="Entry title..." style={{
              width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #E8E9F0",
              fontSize: 14, fontWeight: 600, marginBottom: 8, outline: "none",
              boxSizing: "border-box",
            }}
          />
          <textarea
            value={newEntry.body} onChange={(e) => setNewEntry({ ...newEntry, body: e.target.value })}
            placeholder="How'd it go? What worked? What needs work?..."
            rows={4} style={{
              width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #E8E9F0",
              fontSize: 13, lineHeight: 1.5, resize: "vertical", outline: "none",
              fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
          <button style={{
            width: "100%", padding: 12, borderRadius: 12, border: "none",
            background: ACCENT, color: "white", fontSize: 14, fontWeight: 700,
            cursor: "pointer", marginTop: 8,
          }}>Save Entry 🏀</button>
        </div>
      )}

      {/* Journal Entries */}
      <SectionHeader icon="📅" title="Recent Entries" />
      {JOURNAL_ENTRIES.map((entry) => (
        <div key={entry.id} style={{
          background: CARD, borderRadius: 16, padding: 16, marginBottom: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          borderLeft: `4px solid ${entry.type === "game" ? ACCENT : "#8B5CF6"}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{getMoodEmoji(entry.mood)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{entry.title}</span>
              </div>
              <span style={{ fontSize: 11, color: TEXT_SEC }}>{entry.date}</span>
            </div>
            <span style={{
              fontSize: 10, background: entry.type === "game" ? ACCENT_LIGHT : "#F3F0FF",
              color: entry.type === "game" ? ACCENT : "#8B5CF6",
              padding: "3px 8px", borderRadius: 8, fontWeight: 700, textTransform: "uppercase",
            }}>{entry.type}</span>
          </div>
          <p style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.55, margin: "8px 0 12px" }}>
            {entry.body}
          </p>
          {/* Stats row */}
          <div style={{
            display: "flex", gap: 8, flexWrap: "wrap",
          }}>
            {entry.stats.pts !== undefined && (
              <span style={{ fontSize: 11, background: "#F0FDF4", color: SUCCESS, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>
                {entry.stats.pts} PTS
              </span>
            )}
            {entry.stats.ast !== undefined && (
              <span style={{ fontSize: 11, background: ACCENT_LIGHT, color: ACCENT, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>
                {entry.stats.ast} AST
              </span>
            )}
            {entry.stats.reb !== undefined && (
              <span style={{ fontSize: 11, background: "#F3F0FF", color: "#8B5CF6", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>
                {entry.stats.reb} REB
              </span>
            )}
            {entry.stats.fgPct !== undefined && (
              <span style={{ fontSize: 11, background: "#F8F9FC", color: TEXT_SEC, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>
                {entry.stats.fgPct}% FG
              </span>
            )}
            {entry.stats.to !== undefined && (
              <span style={{ fontSize: 11, background: "#FEF2F2", color: DANGER, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>
                {entry.stats.to} TO
              </span>
            )}
            {entry.stats.shotsTaken !== undefined && (
              <span style={{ fontSize: 11, background: "#F8F9FC", color: TEXT_SEC, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>
                {entry.stats.shotsMade}/{entry.stats.shotsTaken} shots
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── TEAM SCREEN ───
const TeamScreen = () => {
  const [sortBy, setSortBy] = useState("pts");

  const sorted = [...TEAM_DATA].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div>
      {/* Team Header */}
      <div style={{
        background: `linear-gradient(135deg, #1A1D2E, #2D3048)`,
        borderRadius: 20, padding: 20, marginBottom: 20, color: "white",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>{PLAYER.team}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>2025-26 Season · 14-3 Record</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 14 }}>
          {[
            { label: "PPG", value: "71.5" },
            { label: "FG%", value: "48.2" },
            { label: "APG", value: "18.1" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{s.value}</div>
              <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sort Controls */}
      <SectionHeader icon="👥" title="Roster Stats" />
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "pts", label: "Points" },
          { id: "ast", label: "Assists" },
          { id: "reb", label: "Rebounds" },
          { id: "fgPct", label: "FG%" },
        ].map((s) => (
          <button key={s.id} onClick={() => setSortBy(s.id)} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700,
            background: sortBy === s.id ? ACCENT : "#F0F1F5",
            color: sortBy === s.id ? "white" : TEXT_SEC,
            transition: "all 0.2s",
          }}>{s.label}</button>
        ))}
      </div>

      {/* Player Cards */}
      {sorted.map((p, i) => (
        <div key={p.name} style={{
          background: CARD, borderRadius: 14, padding: 14, marginBottom: 8,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", gap: 12,
          border: p.isUser ? `2px solid ${ACCENT}` : "1px solid transparent",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: p.isUser ? ACCENT : "#F0F1F5",
            color: p.isUser ? "white" : TEXT_SEC,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800,
          }}>{p.role}</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: TEXT,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {p.name}
              {p.isUser && <span style={{
                fontSize: 9, background: ACCENT_LIGHT, color: ACCENT,
                padding: "2px 6px", borderRadius: 4, fontWeight: 800,
              }}>YOU</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: sortBy === "pts" ? ACCENT : TEXT }}>{p.pts}</div>
              <div style={{ fontSize: 9, color: TEXT_SEC, fontWeight: 600 }}>PPG</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: sortBy === "ast" ? ACCENT : TEXT }}>{p.ast}</div>
              <div style={{ fontSize: 9, color: TEXT_SEC, fontWeight: 600 }}>APG</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: sortBy === "reb" ? ACCENT : TEXT }}>{p.reb}</div>
              <div style={{ fontSize: 9, color: TEXT_SEC, fontWeight: 600 }}>RPG</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: sortBy === "fgPct" ? ACCENT : TEXT }}>{p.fgPct}%</div>
              <div style={{ fontSize: 9, color: TEXT_SEC, fontWeight: 600 }}>FG%</div>
            </div>
          </div>
        </div>
      ))}

      {/* Team Chemistry Note */}
      <div style={{
        marginTop: 16, background: `linear-gradient(135deg, #F0FDF4, #DCFCE7)`,
        borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 10,
        border: "1px solid #BBF7D0",
      }}>
        <span style={{ fontSize: 22 }}>🤝</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>Team Chemistry</div>
          <div style={{ fontSize: 11, color: "#15803D", lineHeight: 1.4 }}>
            Your assist-to-turnover ratio leads the team at 1.73. Keep feeding your teammates!
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ───
export default function CourtIQ() {
  const [screen, setScreen] = useState("home");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [screen]);

  const titles = {
    home: "Court IQ",
    shots: "Shot Tracking",
    heatmap: "Heat Map",
    journal: "My Journal",
    team: "Team Stats",
  };

  return (
    <div style={{
      maxWidth: 480, margin: "0 auto", background: BG,
      minHeight: "100vh", fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
      position: "relative",
    }}>
      {/* Status Bar / Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(250,251,253,0.92)", backdropFilter: "blur(12px)",
        padding: "12px 20px 10px", borderBottom: "1px solid rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: TEXT, letterSpacing: -0.8 }}>
              {titles[screen]}
            </div>
            {screen === "home" && (
              <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 2 }}>
                What's good, {PLAYER.name.split(" ")[0]}! 👋
              </div>
            )}
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 14, fontWeight: 800,
            boxShadow: `0 2px 10px ${ACCENT}40`,
          }}>
            {PLAYER.name.split(" ").map(n => n[0]).join("")}
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ padding: "16px 16px 100px" }}>
        {screen === "home" && <HomeDashboard onNavigate={setScreen} />}
        {screen === "shots" && <ShotTracking />}
        {screen === "heatmap" && <HeatMapScreen />}
        {screen === "journal" && <JournalScreen />}
        {screen === "team" && <TeamScreen />}
      </div>

      {/* Bottom Navigation */}
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  );
}