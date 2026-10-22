/* UnNag service worker — precache shell + Web Push → call overlay */

const CACHE = "unnag-v1";
const PRECACHE = ["/", "/vault", "/settings", "/manifest.json", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached)),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "UnNag", body: event.data.text() };
  }

  const title = payload.title || "Incoming Drop";
  const options = {
    body: payload.body || "You have a new vault item",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
    requireInteraction: Boolean(payload.requireInteraction),
    tag: payload.tag || "unnag-drop",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || (data.taskId ? `/vault?drop=${data.taskId}` : "/vault");

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          client.postMessage({
            type: "incoming_drop",
            taskId: data.taskId,
            escalationLevel: data.escalationLevel || 2,
            vaultCount: data.vaultCount || 1,
            voiceNoteUrl: data.voiceNoteUrl,
            url,
          });
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
