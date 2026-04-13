/* ══════════════════════════════════════════════════════
   COURT IQ SERVICE WORKER
   Handles push notifications and basic offline caching.
   ══════════════════════════════════════════════════════ */

const CACHE_NAME = "courtiq-v1";
const STATIC_ASSETS = ["/", "/logo.svg", "/icon-192.svg", "/manifest.json"];

// Install — cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  // Skip non-GET and API requests
  if (event.request.method !== "GET" || event.request.url.includes("supabase") || event.request.url.includes("firebase")) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Court IQ";
  const options = {
    body: data.body || "Time to get some reps in! 🏀",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag: data.tag || "courtiq-notification",
    data: { url: data.url || "/" },
    actions: [
      { action: "open", title: "Open App" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("court-iq") && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data?.url || "/");
    })
  );
});
