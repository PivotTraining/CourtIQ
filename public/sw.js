/* ══════════════════════════════════════════════════════
   COURT IQ SERVICE WORKER
   Handles push notifications and basic offline caching.
   ══════════════════════════════════════════════════════ */

const CACHE_NAME = "courtiq-web-v2";
const STATIC_ASSETS = ["/offline.html", "/logo.svg", "/icon-192.png", "/icon-512.png", "/manifest.json"];

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
      Promise.all(keys.filter((k) => k.startsWith("courtiq-") && k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache only public static assets. Sessions, API results, and authenticated pages
// must always come from the network, never another player's browser cache.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }).catch(async () =>
      (await caches.match("/offline.html")) || Response.error()
    ));
    return;
  }
  if (!url.search && STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((cached) => cached || fetch(event.request)));
  }
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Court IQ";
  const options = {
    body: data.body || "Time to get some reps in! 🏀",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
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
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin);
  const destination = target.origin === self.location.origin ? target.href : `${self.location.origin}/dashboard`;
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.navigate(destination).then(() => client.focus());
        }
      }
      return clients.openWindow(destination);
    })
  );
});
