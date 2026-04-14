"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icons";
import PlayerInsights from "@/components/dashboard/PlayerInsights";
import CoachDashboard from "./CoachDashboard";
import TeamIQScreen from "./TeamIQScreen";
import { useApp } from "@/context/AppContext";

export default function IQScreen() {
  const { loading, isTeamIQ, setScreen } = useApp();
  const [tab, setTab] = useState("individual"); // individual | team

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ height: 40, background: "var(--color-muted)", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 192, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 128, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Individual / Team IQ tabs */}
      <div style={{ display: "flex", background: "var(--color-muted)", borderRadius: 12, padding: 3 }}>
        <button onClick={() => setTab("individual")} style={{
          flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          minHeight: 44, transition: "all 0.2s",
          background: tab === "individual" ? "var(--color-card)" : "transparent",
          color: tab === "individual" ? "var(--color-accent)" : "var(--color-text-sec)",
          boxShadow: tab === "individual" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
        }}>
          <Icon name="brain" size={13} /> My IQ
        </button>
        <button onClick={() => setTab("team")} style={{
          flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          minHeight: 44, transition: "all 0.2s",
          background: tab === "team" ? "var(--color-card)" : "transparent",
          color: tab === "team" ? "#8B5CF6" : "var(--color-text-sec)",
          boxShadow: tab === "team" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
        }}>
          <Icon name="user" size={13} color={tab === "team" ? "#8B5CF6" : "var(--color-text-sec)"} />
          Team IQ
          {!isTeamIQ && (
            <span style={{ fontSize: 8, fontWeight: 900, color: "#8B5CF6", background: "rgba(139,92,246,0.15)", borderRadius: 5, padding: "1px 5px", marginLeft: 2 }}>PRO</span>
          )}
        </button>
      </div>

      {/* ── Individual IQ ── */}
      {tab === "individual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Context banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(139,92,246,0.08)",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: 14, padding: "10px 14px",
          }}>
            <Icon name="brain" size={18} color="#8B5CF6" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#8B5CF6" }}>Powered by your Gametime sessions</div>
              <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 1 }}>
                Every shot, assist, and stat you track updates your IQ automatically.
              </div>
            </div>
          </div>

          <PlayerInsights />
          <CoachDashboard />
        </div>
      )}

      {/* ── Team IQ ── */}
      {tab === "team" && (
        isTeamIQ ? (
          <TeamIQScreen />
        ) : (
          /* Upgrade prompt for non-TeamIQ users */
          <div style={{
            background: "linear-gradient(135deg, #1E0A3C, #2D1060)",
            borderRadius: 24, padding: "36px 24px",
            textAlign: "center",
            border: "1px solid rgba(139,92,246,0.3)",
          }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Icon name="user" size={32} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "white", marginBottom: 8 }}>Team IQ</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 24 }}>
              Aggregate intelligence across your entire roster — team radar, coach insights, and every player's individual breakdown in one view.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {[
                { icon: "brain", text: "Team Skill Radar — aggregate of all players" },
                { icon: "fire",  text: "Coach Intelligence — team-level strengths & gaps" },
                { icon: "user",  text: "Roster Breakdown — compare every player side by side" },
                { icon: "link",  text: "Collaborative Live Sessions — parents track in real time" },
                { icon: "trophy", text: "Team Season Stats — wins, averages, trends" },
              ].map((f) => (
                <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={f.icon} size={15} color="#8B5CF6" />
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{f.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setScreen("teamiq-upgrade")} style={{
              width: "100%", padding: "16px 24px", borderRadius: 16,
              background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
              color: "white", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer",
              boxShadow: "0 8px 24px rgba(109,40,217,0.4)", minHeight: 52,
            }}>
              Unlock Team IQ — $9.99/mo
            </button>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 10 }}>
              Includes all Pro features · cancel anytime
            </div>
          </div>
        )
      )}
    </div>
  );
}
