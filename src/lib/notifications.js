/* ══════════════════════════════════════════════════════
   COURT IQ NOTIFICATION SYSTEM
   Registers service worker and schedules local reminders.
   ══════════════════════════════════════════════════════ */

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (err) {
    console.error("SW registration failed:", err);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

// Schedule a local notification (uses service worker)
export async function scheduleStreakReminder() {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return;

  const reg = await navigator.serviceWorker.ready;

  // Check last session timestamp from localStorage
  const lastSession = localStorage.getItem("courtiq-last-session");
  if (!lastSession) return;

  const hoursSince = (Date.now() - new Date(lastSession).getTime()) / 3600000;

  // If more than 20 hours since last session, remind
  if (hoursSince >= 20) {
    reg.showNotification("Court IQ", {
      body: "Don't break your streak! Get some shots up today 🔥",
      icon: "/icon-192.svg",
      tag: "streak-reminder",
    });
  }
}

// Record that a session happened (called from ShotLogger)
export function recordSessionTimestamp() {
  if (typeof window !== "undefined") {
    localStorage.setItem("courtiq-last-session", new Date().toISOString());
  }
}
