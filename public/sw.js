const CACHE_NAME = "pam-cache-v3"
const APP_SHELL = "/index.html"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Buang semua cache versi lama (termasuk cache rusak dari versi sebelumnya)
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

  // Video/media request dibiarin lewat langsung ke jaringan, JANGAN dicegat SW.
  // Video pake Range request buat streaming/seek, dan kalo request itu ke-abort
  // (misal video-nya di-unload pas discroll lewat), sw.js bakal error karena
  // promise fetch-nya reject terus fallback cache-nya kosong.
  if (event.request.destination === "video" || event.request.headers.has("range")) {
    return
  }

  // Navigasi halaman (refresh/reload di route mana pun kayak /lagu/123):
  // coba jaringan dulu, kalo BERHASIL langsung update cache app-shell biar
  // gak pernah kebekukan di versi build lama. Kalo GAGAL (offline/APK baru
  // dibuka jaringan belum siap), baru jatuh ke cache yang paling baru ke-update.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, clone)).catch(() => {})
          return response
        })
        .catch(() => caches.match(APP_SHELL))
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
