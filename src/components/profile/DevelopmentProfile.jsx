"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { fetchSessionHistory } from "@/lib/queries";
import { computeSeasonStats, computeSkillRatings } from "@/lib/intelligence";
import { computeNextMove } from "@/lib/nextMove.mjs";
import { trackEvent } from "@/lib/telemetry";

export default function DevelopmentProfile() {
  const { playerId, player } = useApp();
  const { playerProfile } = useAuth();
  const cardRef = useRef(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    let active = true;
    fetchSessionHistory(playerId).then((sessions) => {
      if (!active) return;
      const ratings = sessions.length ? computeSkillRatings(sessions) : null;
      const season = sessions.length ? computeSeasonStats(sessions) : null;
      setSummary({ sessions, ratings, season, nextMove: computeNextMove(sessions, ratings) });
    }).catch(() => { if (active) setError("Development profile data could not be loaded."); });
    return () => { active = false; };
  }, [playerId]);

  const shareProfile = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    setError("");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: "#0F1117", useCORS: true });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("image");
      const file = new File([blob], "courtiq-development-profile.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "CourtIQ Development Profile" });
        trackEvent("development_profile_shared", { source: "native-share" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        trackEvent("development_profile_shared", { source: "download" });
        setTimeout(() => URL.revokeObjectURL(url), 500);
      }
    } catch {
      setError("The profile image could not be created. Your data was not changed.");
    } finally {
      setSharing(false);
    }
  };

  if (error && !summary) return <p role="alert">{error}</p>;
  if (!summary) return <div style={{ height: 220, borderRadius: 20, background: "var(--color-muted)" }} />;

  const season = summary.season || {};
  const ratings = summary.ratings || {};
  const name = player?.name || playerProfile?.name || "CourtIQ Player";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div ref={cardRef} style={{ background: "linear-gradient(160deg,#111827,#0F1117 60%,#2D1B0E)", color: "white", borderRadius: 26, padding: 26, overflow: "hidden" }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#FF8B61", textTransform: "uppercase", letterSpacing: 1.5 }}>CourtIQ Development Profile</div>
        <h2 style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 950 }}>{name}</h2>
        <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
          {player?.position || playerProfile?.position || "Basketball athlete"}{(player?.team || playerProfile?.team_name) ? " · " + (player?.team || playerProfile?.team_name) : ""}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 22 }}>
          {[
            ["IQ", ratings.overall ?? "—"],
            ["GP", season.gamesPlayed ?? 0],
            ["PPG", season.ppg ?? "—"],
            ["FG%", season.fgPct != null ? season.fgPct + "%" : "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ background: "rgba(255,255,255,.07)", borderRadius: 14, padding: "13px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 950 }}>{value}</div>
              <div style={{ marginTop: 3, fontSize: 8, color: "rgba(255,255,255,.45)", fontWeight: 800 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginTop: 10 }}>
          {[
            ["Shooting", ratings.shooting],
            ["Playmaking", ratings.playmaking],
            ["Rebounding", ratings.rebounding],
            ["Defense", ratings.defense],
            ["Efficiency", ratings.efficiency],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: "11px 12px", borderRadius: 13, background: "rgba(255,255,255,.045)" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.48)", fontWeight: 800 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 950, color: "#FF8B61", marginTop: 3 }}>{value ?? "—"}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, padding: 15, borderRadius: 15, background: "rgba(139,92,246,.14)", border: "1px solid rgba(139,92,246,.2)" }}>
          <div style={{ fontSize: 9, color: "#D9C7FF", fontWeight: 900, textTransform: "uppercase" }}>Current development priority</div>
          <div style={{ marginTop: 5, fontSize: 15, fontWeight: 900 }}>{summary.nextMove.title}</div>
          <div style={{ marginTop: 5, fontSize: 10, color: "rgba(255,255,255,.6)", lineHeight: 1.5 }}>{summary.nextMove.metric}</div>
        </div>

        <div style={{ marginTop: 18, fontSize: 9, color: "rgba(255,255,255,.32)", lineHeight: 1.5 }}>
          Based on manually recorded CourtIQ data. CourtIQ ratings are development heuristics, not verified recruiting or professional scouting grades.
        </div>
      </div>

      {error && <p role="alert" style={{ color: "#EF4444", fontSize: 11 }}>{error}</p>}
      <button type="button" onClick={shareProfile} disabled={sharing} style={{ minHeight: 48, border: 0, borderRadius: 14, background: "#FF6B35", color: "white", fontWeight: 900, cursor: "pointer", opacity: sharing ? .6 : 1 }}>
        {sharing ? "Creating profile…" : "Share development profile"}
      </button>
    </div>
  );
}
