import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'

const COVER_TIME = 2
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

export default function KreatorPresets() {
  const { creatorUsername } = useParams()
  const navigate = useNavigate()
  const { getCache, setCache, clearCache } = usePresetCache()
  const cacheKey = `kreator-presets:${creatorUsername}`
  const cached = getCache(cacheKey)
  const [presets, setPresets] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)
  const gridRef = useRef(null)

  useEffect(() => {
    async function loadData() {
      if (getCache(cacheKey)) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .eq('creator_username', creatorUsername)
          .order('created_at', { ascending: false })
        if (error) throw error
        setPresets(data || [])
        setCache(cacheKey, data || [])
      } catch (err) {
        console.error('Gagal ambil preset kreator:', err)
      } finally {
        setLoading(false)
      }
    }
    if (creatorUsername) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorUsername])

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
    const grid = gridRef.current
    if (!grid) return
    const onScroll = () => {
      resetToCover(activeVideoRef.current)
      activeVideoRef.current = null
    }
    grid.addEventListener('scroll', onScroll, { passive: true })
    return () => grid.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="screen">
      <div className="grid-header">
        <button className="back-btn ghost-static" onClick={() => { clearCache(cacheKey); navigate(-1) }}>← Balik</button>
        <div>
          <h3>@{creatorUsername}</h3>
          <p>{presets.length} preset</p>
        </div>
      </div>

      {loading && (
        <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
      )}

      {!loading && presets.length === 0 && (
        <div className="empty-state" style={{ padding: 30 }}>Belum ada preset dari kreator ini.</div>
      )}

      {!loading && presets.length > 0 && (
        <div className="preset-grid" ref={gridRef}>
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="grid-cell"
              onClick={() => navigate(`/preset/${preset.id}`, { state: { source: 'kreator', creatorUsername } })}
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
                  src={preset.preview_video_url}
                  muted
                  loop
                  playsInline
                  preload="metadata"
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
