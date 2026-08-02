import { createContext, useContext, useRef } from 'react'

// Cache sederhana yang nempel selama app hidup (ngga ke-reset pas pindah halaman,
// soalnya provider-nya ada di atas <Routes>). Dipake biar grid preset ngga perlu
// nunjukin loading & fetch ulang tiap kali user balik dari halaman fullscreen.
const PresetCacheContext = createContext(null)

export function PresetCacheProvider({ children }) {
  const cacheRef = useRef({})

  const getCache = (key) => cacheRef.current[key]

  const setCache = (key, data) => {
    cacheRef.current[key] = { data, timestamp: Date.now() }
  }

  const clearCache = (key) => {
    delete cacheRef.current[key]
  }

  return (
    <PresetCacheContext.Provider value={{ getCache, setCache, clearCache }}>
      {children}
    </PresetCacheContext.Provider>
  )
}

export function usePresetCache() {
  return useContext(PresetCacheContext)
}
