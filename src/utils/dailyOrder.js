// Urutan acak yang BERGANTI tiap hari (jam 12 malam WIB), tapi tetap sama seharian.
// Grid lagu & full screen sama-sama pakai ini, jadi urutannya pasti kembar.

// Kunci hari versi WIB (UTC+7), contoh "2026-09-20". Ganti tepat jam 00:00 WIB.
export function dayKeyWIB(now = Date.now()) {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

// String -> angka (FNV-1a 32-bit)
function hashString(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // Pengacak akhir biar id yang mirip (beda 1 karakter) tetap kesebar acak
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

// Urutin item berdasarkan skor hash(hari + scope + id).
// Preset baru gak ngacak-ngacak posisi preset lain di hari yang sama.
export function sortByDailyOrder(items, scope = '') {
  const day = dayKeyWIB()
  return items
    .map((item) => ({ item, score: hashString(`${day}:${scope}:${item.id}`) }))
    .sort((a, b) => a.score - b.score || String(a.item.id).localeCompare(String(b.item.id)))
    .map((x) => x.item)
}
