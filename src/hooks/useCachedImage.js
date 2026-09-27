import { useEffect, useState } from 'react'
import { getCachedImageBlob, saveCachedImageBlob } from '../utils/imageCacheDB'

// Kasih src gambar yang aman dari tombol "Hapus Cache" bawaan HP: coba ambil dari
// IndexedDB (folder Data) dulu, kalo belum ada baru fetch dari internet terus
// disimpen buat next time. Selagi nunggu, langsung pake URL aslinya dulu biar
// gambar tetep keliatan dari awal (bukan nunggu proses cache-nya kelar dulu).
export function useCachedImage(url) {
  const [src, setSrc] = useState(url || null)

  useEffect(() => {
    if (!url) {
      setSrc(null)
      return
    }
    setSrc(url)
    let cancelled = false
    let objectUrl = null

    async function load() {
      const cachedBlob = await getCachedImageBlob(url)
      if (cancelled) return
      if (cachedBlob) {
        objectUrl = URL.createObjectURL(cachedBlob)
        setSrc(objectUrl)
        return
      }
      try {
        const res = await fetch(url)
        if (!res.ok || cancelled) return
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
        saveCachedImageBlob(url, blob)
      } catch {
        // Gagal fetch (offline dll) - biarin aja, udah kepasang URL asli dari awal
      }
    }
    load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return src
}
