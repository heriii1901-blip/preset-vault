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
  const [failedIds, setFailedIds] = useState(new Set())

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
    video.currentTime = COVER_TIME
  }

  function handleStartPlay(video) {
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

  function handleLoadedMetadata(e) {
    const video = e.currentTarget
    // Video pendek (<COVER_TIME) -> seek ke setengah durasi biar ngga mentok/gagal
    const target = video.duration && video.duration < COVER_TIME ? video.duration / 2 : COVER_TIME
    if (video.currentTime === 0) video.currentTime = target

    // Fallback: kalo event 'seeked' ngga fire dalam 2.5 detik (network macet pas burst
    // load banyak video bareng), paksa retry sekali. Ini yang bikin cover kadang ilang random.
    clearTimeout(video._seekRetryTimer)
    video._seekRetryTimer = setTimeout(() => {
      if (video.currentTime < target - 0.1) {
        video.currentTime = target
      }
    }, 2500)
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
      { rootMargin: '60px 0px 60px 0px' } // dulunya 150px -> hampir semua video ke-trigger barengan pas mount, bikin burst request ke R2
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
              {preset.preview_video_url && !failedIds.has(preset.id) ? (
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
                  onSeeked={(e) => {
                    clearTimeout(e.currentTarget._seekRetryTimer)
                    captureThumb(e.currentTarget, preset.id, setCache)
                  }}
                  onError={() => {
                    // Beneran gagal load (bukan cuma lambat) -> jangan biarin cell kosong/blank,
                    // tampilin fallback icon aja daripada keliatan bug
                    setFailedIds((prev) => new Set(prev).add(preset.id))
                  }}
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
