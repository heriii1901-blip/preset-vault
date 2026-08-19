import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import { creatorNameStyle } from '../utils/creatorFont'
import PresetVideoCell from '../components/PresetVideoCell'

const THUMB_COLORS = [
  'linear-gradient(135deg,#7C5CFF,#4A32C9)',
  'linear-gradient(135deg,#FF3D7F,#C91E5A)',
  'linear-gradient(135deg,#D4FF3D,#8FB800)',
  'linear-gradient(135deg,#7C5CFF,#FF3D7F)',
  'linear-gradient(135deg,#4A32C9,#15151D)',
]
function colorFor(username) {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return THUMB_COLORS[Math.abs(hash) % THUMB_COLORS.length]
}

export default function KreatorPresets() {
  const { creatorUsername } = useParams()
  const navigate = useNavigate()
  const { getCache, setCache, clearCache } = usePresetCache()
  const cacheKey = `kreator-presets:${creatorUsername}`
  const cached = getCache(cacheKey)
  const [presets, setPresets] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const [creatorProfile, setCreatorProfile] = useState(null)
  const activeVideoRef = useRef(null)
  const gridRef = useRef(null)

  useEffect(() => {
    async function loadData() {
      if (getCache(cacheKey)) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .eq('creator_username', creatorUsername)
          .eq('link_pending', false)
          .order('created_at', { ascending: false })
        if (error) throw error
        setPresets(data || [])
        setCache(cacheKey, data || [])
      } catch (err) {
        console.error('Gagal ambil preset kreator:', err)
      } finally {
        setLoading(false)
      }
    }
    if (creatorUsername) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorUsername])

  useEffect(() => {
    async function loadCreatorProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_creator, tiktok_link, contact_link, bio, avatar_url, account_name, account_font, account_bold')
          .eq('creator_username', creatorUsername)
          .maybeSingle()
        if (error) throw error
        setCreatorProfile(data)
      } catch (err) {
        console.error('Gagal ambil profil kreator:', err)
      }
    }
    if (creatorUsername) loadCreatorProfile()
  }, [creatorUsername])

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
      <button
        className="back-btn ghost-static"
        style={{ margin: '14px 0 0 16px', width: 'fit-content' }}
        onClick={() => { clearCache(cacheKey); navigate(-1) }}
      >
        ← Balik
      </button>

      <div className="kreator-profile-header">
        {creatorProfile?.avatar_url ? (
          <img
            src={creatorProfile.avatar_url}
            alt=""
            className="kreator-profile-avatar"
            style={{ width: 72, height: 72, objectFit: 'cover' }}
          />
        ) : (
          <div className="kreator-profile-avatar" style={{ width: 72, height: 72, background: colorFor(creatorUsername) }}>
            {creatorUsername.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="kreator-profile-info">
          <h3 style={creatorProfile ? creatorNameStyle(creatorProfile.account_font, creatorProfile.account_bold) : undefined}>
            {creatorProfile?.account_name || `@${creatorUsername}`}
          </h3>
          {creatorProfile?.account_name && (
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>@{creatorUsername}</p>
          )}
          <p>{presets.length} preset</p>
          {creatorProfile?.bio && (
            <p style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4, color: 'var(--text)' }}>{creatorProfile.bio}</p>
          )}
          {creatorProfile?.is_creator && (creatorProfile?.contact_link || creatorProfile?.tiktok_link) && (
            <a
              href={creatorProfile.contact_link || creatorProfile.tiktok_link}
              target="_blank"
              rel="noreferrer"
              className="kreator-profile-link"
              onClick={(e) => e.stopPropagation()}
            >
              🔗 Link Kontak
            </a>
          )}
        </div>
      </div>

      {loading && (
        <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
      )}

      {!loading && presets.length === 0 && (
        <div className="empty-state" style={{ padding: 30 }}>Belum ada preset dari kreator ini.</div>
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
              showOverlay={false}
              onNavigate={(p) => navigate(`/preset/${p.id}`, { state: { source: 'kreator', creatorUsername } })}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}
