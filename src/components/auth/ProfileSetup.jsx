"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createPlayerProfile } from "@/lib/queries";
import Icon from "@/components/ui/Icons";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const LEVELS = [
  { id: "beginner", label: "Beginner", desc: "Just starting out", iconName: "star" },
  { id: "intermediate", label: "Intermediate", desc: "Rec league / JV", iconName: "zap" },
  { id: "advanced", label: "Advanced", desc: "Varsity / AAU", iconName: "fire" },
  { id: "elite", label: "Elite", desc: "Travel / Showcase", iconName: "trophy" },
];

const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-input-bg)",
  fontSize: 15,
  color: "var(--color-text)",
  outline: "none",
  boxSizing: "border-box",
};

export default function ProfileSetup() {
  const { user, setPlayerProfile, setNeedsProfile } = useAuth();
  const [form, setForm] = useState({
    name: user?.displayName || "",
    team_name: "",
    position: "PG",
    jersey_number: "",
    age: "",
    level: "intermediate",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const profile = await createPlayerProfile({
        firebase_uid: user.id,
        name: form.name.trim(),
        team_name: form.team_name.trim() || null,
        position: form.position,
        jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
        age: form.age ? parseInt(form.age) : null,
      });
      setPlayerProfile(profile);
      setNeedsProfile(false);
    } catch (err) {
      setError(err.message || "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      height: "100dvh",
      background: "var(--color-bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: "max(24px, env(safe-area-inset-top, 24px))",
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 40,
      boxSizing: "border-box",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ marginBottom: 8 }}><Icon name="hand" size={40} color="#FF6B35" /></div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>Set Up Your Profile</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-sec)", marginTop: 6 }}>Let's get your player card ready</p>
      </div>

      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "var(--color-card)",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Name</label>
            <input value={form.name} onChange={(e) => update("name", e.target.value)}
              placeholder="Your name" required style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Team Name</label>
            <input value={form.team_name} onChange={(e) => update("team_name", e.target.value)}
              placeholder="e.g. Cleveland Elite AAU" style={inputStyle} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Position</label>
              <select value={form.position} onChange={(e) => update("position", e.target.value)}
                style={inputStyle}>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ width: 80 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Jersey #</label>
              <input type="number" value={form.jersey_number} onChange={(e) => update("jersey_number", e.target.value)}
                placeholder="#" min="0" max="99" style={inputStyle} />
            </div>
            <div style={{ width: 72 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Age</label>
              <input type="number" value={form.age} onChange={(e) => update("age", e.target.value)}
                placeholder="16" min="8" max="30" style={inputStyle} />
            </div>
          </div>

          {/* Skill Level */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Skill Level</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {LEVELS.map((l) => (
                <button key={l.id} type="button" onClick={() => update("level", l.id)}
                  style={{
                    padding: "12px",
                    borderRadius: 12,
                    border: `2px solid ${form.level === l.id ? "var(--color-accent)" : "var(--color-border)"}`,
                    background: form.level === l.id ? "var(--color-accent-light)" : "var(--color-card)",
                    textAlign: "left",
                    cursor: "pointer",
                    minHeight: 44,
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name={l.iconName} size={18} color={form.level === l.id ? "var(--color-accent)" : "var(--color-text-sec)"} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: form.level === l.id ? "var(--color-accent)" : "var(--color-text)" }}>{l.label}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-sec)" }}>{l.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </form>
      </div>

      {/* Submit button OUTSIDE the card so it's always visible */}
      {error && (
        <div style={{
          fontSize: 13, color: "#DC2626", background: "#FEF2F2",
          padding: "12px 16px", borderRadius: 12, border: "1px solid #FECACA",
          maxWidth: 400, width: "100%", marginTop: 12, boxSizing: "border-box",
        }}>{error}</div>
      )}

      <button onClick={handleSubmit} disabled={loading || !form.name.trim()} style={{
        width: "100%", maxWidth: 400,
        padding: "16px 24px", borderRadius: 16,
        border: "none", background: "#FF6B35", color: "white",
        fontSize: 17, fontWeight: 800, cursor: "pointer",
        minHeight: 52, marginTop: 16,
        opacity: loading || !form.name.trim() ? 0.5 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: "0 4px 16px rgba(255,107,53,0.3)",
        boxSizing: "border-box",
      }}>
        {loading ? "Creating..." : <><span>Let's Go</span> <Icon name="basketball" size={18} color="white" /></>}
      </button>
    </div>
  );
}
