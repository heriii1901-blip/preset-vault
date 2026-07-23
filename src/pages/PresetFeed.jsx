import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

export default function PresetFeed() {
  const { presetId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isFromTerbaru = location.state?.source === 'terbaru'
  const { user } = useAuth()
  const [presets, setPresets] = useState([])
  const [songName, setSongName] = useState('')
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const itemRefs = useRef({})
  const videoRefs = useRef({})
  const hasScrolledRef = useRef(false)

  const [linkModal, setLinkModal] = useState(null) // { label, link } | null
  const [copied, setCopied] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState(new Set())
  const [pausedIds, setPausedIds] = useState(new Set())
  const activeVideoIdRef = useRef(null)
  const [videoProgress, setVideoProgress] = useState({}) // Menyimpan progress tiap video { [id]: { current, duration } }

  useEffect(() => {
    async function loadFeed() {
      setLoading(true)
      try {
        const { data: clickedPreset, error: presetErr } = await supabase
          .from('presets')
          .select('*, songs(name)')
          .eq('id', presetId)
          .single()
        if (presetErr) throw presetErr

        setSongName(clickedPreset.songs?.name || '')

        let query = supabase.from('presets').select('*, songs(name)')

        if (isFromTerbaru) {
          // Sama kayak query di Terbaru.jsx: preset terbaru lintas lagu
          query = query.order('created_at', { ascending: false }).limit(20)
        } else {
          // Fokus 1 lagu aja
          query = query.eq('song_id', clickedPreset.song_id).order('created_at', { ascending: true })
        }

        const { data: allPresets, error: listErr } = await query
        if (listErr) throw listErr

        setPresets(allPresets || [])

        if (user) {
          const { data: favs } = await supabase
            .from('favorites')
            .select('preset_id')
            .eq('user_id', user.id)
          setFavoritedIds(new Set((favs || []).map((f) => f.preset_id)))
        }
      } catch (err) {
        console.error('Gagal ambil feed preset:', err)
      } finally {
        setLoading(false)
      }
    }
    if (presetId) loadFeed()
    hasScrolledRef.current = false
  }, [presetId, user, isFromTerbaru])
  
  useEffect(() => {
    if (loading || presets.length === 0 || hasScrolledRef.current) return
    const el = itemRefs.current[presetId]
    if (el) {
      el.scrollIntoView({ block: 'start' })
      hasScrolledRef.current = true
    }
  }, [loading, presets, presetId])

  // Cuma dipanggil pas scroll pindah ke video lain, bukan pas pause/play manual
  function switchToVideo(id) {
    if (activeVideoIdRef.current === id) return
    const oldId = activeVideoIdRef.current
    if (oldId && videoRefs.current[oldId]) {
      videoRefs.current[oldId].pause()
    }
    activeVideoIdRef.current = id
    const video = videoRefs.current[id]
    if (!video) return
    video.currentTime = 0
    video.play()
      .then(() => {
        setPausedIds((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
      .catch(() => {
        setPausedIds((prev) => new Set(prev).add(id))
      })
  }

  // Autoplay video yang lagi penuh di layar, pause sisanya
  useEffect(() => {
    if (presets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target
          const id = video.dataset.presetId
          if (entry.isIntersecting && entry.intersectionRatio > 0.75) {
            switchToVideo(id)
          } else if (activeVideoIdRef.current === id) {
            video.pause()
            activeVideoIdRef.current = null
          }
        })
      },
      { threshold: [0, 0.75, 1] }
    )

    // Delay dikit biar gak tabrakan sama scrollIntoView pas halaman baru kebuka
    const timer = setTimeout(() => {
      Object.values(videoRefs.current).forEach((v) => {
        if (v) observer.observe(v)
      })
    }, 150)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [presets])

  const togglePlayPause = (id) => {
    const video = videoRefs.current[id]
    if (!video) return
    if (video.paused) {
      activeVideoIdRef.current = id
      video.play()
        .then(() => {
          setPausedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        })
        .catch(() => {
          setPausedIds((prev) => new Set(prev).add(id))
        })
    } else {
      video.pause()
      setPausedIds((prev) => new Set(prev).add(id))
    }
  }

  // Fungsi untuk update posisi progress bar saat video jalan
  const handleTimeUpdate = (id, e) => {
    const video = e.target
    setVideoProgress((prev) => ({
      ...prev,
      [id]: {
        current: video.currentTime || 0,
        duration: video.duration || 0,
      },
    }))
  }

  // Fungsi saat user menggeser/mengklik garis durasi (Scrubber)
  const handleScrub = (id, value) => {
    const video = videoRefs.current[id]
    if (!video) return
    video.currentTime = value
    setVideoProgress((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        current: value,
      },
    }))
  }

  // Fungsi pembantu untuk mengubah detik ke format MM:SS (Contoh: 75 detik -> 01:15)
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00'
    const mins = Math.floor(timeInSeconds / 60)
    const secs = Math.floor(timeInSeconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const openLinkModal = (label, link) => {
    setCopied(false)
    setLinkModal({ label, link })
  }

  const closeLinkModal = () => {
    setLinkModal(null)
    setCopied(false)
  }

  const handleCopy = async () => {
    if (!linkModal) return
    try {
      await navigator.clipboard.writeText(linkModal.link)
      setCopied(true)
    } catch (err) {
      console.error('Gagal nyalin:', err)
    }
  }

  const toggleFavorite = async (presetIdToToggle) => {
    if (!user) return
    const isFav = favoritedIds.has(presetIdToToggle)

    setFavoritedIds((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(presetIdToToggle)
      else next.add(presetIdToToggle)
      return next
    })

    try {
      if (isFav) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('preset_id', presetIdToToggle)
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: user.id, preset_id: presetIdToToggle })
      }
    } catch (err) {
      console.error('Gagal update favorit:', err)
      setFavoritedIds((prev) => {
        const next = new Set(prev)
        if (isFav) next.add(presetIdToToggle)
        else next.delete(presetIdToToggle)
        return next
      })
    }
  }

  return (
    <div className="screen">
      <button className="feed-back-btn" onClick={() => navigate(-1)}>←</button>

      {loading && (
        <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Memuat...
        </div>
      )}

      {!loading && (
        <div className="feed-container" ref={containerRef}>
          {presets.map((preset) => {
            const isFav = favoritedIds.has(preset.id)
            const isPaused = pausedIds.has(preset.id)

            // Ambil info waktu sekarang dan total durasi video ini
            const currentSec = videoProgress[preset.id]?.current || 0
            const durationSec = videoProgress[preset.id]?.duration || 0

            return (
              <div
                key={preset.id}
                className="feed-item"
                ref={(el) => { itemRefs.current[preset.id] = el }}
              >
                {preset.preview_video_url ? (
                  <video
                    ref={(el) => { videoRefs.current[preset.id] = el }}
                    data-preset-id={preset.id}
                    src={preset.preview_video_url}
                    loop
                    playsInline
                    preload="auto"
                    onClick={() => togglePlayPause(preset.id)}
                    onTimeUpdate={(e) => handleTimeUpdate(preset.id, e)}
                  />
                ) : (
                  <div className="grid-fallback" style={{ fontSize: 40 }}>🎬</div>
                )}

                {isPaused && (
                  <div className="feed-pause-icon" onClick={() => togglePlayPause(preset.id)}>▶</div>
                )}

                <div className="feed-overlay">
                  <h4>{preset.songs?.name || songName}</h4>
                  <p>@{preset.creator_username}</p>
                  <div className="feed-actions">
                    <button
                      type="button"
                      className={isFav ? 'feed-fav-btn active' : 'feed-fav-btn'}
                      onClick={() => toggleFavorite(preset.id)}
                      aria-label="Favoritkan"
                    >
                      {isFav ? '♥' : '♡'}
                    </button>
                    <button
                      type="button"
                      className="feed-btn"
                      onClick={() => openLinkModal('Link XML', preset.xml_link)}
                    >
                      Link XML
                    </button>
                    <button
                      type="button"
                      className="feed-btn"
                      onClick={() => openLinkModal('Link 5MB', preset.mb_link)}
                    >
                      Link 5MB
                    </button>
                    {preset.tiktok_link && (
                      <a className="feed-btn" href={preset.tiktok_link} target="_blank" rel="noreferrer">
                        Vid Kreator
                      </a>
                    )}
                  </div>
                </div>

                {/* Progress Bar dengan Teks Angka Detik */}
                <div className="feed-progress-container">
                  <div className="feed-time-text">
                    {formatTime(currentSec)} / {formatTime(durationSec)}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={durationSec || 100}
                    value={currentSec}
                    onChange={(e) => handleScrub(preset.id, parseFloat(e.target.value))}
                    className="feed-progress-bar"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {linkModal && (
        <div className="link-modal-backdrop" onClick={closeLinkModal}>
          <div className="link-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="link-modal-header">
              <span>{linkModal.label}</span>
              <button type="button" className="link-modal-close" onClick={closeLinkModal}>×</button>
            </div>
            {linkModal.label === 'Link XML' ? (
              <textarea
                className="link-modal-input link-modal-textarea"
                readOnly
                value={linkModal.link}
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <input
                className="link-modal-input"
                readOnly
                value={linkModal.link}
                onFocus={(e) => e.target.select()}
              />
            )}
            <button type="button" className="link-modal-copy-btn" onClick={handleCopy}>
              {copied ? '✓ Tersalin' : 'Salin Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
