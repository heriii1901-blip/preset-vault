import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import PresetVideoCell from '../components/PresetVideoCell'

export default function SongPresets() {
  const { songId } = useParams()
  const navigate = useNavigate()
  const { getCache, setCache, clearCache } = usePresetCache()
  const cacheKey = `song:${songId}`
  const cached = getCache(cacheKey)
  const [song, setSong] = useState(cached?.data?.song || null)
  const [presets, setPresets] = useState(cached?.data?.presets || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)
  const gridRef = useRef(null)

  useEffect(() => {
    async function loadData() {
      // Udah ada cache buat lagu ini -> skip, biar urutan grid stabil selama user masih di halaman ini
      if (getCache(cacheKey)) return
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
        setCache(cacheKey, { song: songData, presets: shuffled })
      } catch (err) {
        console.error('Gagal ambil preset lagu:', err)
      } finally {
        setLoading(false)
      }
    }
    if (songId) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId])

  function resetToCover(video) {
    if (!video) return
    video.pause()
    video.currentTime = 2
  }

  function handleHoverStart(video) {
    if (!video || activeVideoRef.current === video) return
    resetToCover(activeVideoRef.current)
    video.play().catch(() => {})
    activeVideoRef.current = video
  }

  function handleHoverEnd(video) {
    resetToCover(video)
    if (activeVideoRef.current === video) activeVideoRef.current = null
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
          {presets.map((preset, i) => (
            <PresetVideoCell
              key={preset.id}
              preset={preset}
              index={i}
              getCache={getCache}
              setCache={setCache}
              onNavigate={(p) => navigate(`/preset/${p.id}`)}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}
