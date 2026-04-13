/* ══════════════════════════════════════════════════════
   COURT IQ ANALYTICS
   Lightweight event tracking to localStorage.
   No external services — keeps user data private.
   Can be swapped for Mixpanel/Amplitude later.
   ══════════════════════════════════════════════════════ */

const STORAGE_KEY = "courtiq-analytics";

function getEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function trackEvent(name, properties = {}) {
  if (typeof window === "undefined") return;
  const events = getEvents();
  events.push({
    event: name,
    props: properties,
    ts: new Date().toISOString(),
  });
  // Keep last 500 events
  if (events.length > 500) events.splice(0, events.length - 500);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch { /* storage full */ }
}

export function getAnalyticsSummary() {
  const events = getEvents();
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);

  const thisWeek = events.filter((e) => new Date(e.ts) >= weekAgo);
  const counts = {};
  for (const e of thisWeek) {
    counts[e.event] = (counts[e.event] || 0) + 1;
  }

  return {
    totalEvents: events.length,
    thisWeek: thisWeek.length,
    topEvents: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
}

// Standard events
export const Events = {
  SESSION_START: "session_start",
  SESSION_END: "session_end",
  SHOT_LOGGED: "shot_logged",
  DRILL_STARTED: "drill_started",
  WORKOUT_COMPLETED: "workout_completed",
  JOURNAL_CREATED: "journal_created",
  PROFILE_SWITCH: "profile_switch",
  PLAYER_ADDED: "player_added",
  SHARE_STATS: "share_stats",
  SCREEN_VIEW: "screen_view",
  BADGE_EARNED: "badge_earned",
  DARK_MODE_TOGGLE: "dark_mode_toggle",
};
