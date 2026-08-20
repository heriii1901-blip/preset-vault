// Penyimpanan lokal (IndexedDB) buat thumbnail cover grid.
// Tujuannya biar cover yang udah pernah ke-capture TETEP ada walau app
// di-reload penuh / tab ditutup / APK di-kill dari background - bukan
// cuma nempel di memory doang (yang ilang kalo app-nya restart).
const DB_NAME = 'pam-thumb-cache'
const DB_VERSION = 1
const STORE_NAME = 'thumbs'
const MAX_ITEMS = 300 // batas biar IndexedDB ga bengkak terus tanpa henti

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveThumb(id, dataUrl) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ id, dataUrl, updatedAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Gagal simpen thumbnail ke penyimpanan lokal:', err)
  }
}

export async function getAllThumbs() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.error('Gagal ambil thumbnail dari penyimpanan lokal:', err)
    return []
  }
}

// Kalo kekumpul kebanyakan, buang yang paling lama dulu.
export async function pruneThumbs() {
  try {
    const all = await getAllThumbs()
    if (all.length <= MAX_ITEMS) return
    const db = await openDB()
    const sorted = all.sort((a, b) => a.updatedAt - b.updatedAt)
    const toDelete = sorted.slice(0, all.length - MAX_ITEMS)
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      toDelete.forEach((item) => tx.objectStore(STORE_NAME).delete(item.id))
      tx.oncomplete = () => resolve()
    })
  } catch (err) {
    console.error('Gagal beberesin thumbnail lama:', err)
  }
}
