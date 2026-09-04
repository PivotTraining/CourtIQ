"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { fetchSessionHistory } from "@/lib/queries";
import { computeSkillRatings } from "@/lib/intelligence";
import { computeBadges } from "@/lib/badges";
import { computeNextMove } from "@/lib/nextMove.mjs";
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

function pointsForSession(session) {
  const shots = session.shot_logs || [];
  const stats = session.game_stats || {};
  return shots.filter((shot) => shot.made).reduce((sum, shot) => {
    const zone = COURT_ZONES.find((item) => item.id === shot.zone_id);
    return sum + (zone?.pts || 2);
  }, 0) + Number(stats.ft_made || 0);
}

function ratingTier(overall = 0) {
  if (overall >= 90) return { label: "Elite", color: "#FF6B35" };
  if (overall >= 75) return { label: "Advanced", color: "#22C55E" };
  if (overall >= 55) return { label: "Solid", color: "#3B82F6" };
  if (overall >= 35) return { label: "Developing", color: "#F59E0B" };
  return { label: "Rookie", color: "#8B5CF6" };
}

export default function HomeDashboard() {
  const { setScreen, player, playerId, journalEntries, loading } = useApp();
  const [sessions, setSessions] = useState([]);
  const [ratings, setRatings] = useState(null);
  const [badges, setBadges] = useState(null);
  const [nextMove, setNextMove] = useState(null);
  const [showRatingInfo, setShowRatingInfo] = useState(false);

  useEffect(() => {
    if (!playerId) return;

    let active = true;
    fetchSessionHistory(playerId)
      .then((history) => {
        if (!active) return;
        const computedRatings = history.length ? computeSkillRatings(history) : null;
        setSessions(history);
        setRatings(computedRatings);
        setBadges(history.length ? computeBadges(history, player?.streak || 0, journalEntries.length) : null);
        setNextMove(computeNextMove(history, computedRatings));
      })
      .catch(() => {
        if (active) setNextMove(computeNextMove([], null));
      });

    return () => {
      active = false;
    };
  }, [playerId, player?.streak, journalEntries.length]);

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 16, padding: "0 4px" }}>
        <div style={{ height: 210, background: "var(--color-muted)", borderRadius: 24, animation: "pulse 1.5s ease infinite" }} />
        <div style={{ height: 180, background: "var(--color-muted)", borderRadius: 20, animation: "pulse 1.5s ease infinite" }} />
      </div>
    );
  }

  const hasSessions = sessions.length > 0;
  const recentSessions = sessions.slice(0, 3);
  const tier = ratingTier(ratings?.overall || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "0 4px" }}>
      <div style={{ textAlign: "center", padding: "4px 0" }}>
        <img
          src={typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "/courtiq-dark.png" : "/courtiq-light.png"}
          alt="Court IQ"
          style={{ height: 68, maxWidth: "100%", objectFit: "contain" }}
        />
      </div>

      {player && (
        <section style={{
          background: "var(--color-card)",
          borderRadius: 24,
          padding: "28px 24px",
          boxShadow: "var(--shadow-elevated)",
          border: "1px solid var(--color-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: "1 1 260px" }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.3, color: "var(--color-text-sec)", textTransform: "uppercase" }}>
                Player development profile
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--color-text)", marginTop: 7, letterSpacing: -0.8 }}>
                {player.name}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-sec)", marginTop: 4 }}>
                {player.position || "Basketball athlete"}{player.team ? ` · ${player.team}` : ""}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {player.streak > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FEF3C7", color: "#D97706", borderRadius: 20, padding: "6px 11px", fontSize: 11, fontWeight: 800 }}>
                    <Icon name="fire" size={14} color="#D97706" /> {player.streak}-day streak
                  </span>
                )}
                {badges?.earned?.length > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FFF0E8", color: "#FF6B35", borderRadius: 20, padding: "6px 11px", fontSize: 11, fontWeight: 800 }}>
                    <Icon name="trophy" size={14} color="#FF6B35" /> {badges.earned.length} badges
                  </span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--color-muted)", color: "var(--color-text-sec)", borderRadius: 20, padding: "6px 11px", fontSize: 11, fontWeight: 800 }}>
                  {sessions.length} session{sessions.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => ratings && setShowRatingInfo((value) => !value)}
              style={{
                flex: "0 0 auto",
                minWidth: 150,
                border: "none",
                borderRadius: 20,
                padding: "20px 24px",
                cursor: ratings ? "pointer" : "default",
                background: `${tier.color}14`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: ratings ? 54 : 36, lineHeight: 1, fontWeight: 950, color: ratings ? tier.color : "#FF6B35" }}>
                {ratings ? ratings.overall : `#${player.number || 0}`}
              </div>
              <div style={{ fontSize: 10, marginTop: 7, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: ratings ? tier.color : "#FF6B35" }}>
                {ratings ? `${tier.label} rating` : "Jersey"}
              </div>
            </button>
          </div>

          {showRatingInfo && ratings && (
            <div style={{ marginTop: 18, background: "var(--color-muted)", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "var(--color-text)" }}>How CourtIQ reads your game</div>
              <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--color-text-sec)", marginTop: 6 }}>
                Your overall score blends Shooting, Playmaking, Rebounding, Defense and Efficiency. The score is experience-gated so a small sample cannot create an inflated rating.
              </div>
              <button type="button" onClick={() => setScreen("iq")} style={{ marginTop: 12, border: "none", background: "transparent", padding: 0, color: "#FF6B35", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
                Open full IQ breakdown →
              </button>
            </div>
          )}
        </section>
      )}

      {nextMove && (
        <section style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          padding: "24px",
          background: "linear-gradient(135deg, #21163F 0%, #3B2470 52%, #6D3AE8 100%)",
          boxShadow: "0 18px 42px rgba(61,36,112,0.24)",
          color: "white",
        }}>
          <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.07)", right: -80, top: -110 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 950, letterSpacing: 1.5, color: "#D9C7FF", textTransform: "uppercase" }}>
              <Icon name="brain" size={15} color="#D9C7FF" /> CourtIQ next move
            </div>
            <h2 style={{ margin: "10px 0 0", fontSize: 24, lineHeight: 1.1, fontWeight: 950, letterSpacing: -0.6 }}>
              {nextMove.title}
            </h2>
            <p style={{ margin: "10px 0 0", maxWidth: 760, fontSize: 13, lineHeight: 1.65, color: "rgba(255,255,255,0.78)" }}>
              {nextMove.reason}
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setScreen(nextMove.screen)}
                style={{ border: "none", borderRadius: 12, padding: "11px 15px", background: "white", color: "#3B2470", fontSize: 12, fontWeight: 950, cursor: "pointer" }}
              >
                {nextMove.actionLabel} →
              </button>
              <span style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 800, color: "#F0E8FF" }}>
                {nextMove.metric}
              </span>
            </div>
          </div>
        </section>
      )}

      {!hasSessions && (
        <section style={{ background: "var(--color-card)", borderRadius: 20, padding: 24, textAlign: "center", boxShadow: "var(--shadow-card)", border: "1px solid var(--color-border)" }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: "#FFF0E8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Icon name="basketball" size={28} color="#FF6B35" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--color-text)" }}>Give CourtIQ something to read</div>
          <div style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.55, margin: "8px auto 0", maxWidth: 500 }}>
            Log a game or workout. Once there is real performance data, CourtIQ will start identifying patterns, weaknesses and the next best development move.
          </div>
        </section>
      )}

      {recentSessions.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 4px", marginBottom: 11 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "var(--color-text)" }}>Recent work</div>
              <div style={{ fontSize: 10, color: "var(--color-text-sec)", marginTop: 2 }}>The data behind your recommendations</div>
            </div>
            <button type="button" onClick={() => setScreen("shots")} style={{ border: "none", background: "transparent", color: "#FF6B35", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
              See all
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {recentSessions.map((session) => {
              const shots = session.shot_logs || [];
              const made = shots.filter((shot) => shot.made).length;
              const stats = session.game_stats || {};
              const points = pointsForSession(session);

              return (
                <article key={session.id} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "var(--shadow-card)" }}>
                  <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, background: session.type === "game" ? "#FFF0E8" : "#F3F0FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={session.type === "game" ? "trophy" : "zap"} size={20} color={session.type === "game" ? "#FF6B35" : "#8B5CF6"} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 850, color: "var(--color-text)", textTransform: "capitalize" }}>
                      {session.type} <span style={{ fontWeight: 500, color: "var(--color-text-sec)" }}>· {formatDate(session.created_at)}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 5 }}>
                      {points > 0 && <span style={{ fontSize: 11, fontWeight: 850, color: "#FF6B35" }}>{points} PTS</span>}
                      {shots.length > 0 && <span style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-sec)" }}>{made}/{shots.length} FG</span>}
                      {Number(stats.ast || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 850, color: "#22C55E" }}>{stats.ast} AST</span>}
                      {Number(stats.to || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 850, color: "#EF4444" }}>{stats.to} TO</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div style={{ fontSize: 14, fontWeight: 900, color: "var(--color-text)", padding: "0 4px", marginBottom: 10 }}>Explore your game</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {[
            { id: "train", icon: "dumbbell", label: "Training", caption: "Workouts & drills", bg: "#FFF0E8", color: "#FF6B35" },
            { id: "iq", icon: "brain", label: "My IQ", caption: "Ratings & trends", bg: "#F3F0FF", color: "#8B5CF6" },
            { id: "gamelog", icon: "trophy", label: "Game Log", caption: "Performance history", bg: "#FEF3C7", color: "#D97706" },
            { id: "heatmap", icon: "fire", label: "Heat Map", caption: "Where shots fall", bg: "#ECFDF5", color: "#10B981" },
          ].map((action) => (
            <button key={action.id} type="button" onClick={() => setScreen(action.id)} style={{ minHeight: 118, background: action.bg, border: "none", borderRadius: 17, padding: "18px 16px", cursor: "pointer", textAlign: "left" }}>
              <Icon name={action.icon} size={25} color={action.color} />
              <div style={{ fontSize: 13, fontWeight: 900, color: action.color, marginTop: 10 }}>{action.label}</div>
              <div style={{ fontSize: 10, fontWeight: 650, color: action.color, opacity: 0.72, marginTop: 3 }}>{action.caption}</div>
            </button>
          ))}
        </div>
      </section>

      <div style={{ height: 20 }} />
    </div>
  );
}
