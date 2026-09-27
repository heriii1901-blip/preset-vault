import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { usePresetCache } from '../context/PresetCacheContext'
import PresetVideoCell from '../components/PresetVideoCell'
import { resolveTiktokVideoId } from '../utils/tiktokLink'
import { useSwipePages } from '../hooks/useSwipePages'
import { useTabIndicator } from '../hooks/useTabIndicator'
import { useCachedImage } from '../hooks/useCachedImage'

const CACHE_KEY = 'terbaru'
const TRENDING_CACHE_KEY = 'terbaru-trending'
const SEARCH_COLLAPSE_DISTANCE = 120
const LERP_FACTOR = 0.18 // laju di ~60fps; dinormalisasi ke deltaTime di tick()

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}

export default function Terbaru() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { getCache, setCache } = usePresetCache()
  const [wallpaperUrl, setWallpaperUrl] = useState(null)
  const cachedWallpaperUrl = useCachedImage(wallpaperUrl)
  const cached = getCache(CACHE_KEY)
  const [presets, setPresets] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)

  // Tab Terbaru/Trending
  const { activeIndex: activeTab, progress: tabProgress, trackStyle: tabTrackStyle, scrollerRef: tabViewportRef, goTo: goToTab, touchHandlers: tabTouchHandlers } = useSwipePages(2)
  const { containerRef: tabBarRef, tabRefs, indicatorStyle: tabIndicatorStyle, getTabColor } = useTabIndicator(tabProgress, 2)
  const trendingCached = getCache(TRENDING_CACHE_KEY)
  const [trendingPresets, setTrendingPresets] = useState(trendingCached?.data || [])
  const [loadingTrending, setLoadingTrending] = useState(!trendingCached)
  const [trendingMsg, setTrendingMsg] = useState('')
  const trendingMsgTimerRef = useRef(null)

  const bannerRef = useRef(null)
  const searchRef = useRef(null)
  const scrollTargetRef = useRef(0)
  const searchCurrentRef = useRef(0)
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
          .eq('hide_from_latest', false)
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

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

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

  useEffect(() => {
    async function loadTrendingPresets() {
      if (!getCache(TRENDING_CACHE_KEY)) setLoadingTrending(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .eq('link_pending', false)
          .eq('is_trending', true)
          .order('created_at', { ascending: false })
        if (error) throw error
        setTrendingPresets(data || [])
        setCache(TRENDING_CACHE_KEY, data || [])
      } catch (err) {
        console.error('Gagal ambil preset trending:', err)
      } finally {
        setLoadingTrending(false)
      }
    }
    loadTrendingPresets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function flashTrendingMsg(text) {
    setTrendingMsg(text)
    clearTimeout(trendingMsgTimerRef.current)
    trendingMsgTimerRef.current = setTimeout(() => setTrendingMsg(''), 2000)
  }

  async function handleAddToTrending(preset) {
    if (!isAdmin || preset.is_trending) return
    setTrendingPresets((prev) => [preset, ...prev])
    flashTrendingMsg('✅ Dimasukin ke Trending')
    const { error } = await supabase.from('presets').update({ is_trending: true }).eq('id', preset.id)
    if (error) {
      console.error('Gagal masukin ke trending:', error)
      setTrendingPresets((prev) => prev.filter((p) => p.id !== preset.id))
      flashTrendingMsg('❌ Gagal, coba lagi')
    }
  }

  async function handleRemoveFromTrending(preset) {
    if (!isAdmin) return
    setTrendingPresets((prev) => prev.filter((p) => p.id !== preset.id))
    flashTrendingMsg('🗑️ Dikeluarin dari Trending')
    const { error } = await supabase.from('presets').update({ is_trending: false }).eq('id', preset.id)
    if (error) {
      console.error('Gagal keluarin dari trending:', error)
      setTrendingPresets((prev) => [preset, ...prev])
      flashTrendingMsg('❌ Gagal, coba lagi')
    }
  }

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

  function tick(timestamp) {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp
    const dt = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp

    // Dinormalisasi ke deltaTime biar kecepatan animasinya konsisten
    // di refresh rate berapa pun (60/90/120Hz).
    const smoothing = 1 - Math.pow(1 - LERP_FACTOR, dt / 16.67)

    const scrollTop = scrollTargetRef.current
    const searchTarget = easeOutCubic(Math.min(scrollTop / SEARCH_COLLAPSE_DISTANCE, 1))

    searchCurrentRef.current += (searchTarget - searchCurrentRef.current) * smoothing

    const sVal = searchCurrentRef.current

    // Mengecil + naik ke atas + lenyap + larut (blur), barengan.
    const sEl = searchRef.current
    if (sEl) {
      sEl.style.transform = `scale(${1 - sVal * 0.24}) translateY(${-sVal * 50}px)`
      
      // Bikin variabel baru khusus efek pudar yang dilambatin
      const lambatPudar = 1 - (sVal * sVal);
      
      sEl.style.opacity = `${Math.max(0, lambatPudar)}`
      sEl.style.pointerEvents = sVal > 0.8 ? 'none' : 'auto'
      
      // Blok hitam juga dipakein rumus yang sama
      sEl.parentElement.style.background = `color-mix(in srgb, var(--bg) ${Math.max(0, lambatPudar) * 100}%, transparent)`
    }

    // Banner (area gelap + judul Terbaru) lenyap barengan, kurvanya disamain sm search bar.
    const bEl = bannerRef.current
    if (bEl) {
      bEl.style.opacity = `${Math.max(0, 1 - sVal * 1)}`
    }

    const stillMoving = Math.abs(searchTarget - sVal) > 0.001

    if (stillMoving) {
      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      animFrameRef.current = null
    }
  }

  function handleGridScroll(e) {
    scrollTargetRef.current = e.currentTarget.scrollTop
    if (!animFrameRef.current) {
      lastTimeRef.current = 0
      animFrameRef.current = requestAnimationFrame(tick)
    }
  }

  // Tombol papan klip: tempel teks dari clipboard ke kolom (kayak Ctrl+V)
  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text || !text.trim()) {
        setSearchStatus({ type: 'empty', text: 'Clipboard kosong, salin link TikTok dulu.' })
        return
      }
      setLinkQuery(text.trim())
      setSearchStatus(null)
    } catch {
      setSearchStatus({ type: 'error', text: 'Gak bisa baca clipboard, tempel manual aja ya.' })
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
      <div className="grid-page terbaru-page">
        <div className="terbaru-banner"> {/* Hapus ref dari sini */}
          <img
            src={cachedWallpaperUrl || '/terbaru-banner.jpg'}
            alt=""
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          {/* Pindahkan ref ke sini supaya cuma gradien gelapnya yang berefek */}
          <div className="terbaru-banner-gradient" ref={bannerRef} />
          <h3 className="terbaru-banner-title">Terbaru</h3>
        </div>

        <div className="terbaru-scroller" onScroll={handleGridScroll}>
          <div className="terbaru-spacer" />

          <div className="terbaru-sheet">
            <div className="terbaru-search-wrap" ref={searchRef}>
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
                  className="terbaru-paste-btn"
                  onClick={handlePaste}
                  aria-label="Tempel dari clipboard"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
                    <rect x="6" y="6" width="12" height="15" rx="2" />
                    <path d="M9 12h6M9 16h4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="terbaru-search-btn"
                  onClick={handleSearchByLink}
                  disabled={searching}
                  aria-label="Cari preset dari link"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </div>
              {searchStatus && (
                <p className={`terbaru-search-status terbaru-search-status--${searchStatus.type}`}>
                  {searchStatus.text}
                </p>
              )}
            </div>

            <div className="terbaru-tabbar" ref={tabBarRef}>
              <button
                type="button"
                ref={(el) => (tabRefs.current[0] = el)}
                className="terbaru-tab"
                style={{ color: getTabColor(0) }}
                onClick={() => goToTab(0)}
              >
                Terbaru
              </button>
              <button
                type="button"
                ref={(el) => (tabRefs.current[1] = el)}
                className="terbaru-tab"
                style={{ color: getTabColor(1) }}
                onClick={() => goToTab(1)}
              >
                Trending
              </button>
              <div className="terbaru-tabbar-indicator" style={tabIndicatorStyle} />
            </div>

            {trendingMsg && <p className="terbaru-trending-toast">{trendingMsg}</p>}

            <div className="terbaru-swipe-viewport" ref={tabViewportRef}>
              <div className="terbaru-swipe-track" style={tabTrackStyle} {...tabTouchHandlers}>
                <div className="terbaru-swipe-page">
                  {loading && (
                    <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
                  )}

                  {!loading && presets.length === 0 && (
                    <div className="empty-state" style={{ padding: 30 }}>Belum ada preset terbaru.</div>
                  )}

                  {!loading && presets.length > 0 && (
                    <div className="preset-grid preset-grid--static">
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
                          onLongPress={isAdmin ? handleAddToTrending : undefined}
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

                <div className="terbaru-swipe-page">
                  {loadingTrending && (
                    <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
                  )}

                  {!loadingTrending && trendingPresets.length === 0 && (
                    <div className="empty-state" style={{ padding: 30 }}>
                      Belum ada video trending.{isAdmin ? ' Tekan-tahan video di tab Terbaru buat masukin.' : ''}
                    </div>
                  )}

                  {!loadingTrending && trendingPresets.length > 0 && (
                    <div className="preset-grid preset-grid--static">
                      {trendingPresets.map((preset, i) => (
                        <PresetVideoCell
                          key={preset.id}
                          preset={preset}
                          index={i}
                          getCache={getCache}
                          setCache={setCache}
                          onNavigate={(p) => navigate(`/preset/${p.id}`, { state: { source: 'terbaru' } })}
                          onHoverStart={handleHoverStart}
                          onHoverEnd={handleHoverEnd}
                          onLongPress={isAdmin ? handleRemoveFromTrending : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
