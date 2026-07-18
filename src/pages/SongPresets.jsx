import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

export default function SongPresets() {
  const { songId } = useParams()
  const navigate = useNavigate()
  const [song, setSong] = useState(null)
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const activeVideoRef = useRef(null)
  const gridRef = useRef(null)

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

  // Video kepause otomatis begitu user geser/scroll grid-nya
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
    </div>
  )
}
