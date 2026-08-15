// Penyimpanan lokal (IndexedDB) buat antrian upload yang belum kelar.
// Tujuannya: kalo app ke-close paksa di tengah proses, sisa job-nya gak ilang -
// pas app dibuka lagi, kita baca ulang dari sini dan lanjutin dari awal.
const DB_NAME = 'pam-upload-queue'
const DB_VERSION = 1
const STORE_NAME = 'jobs'

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
