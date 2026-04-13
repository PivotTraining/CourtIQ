export const MOODS = [
  { id: "fire", emoji: "\u{1F525}", icon: "fire", label: "Fire" },
  { id: "focused", emoji: "\u{1F3AF}", icon: "target", label: "Focused" },
  { id: "tough", emoji: "\u{1F4AA}", icon: "muscle", label: "Tough" },
  { id: "chill", emoji: "\u{1F60E}", icon: "star", label: "Chill" },
  { id: "grind", emoji: "\u26A1", icon: "zap", label: "Grind" },
];

// SVG viewBox is 500x400. 3-point arc path:
//   M 60 380 L 60 300 Q 60 80 250 45 Q 440 80 440 300 L 440 380
// Zone coordinates are in viewport percentages (x*5 = SVG x, y*4 = SVG y)
// All 3-point zones are positioned CLEARLY OUTSIDE the arc.
// All 2-point zones are positioned CLEARLY INSIDE the arc.
export const COURT_ZONES = [
  // ── 3-POINTERS (outside the arc) ──
  { id: "left-corner-3", x: 5, y: 80, label: "L Corner 3", category: "threes", pts: 3 },
  { id: "left-wing-3", x: 8, y: 25, label: "L Wing 3", category: "threes", pts: 3 },
  { id: "top-key-3", x: 50, y: 6, label: "Top Key 3", category: "threes", pts: 3 },
  { id: "right-wing-3", x: 92, y: 25, label: "R Wing 3", category: "threes", pts: 3 },
  { id: "right-corner-3", x: 95, y: 80, label: "R Corner 3", category: "threes", pts: 3 },
  // ── 2-POINTERS (inside the arc) ──
  { id: "left-elbow", x: 32, y: 45, label: "L Elbow", category: "midRange", pts: 2 },
  { id: "right-elbow", x: 68, y: 45, label: "R Elbow", category: "midRange", pts: 2 },
  { id: "free-throw", x: 50, y: 42, label: "Free Throw", category: "freeThrows", pts: 1 },
  { id: "left-block", x: 36, y: 68, label: "L Block", category: "paint", pts: 2 },
  { id: "right-block", x: 64, y: 68, label: "R Block", category: "paint", pts: 2 },
  { id: "paint", x: 50, y: 58, label: "Paint", category: "paint", pts: 2 },
  { id: "left-mid", x: 28, y: 52, label: "L Mid", category: "midRange", pts: 2 },
  { id: "right-mid", x: 72, y: 52, label: "R Mid", category: "midRange", pts: 2 },
];

export const ZONE_CATEGORIES = {
  threes: ["left-corner-3", "left-wing-3", "top-key-3", "right-wing-3", "right-corner-3"],
  midRange: ["left-elbow", "right-elbow", "left-mid", "right-mid"],
  paint: ["left-block", "right-block", "paint"],
  freeThrows: ["free-throw"],
};
