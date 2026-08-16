// Penyimpanan lokal (IndexedDB) buat antrian & riwayat upload.
// SEMUA item (lagi antri, lagi jalan, sukses, gagal, dibatalin) disimpen di 1 store
// 'queue_items' biar bisa ditampilin jadi 1 list riwayat di halaman admin.
// Store lama 'jobs' & 'failed_jobs' otomatis dipindahin sekali ke 'queue_items' pas upgrade.
const DB_NAME = 'pam-upload-queue'
const DB_VERSION = 3
const STORE_NAME = 'queue_items'
const LEGACY_JOBS_STORE = 'jobs'
const LEGACY_FAILED_STORE = 'failed_jobs'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(LEGACY_JOBS_STORE)) {
        db.createObjectStore(LEGACY_JOBS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(LEGACY_FAILED_STORE)) {
        db.createObjectStore(LEGACY_FAILED_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveQueueItem(item) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Gagal simpen item antrian ke penyimpanan lokal:', err)
  }
}

export async function deleteQueueItem(id) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Gagal hapus item antrian dari penyimpanan lokal:', err)
  }
}

export async function getAllQueueItems() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.error('Gagal ambil item antrian dari penyimpanan lokal:', err)
    return []
  }
}

// Pindahin data dari store lama ('jobs' & 'failed_jobs' - versi sebelum ada halaman Riwayat)
// ke store baru 'queue_items', sekali doang. Aman dipanggil berkali-kali karena
// store lama langsung dikosongin abis dipindah.
export async function migrateLegacyQueueData() {
  try {
    const db = await openDB()

    const readAll = (storeName) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const req = tx.objectStore(storeName).getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => reject(req.error)
      })

    const clearStore = (storeName) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })

    const [legacyJobs, legacyFailed] = await Promise.all([
      readAll(LEGACY_JOBS_STORE),
      readAll(LEGACY_FAILED_STORE),
    ])

    if (legacyJobs.length === 0 && legacyFailed.length === 0) return []

    const now = Date.now()
    const migrated = [
      ...legacyJobs.map((j) => ({
        ...j,
        status: 'queued',
        stage: 'Lanjutin upload yang sempet kepotong...',
        progress: 0,
        createdAt: j.createdAt || now,
        updatedAt: now,
      })),
      ...legacyFailed.map((f) => ({
        ...f,
        status: 'error',
        stage: 'Gagal upload',
        progress: 0,
        errorMessage: f.errorMessage || 'Gagal upload',
        createdAt: f.createdAt || f.failedAt || now,
        updatedAt: f.failedAt || now,
      })),
    ]

    for (const item of migrated) {
      await saveQueueItem(item)
    }
    await Promise.all([clearStore(LEGACY_JOBS_STORE), clearStore(LEGACY_FAILED_STORE)])

    return migrated
  } catch (err) {
    console.error('Gagal migrasi data antrian lama:', err)
    return []
  }
}
