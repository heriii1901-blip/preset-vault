import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

export default function PresetFeed() {
  const { presetId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isFromTerbaru = location.state?.source === 'terbaru'
  const isFromKreator = location.state?.source === 'kreator'
  const isFromFavorit = location.state?.source === 'favorit'
  const filterCreatorUsername = location.state?.creatorUsername
  const { user } = useAuth()
  const [presets, setPresets] = useState([])
  const [songName, setSongName] = useState('')
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const videoRefs = useRef({})
  const hasScrolledRef = useRef(false)
  const containerHeightRef = useRef(0)
  const firstApplyRef = useRef(true)
  const dragRef = useRef({ startY: 0, dragging: false, currentDelta: 0 })

  const [activeIndex, setActiveIndex] = useState(0)
  const [feedReady, setFeedReady] = useState(false)
  const [linkModal, setLinkModal] = useState(null) // { label, link } | null
  const [copied, setCopied] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState(new Set())
  const [pausedIds, setPausedIds] = useState(new Set())
  const activeVideoIdRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const retryCountRef = useRef({})
  const videoUrlsRef = useRef({})
  const [videoProgress, setVideoProgress] = useState({}) // { [id]: { current, duration } }
  const [loadedIds, setLoadedIds] = useState(new Set())

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

        let favIds = []
        if (user) {
          const { data: favs } = await supabase
            .from('favorites')
            .select('preset_id')
            .eq('user_id', user.id)
          favIds = (favs || []).map((f) => f.preset_id)
          setFavoritedIds(new Set(favIds))
        }

        let query = supabase.from('presets').select('*, songs(name)').eq('link_pending', false)

        if (isFromTerbaru) {
          query = query.order('created_at', { ascending: false }).limit(20)
        } else if (isFromKreator && filterCreatorUsername) {
          query = query.eq('creator_username', filterCreatorUsername).order('created_at', { ascending: false })
        } else if (isFromFavorit) {
          query = query.in('id', favIds.length > 0 ? favIds : [presetId]).order('created_at', { ascending: false })
        } else {
          query = query.eq('song_id', clickedPreset.song_id).order('created_at', { ascending: true })
        }

        const { data: allPresets, error: listErr } = await query
        if (listErr) throw listErr

        setPresets(allPresets || [])
      } catch (err) {
        console.error('Gagal ambil feed preset:', err)
      } finally {
        setLoading(false)
      }
    }
    if (presetId) loadFeed()
    hasScrolledRef.current = false
    firstApplyRef.current = true
    setFeedReady(false)
  }, [presetId, user, isFromTerbaru, isFromKreator, filterCreatorUsername, isFromFavorit])
  // Ukur tinggi container sekali & tiap resize (dipake buat hitung transform px)
    
  useLayoutEffect(() => {
    function measure() {
      const h = containerRef.current?.clientHeight || window.innerHeight
      containerHeightRef.current = h
      if (containerRef.current) containerRef.current.style.setProperty('--feed-item-h', `${h}px`)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  
  // Kalo ukuran layar berubah signifikan (app di-kecilin / keluar mode fullscreen sistem),
  // otomatis balik ke grid - ngga manggil Supabase, jadi ngga ada resiko egress
  useEffect(() => {
    const initialWidth = window.innerWidth
    const initialHeight = window.innerHeight
    function handleWindowResize() {
      const widthChanged = Math.abs(window.innerWidth - initialWidth) > 60
      const heightChanged = Math.abs(window.innerHeight - initialHeight) > 60
      if (widthChanged || heightChanged) navigate(-1)
    }
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Posisi awal begitu data kelar dimuat — cari index preset yang diklik dari list
  useEffect(() => {
    if (loading || presets.length === 0 || hasScrolledRef.current) return
    const idx = presets.findIndex((p) => p.id === presetId)
    setActiveIndex(idx >= 0 ? idx : 0)
    hasScrolledRef.current = true
    setFeedReady(true)
  }, [loading, presets, presetId])

  const applyTransform = useCallback((indexFloat, animate) => {
    const track = trackRef.current
    if (!track) return
    const h = containerHeightRef.current
    track.style.transition = animate ? 'transform 280ms cubic-bezier(.22,.68,0,1)' : 'none'
    track.style.transform = `translate3d(0, ${-indexFloat * h}px, 0)`
  }, [])

  // Tiap activeIndex berubah, geser track ke posisi itu (animasi kecuali pas pertama kali)
  useEffect(() => {
    if (!feedReady) return
    applyTransform(activeIndex, !firstApplyRef.current)
    firstApplyRef.current = false
  }, [activeIndex, presets.length, applyTransform, feedReady])

  // Load video di sekitar index aktif aja (current, sebelum, sesudah) - biar hemat & instan
  useEffect(() => {
    if (!feedReady) return
    const idsToLoad = [activeIndex - 1, activeIndex, activeIndex + 1]
      .map((i) => presets[i]?.id)
      .filter(Boolean)
    if (idsToLoad.length === 0) return
    setLoadedIds((prev) => {
      let changed = false
      const next = new Set(prev)
      idsToLoad.forEach((id) => {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [activeIndex, presets, feedReady])
  
  function switchToVideo(id) {
    if (activeVideoIdRef.current === id) return
    const oldId = activeVideoIdRef.current
    if (oldId && videoRefs.current[oldId]) {
      videoRefs.current[oldId].pause()
    }
    activeVideoIdRef.current = id
    setActiveId(id)
    const video = videoRefs.current[id]
    if (!video) return
    video.currentTime = 0

    if (!video.src) {
      const url = videoUrlsRef.current[id]
      if (!url) return
      video.src = url
      video.load()
    }

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

  // Video yang lagi aktif (posisi tengah layar) itu yang otomatis diputer, sisanya di-pause
  useEffect(() => {
    if (!feedReady || presets.length === 0) return
    const activePreset = presets[activeIndex]
    if (activePreset) switchToVideo(activePreset.id)
  }, [activeIndex, presets, feedReady])

  // Kontrol geser manual: 1x sentuh-geser = pindah PERSIS 1 video, seberapa
  // jauh/kenceng pun ditarik, ngikutin jari 1:1 (bukan native scroll lagi).
  useEffect(() => {
    const el = containerRef.current
    if (!el || presets.length === 0) return

    function handleTouchStart(e) {
      if (e.touches.length !== 1) return
      dragRef.current.dragging = true
      dragRef.current.startY = e.touches[0].clientY
      dragRef.current.currentDelta = 0
    }

    function handleTouchMove(e) {
      if (!dragRef.current.dragging || e.touches.length !== 1) return
      e.preventDefault()
      const h = containerHeightRef.current
      let delta = dragRef.current.startY - e.touches[0].clientY
      delta = Math.max(Math.min(delta, h), -h)
      dragRef.current.currentDelta = delta
      const track = trackRef.current
      if (track) {
        track.style.transition = 'none'
        track.style.transform = `translate3d(0, ${-(activeIndex * h) - delta}px, 0)`
      }
    }

    function handleTouchEnd() {
      if (!dragRef.current.dragging) return
      dragRef.current.dragging = false
      const h = containerHeightRef.current
      const delta = dragRef.current.currentDelta
      const threshold = h * 0.15
      let newIndex = activeIndex
      if (delta > threshold) newIndex = activeIndex + 1
      else if (delta < -threshold) newIndex = activeIndex - 1
      newIndex = Math.max(0, Math.min(newIndex, presets.length - 1))
      dragRef.current.currentDelta = 0
      applyTransform(newIndex, true)
      setActiveIndex(newIndex)
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [activeIndex, presets.length, applyTransform])

  const togglePlayPause = (id) => {
    const video = videoRefs.current[id]
    if (!video) return
    if (video.paused) {
      activeVideoIdRef.current = id
      setActiveId(id)
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

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00'
    const mins = Math.floor(timeInSeconds / 60)
    const secs = Math.floor(timeInSeconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const isValidUrl = (str) => {
    if (!str) return false
    try {
      const url = new URL(str)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
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

  const handleShare = async (preset) => {
    const shareUrl = `${window.location.origin}/preset/${preset.id}`
    const shareData = {
      title: preset.songs?.name || songName || 'Preset PAM',
      text: `Cobain preset ini di PAM, dari @${preset.creator_username}`,
      url: shareUrl,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Gagal share:', err)
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setLinkModal({ label: 'Link Preset', link: shareUrl })
      } catch (err) {
        console.error('Gagal nyalin link share:', err)
      }
    }
  }

  function handleVideoError(id, e) {
    const video = e.currentTarget
    const attempts = retryCountRef.current[id] || 0
    if (attempts >= 2) return
    retryCountRef.current[id] = attempts + 1
    setTimeout(() => {
      if (!video) return
      video.load()
      if (activeVideoIdRef.current === id) {
        video.play().catch(() => {
          setPausedIds((prev) => new Set(prev).add(id))
        })
      }
    }, 800)
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
          <div className="feed-track" ref={trackRef}>
            {presets.map((preset) => {
              const isFav = favoritedIds.has(preset.id)
              const isPaused = pausedIds.has(preset.id)

              const currentSec = videoProgress[preset.id]?.current || 0
              const durationSec = videoProgress[preset.id]?.duration || 0
              videoUrlsRef.current[preset.id] = preset.preview_video_url

              return (
                  <div key={preset.id} className={`feed-item${isFromTerbaru ? ' feed-item--with-nav' : ''}`} data-preset-id={preset.id}>
                  {preset.preview_video_url ? (
                    <video
                      ref={(el) => { videoRefs.current[preset.id] = el }}
                      data-preset-id={preset.id}
                      src={loadedIds.has(preset.id) ? preset.preview_video_url : undefined}
                      poster={preset.cover_url}
                      loop
                      playsInline
                      preload={activeId === preset.id ? 'auto' : loadedIds.has(preset.id) ? 'metadata' : 'none'}
                      onClick={() => togglePlayPause(preset.id)}
                      onTimeUpdate={(e) => handleTimeUpdate(preset.id, e)}
                      onError={(e) => handleVideoError(preset.id, e)}
                      onLoadedData={() => {
                        if (activeVideoIdRef.current === preset.id) {
                          videoRefs.current[preset.id]?.play()
                            .then(() => {
                              setPausedIds((prev) => {
                                if (!prev.has(preset.id)) return prev
                                const next = new Set(prev)
                                next.delete(preset.id)
                                return next
                              })
                            })
                            .catch(() => {
                              setPausedIds((prev) => new Set(prev).add(preset.id))
                            })
                        }
                      }}
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
                        isValidUrl(preset.tiktok_link) ? (
                          <a className="feed-btn" href={preset.tiktok_link} target="_blank" rel="noreferrer">
                            Vid Kreator
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="feed-btn"
                            onClick={() => openLinkModal('Vid Kreator', preset.tiktok_link)}
                          >
                            Vid Kreator
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="feed-side-actions">
                    <button
                      type="button"
                      className={isFav ? 'feed-icon-btn love active' : 'feed-icon-btn love'}
                      onClick={() => toggleFavorite(preset.id)}
                      aria-label="Favoritkan"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="feed-icon-btn"
                      onClick={() =>
                        navigate(`/download/${preset.id}`, {
                          state: {
                            videoUrl: preset.preview_video_url,
                            songName: preset.songs?.name || songName,
                          },
                        })
                      }
                      aria-label="Download"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12" />
                        <path d="M7.5 10.5L12 15l4.5-4.5" />
                        <path d="M5 21h14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="feed-icon-btn"
                      onClick={() => handleShare(preset)}
                      aria-label="Bagikan"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>

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
        </div>
      )}

      {linkModal && (
        <div className="link-modal-backdrop" onClick={closeLinkModal}>
          <div className="link-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="link-modal-header">
              <span>{linkModal.label}</span>
              <button type="button" className="link-modal-close" onClick={closeLinkModal}>×</button>
            </div>

            {isValidUrl(linkModal.link) ? (
              <a
                href={linkModal.link}
                target="_blank"
                rel="noreferrer"
                className={
                  linkModal.label === 'Link XML'
                    ? 'link-modal-input link-modal-textarea link-modal-clickable'
                    : 'link-modal-input link-modal-clickable'
                }
              >
                {linkModal.link}
              </a>
            ) : (
              <div
                className={
                  linkModal.label === 'Link XML'
                    ? 'link-modal-input link-modal-textarea'
                    : 'link-modal-input'
                }
              >
                {linkModal.link}
              </div>
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
