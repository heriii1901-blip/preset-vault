import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

export default function PresetFeed() {
  const { presetId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isFromTerbaru = location.state?.source === 'terbaru'
  const isFromKreator = location.state?.source === 'kreator'
  const filterCreatorUsername = location.state?.creatorUsername
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
  const [activeId, setActiveId] = useState(null)
  const retryCountRef = useRef({})
  const videoUrlsRef = useRef({})
  const [videoProgress, setVideoProgress] = useState({}) // Menyimpan progress tiap video { [id]: { current, duration } }
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

        let query = supabase.from('presets').select('*, songs(name)')

        if (isFromTerbaru) {
          // Sama kayak query di Terbaru.jsx: preset terbaru lintas lagu
          query = query.order('created_at', { ascending: false }).limit(15)
        } else if (isFromKreator && filterCreatorUsername) {
          // Kejebak di kreator yang sama aja, jangan nyasar ke video lain
          query = query.eq('creator_username', filterCreatorUsername).order('created_at', { ascending: false })
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
  }, [presetId, user, isFromTerbaru, isFromKreator, filterCreatorUsername])
  
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
    setActiveId(id)
    const video = videoRefs.current[id]
    if (!video) return
    video.currentTime = 0

    if (!video.src) {
      const url = videoUrlsRef.current[id]
      if (!url) return
      video.src = url
      video.load()
      setLoadedIds((prev) => {
        if (prev.has(id)) return prev
        return new Set(prev).add(id)
      })
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
          setActiveId(null)
        }
      })
    },
    { threshold: [0, 0.75, 1] }
  )

  const loadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.dataset.presetId
        if (entry.isIntersecting) {
          setLoadedIds((prev) => {
            if (prev.has(id)) return prev
            return new Set(prev).add(id)
          })
        } else {
          setLoadedIds((prev) => {
            if (!prev.has(id)) return prev
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      })
    },
    { rootMargin: '100% 0px 100% 0px' }
  )

  const timer = setTimeout(() => {
    Object.values(itemRefs.current).forEach((el) => {
      if (el) loadObserver.observe(el)
    })
    Object.values(videoRefs.current).forEach((v) => {
      if (v) observer.observe(v)
    })
  }, 150)

  return () => {
    clearTimeout(timer)
    observer.disconnect()
    loadObserver.disconnect()
  }
}, [presets])

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
          {presets.map((preset) => {
            const isFav = favoritedIds.has(preset.id)
            const isPaused = pausedIds.has(preset.id)

            const currentSec = videoProgress[preset.id]?.current || 0
            const durationSec = videoProgress[preset.id]?.duration || 0
            videoUrlsRef.current[preset.id] = preset.preview_video_url

            return (
              <div
                key={preset.id}
                className="feed-item"
                data-preset-id={preset.id}
                ref={(el) => { itemRefs.current[preset.id] = el }}
              >
                {preset.preview_video_url ? (
                  <video
                    ref={(el) => { videoRefs.current[preset.id] = el }}
                    data-preset-id={preset.id}
                    src={loadedIds.has(preset.id) ? preset.preview_video_url : undefined}
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
