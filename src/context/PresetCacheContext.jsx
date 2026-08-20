import { createContext, useContext, useRef, useState, useEffect } from 'react'
import { saveThumb, getAllThumbs, pruneThumbs } from '../utils/thumbCacheDB'

// Cache sederhana yang nempel selama app hidup (ngga ke-reset pas pindah halaman,
// soalnya provider-nya ada di atas <Routes>). Dipake biar grid preset ngga perlu
// nunjukin loading & fetch ulang tiap kali user balik dari halaman fullscreen.
//
// Khusus thumbnail cover ("thumb:..."), selain nempel di memory, juga ditulis ke
// IndexedDB biar TETEP ada walau app di-reload penuh / APK di-kill dari background.
const PresetCacheContext = createContext(null)

export function PresetCacheProvider({ children }) {
  const cacheRef = useRef({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    getAllThumbs().then((rows) => {
      rows.forEach((row) => {
        cacheRef.current[`thumb:${row.id}`] = { data: row.dataUrl, timestamp: row.updatedAt }
      })
      setHydrated(true)
      pruneThumbs()
    })
  }, [])

  const getCache = (key) => cacheRef.current[key]

  const setCache = (key, data) => {
    cacheRef.current[key] = { data, timestamp: Date.now() }
    if (key.startsWith('thumb:')) {
      saveThumb(key.slice('thumb:'.length), data)
    }
  }

  const clearCache = (key) => {
    delete cacheRef.current[key]
  }

  return (
    <PresetCacheContext.Provider value={{ getCache, setCache, clearCache, hydrated }}>
      {children}
    </PresetCacheContext.Provider>
  )
}

export function usePresetCache() {
  return useContext(PresetCacheContext)
}
