import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

const COVER_TIME = 2.5

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
  supabase.from('presets').select('*').eq('song_id', songId),
])
if (error) throw error
setSong(songData)

// Acak urutan preset (Fisher-Yates shuffle) biar gak sesuai tanggal upload
const shuffled = [...(presetsData || [])]
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
}
setPresets(shuffled)
      } catch (err) {
        console.error('Gagal ambil preset lagu:', err)
      } finally {
        setLoading(false)
      }
    }
    if (songId) loadData()
  }, [songId])

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
                  disablePictureInPicture
                  controlsList="nodownload"
                  draggable={false}
                  onLoadedMetadata={handleLoadedMetadata}
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
