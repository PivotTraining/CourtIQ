"use client";

import { useRef, useState } from "react";
import Icon from "@/components/ui/Icons";

export default function ShareStoryCard({ stats, playerName, onClose }) {
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      canvas.toBlob(async (blob) => {
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], "court-iq-stats.png", { type: "image/png" })] })) {
          await navigator.share({
            files: [new File([blob], "court-iq-stats.png", { type: "image/png" })],
          });
        } else {
          // Fallback: download
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "court-iq-stats.png";
          a.click();
          URL.revokeObjectURL(url);
        }
        setSharing(false);
      }, "image/png");
    } catch (err) {
      console.error("Share failed:", err);
      setSharing(false);
    }
  };

  const { totalPts = 0, fgPct = 0, threePct = 0, ftPct = 0, ast = 0, reb = 0, stl = 0, blk = 0, eff = 0, sessionType = "game" } = stats || {};

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 350,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }} onClick={onClose}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }} onClick={(e) => e.stopPropagation()}>
        {/* The card -- 9:16 aspect ratio for IG Stories */}
        <div ref={cardRef} style={{
          width: 320,
          height: 568,
          borderRadius: 24,
          overflow: "hidden",
          background: "linear-gradient(160deg, #1A1D2E 0%, #0F1117 50%, #2D1B0E 100%)",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, -apple-system, sans-serif",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,107,53,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="basketball" size={20} color="#FF6B35" /></div>
            <div>
              <div style={{ color: "white", fontSize: 16, fontWeight: 800 }}>Court IQ</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600 }}>
                {sessionType === "game" ? "Game Recap" : "Practice Recap"}
              </div>
            </div>
          </div>

          {/* Player name */}
          <div style={{ color: "white", fontSize: 28, fontWeight: 900, marginBottom: 4, letterSpacing: -0.5 }}>{playerName}</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 32 }}>
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>

          {/* Big stat */}
          {totalPts > 0 && (
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ color: "#FF6B35", fontSize: 72, fontWeight: 900, lineHeight: 1 }}>{totalPts}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>POINTS</div>
            </div>
          )}

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, flex: 1 }}>
            {[
              { label: "FG%", value: `${fgPct}%`, color: fgPct >= 50 ? "#22C55E" : "#FF6B35" },
              { label: "3PT%", value: `${threePct}%`, color: "#3B82F6" },
              { label: "FT%", value: `${ftPct}%`, color: "#0EA5E9" },
              ...(ast > 0 ? [{ label: "AST", value: ast, color: "#22C55E" }] : []),
              ...(reb > 0 ? [{ label: "REB", value: reb, color: "#F59E0B" }] : []),
              ...(stl > 0 ? [{ label: "STL", value: stl, color: "#10B981" }] : []),
            ].filter(Boolean).slice(0, 6).map((s) => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 8px", textAlign: "center" }}>
                <div style={{ color: s.color, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Efficiency badge */}
          {eff !== 0 && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <span style={{
                background: eff >= 10 ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.06)",
                color: eff >= 10 ? "#FF6B35" : "rgba(255,255,255,0.5)",
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 800,
              }}>
                EFF: {eff}
              </span>
            </div>
          )}

          {/* Branding */}
          <div style={{ textAlign: "center", marginTop: "auto", paddingTop: 16 }}>
            <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>Tracked with Court IQ <Icon name="brain" size={10} color="rgba(255,255,255,0.15)" /></div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 320 }}>
          <button onClick={handleShare} disabled={sharing}
            style={{
              flex: 1,
              padding: "16px 0",
              borderRadius: 16,
              background: "var(--color-accent)",
              color: "white",
              fontSize: 17,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              minHeight: 44,
              opacity: sharing ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}>
            {sharing ? "Generating..." : <><Icon name="share" size={16} /> Share</>}
          </button>
          <button onClick={onClose}
            style={{
              padding: "16px 24px",
              borderRadius: 16,
              background: "var(--color-muted)",
              color: "var(--color-text-sec)",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              minHeight: 44,
            }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
