import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import PresetVideoCell from '../components/PresetVideoCell'

const CATEGORY_LABEL = {
  overlay: 'Overlay',
  glitch: 'Glitch',
  cc: 'CC',
  jj: 'Efek JJ',
  transisi: 'Transisi',
  lainnya: 'Lainnya',
}

export default function EfekKategori() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { getCache, setCache, clearCache } = usePresetCache()
  const cacheKey = `efek-kategori:${category}`
  const cached = getCache(cacheKey)
  const [effects, setEffects] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)
  const gridRef = useRef(null)

  // Cuma fetch kalo belum ada cache buat kategori ini (biar urutan grid stabil
  // selama user masih di halaman), jadi gak ada resiko query berulang/loop.
  useEffect(() => {
    async function loadData() {
      if (getCache(cacheKey)) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('effects')
          .select('*')
          .eq('category', category)
          .eq('link_pending', false)
          .order('created_at', { ascending: false })
        if (error) throw error
        setEffects(data || [])
        setCache(cacheKey, data || [])
      } catch (err) {
        console.error('Gagal ambil efek kategori:', err)
      } finally {
        setLoading(false)
      }
    }
    if (category) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  function resetToCover(video) {
    if (!video) return
    video.pause()
    video.currentTime = 2
  }

  function handleHoverStart(video) {
    if (!video || activeVideoRef.current === video) return
    resetToCover(activeVideoRef.current)
    video.play().catch(() => {})
    activeVideoRef.current = video
  }

  function handleHoverEnd(video) {
    resetToCover(video)
    if (activeVideoRef.current === video) activeVideoRef.current = null
  }

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const onScroll = () => {
      resetToCover(activeVideoRef.current)
      activeVideoRef.current = null
    }
    grid.addEventListener('scroll', onScroll, { passive: true })
    return () => grid.removeEventListener('scroll', onScroll)
  }, [])

  const label = CATEGORY_LABEL[category] || category

  return (
    <div className="screen">
      <div className="grid-header">
        <button className="back-btn ghost-static" onClick={() => { clearCache(cacheKey); navigate(-1) }}>← Balik</button>
        <div>
          <h3>{label}</h3>
          <p>{effects.length} efek</p>
        </div>
      </div>

      {loading && (
        <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
      )}

      {!loading && effects.length === 0 && (
        <div className="empty-state" style={{ padding: 30 }}>Belum ada efek di kategori ini.</div>
      )}

      {!loading && effects.length > 0 && (
        <div className="preset-grid" ref={gridRef}>
          {effects.map((effect, i) => (
            <PresetVideoCell
              key={effect.id}
              preset={effect}
              index={i}
              getCache={getCache}
              setCache={setCache}
              overlayLabel={effect.title}
              onNavigate={(e) => navigate(`/efek/${e.id}`)}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}
