// Service worker: keeps a copy of the app so it also opens without internet.
// Strategy "network first": always try to load the newest version,
// fall back to the saved copy when offline.

const CACHE = "haushalt-v2";
const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "tasks.js",
  "reward.js",
  "push.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/badge-96.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});

// Reminder from the push server. It carries no text, so the wording is chosen here.
self.addEventListener("push", (event) => {
  const lastCall = new Date().getHours() >= 22;
  event.waitUntil(
    self.registration.showNotification("Haushalt", {
      body: lastCall ? "Letzte Erinnerung für heute: Es ist noch etwas offen." : "Es ist noch etwas offen. Kurz abhaken?",
      icon: "icons/icon-192.png",
      badge: "icons/badge-96.png",
      tag: "haushalt-reminder",
      renotify: true,
      vibrate: [200, 100, 200],
    }),
  );
});

// Tapping the notification opens the app (or brings it to the front).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
