"use client";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Icon from "@/components/ui/Icons";

const FEATURES = [
  { icon: "fire", label: "Advanced Heat Map Analytics", desc: "See exactly where you score from and where you struggle" },
  { icon: "brain", label: "Radar Chart & IQ Breakdown", desc: "Full skill radar with percentile breakdowns" },
  { icon: "user", label: "Parent-Child Account Linking", desc: "Parents can monitor and track their child's progress" },
  { icon: "trophy", label: "Unlimited Game History", desc: "Full searchable archive of every game session" },
  { icon: "star", label: "Export Stats & Reports", desc: "Share polished stat reports with coaches or colleges" },
];

export default function ProUpgradeScreen({ featureName }) {
  const { upgradeToPro, setScreen } = useApp();
  const [upgraded, setUpgraded] = useState(false);

  const handleUpgrade = () => {
    upgradeToPro();
    setUpgraded(true);
    setTimeout(() => {
      setScreen("home");
    }, 2000);
  };

  if (upgraded) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "60vh", gap: 16, textAlign: "center", padding: "0 24px",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: "linear-gradient(135deg, #22C55E, #16A34A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 32px rgba(34,197,94,0.4)",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--color-text)" }}>
          Welcome to Pro!
        </div>
        <div style={{ fontSize: 14, color: "var(--color-text-sec)", lineHeight: 1.6 }}>
          All Pro features are now unlocked. Your header has changed to reflect your Pro status.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "0 4px" }}>

      {/* Hero Section */}
      <div style={{
        background: "linear-gradient(160deg, #0A2A1F 0%, #0F3D2E 60%, #1A4A35 100%)",
        borderRadius: 24,
        padding: "32px 24px",
        textAlign: "center",
        marginBottom: 20,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle glow */}
        <div style={{
          position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 20, padding: "4px 14px", marginBottom: 16,
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#22C55E", textTransform: "uppercase", letterSpacing: 1.2 }}>Court IQ Pro</span>
        </div>

        <div style={{ fontSize: 28, fontWeight: 900, color: "white", lineHeight: 1.2, marginBottom: 8 }}>
          Unlock Your Full<br />Court Potential
        </div>

        {featureName && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 14px",
            marginTop: 8, marginBottom: 4,
          }}>
            <Icon name="fire" size={14} color="#F59E0B" />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
              {featureName} requires Pro
            </span>
          </div>
        )}

        <div style={{ fontSize: 36, fontWeight: 900, color: "#22C55E", marginTop: 20, lineHeight: 1 }}>
          $4.99
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>per month · cancel anytime</div>
      </div>

      {/* Feature List */}
      <div style={{
        background: "var(--color-card)",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        marginBottom: 20,
      }}>
        <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Everything included
          </span>
        </div>
        {FEATURES.map((f, i) => (
          <div key={f.label} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 20px",
            borderBottom: i < FEATURES.length - 1 ? "1px solid var(--color-muted)" : "none",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "rgba(34,197,94,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name={f.icon} size={18} color="#22C55E" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{f.label}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 2, lineHeight: 1.4 }}>{f.desc}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <button
        onClick={handleUpgrade}
        style={{
          width: "100%",
          padding: "18px 24px",
          borderRadius: 18,
          background: "linear-gradient(135deg, #22C55E, #16A34A)",
          color: "white",
          fontSize: 16,
          fontWeight: 800,
          border: "none",
          cursor: "pointer",
          minHeight: 56,
          boxShadow: "0 8px 32px rgba(34,197,94,0.35)",
          letterSpacing: -0.3,
        }}
      >
        Upgrade to Pro — $4.99/mo
      </button>

      <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "var(--color-text-sec)" }}>
        Simulated purchase — no real payment processed
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}
