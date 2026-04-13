"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { getMoodIcon } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import { MOODS } from "@/lib/constants";
import Icon from "@/components/ui/Icons";

const cardStyle = {
  background: "var(--color-card)",
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-card)",
  padding: 16,
};

const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  fontSize: 14,
  fontWeight: 600,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  color: "var(--color-text)",
};

const statInputStyle = {
  width: 64,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  textAlign: "center",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
  color: "var(--color-text)",
};

export default function JournalScreen() {
  const { journalEntries, addJournalEntry, loading } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: "",
    body: "",
    type: "practice",
    mood: "focused",
  });
  const [stats, setStats] = useState({ pts: "", ast: "", reb: "", to: "", fgPct: "" });
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ height: 48, background: "var(--color-muted)", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 128, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 128, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }

  const handleSave = async () => {
    if (!newEntry.title.trim() || !newEntry.body.trim()) return;
    setSaving(true);
    try {
      const entryStats = {};
      if (newEntry.type === "game") {
        if (stats.pts) entryStats.pts = parseInt(stats.pts);
        if (stats.ast) entryStats.ast = parseInt(stats.ast);
        if (stats.reb) entryStats.reb = parseInt(stats.reb);
        if (stats.to) entryStats.to = parseInt(stats.to);
        if (stats.fgPct) entryStats.fgPct = parseInt(stats.fgPct);
      } else {
        if (stats.fgPct) entryStats.fgPct = parseInt(stats.fgPct);
      }
      await addJournalEntry({ ...newEntry, stats: entryStats });
      setNewEntry({ title: "", body: "", type: "practice", mood: "focused" });
      setStats({ pts: "", ast: "", reb: "", to: "", fgPct: "" });
      setShowNew(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* New Entry Button */}
      <button
        onClick={() => setShowNew(!showNew)}
        style={{
          width: "100%",
          padding: "14px 0",
          borderRadius: 14,
          border: showNew ? "2px dashed rgba(239,68,68,0.3)" : "2px dashed var(--color-accent)",
          background: showNew ? "#FEF2F2" : "rgba(255,107,53,0.06)",
          color: showNew ? "var(--color-danger)" : "var(--color-accent)",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 44,
        }}
      >
        {showNew
          ? <><Icon name="x" size={14} /> Cancel</>
          : <><Icon name="edit" size={14} /> New Journal Entry</>
        }
      </button>

      {/* New Entry Form */}
      {showNew && (
        <div style={{ ...cardStyle, marginBottom: 20, border: "1px solid rgba(255,107,53,0.2)" }}>
          {/* Type Toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["game", "practice"].map((t) => (
              <button
                key={t}
                onClick={() => setNewEntry({ ...newEntry, type: t })}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  background: newEntry.type === t ? (t === "game" ? "#FF6B35" : "#8B5CF6") : "var(--color-muted)",
                  color: newEntry.type === t ? "white" : "var(--color-text-sec)",
                }}
              >
                <Icon name={t === "game" ? "trophy" : "zap"} size={14} />{t === "game" ? "Game" : "Practice"}
              </button>
            ))}
          </div>

          {/* Mood Selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {MOODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setNewEntry({ ...newEntry, mood: m.id })}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 12,
                  border: newEntry.mood === m.id ? "2px solid #FF6B35" : "2px solid transparent",
                  cursor: "pointer",
                  background: newEntry.mood === m.id ? "#FFF0E8" : "var(--color-bg)",
                  minHeight: 44,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                <Icon name={m.icon} size={18} color={newEntry.mood === m.id ? "#FF6B35" : "#6B7194"} />
                <span style={{ fontSize: 9, fontWeight: 700, color: newEntry.mood === m.id ? "#FF6B35" : "var(--color-text-sec)" }}>{m.label}</span>
              </button>
            ))}
          </div>

          <input
            value={newEntry.title}
            onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
            placeholder="Entry title..."
            style={{ ...inputStyle, marginBottom: 8 }}
          />

          <textarea
            value={newEntry.body}
            onChange={(e) => setNewEntry({ ...newEntry, body: e.target.value })}
            placeholder="How'd it go? What worked? What needs work?..."
            rows={3}
            style={{ ...inputStyle, lineHeight: 1.6, resize: "vertical" }}
          />

          {/* Stat Entry */}
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Stats (optional)
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {newEntry.type === "game" && (
                <>
                  <input
                    type="number" value={stats.pts} onChange={(e) => setStats({ ...stats, pts: e.target.value })}
                    placeholder="PTS" style={statInputStyle}
                  />
                  <input
                    type="number" value={stats.ast} onChange={(e) => setStats({ ...stats, ast: e.target.value })}
                    placeholder="AST" style={statInputStyle}
                  />
                  <input
                    type="number" value={stats.reb} onChange={(e) => setStats({ ...stats, reb: e.target.value })}
                    placeholder="REB" style={statInputStyle}
                  />
                  <input
                    type="number" value={stats.to} onChange={(e) => setStats({ ...stats, to: e.target.value })}
                    placeholder="TO" style={statInputStyle}
                  />
                </>
              )}
              <input
                type="number" value={stats.fgPct} onChange={(e) => setStats({ ...stats, fgPct: e.target.value })}
                placeholder="FG%" style={statInputStyle}
              />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 14,
              background: "var(--color-accent)",
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              cursor: saving ? "default" : "pointer",
              marginTop: 8,
              minHeight: 44,
              opacity: saving ? 0.6 : 1,
            }}>
            {saving ? "Saving..." : "Save Entry"}
          </button>
        </div>
      )}

      {/* Divider */}
      <div style={{ margin: "20px 0", display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, height: 1.5, background: "linear-gradient(to right, transparent, var(--color-border), transparent)" }} />
      </div>

      {/* Section Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="clock" size={18} color="var(--color-accent)" />
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Recent Entries</span>
        </div>
      </div>

      {/* Journal Entries */}
      {journalEntries.length === 0 ? (
        <EmptyState
          icon="journal"
          title="Your journal is empty"
          subtitle="Write about your games and practices to track your growth"
        />
      ) : (
        <div>
          {journalEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                ...cardStyle,
                marginBottom: 12,
                borderLeft: `4px solid ${entry.type === "game" ? "#FF6B35" : "#8B5CF6"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Icon name={getMoodIcon(entry.mood)} size={16} color="var(--color-accent)" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.title}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-text-sec)" }}>{entry.date}</span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 8,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    flexShrink: 0,
                    background: entry.type === "game" ? "#FFF0E8" : "#F3F0FF",
                    color: entry.type === "game" ? "#FF6B35" : "#8B5CF6",
                  }}
                >
                  {entry.type}
                </span>
              </div>

              <p style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.6, margin: "8px 0" }}>{entry.body}</p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {entry.stats.pts > 0 && (
                  <span style={{ fontSize: 11, background: "#F0FDF4", color: "var(--color-success)", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>{entry.stats.pts} PTS</span>
                )}
                {entry.stats.ast > 0 && (
                  <span style={{ fontSize: 11, background: "rgba(255,107,53,0.08)", color: "var(--color-accent)", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>{entry.stats.ast} AST</span>
                )}
                {entry.stats.reb > 0 && (
                  <span style={{ fontSize: 11, background: "#F3F0FF", color: "#8B5CF6", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>{entry.stats.reb} REB</span>
                )}
                {entry.stats.fgPct > 0 && (
                  <span style={{ fontSize: 11, background: "var(--color-bg)", color: "var(--color-text-sec)", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>{entry.stats.fgPct}% FG</span>
                )}
                {entry.stats.to > 0 && (
                  <span style={{ fontSize: 11, background: "#FEF2F2", color: "var(--color-danger)", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>{entry.stats.to} TO</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
