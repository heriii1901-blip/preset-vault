// Penyimpanan lokal (IndexedDB) buat antrian upload.
// Store 'jobs': job yang lagi diproses/nunggu antrian - biar kalo app ke-close paksa,
// pas dibuka lagi bisa dilanjutin dari sini.
// Store 'failed_jobs': job yang GAGAL upload - disimpen permanen (sampe di-retry atau dihapus manual)
// biar bisa di-upload ulang nanti tanpa isi form dari awal, misalnya abis kodenya direvisi.
const DB_NAME = 'pam-upload-queue'
const DB_VERSION = 2
const STORE_NAME = 'jobs'
const FAILED_STORE_NAME = 'failed_jobs'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(FAILED_STORE_NAME)) {
        db.createObjectStore(FAILED_STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveJobToDB(job) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(job)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Gagal simpen job ke penyimpanan lokal:', err)
  }
}

export async function deleteJobFromDB(id) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Gagal hapus job dari penyimpanan lokal:', err)
  }
}

export async function getAllJobsFromDB() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.error('Gagal ambil job dari penyimpanan lokal:', err)
    return []
  }
}

export async function saveFailedJobToDB(job) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FAILED_STORE_NAME, 'readwrite')
      tx.objectStore(FAILED_STORE_NAME).put(job)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Gagal simpen job gagal ke penyimpanan lokal:', err)
  }
}

export async function deleteFailedJobFromDB(id) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FAILED_STORE_NAME, 'readwrite')
      tx.objectStore(FAILED_STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Gagal hapus job gagal dari penyimpanan lokal:', err)
  }
}

export async function getAllFailedJobsFromDB() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FAILED_STORE_NAME, 'readonly')
      const req = tx.objectStore(FAILED_STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.error('Gagal ambil job gagal dari penyimpanan lokal:', err)
    return []
  }
}
