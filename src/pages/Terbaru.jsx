import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import PresetVideoCell from '../components/PresetVideoCell'

const CACHE_KEY = 'terbaru'

export default function Terbaru() {
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()
  const cached = getCache(CACHE_KEY)
  const [presets, setPresets] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)

  useEffect(() => {
    async function loadLatestPresets() {
      // Kalo udah ada cache, tampilin dulu tanpa loading, terus refresh diem-diem
      if (!getCache(CACHE_KEY)) setLoading(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
        if (error) throw error
        setPresets(data || [])
        setCache(CACHE_KEY, data || [])
      } catch (err) {
        console.error('Gagal ambil preset terbaru:', err)
      } finally {
        setLoading(false)
      }
    }
    loadLatestPresets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetToCover(video) {
    if (!video) return
    video.pause()
    video.currentTime = 2
  }

  function handleHoverStart(video) {
    if (!video || activeVideoRef.current === video) return
    resetToCover(activeVideoRef.current)
    activeVideoRef.current = video

    // Kalo data video belum cukup siap (kepotong antrian network pas burst load),
    // play() bisa silent-fail. Tunggu 'canplay' dulu baru play, biar ngga ke-skip diem-diem.
    if (video.readyState >= 2) {
      video.play().catch(() => {})
    } else {
      const onReady = () => {
        video.removeEventListener('canplay', onReady)
        if (activeVideoRef.current === video) video.play().catch(() => {})
      }
      video.addEventListener('canplay', onReady)
    }
  }

  function handleHoverEnd(video) {
    resetToCover(video)
    if (activeVideoRef.current === video) activeVideoRef.current = null
  }

  return (
    <div className="screen">
      <div className="grid-page">
      <div className="grid-header">
        <div>
          <h3 className="grid-header-title-lg">Terbaru</h3>
        </div>
      </div>
        
      {loading && (
        <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
      )}

      {!loading && presets.length === 0 && (
        <div className="empty-state" style={{ padding: 30 }}>Belum ada preset terbaru.</div>
      )}

      {!loading && presets.length > 0 && (
        <div className="preset-grid">
          {presets.map((preset, i) => (
            <PresetVideoCell
              key={preset.id}
              preset={preset}
              index={i}
              getCache={getCache}
              setCache={setCache}
              onNavigate={(p) => navigate(`/preset/${p.id}`, { state: { source: 'terbaru' } })}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          ))}
          <div
            className="grid-cell grid-cell-viewall"
            onClick={() => navigate('/lagu')}
          >
            <div className="grid-fallback" style={{ fontSize: 28 }}>🎵</div>
            <div className="grid-cell-overlay">Lihat Semua</div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
