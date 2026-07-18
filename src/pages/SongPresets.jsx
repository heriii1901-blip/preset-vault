import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

export default function SongPresets() {
  const { songId } = useParams()
  const navigate = useNavigate()
  const [song, setSong] = useState(null)
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const videoRefs = useRef({})

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [{ data: songData }, { data: presetsData, error }] = await Promise.all([
          supabase.from('songs').select('*').eq('id', songId).single(),
          supabase.from('presets').select('*').eq('song_id', songId).order('created_at', { ascending: true }),
        ])
        if (error) throw error
        setSong(songData)
        setPresets(presetsData || [])
      } catch (err) {
        console.error('Gagal ambil preset lagu:', err)
      } finally {
        setLoading(false)
      }
    }
    if (songId) loadData()
  }, [songId])

  // Autoplay video yang lagi keliatan di layar (kayak grid pencarian TikTok),
  // pause video yang udah keluar dari layar.
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

    Object.values(videoRefs.current).forEach((v) => {
      if (v) observer.observe(v)
    })

    return () => observer.disconnect()
  }, [presets])

  return (
    <div className="screen">
      <div className="grid-header">
        <button className="back-btn ghost-static" onClick={() => navigate(-1)}>← Balik</button>
        <div>
          <h3>{song?.name || 'Memuat...'}</h3>
          <p>{presets.length} preset</p>
        </div>
      </div>

      {loading && (
        <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
      )}

      {!loading && presets.length === 0 && (
        <div className="empty-state" style={{ padding: 30 }}>Belum ada preset buat lagu ini.</div>
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
    </div>
  )
}
