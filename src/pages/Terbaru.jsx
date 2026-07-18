import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { BottomNav } from '../components/BottomNav'

export default function Terbaru() {
  const navigate = useNavigate()
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const videoRefs = useRef({})

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

  useEffect(() => {
    if (presets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            video.play().catch(() => {})
          } else {
            video.pause()
          }
        })
      },
      { threshold: [0, 0.6, 1] }
    )
    Object.values(videoRefs.current).forEach((v) => v && observer.observe(v))
    return () => observer.disconnect()
  }, [presets])

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
        <div className="preset-grid">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="grid-cell"
              onClick={() => navigate(`/preset/${preset.id}`)}
            >
              {preset.preview_video_url ? (
                <video
                  ref={(el) => { videoRefs.current[preset.id] = el }}
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
