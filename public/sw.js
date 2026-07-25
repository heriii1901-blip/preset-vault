const CACHE_NAME = "pam-cache-v2"
const APP_SHELL = "/index.html"

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(APP_SHELL)).catch(() => {})
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Buang cache versi lama biar ngga ada sisa yang bikin bingung
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  )
})

self.addEventListener("fetch", (event) => {
  // Cuma tangani request GET. POST/PATCH/DELETE (kayak nyimpen favorit,
  // insert preset, dll) dibiarin lewat langsung ke jaringan tanpa dicegat.
  if (event.request.method !== "GET") return

  // Navigasi halaman (refresh/reload di route mana pun kayak /lagu/123):
  // coba jaringan dulu, kalo gagal balikin index.html dari cache biar React Router
  // yang nentuin halaman mana yang harus dirender, bukan 404 dari server/browser.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(APP_SHELL).then((cached) => cached || fetch(APP_SHELL))
      )
    )
    return
  }

  // Request biasa (JS, CSS, gambar, dll): jaringan dulu, fallback ke cache kalo ada.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {})
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
