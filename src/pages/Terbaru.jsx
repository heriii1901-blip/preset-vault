import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { BottomNav } from '../components/BottomNav'

export default function Terbaru() {
  const navigate = useNavigate()
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const activeVideoRef = useRef(null)
  const gridRef = useRef(null)

  useEffect(() => {
    async function loadLatest() {
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
        if (error) throw error
        setPresets(data || [])
      } catch (err) {
        console.error('Gagal ambil preset terbaru:', err)
      } finally {
        setLoading(false)
      }
    }
    loadLatest()
  }, [])

  function pauseActive() {
    if (activeVideoRef.current) {
      activeVideoRef.current.pause()
      activeVideoRef.current = null
    }
  }

  function handlePressStart(video) {
    if (!video) return
    pauseActive()
    video.play().catch(() => {})
    activeVideoRef.current = video
  }

  function handlePressEnd(video) {
    if (!video) return
    video.pause()
    if (activeVideoRef.current === video) activeVideoRef.current = null
  }

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const onScroll = () => pauseActive()
    grid.addEventListener('scroll', onScroll, { passive: true })
    return () => grid.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="screen">
      <div className="grid-header">
        <div>
          <h3>Terbaru</h3>
          <p>{presets.length} preset</p>
        </div>
      </div>

      {loading && <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>}

      {!loading && presets.length === 0 && (
        <div className="empty-state" style={{ padding: 30 }}>Belum ada preset.</div>
      )}

      {!loading && presets.length > 0 && (
        <div className="preset-grid" ref={gridRef}>
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="grid-cell"
              onClick={() => navigate(`/preset/${preset.id}`)}
              onPointerDown={(e) => handlePressStart(e.currentTarget.querySelector('video'))}
              onPointerUp={(e) => handlePressEnd(e.currentTarget.querySelector('video'))}
              onPointerLeave={(e) => handlePressEnd(e.currentTarget.querySelector('video'))}
              onPointerCancel={(e) => handlePressEnd(e.currentTarget.querySelector('video'))}
            >
              {preset.preview_video_url ? (
                <video
                  src={preset.preview_video_url}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="grid-fallback">🎬</div>
              )}
              <div className="grid-cell-overlay">@{preset.creator_username}</div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
