const CACHE_NAME = "pam-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Cuma tangani request GET. POST/PATCH/DELETE (kayak nyimpen favorit,
  // insert preset, dll) dibiarin lewat langsung ke jaringan tanpa dicegat.
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
