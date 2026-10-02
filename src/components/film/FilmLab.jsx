"use client";

import { useEffect, useRef, useState } from "react";

const TYPES = ["Made shot", "Missed shot", "Assist", "Turnover", "Steal", "Rebound", "Coaching note"];

function clock(seconds = 0) {
  const value = Math.max(0, Number(seconds) || 0);
  return Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0");
}

export default function FilmLab() {
  const player = useRef(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [note, setNote] = useState("");
  const [markers, setMarkers] = useState([]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const openVideo = (file) => {
    if (!file || !file.type.startsWith("video/")) return;
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(file));
    setName(file.name);
    setMarkers([]);
  };

  const addMarker = () => {
    if (!player.current) return;
    const time = Number(player.current.currentTime.toFixed(2));
    setMarkers((rows) => [...rows, { id: crypto.randomUUID(), time, type, note: note.trim() }].sort((a, b) => a.time - b.time));
    setNote("");
  };

  const seek = (time) => {
    if (!player.current) return;
    player.current.currentTime = Math.max(0, time - 2);
    player.current.play().catch(() => {});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={{ background: "linear-gradient(135deg,#111827,#1F2937)", color: "white", borderRadius: 22, padding: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2, color: "#FDBA74" }}>Film Lab</div>
        <h2 style={{ margin: "7px 0 0", fontSize: 24, fontWeight: 950 }}>Review the possession, not just the box score.</h2>
        <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,.72)", fontSize: 12, lineHeight: 1.6 }}>
          Load game film from this device and tag the exact moments you want to revisit. The video stays on this device in this version.
        </p>
      </section>

      {!url ? (
        <label style={{ display: "grid", placeItems: "center", minHeight: 240, border: "2px dashed var(--color-border)", borderRadius: 22, background: "var(--color-card)", cursor: "pointer", textAlign: "center", padding: 28 }}>
          <input type="file" accept="video/*" onChange={(event) => openVideo(event.target.files?.[0])} style={{ display: "none" }} />
          <div>
            <div style={{ fontSize: 34 }}>▶</div>
            <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900, color: "var(--color-text)" }}>Choose game film</div>
            <div style={{ marginTop: 5, fontSize: 11, color: "var(--color-text-sec)" }}>Use a video file already on this device.</div>
          </div>
        </label>
      ) : (
        <>
          <section style={{ background: "#000", borderRadius: 20, overflow: "hidden" }}>
            <video ref={player} src={url} controls playsInline style={{ width: "100%", maxHeight: "68vh", display: "block" }} />
          </section>

          <section style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 20, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--color-text)" }}>Tag current moment</div>
            <div style={{ fontSize: 10, color: "var(--color-text-sec)", marginTop: 2 }}>{name}</div>
            <select value={type} onChange={(event) => setType(event.target.value)} style={{ width: "100%", marginTop: 12, minHeight: 44, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text)", padding: "0 12px" }}>
              {TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Optional coaching note" style={{ width: "100%", marginTop: 10, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text)", padding: 12, resize: "vertical" }} />
            <button type="button" onClick={addMarker} style={{ width: "100%", minHeight: 48, marginTop: 10, border: 0, borderRadius: 12, background: "#FF6B35", color: "white", fontWeight: 900, cursor: "pointer" }}>Mark this moment</button>
          </section>

          <section style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 20, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "var(--color-text)" }}>Film timeline · {markers.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {markers.map((marker) => (
                <div key={marker.id} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 12, background: "var(--color-muted)", padding: 10 }}>
                  <button type="button" onClick={() => seek(marker.time)} style={{ minHeight: 40, minWidth: 54, border: 0, borderRadius: 9, background: "#FF6B35", color: "white", fontWeight: 900, cursor: "pointer" }}>{clock(marker.time)}</button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "var(--color-text)" }}>{marker.type}</div>
                    {marker.note && <div style={{ fontSize: 10, color: "var(--color-text-sec)", marginTop: 2 }}>{marker.note}</div>}
                  </div>
                  <button type="button" onClick={() => setMarkers((rows) => rows.filter((row) => row.id !== marker.id))} aria-label="Remove marker" style={{ minHeight: 40, width: 40, border: 0, background: "transparent", color: "#EF4444", cursor: "pointer" }}>×</button>
                </div>
              ))}
              {!markers.length && <div style={{ textAlign: "center", padding: 22, color: "var(--color-text-sec)", fontSize: 11 }}>Play the film and tag the first important moment.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
