"use client";

import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { calcPct } from "@/lib/utils";
import { fetchSessionHistory } from "@/lib/queries";
import { computeSkillRatings } from "@/lib/intelligence";
import { computeBadges } from "@/lib/badges";
import { COURT_ZONES } from "@/lib/constants";
import Icon from "@/components/ui/Icons";

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HomeDashboard() {
  const { setScreen, player, playerId, shotData, journalEntries, loading } = useApp();
  const [sessions, setSessions] = useState([]);
  const [ratings, setRatings] = useState(null);
  const [badges, setBadges] = useState(null);
  const [showRatingInfo, setShowRatingInfo] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    fetchSessionHistory(playerId).then((s) => {
      setSessions(s);
      if (s.length > 0) {
        setRatings(computeSkillRatings(s));
        setBadges(computeBadges(s, player?.streak || 0, journalEntries.length));
      }
    }).catch(() => {});
  }, [playerId, player?.streak, journalEntries.length]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 4px" }}>
        <div style={{ height: 180, background: "var(--color-muted)", borderRadius: 24, animation: "pulse 1.5s ease infinite" }} />
        <div style={{ height: 60, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease infinite" }} />
      </div>
    );
  }

  const hasSessions = sessions.length > 0;
  const recentSessions = sessions.slice(0, 2);
  const data = shotData.game;
  const fgPct = calcPct(data.made, data.total);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "0 4px" }}>

      {/* ═══ LOGO — centered, transparent ═══ */}
      <div style={{ textAlign: "center", padding: "8px 0 0" }}>
        <img
          src={typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "/courtiq-dark.png" : "/courtiq-light.png"}
          alt="Court IQ"
          style={{ height: 80, objectFit: "contain" }}
        />
      </div>

      {/* ═══ HERO CARD ═══ */}
      {player && (
        <div style={{
          background: "var(--color-card)",
          borderRadius: 24,
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "var(--shadow-elevated)",
          position: "relative",
          overflow: "hidden",
        }}>
          {(() => {
            const r = ratings?.overall || 0;
            const tierColor = r >= 90 ? "#FF6B35" : r >= 75 ? "#22C55E" : r >= 55 ? "#3B82F6" : r >= 35 ? "#F59E0B" : "#8B5CF6";
            const tierLabel = r >= 90 ? "Elite" : r >= 75 ? "Advanced" : r >= 55 ? "Solid" : r >= 35 ? "Developing" : "Rookie";
            return (
              <button onClick={() => ratings && setShowRatingInfo(!showRatingInfo)} style={{ background: "none", border: "none", cursor: ratings ? "pointer" : "default", padding: 0, width: "100%" }}>
                <div style={{ fontSize: ratings ? 64 : 44, fontWeight: 900, color: ratings ? tierColor : "#FF6B35", lineHeight: 1 }}>
                  {ratings ? ratings.overall : `#${player.number || 0}`}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: ratings ? tierColor : "#FF6B35", opacity: 0.7, marginTop: 6, textTransform: "uppercase" }}>
                  {ratings ? "Overall Rating" : "Jersey Number"}
                </div>
                {ratings && (
                  <div style={{ fontSize: 13, color: tierColor, marginTop: 8, fontWeight: 600 }}>
                    {tierLabel}
                    <span style={{ color: "var(--color-text-sec)", fontSize: 12 }}>{" · Tap for details"}</span>
                  </div>
                )}
              </button>
            );
          })()}

          {/* Rating explanation */}
          {showRatingInfo && ratings && (
            <div style={{ marginTop: 16, textAlign: "left", background: "var(--color-muted)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", marginBottom: 10 }}>How Your Rating Works</div>
              <div style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.7, marginBottom: 14 }}>
                Your overall rating (0-99) is calculated from 5 skills: Shooting, Playmaking, Rebounding, Defense, and Efficiency. Each session updates your rating based on real performance.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { range: "90-99", label: "Elite", color: "#FF6B35", desc: "Top-tier performance across all categories" },
                  { range: "75-89", label: "Advanced", color: "#22C55E", desc: "Strong all-around game with standout areas" },
                  { range: "55-74", label: "Solid", color: "#3B82F6", desc: "Consistent player with room to grow" },
                  { range: "35-54", label: "Developing", color: "#F59E0B", desc: "Building fundamentals and gaining experience" },
                  { range: "0-34", label: "Rookie", color: "#8B5CF6", desc: "Just getting started — every session counts" },
                ].map((tier) => (
                  <div key={tier.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: tier.color, minWidth: 44 }}>{tier.range}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: tier.color, minWidth: 80 }}>{tier.label}</span>
                    <span style={{ fontSize: 12, color: "var(--color-text-sec)", lineHeight: 1.4 }}>{tier.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: 20, fontWeight: 900, color: "var(--color-text)", marginTop: 16 }}>
            {player.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-sec)", marginTop: 4 }}>
            {player.position} {player.team ? `· ${player.team}` : ""}
          </div>

          {/* Streak + Badges — inline pills */}
          {(player.streak > 0 || (badges && badges.earned.length > 0)) && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              {player.streak > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#FEF3C7", color: "#D97706",
                  borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 700,
                }}>
                  <Icon name="fire" size={14} color="#D97706" /> {player.streak}-day streak
                </span>
              )}
              {badges && badges.earned.length > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#FFF0E8", color: "#FF6B35",
                  borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 700,
                }}>
                  <Icon name="trophy" size={14} color="#FF6B35" /> {badges.earned.length} badges
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ EMPTY STATE — First time user ═══ */}
      {!hasSessions && (
        <div style={{
          background: "var(--color-card)",
          borderRadius: 20,
          padding: 24,
          textAlign: "center",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32,
            background: "#FFF0E8",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Icon name="basketball" size={28} color="#FF6B35" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>
            Ready to start?
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.5, marginBottom: 16 }}>
            Tap the + button to log your first session. Track shots, assists, rebounds, and more.
          </div>
        </div>
      )}

      {/* ═══ RECENT SESSIONS — Clean list ═══ */}
      {recentSessions.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>Recent</span>
            <button onClick={() => setScreen("shots")} style={{
              fontSize: 12, fontWeight: 700, color: "#FF6B35",
              background: "none", border: "none", cursor: "pointer", padding: "8px 0",
            }}>
              See all
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentSessions.map((s) => {
              const shots = s.shot_logs || [];
              const made = shots.filter((sh) => sh.made).length;
              const stats = s.game_stats || {};
              const pts = shots.filter((sh) => sh.made).reduce((sum, sh) => {
                const zone = COURT_ZONES.find((z) => z.id === sh.zone_id);
                return sum + (zone?.pts || 2);
              }, 0) + (stats.ft_made || 0);
              return (
                <div key={s.id} style={{
                  background: "var(--color-card)",
                  borderRadius: 16, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  boxShadow: "var(--shadow-card)",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: s.type === "game" ? "#FFF0E8" : "#F3F0FF",
                    flexShrink: 0,
                  }}>
                    <Icon name={s.type === "game" ? "trophy" : "zap"} size={20} color={s.type === "game" ? "#FF6B35" : "#8B5CF6"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", textTransform: "capitalize" }}>
                      {s.type} <span style={{ fontWeight: 400, color: "var(--color-text-sec)" }}>· {formatDate(s.created_at)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      {pts > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35" }}>{pts} PTS</span>}
                      {shots.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)" }}>{made}/{shots.length} FG</span>}
                      {stats.ast > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#22C55E" }}>{stats.ast} AST</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ QUICK ACTIONS — 2x2 grid with big icons ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { id: "skills", icon: "skills", label: "Skills", bg: "#FFF0E8", color: "#FF6B35" },
          { id: "iq", icon: "brain", label: "My IQ", bg: "#F3F0FF", color: "#8B5CF6" },
          { id: "gamelog", icon: "trophy", label: "Game Log", bg: "#FEF3C7", color: "#D97706" },
          { id: "heatmap", icon: "fire", label: "Heat Map", bg: "#ECFDF5", color: "#10B981" },
        ].map((a) => (
          <button key={a.id} onClick={() => setScreen(a.id)} style={{
            background: a.bg, border: "none", borderRadius: 16,
            padding: "20px 16px", cursor: "pointer",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 8,
          }}>
            <Icon name={a.icon} size={28} color={a.color} />
            <span style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom spacer for nav */}
      <div style={{ height: 20 }} />
    </div>
  );
}
