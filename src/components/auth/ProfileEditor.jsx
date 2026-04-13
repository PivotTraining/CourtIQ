"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { getSupabase } from "@/lib/supabase";
import { signOutUser } from "@/lib/firebase";
import Icon from "@/components/ui/Icons";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

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

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--color-text-sec)",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  marginBottom: 4,
  display: "block",
};

export default function ProfileEditor({ onClose }) {
  const { playerProfile, setPlayerProfile } = useAuth();
  const { refreshData } = useApp();
  const [form, setForm] = useState({
    name: playerProfile?.name || "",
    team_name: playerProfile?.team_name || "",
    position: playerProfile?.position || "PG",
    jersey_number: playerProfile?.jersey_number?.toString() || "",
    age: playerProfile?.age?.toString() || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { data, error: err } = await getSupabase()
        .from("players")
        .update({
          name: form.name.trim(),
          team_name: form.team_name.trim() || null,
          position: form.position,
          jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
          age: form.age ? parseInt(form.age) : null,
        })
        .eq("id", playerProfile.id)
        .select()
        .single();
      if (err) throw err;
      setPlayerProfile(data);
      await refreshData();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 200,
      background: "var(--color-bg)",
      overflowY: "auto",
    }}>
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <button onClick={onClose} style={{
            background: "transparent",
            border: "none",
            color: "var(--color-text-sec)",
            fontSize: 15,
            cursor: "pointer",
            minHeight: 44,
            padding: "8px 12px",
          }}>Cancel</button>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>Edit Profile</span>
          <div style={{ width: 64 }} />
        </div>

        <div style={{
          background: "var(--color-card)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input
                value={form.name} onChange={(e) => update("name", e.target.value)}
                placeholder="Your name" required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Team</label>
              <input
                value={form.team_name} onChange={(e) => update("team_name", e.target.value)}
                placeholder="e.g. Cleveland Elite AAU"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Position</label>
                <select
                  value={form.position} onChange={(e) => update("position", e.target.value)}
                  style={inputStyle}
                >
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ width: 96 }}>
                <label style={labelStyle}>Jersey #</label>
                <input
                  type="number" value={form.jersey_number} onChange={(e) => update("jersey_number", e.target.value)}
                  placeholder="#" min="0" max="99"
                  style={inputStyle}
                />
              </div>
              <div style={{ width: 80 }}>
                <label style={labelStyle}>Age</label>
                <input
                  type="number" value={form.age} onChange={(e) => update("age", e.target.value)}
                  placeholder="16" min="10" max="25"
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div style={{
                fontSize: 12,
                color: "#DC2626",
                background: "#FEF2F2",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #FECACA",
              }}>{error}</div>
            )}

            <button type="submit" disabled={saving} style={{
              width: "100%",
              padding: "14px 24px",
              borderRadius: 14,
              border: "none",
              background: "var(--color-accent)",
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 44,
              marginTop: 8,
              opacity: saving ? 0.5 : 1,
            }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Reset Data */}
        <button
          onClick={async () => {
            if (!window.confirm("This will delete all your sessions, shots, and journal entries but keep your account. Continue?")) return;
            setSaving(true);
            try {
              await getSupabase().from("shot_logs").delete().eq("player_id", playerProfile.id);
              await getSupabase().from("journal_entries").delete().eq("player_id", playerProfile.id);
              await getSupabase().from("sessions").delete().eq("player_id", playerProfile.id);
              await refreshData();
              onClose();
            } catch (err) {
              setError("Failed to reset data");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "14px 0",
            borderRadius: 16,
            border: "2px solid rgba(245,158,11,0.2)",
            background: "rgba(245,158,11,0.05)",
            color: "#F59E0B",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            minHeight: 44,
            opacity: saving ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Icon name="refresh" size={16} /> Reset All Stats
        </button>

        {/* Sign Out */}
        <button
          onClick={signOutUser}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "14px 0",
            borderRadius: 16,
            border: "2px solid rgba(220,38,38,0.2)",
            background: "rgba(220,38,38,0.05)",
            color: "#DC2626",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            minHeight: 44,
          }}
        >
          Sign Out
        </button>

        {/* Delete Account Trigger */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "12px 0",
            borderRadius: 16,
            border: "none",
            background: "transparent",
            color: "rgba(220,38,38,0.5)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            minHeight: 44,
            opacity: saving ? 0.5 : 1,
          }}
          aria-label="Delete account and all data"
        >
          Delete Account & All Data
        </button>

        {/* Destructive Confirmation Sheet */}
        {showDeleteConfirm && (
          <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }} onClick={() => setShowDeleteConfirm(false)}>
            <div style={{
              width: "100%",
              maxWidth: 520,
              background: "var(--color-card)",
              borderRadius: "20px 20px 0 0",
              padding: 24,
              paddingBottom: 32,
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 40, height: 4, background: "var(--color-muted)", borderRadius: 2, margin: "0 auto 16px" }} />
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}><Icon name="alert" size={32} color="#F59E0B" /></div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>Delete Your Account?</h3>
                <p style={{ fontSize: 13, color: "var(--color-text-sec)", margin: 0 }}>This will permanently remove all your sessions, shots, journal entries, and stats. This cannot be undone.</p>
              </div>
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await getSupabase().from("shot_logs").delete().eq("player_id", playerProfile.id);
                    await getSupabase().from("journal_entries").delete().eq("player_id", playerProfile.id);
                    await getSupabase().from("sessions").delete().eq("player_id", playerProfile.id);
                    await getSupabase().from("players").delete().eq("id", playerProfile.id);
                    await signOutUser();
                  } catch (err) {
                    setError("Failed to delete. Contact support@pivottrainingdev.com");
                    setSaving(false);
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "16px 0",
                  borderRadius: 16,
                  background: "#DC2626",
                  color: "white",
                  fontSize: 17,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  minHeight: 44,
                  opacity: saving ? 0.5 : 1,
                  marginBottom: 8,
                }}
              >
                {saving ? "Deleting..." : "Delete Everything"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  width: "100%",
                  padding: "16px 0",
                  borderRadius: 16,
                  background: "var(--color-muted)",
                  color: "var(--color-text)",
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
