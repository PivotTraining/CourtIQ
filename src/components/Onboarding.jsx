"use client";

import { useState } from "react";

// SVG icons instead of emoji (WKWebView has emoji rendering issues at large sizes)
const IconShot = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="30" stroke="white" strokeWidth="3"/><path d="M36 6C36 6 36 36 36 66" stroke="white" strokeWidth="2.5"/><path d="M6 36C6 36 36 36 66 36" stroke="white" strokeWidth="2.5"/><path d="M12 16C20 28 28 36 36 36C44 36 52 28 60 16" stroke="white" strokeWidth="2.5" fill="none"/><path d="M12 56C20 44 28 36 36 36C44 36 52 44 60 56" stroke="white" strokeWidth="2.5" fill="none"/></svg>
);
const IconStats = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><rect x="10" y="38" width="12" height="24" rx="3" fill="white" fillOpacity="0.8"/><rect x="30" y="22" width="12" height="40" rx="3" fill="white"/><rect x="50" y="10" width="12" height="52" rx="3" fill="white" fillOpacity="0.8"/></svg>
);
const IconBrain = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="28" stroke="white" strokeWidth="3"/><path d="M36 16V56" stroke="white" strokeWidth="2.5"/><path d="M24 24C28 28 32 30 36 30C40 30 44 28 48 24" stroke="white" strokeWidth="2.5" fill="none"/><path d="M24 48C28 44 32 42 36 42C40 42 44 44 48 48" stroke="white" strokeWidth="2.5" fill="none"/><circle cx="28" cy="36" r="4" fill="white" fillOpacity="0.6"/><circle cx="44" cy="36" r="4" fill="white" fillOpacity="0.6"/></svg>
);
const IconTrain = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><rect x="14" y="32" width="44" height="8" rx="4" fill="white"/><rect x="20" y="24" width="8" height="24" rx="4" fill="white" fillOpacity="0.8"/><rect x="44" y="20" width="8" height="32" rx="4" fill="white" fillOpacity="0.8"/></svg>
);
const IconFire = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><path d="M36 8C36 8 48 24 48 40C48 52 42 60 36 62C30 60 24 52 24 40C24 24 36 8 36 8Z" fill="white" fillOpacity="0.9"/><path d="M36 30C36 30 42 38 42 46C42 52 39 56 36 57C33 56 30 52 30 46C30 38 36 30 36 30Z" fill="white" fillOpacity="0.4"/></svg>
);

const SLIDES = [
  {
    Icon: IconShot,
    title: "Track Every Shot",
    subtitle: "Tap zones on the court to log makes and misses. See your hot spots and cold zones in real time.",
    bg: "#FF6B35",
  },
  {
    Icon: IconStats,
    title: "Full Game Stats",
    subtitle: "Points, assists, rebounds, steals, blocks, turnovers, fouls, and minutes — all in one place.",
    bg: "#22C55E",
  },
  {
    Icon: IconBrain,
    title: "Your Player IQ",
    subtitle: "Get a personal rating, see trends over time, and receive AI-powered analysis after every session.",
    bg: "#8B5CF6",
  },
  {
    Icon: IconTrain,
    title: "Train Smarter",
    subtitle: "Personalized practice plans built from your weak zones. 18 drills filtered by your age and level.",
    bg: "#3B82F6",
  },
  {
    Icon: IconFire,
    title: "Ready to Go",
    subtitle: "Your basketball journey starts now. Every rep counts. Every game teaches. Let's build your legacy.",
    bg: "#FF6B35",
  },
];

export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 300,
      display: "flex",
      flexDirection: "column",
      background: slide.bg,
      transition: "background 0.5s ease",
      overflow: "hidden",
    }}>
      {/* Skip — properly below status bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "60px 20px 0" }}>
        {!isLast && (
          <button
            onClick={onComplete}
            style={{
              fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)",
              background: "none", border: "none", cursor: "pointer",
              padding: "8px 4px", minHeight: 44,
            }}
          >
            Skip
          </button>
        )}
        {isLast && <div style={{ height: 44 }} />}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 40px",
        textAlign: "center",
      }}>
        <div key={current}>
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}><slide.Icon /></div>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: "white", margin: "0 0 16px", lineHeight: 1.1 }}>
            {slide.title}
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, margin: 0 }}>
            {slide.subtitle}
          </p>
        </div>
      </div>

      {/* Dots + Button — pinned to bottom */}
      <div style={{ padding: "0 32px 60px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              width: i === current ? 24 : 8, height: 8, borderRadius: 4,
              background: i === current ? "white" : "rgba(255,255,255,0.3)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
        <button
          onClick={() => (isLast ? onComplete() : setCurrent(current + 1))}
          style={{
            width: "100%", padding: "18px 0", borderRadius: 16,
            border: "none", cursor: "pointer",
            background: "white", color: "#1A1D2E",
            fontSize: 18, fontWeight: 800,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          {isLast ? "Let's Go" : "Next"}
        </button>
      </div>
    </div>
  );
}
