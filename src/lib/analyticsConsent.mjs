// CourtIQ analytics are optional; essential account/session storage is separate.
// A missing or unreadable preference always means no optional measurement.
export const ANALYTICS_CHOICE_KEY = "courtiq:analytics-consent:v1";
export const ANALYTICS_CHOICE_EVENT = "courtiq:analytics-consent-updated";

export function getAnalyticsChoice(storage) {
  try {
    const value = storage?.getItem(ANALYTICS_CHOICE_KEY);
    return value === "allow" || value === "essential" ? value : null;
  } catch { return null; }
}

export function setAnalyticsChoice(storage, choice) {
  if (choice !== "allow" && choice !== "essential") return false;
  try {
    storage?.setItem(ANALYTICS_CHOICE_KEY, choice);
    return getAnalyticsChoice(storage) === choice;
  } catch { return false; }
}

export function shouldMeasure(storage, { doNotTrack, globalPrivacyControl } = {}) {
  // Explicit user preference plus opt-out browser signals where available.
  return getAnalyticsChoice(storage) === "allow" &&
    doNotTrack !== "1" && globalPrivacyControl !== true;
}
