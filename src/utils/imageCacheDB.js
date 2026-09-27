// Cache gambar remote (avatar/PP, wallpaper, cover preset) ke IndexedDB (nyimpen
// Blob asli, bukan cuma alamatnya). IndexedDB itu masuk folder "Data" aplikasi di
// Android/browser - beda sama Cache Storage / HTTP cache browser yang masuk folder
// "Cache" dan bisa ke-wipe kapan aja: baik otomatis pas storage HP penuh, MAUPUN
// manual pas user pencet tombol "Hapus Cache" di Setelan > Apl (yang orang suka
// pencet asal karena keliatan "aman", beda sama "Hapus Data" yang keliatan berat).
const DB_NAME = 'pam-image-cache'
const DB_VERSION = 1
const STORE_NAME = 'images'
const MAX_ITEMS = 250 // batas jaga-jaga biar data APK ngga bengkak (mayoritas gambar kecil)

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getCachedImageBlob(url) {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(url)
      req.onsuccess = () => resolve(req.result?.blob || null)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.error('Gagal ambil gambar dari penyimpanan lokal:', err)
    return null
  }
}

export async function saveCachedImageBlob(url, blob) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ url, blob, updatedAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    pruneImageCache()
  } catch (err) {
    console.error('Gagal simpen gambar ke penyimpanan lokal:', err)
  }
}

// Kalo kekumpul kebanyakan, buang yang paling lama dulu.
async function pruneImageCache() {
  try {
    const db = await openDB()
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
    if (all.length <= MAX_ITEMS) return
    const sorted = all.sort((a, b) => a.updatedAt - b.updatedAt)
    const toDelete = sorted.slice(0, all.length - MAX_ITEMS)
    const tx = db.transaction(STORE_NAME, 'readwrite')
    toDelete.forEach((item) => tx.objectStore(STORE_NAME).delete(item.url))
  } catch (err) {
    console.error('Gagal beberesin gambar lama:', err)
  }
}
