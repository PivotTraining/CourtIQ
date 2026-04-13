export function getHeatColor(pct) {
  if (pct >= 60) return "rgba(34, 197, 94, 0.85)";
  if (pct >= 50) return "rgba(34, 197, 94, 0.55)";
  if (pct >= 40) return "rgba(255, 107, 53, 0.65)";
  if (pct >= 30) return "rgba(255, 107, 53, 0.4)";
  return "rgba(239, 68, 68, 0.6)";
}

export function getMoodEmoji(mood) {
  const moods = {
    fire: "🔥",
    focused: "🎯",
    tough: "💪",
    chill: "😎",
    grind: "⚡",
  };
  return moods[mood] || "🏀";
}

export function getMoodIcon(mood) {
  const moods = {
    fire: "fire",
    focused: "target",
    tough: "muscle",
    chill: "star",
    grind: "zap",
  };
  return moods[mood] || "basketball";
}

export function calcPct(made, total) {
  if (!total) return 0;
  return Math.round((made / total) * 100);
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "What's good";
  return "Good evening";
}
