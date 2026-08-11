"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icons";

const PRO_FEATURES = [
  { icon: "fire",    label: "Advanced Heat Map Analytics",     desc: "See exactly where you score and where you struggle" },
  { icon: "brain",   label: "Radar Chart & Full IQ Breakdown", desc: "Skill radar, percentile breakdowns, coach analysis" },
  { icon: "user",    label: "Parent-Child Account Linking",    desc: "Parents can monitor and track their child's progress" },
  { icon: "trophy",  label: "Unlimited Game History",          desc: "Full searchable archive of every game session" },
  { icon: "star",    label: "Export Stats & Reports",          desc: "Share polished stat reports with coaches or colleges" },
];

const TEAM_FEATURES = [
  { icon: "user",     label: "Team IQ Radar",                 desc: "Aggregate skill radar across your full roster" },
  { icon: "brain",    label: "Coach Intelligence",            desc: "Team-level strengths, gaps, and coaching insights" },
  { icon: "link",     label: "Collaborative Live Sessions",   desc: "Parents & coaches track the same game in real time" },
  { icon: "barChart", label: "Roster Stat Breakdown",         desc: "Compare every player side by side — GP, FG%, PPG, APG" },
  { icon: "trophy",   label: "Team Season Stats",             desc: "Team record, averages, and trend tracking over time" },
  { icon: "fire",     label: "Everything in Pro",             desc: "All individual Pro features included" },
];

export default function ProUpgradeScreen({ featureName, teamMode = false }) {
  const [selectedTier, setSelectedTier] = useState(teamMode ? "team" : "pro");

  const isTeam = selectedTier === "team";
  const accentColor = isTeam ? "#8B5CF6" : "#22C55E";
  const features = isTeam ? TEAM_FEATURES : PRO_FEATURES;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "0 4px" }}>

      {/* Tier Selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[
          { id: "pro",  label: "Court IQ Pro", price: "$4.99/mo", color: "#22C55E" },
          { id: "team", label: "Team IQ",       price: "$9.99/mo", color: "#8B5CF6", badge: "Includes Pro" },
        ].map((t) => (
          <button key={t.id} onClick={() => setSelectedTier(t.id)} style={{
            flex: 1, padding: "14px 12px", borderRadius: 16, textAlign: "center", cursor: "pointer",
            border: `2px solid ${selectedTier === t.id ? t.color : "var(--color-border)"}`,
            background: selectedTier === t.id ? `${t.color}12` : "var(--color-card)",
            transition: "all 0.2s",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: selectedTier === t.id ? t.color : "var(--color-text-sec)", marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: selectedTier === t.id ? t.color : "var(--color-text)" }}>{t.price}</div>
            {t.badge && (
              <div style={{ fontSize: 9, fontWeight: 700, color: t.color, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.badge}</div>
            )}
          </button>
        ))}
      </div>

      {/* Hero */}
      <div style={{
        background: isTeam
          ? "linear-gradient(160deg, #1E0A3C 0%, #2D1060 60%, #3B1A7A 100%)"
          : "linear-gradient(160deg, #0A2A1F 0%, #0F3D2E 60%, #1A4A35 100%)",
        borderRadius: 24, padding: "28px 24px", textAlign: "center", marginBottom: 20,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
          width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${isTeam ? "rgba(139,92,246,0.15)" : "rgba(34,197,94,0.15)"} 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${accentColor}20`, border: `1px solid ${accentColor}40`,
          borderRadius: 20, padding: "4px 14px", marginBottom: 14,
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: 1.2 }}>
            {isTeam ? "Team IQ" : "Court IQ Pro"}
          </span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "white", lineHeight: 1.25, marginBottom: 8 }}>
          {isTeam ? "Unlock Your Full\nTeam Potential" : "Unlock Your Full\nCourt Potential"}
        </div>
        {featureName && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 14px", marginTop: 8,
          }}>
            <Icon name="fire" size={14} color="#F59E0B" />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
              {featureName} requires {isTeam ? "Team IQ" : "Pro"}
            </span>
          </div>
        )}
        <div style={{ fontSize: 38, fontWeight: 900, color: accentColor, marginTop: 18, lineHeight: 1 }}>
          {isTeam ? "$9.99" : "$4.99"}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>per month · cancel anytime</div>
      </div>

      {/* Feature List */}
      <div style={{
        background: "var(--color-card)", borderRadius: 20, overflow: "hidden",
        border: "1px solid var(--color-border)", marginBottom: 20,
      }}>
        <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Everything included
          </span>
        </div>
        {features.map((f, i) => (
          <div key={f.label} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
            borderBottom: i < features.length - 1 ? "1px solid var(--color-muted)" : "none",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `${accentColor}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name={f.icon} size={18} color={accentColor} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{f.label}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 2, lineHeight: 1.4 }}>{f.desc}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button disabled aria-disabled="true" style={{
        width: "100%", padding: "18px 24px", borderRadius: 18,
        background: isTeam
          ? "linear-gradient(135deg, #7C3AED, #6D28D9)"
          : "linear-gradient(135deg, #22C55E, #16A34A)",
        color: "white", fontSize: 16, fontWeight: 800, border: "none",
        minHeight: 56,
        boxShadow: isTeam ? "0 8px 32px rgba(109,40,217,0.35)" : "0 8px 32px rgba(34,197,94,0.35)",
        letterSpacing: -0.3, opacity: 0.55, cursor: "not-allowed",
      }}>
        Secure subscriptions coming soon
      </button>

      <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "var(--color-text-sec)" }}>
        Purchases are unavailable until App Store and Play billing verification is connected.
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}
