import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CourtIQ. Track the game. Know what to work on next.";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", position: "relative",
          background: "#0F1117", color: "#FFFFFF", overflow: "hidden",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{
          width: 16, height: "100%", background: "#FF6B35", position: "absolute", left: 0, top: 0,
        }} />
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "64px 72px 68px 92px", width: "76%",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 15, color: "#FF875B",
            fontSize: 27, fontWeight: 900, letterSpacing: 3,
          }}>
            <div style={{
              display: "flex", width: 52, height: 52, borderRadius: 15,
              background: "#FF6B35", alignItems: "center", justifyContent: "center",
              color: "#FFFFFF", fontSize: 25, fontWeight: 900,
            }}>IQ</div>
            COURTIQ
          </div>
          <div style={{ fontSize: 65, fontWeight: 900, lineHeight: 1.08, marginTop: 35, letterSpacing: -2 }}>
            Track the game.
          </div>
          <div style={{ fontSize: 65, fontWeight: 900, lineHeight: 1.08, color: "#FF7B4B", letterSpacing: -2 }}>
            Know your next move.
          </div>
          <div style={{
            display: "flex", fontSize: 25, marginTop: 32,
            lineHeight: 1.4, color: "#C6CCD6", maxWidth: 700,
          }}>
            Basketball game tracking, performance insights and skill development.
          </div>
          <div style={{ display: "flex", color: "#FF9D7C", fontSize: 20, fontWeight: 700, marginTop: 34 }}>
            getcourtiq.com
          </div>
        </div>
        <div style={{
          display: "flex", width: 320, height: 320, borderRadius: 160,
          border: "9px solid #FF6B35", position: "absolute", right: -110, top: 152,
          opacity: 0.45,
        }} />
        <div style={{
          display: "flex", width: 190, height: 190, borderRadius: 95,
          border: "5px solid #FF6B35", position: "absolute", right: -45, top: 218,
          opacity: 0.7,
        }} />
      </div>
    ),
    size,
  );
}
