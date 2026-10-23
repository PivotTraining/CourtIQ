"use client";
import { useState } from "react";
import { deleteGameSession } from "@/lib/queries";
import { createDeviceVideoStore } from "@/lib/deviceVideo.mjs";
import { loadRecovery, recoveryKey } from "@/lib/sessionRecovery.mjs";
import { useApp } from "@/context/AppContext";

// The shared/team-game record may belong to several players; never cascade-delete it here.
export default function DeleteGameButton({ session, playerId, accountId, onDeleted }) {
  const { refreshData } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (session.type !== "game") return null;
  if (session.mode !== "individual") return <p className="report-media-note">Shared team games cannot be deleted from an individual player log.</p>;
  if (session.tracker_status === "active") return null;

  async function remove(event) {
    event.stopPropagation();
    if (busy || !playerId || !accountId) return;
    const label = session.tracker_context?.opponent ? ` vs ${session.tracker_context.opponent}` : "";
    if (!window.confirm(`Permanently delete this game${label}? All of its shots, stats and tracking entries will be removed from your totals and reports. This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      // Authoritative server delete first; never remove rows from the UI on a failed write.
      await deleteGameSession(session.id, playerId);
    } catch {
      setError("The game could not be deleted. Your stats are unchanged. Check your connection and try again.");
      setBusy(false);
      return;
    }
    let warning = "";
    try {
      const cached = loadRecovery(window.localStorage, accountId, playerId);
      if (cached?.snapshot?.session?.id === session.id && !cached.pending?.length)
        window.localStorage.removeItem(recoveryKey(accountId, playerId));
    } catch { /* Keep unsynced on-device entries intact if recovery cannot be inspected. */ }
    try {
      await createDeviceVideoStore().remove(accountId, session.id);
    } catch {
      warning = "Game removed, but a video stored on this device could not be cleared. Check device video storage.";
    }
    try {
      if (!(await refreshData())) {
        warning += " Updated tracking totals could not reload yet. Reopen CourtIQ to refresh.";
      }
    } catch {
      warning += " Updated tracking totals could not reload yet. Reopen CourtIQ to refresh.";
    }
    onDeleted(session.id, warning.trim());
    setBusy(false);
  }

  return <div style={{ marginTop: 18, borderTop: "1px solid var(--color-border)", paddingTop: 16 }} onClick={event => event.stopPropagation()}>
    <button type="button" onClick={remove} disabled={busy || !playerId || !accountId}
      aria-label="Delete this game and remove its stats" style={{ minHeight: 44, padding: "10px 14px", borderRadius: 12,
        background: "transparent", border: "1px solid #B91C1C", color: "#DC2626", fontSize: 13, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
      {busy ? "Deleting game…" : "Delete game & stats"}
    </button>
    <p className="report-media-note">Permanent. Removes this game from season averages, heat maps and tracking totals.</p>
    {error && <p role="alert" style={{ color: "#DC2626", fontSize: 13 }}>{error}</p>}
  </div>;
}
