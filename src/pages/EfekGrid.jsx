import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import PresetVideoCell from '../components/PresetVideoCell'

const CACHE_KEY = 'efek-grid'

export default function EfekGrid() {
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()
  const cached = getCache(CACHE_KEY)
  const [effects, setEffects] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)

  useEffect(() => {
    async function loadEffects() {
      if (!getCache(CACHE_KEY)) setLoading(true)
      try {
        const { data, error } = await supabase
          .from('effects')
          .select('*')
          .eq('link_pending', false)
          .order('created_at', { ascending: false })
        if (error) throw error
        setEffects(data || [])
        setCache(CACHE_KEY, data || [])
      } catch (err) {
        console.error('Gagal ambil daftar efek:', err)
      } finally {
        setLoading(false)
      }
    }
    loadEffects()
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
      <div className="grid-page efek-grid-page">
        <div className="grid-header">
          <div>
            <h3 className="grid-header-title-lg">Efek</h3>
          </div>
        </div>

        {loading && <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>}

        {!loading && effects.length === 0 && (
          <div className="empty-state" style={{ padding: 30 }}>Belum ada efek. Yuk upload pertama!</div>
        )}

        {!loading && effects.length > 0 && (
          <div className="preset-grid" style={{ paddingBottom: 70 }}>
            {effects.map((effect, i) => (
              <PresetVideoCell
                key={effect.id}
                preset={effect}
                index={i}
                getCache={getCache}
                setCache={setCache}
                showOverlay={false}
                onNavigate={(p) => navigate(`/efek/${p.id}`)}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          className="efek-fab"
          onClick={() => navigate('/efek/tambah')}
          aria-label="Tambah Efek"
        >
          +
        </button>
      </div>
    </div>
  )
}
