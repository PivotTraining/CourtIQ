"use client";

const ALLOWED = new Set([
  "app_open",
  "screen_view",
  "workout_started",
  "film_opened",
  "film_marker_added",
  "development_profile_shared",
]);

export async function trackEvent(event, properties = {}) {
  if (!ALLOWED.has(event) || typeof window === "undefined") return;
  const clean = {};
  if (typeof properties.screen === "string") clean.screen = properties.screen.slice(0, 40);
  if (typeof properties.source === "string") clean.source = properties.source.slice(0, 40);
  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ event, properties: clean }),
    });
  } catch {
    // Analytics must never interrupt product use.
  }
}
