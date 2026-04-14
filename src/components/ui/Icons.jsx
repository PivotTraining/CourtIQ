"use client";

/* ══════════════════════════════════════════════════════
   COURT IQ SVG ICON LIBRARY
   Replaces emojis which don't render in Capacitor WKWebView.
   All icons are inline SVGs — no external fonts or files needed.
   Usage: <Icon name="home" size={20} color="#FF6B35" />
   ══════════════════════════════════════════════════════ */

const paths = {
  // Navigation
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
  train: "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-6 5 6M12 4v12",
  brain: "M12 2a8 8 0 00-8 8c0 2.5 1.5 4.5 3 6l1 4h8l1-4c1.5-1.5 3-3.5 3-6a8 8 0 00-8-8zM9 18h6M10 22h4",
  journal: "M4 4h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 0h2m-2 4h16M8 2v4m4-4v4",
  fire: "M12 2c1 4 5 7 5 12a7 7 0 01-14 0c0-5 4-8 5-12 .5 2 2 4 4 4s3.5-2 4-4z",
  map: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",

  // Actions
  plus: "M12 4v16m8-8H4",
  refresh: "M4 4v5h5M20 20v-5h-5M4.93 9A8 8 0 0120 11.07M19.07 15A8 8 0 014 12.93",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  undo: "M3 10h10a5 5 0 010 10H7",
  share: "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13",
  moon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  sun: "M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
  check: "M5 13l4 4L19 7",
  x: "M6 6l12 12M6 18L18 6",
  chevDown: "M6 9l6 6 6-6",
  clock: "M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z",
  trophy: "M6 9H3a1 1 0 01-1-1V5a1 1 0 011-1h3m12 5h3a1 1 0 001-1V5a1 1 0 00-1-1h-3M6 4h12v6a6 6 0 01-12 0V4zm3 16h6m-3-4v4",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  target: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z",

  // Stats
  basketball: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2v20M5.2 5.2c2.5 2 5 3 6.8 3s4.3-1 6.8-3M5.2 18.8c2.5-2 5-3 6.8-3s4.3 1 6.8 3",
  chart: "M4 20h16M4 20V10l4-6 4 8 4-4 4 6",
  trending: "M23 6l-9.5 9.5-5-5L1 18",
  shield: "M12 2l8 4v6c0 5.25-3.5 10-8 11.25C7.5 22 4 17.25 4 12V6l8-4z",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  award: "M12 15l-3.5 7 1-4.5L5 17l4.5-1L12 12.5l2.5 3.5 4.5 1-4.5.5 1 4.5z",
  // Additional icons for full emoji coverage
  dumbbell: "M6.5 6.5h11M4 10h2.5V6.5H4a2 2 0 000 4zm0 0v3.5a2 2 0 004 0V10m12 0h-2.5V6.5H20a2 2 0 010 4zm0 0v3.5a2 2 0 01-4 0V10",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  hand: "M18 11V6a2 2 0 00-4 0v1M14 7V4a2 2 0 00-4 0v6M10 5V4a2 2 0 00-4 0v7M6 11a2 2 0 00-4 0v1a8 8 0 0016 0v-1",
  volume: "M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07",
  lock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  stickman: "M12 2a2 2 0 100 4 2 2 0 000-4zM12 6v7m-4-4l4 1 4-1m-7 7l3-3 3 3m-6 0l-1 4m7-4l1 4",
  skills: "M12 2a2 2 0 100 4 2 2 0 000-4zM12 6v5m-5-2h10M9 16l3-5 3 5M7 21l2-5m6 5l2-5",
  unlock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 019.9-1",
  paint: "M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z",
  gem: "M6 3h12l4 6-10 13L2 9l4-6z",
  flash: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  mic: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4m-3 0h6",
  barChart: "M12 20V10M18 20V4M6 20v-4",
  medal: "M12 8a4 4 0 100-8 4 4 0 000 8zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
  compass: "M12 2a10 10 0 100 20 10 10 0 000-20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z",
  play: "M5 3l14 9-14 9V3z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  skip: "M5 4l10 8-10 8V4zM19 5v14",
  clipboard: "M9 2h6a1 1 0 011 1v1H8V3a1 1 0 011-1zM4 6h16v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6z",
  lightbulb: "M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2zM9 21h6",
  snowflake: "M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07",
  theater: "M2 16.1A5 5 0 0015.9 6L2 16.1zM15.9 6A5 5 0 0122 16.1L15.9 6z",
  muscle: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1M5.5 4.5l3 3M18.5 4.5l-3 3",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  arrowUp: "M12 19V5m-7 7l7-7 7 7",
  arrowDown: "M12 5v14m7-7l-7 7-7-7",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  info: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 16v-4m0-4h.01",
  alert: "M12 2L2 22h20L12 2zm0 14h.01M12 10v4",
  link: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  trendUp: "M23 6l-9.5 9.5-5-5L1 18",
  trendDown: "M23 18l-9.5-9.5-5 5L1 6",
};

export default function Icon({ name, size = 20, color = "currentColor", style = {}, className = "" }) {
  const d = paths[name];
  if (!d) return <span style={{ fontSize: size, ...style }} className={className}>{name}</span>;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

// Filled variant for special cases
export function IconFilled({ name, size = 20, color = "currentColor", style = {} }) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={d} />
    </svg>
  );
}

/* ── Emoji-to-SVG mapper ──
   Drop-in replacement: <Emoji e="🏀" size={20} />
   Falls back to text if no SVG mapping exists */
const EMOJI_MAP = {
  // Sports & game
  "🏀": "basketball", "🏟️": "trophy", "🏆": "trophy", "🥇": "medal", "🥈": "award",
  "🥉": "award", "🎖️": "award", "⚽": "basketball", "🏈": "basketball",
  // Stats & data
  "📊": "barChart", "📈": "trending", "📉": "trending", "🎯": "target", "📋": "clipboard",
  // Mind & body
  "🧠": "brain", "🏋️": "dumbbell", "🏋️‍♂️": "dumbbell", "💪": "muscle", "🧘": "user",
  // Actions
  "🔥": "fire", "⚡": "zap", "💥": "zap", "✨": "star", "💫": "star", "🌟": "star",
  "⭐": "star", "💎": "gem", "👑": "trophy",
  // UI
  "📤": "share", "🌙": "moon", "☀️": "sun", "🔄": "refresh", "🔁": "refresh",
  "🏠": "home", "📓": "journal", "🎨": "paint", "🔧": "settings",
  // People
  "👁️": "eye", "👁": "eye", "🖐️": "hand", "🖐": "hand", "👥": "user", "🎭": "theater",
  "😎": "star", "🤔": "brain",
  // Defense
  "🛡️": "shield", "🛡": "shield", "🔒": "lock", "🔓": "unlock",
  // Warnings
  "⚠️": "alert", "⚠": "alert", "🚫": "x", "❄️": "snowflake", "🧊": "snowflake",
  // Location
  "📍": "map", "🗺️": "compass", "🗺": "compass",
  // Training
  "⏱️": "clock", "⏱": "clock", "💡": "lightbulb",
  // Mood emojis
  "🔥": "fire", "😤": "muscle", "😴": "moon",
  // Checks
  "✓": "check", "✗": "x", "✅": "check", "▸": "play",
  // Music & sound
  "🔊": "volume", "🎵": "volume",
  // Edit
  "✏️": "edit", "🗑️": "trash",
  // Info
  "ℹ️": "info", "💬": "mic",
  // Download
  "📥": "download",
};

export function Emoji({ e, size = 20, color = "currentColor", style = {} }) {
  const iconName = EMOJI_MAP[e];
  if (iconName && paths[iconName]) {
    return <Icon name={iconName} size={size} color={color} style={style} />;
  }
  // Fallback: render as text (works on web, may break in WKWebView)
  return <span style={{ fontSize: size, lineHeight: 1, ...style }}>{e}</span>;
}
