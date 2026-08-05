import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'

const COVER_TIME = 2
const CACHE_KEY = 'terbaru'
function captureThumb(video, presetId, setCache) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    if (!canvas.width || !canvas.height) return
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    setCache(`thumb:${presetId}`, canvas.toDataURL('image/jpeg', 0.6))
  } catch {
    // video beda origin tanpa izin CORS baca pixel, skip aja
  }
}

export default function Terbaru() {
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()
  const cached = getCache(CACHE_KEY)
  const [presets, setPresets] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)
  const gridRef = useRef(null)
  const itemRefs = useRef({})
  const [visibleIds, setVisibleIds] = useState(new Set())

  useEffect(() => {
    async function loadLatestPresets() {
      // Kalo udah ada cache, tampilin dulu tanpa loading, terus refresh diem-diem
      if (!getCache(CACHE_KEY)) setLoading(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(15)
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
    video.currentTime = COVER_TIME
  }

  function handleStartPlay(video) {
    if (!video || activeVideoRef.current === video) return
    resetToCover(activeVideoRef.current)
    video.play().catch(() => {})
    activeVideoRef.current = video
  }

  function handleLoadedMetadata(e) {
    const video = e.currentTarget
    if (video.currentTime === 0) video.currentTime = COVER_TIME
  }

  useEffect(() => {
    if (presets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.dataset.presetId
          if (entry.isIntersecting) {
            setVisibleIds((prev) => {
              if (prev.has(id)) return prev
              return new Set(prev).add(id)
            })
          }
        })
      },
      { rootMargin: '150px 0px 150px 0px' }
    )
    const timer = setTimeout(() => {
      Object.values(itemRefs.current).forEach((el) => {
        if (el) observer.observe(el)
      })
    }, 100)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [presets])

  return (
    <div className="screen">
      <div className="grid-page">
      <div className="grid-header">
        <div>
          <h3>Terbaru</h3>
          <p>{presets.length} preset</p>
        </div>
      </div>

      {loading && (
        <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
      )}

      {!loading && presets.length === 0 && (
        <div className="empty-state" style={{ padding: 30 }}>Belum ada preset terbaru.</div>
      )}

      {!loading && presets.length > 0 && (
        <div className="preset-grid" ref={gridRef}>
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="grid-cell"
              data-preset-id={preset.id}
              ref={(el) => { itemRefs.current[preset.id] = el }}
              onClick={() => navigate(`/preset/${preset.id}`, { state: { source: 'terbaru' } })}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => handleStartPlay(e.currentTarget.querySelector('video'))}
              onMouseEnter={(e) => handleStartPlay(e.currentTarget.querySelector('video'))}
              onMouseLeave={(e) => {
                resetToCover(e.currentTarget.querySelector('video'))
                if (activeVideoRef.current === e.currentTarget.querySelector('video')) {
                  activeVideoRef.current = null
                }
              }}
            >
              {preset.preview_video_url ? (
                <video
                  src={visibleIds.has(preset.id) ? preset.preview_video_url : undefined}
                  muted
                  loop
                  playsInline
                  preload={visibleIds.has(preset.id) ? 'metadata' : 'none'}
                  crossOrigin="anonymous"
                  disablePictureInPicture
                  controlsList="nodownload"
                  draggable={false}
                  poster={getCache(`thumb:${preset.id}`)?.data}
                  onLoadedMetadata={handleLoadedMetadata}
                  onSeeked={(e) => captureThumb(e.currentTarget, preset.id, setCache)}
                />
              ) : (
                <div className="grid-fallback">🎬</div>
              )}
              <div className="grid-cell-overlay">@{preset.creator_username}</div>
            </div>
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

