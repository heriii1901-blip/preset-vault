import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { usePresetCache } from '../context/PresetCacheContext'
import PresetVideoCell from '../components/PresetVideoCell'
import { resolveTiktokVideoId } from '../utils/tiktokLink'

const CACHE_KEY = 'terbaru'
const BANNER_FADE_DISTANCE = 170
const LERP_FACTOR = 0.18 // laju di ~60fps; dinormalisasi pakai deltaTime di tick()

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}

export default function Terbaru() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getCache, setCache } = usePresetCache()
  const [wallpaperUrl, setWallpaperUrl] = useState(null)
  const cached = getCache(CACHE_KEY)
  const [presets, setPresets] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)

  const bannerRef = useRef(null)
  const titleRef = useRef(null)
  const scrollTargetRef = useRef(0)
  const fadeCurrentRef = useRef(0)
  const animFrameRef = useRef(null)
  const lastTimeRef = useRef(0)

  const [linkQuery, setLinkQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchStatus, setSearchStatus] = useState(null)

  useEffect(() => {
    async function loadLatestPresets() {
      if (!getCache(CACHE_KEY)) setLoading(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .eq('link_pending', false)
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

  // Bersihin rAF loop pas komponen unmount biar gak nyangkut jalan di background.
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // Ambil wallpaper custom user (kalau ada). Cuma jalan pas user berubah
  // (login/ganti akun), sekali per sesi, gak ada resiko query berulang/loop.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    async function loadWallpaper() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('wallpaper_url')
          .eq('id', user.id)
          .single()
        if (error) throw error
        if (!cancelled) setWallpaperUrl(data?.wallpaper_url || null)
      } catch (err) {
        console.error('Gagal ambil wallpaper:', err)
      }
    }
    loadWallpaper()
    return () => { cancelled = true }
  }, [user?.id])

  function resetToCover(video) {
    if (!video) return
    video.pause()
    video.currentTime = 2
  }

  function handleHoverStart(video) {
    if (!video || activeVideoRef.current === video) return
    resetToCover(activeVideoRef.current)
    activeVideoRef.current = video

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

  function handleHoverEnd(video) {
    resetToCover(video)
    if (activeVideoRef.current === video) activeVideoRef.current = null
  }

  // Cuma ngurus fade+collapse banner. Search bar udah nempel sendiri
  // pakai CSS position:sticky, jadi gak butuh JS buat itu lagi.
  function tick(timestamp) {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp
    const dt = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp

    const scrollTop = scrollTargetRef.current
    const target = easeOutCubic(Math.min(scrollTop / BANNER_FADE_DISTANCE, 1))

    // Lerp dinormalisasi ke deltaTime biar kecepatannya konsisten
    // di refresh rate berapa pun (60/90/120Hz), gak kesat-kesat lagi.
    const smoothing = 1 - Math.pow(1 - LERP_FACTOR, dt / 16.67)
    fadeCurrentRef.current += (target - fadeCurrentRef.current) * smoothing

    const val = fadeCurrentRef.current

    if (bannerRef.current) {
      bannerRef.current.style.opacity = `${1 - val}`
      bannerRef.current.style.transform = `translateY(${-val * 24}px) scale(${1 - val * 0.06})`
    }
    if (titleRef.current) {
      const textVal = Math.min(val * 1.6, 1) // teks "Terbaru" pudar lebih cepat dari gambarnya
      titleRef.current.style.opacity = `${1 - textVal}`
    }

    if (Math.abs(target - val) > 0.001) {
      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      animFrameRef.current = null
    }
  }

  function handleScroll(e) {
    scrollTargetRef.current = e.currentTarget.scrollTop
    if (!animFrameRef.current) {
      lastTimeRef.current = 0
      animFrameRef.current = requestAnimationFrame(tick)
    }
  }

  async function handleSearchByLink() {
    const raw = linkQuery.trim()
    if (!raw) {
      setSearchStatus({ type: 'error', text: 'Tempel link TikTok dulu ya.' })
      return
    }
    setSearching(true)
    setSearchStatus({ type: 'loading', text: 'Nyari preset dari link...' })
    try {
      const term = await resolveTiktokVideoId(raw)
      if (!term) {
        setSearchStatus({ type: 'empty', text: 'Link gak valid atau gak bisa dibuka.' })
        setSearching(false)
        return
      }
      const { data, error } = await supabase
        .from('presets')
        .select('id')
        .eq('tiktok_video_id', term)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setSearchStatus(null)
        navigate(`/preset/${data.id}`, { state: { source: 'terbaru' } })
      } else {
        setSearchStatus({ type: 'empty', text: 'Belum ada preset dari link ini di PAM.' })
      }
    } catch (err) {
      console.error('Gagal cari preset dari link:', err)
      setSearchStatus({ type: 'error', text: 'Gagal nyari, coba lagi.' })
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="screen">
      <div className="grid-page">
        <div className="terbaru-scroll" onScroll={handleScroll}>
          <div className="terbaru-banner" ref={bannerRef}>
            <img
              src={wallpaperUrl || '/terbaru-banner.jpg'}
              alt=""
              draggable={false}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div className="terbaru-banner-gradient" />
            <h3 className="terbaru-banner-title" ref={titleRef}>Terbaru</h3>
          </div>

          <div className="terbaru-search-wrap">
            <div className="terbaru-search-glow" />
            <div className="terbaru-search-bar">
              <input
                type="text"
                placeholder="Tempel link TikTok di sini..."
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchByLink() }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
              />
              <button
                type="button"
                className="terbaru-search-btn"
                onClick={handleSearchByLink}
                disabled={searching}
                aria-label="Cari preset dari link"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
                  <rect x="6" y="6" width="12" height="15" rx="2" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
              </button>
            </div>
            {searchStatus && (
              <p className={`terbaru-search-status terbaru-search-status--${searchStatus.type}`}>
                {searchStatus.text}
              </p>
            )}
          </div>

          {loading && (
            <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
          )}

          {!loading && presets.length === 0 && (
            <div className="empty-state" style={{ padding: 30 }}>Belum ada preset terbaru.</div>
          )}

          {!loading && presets.length > 0 && (
            <div className="preset-grid">
              {presets.map((preset, i) => (
                <PresetVideoCell
                  key={preset.id}
                  preset={preset}
                  index={i}
                  getCache={getCache}
                  setCache={setCache}
                  onNavigate={(p) => navigate(`/preset/${p.id}`, { state: { source: 'terbaru' } })}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                />
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
    </div>
  )
}
