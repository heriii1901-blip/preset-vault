import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import PresetVideoCell from '../components/PresetVideoCell'

const CACHE_KEY = 'terbaru'
const COLLAPSE_DISTANCE = 120 // px scroll sampe banner+search bar collapse penuh

export default function Terbaru() {
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()
  const cached = getCache(CACHE_KEY)
  const [presets, setPresets] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const activeVideoRef = useRef(null)
  const collapseRef = useRef(null)
  const collapseMaxHeightRef = useRef(0)
  const rafRef = useRef(null)

  const [linkQuery, setLinkQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchStatus, setSearchStatus] = useState(null)

  // Query ini cuma jalan sekali pas mount (deps kosong), limit 20 tetep dipertahanin,
  // gak ada resiko query berulang/loop.
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

  useEffect(() => {
    if (collapseRef.current) {
      collapseMaxHeightRef.current = collapseRef.current.offsetHeight
    }
  }, [])

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

  // Banner + search bar collapse ngikutin scroll grid di bawahnya.
  // Ditulis langsung ke DOM lewat ref (bukan setState) biar gak trigger
  // re-render tiap tick scroll - dibungkus requestAnimationFrame biar smooth.
  function handleGridScroll(e) {
    if (rafRef.current) return
    const scrollTop = e.currentTarget.scrollTop
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const el = collapseRef.current
      if (!el) return
      const maxHeight = collapseMaxHeightRef.current || 1
      const ratio = Math.min(scrollTop / COLLAPSE_DISTANCE, 1)
      el.style.height = `${maxHeight * (1 - ratio)}px`
      el.style.opacity = `${1 - ratio}`
    })
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
      // Ambil ID video panjang dari link kalo ada, biar toleran ke variasi
      // link (share link, query param, dll) - bukan cuma exact match string.
      const idMatch = raw.match(/(\d{15,20})/)
      const term = idMatch ? idMatch[1] : raw
      const { data, error } = await supabase
        .from('presets')
        .select('id')
        .ilike('tiktok_link', `%${term}%`)
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
        <div className="terbaru-collapse" ref={collapseRef}>
          <div className="terbaru-banner">
            <img
              src="/terbaru-banner.jpg"
              alt=""
              draggable={false}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>
          <div className="terbaru-search-wrap">
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
        </div>

        <div className="grid-header">
          <div>
            <h3 className="grid-header-title-lg">Terbaru</h3>
          </div>
        </div>

        {loading && (
          <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
        )}

        {!loading && presets.length === 0 && (
          <div className="empty-state" style={{ padding: 30 }}>Belum ada preset terbaru.</div>
        )}

        {!loading && presets.length > 0 && (
          <div className="preset-grid" onScroll={handleGridScroll}>
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
  )
}
