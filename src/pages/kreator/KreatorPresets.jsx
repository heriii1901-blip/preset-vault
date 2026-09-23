import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../supabase'
import { usePresetCache } from '../../context/PresetCacheContext'
import { creatorNameStyle } from '../../utils/creatorFont'
import { useSwipePages } from '../../hooks/useSwipePages'
import { useTabIndicator } from '../../hooks/useTabIndicator'
import PresetVideoCell from '../../components/PresetVideoCell'
import ProfileTabIcon from '../../components/ProfileTabIcon'
import AvatarViewer from '../../components/AvatarViewer'
import { safeHref } from '../../utils/safeUrl'

// Tab bar publik disamain sama tab bar di Profil sendiri. Tiap tab dikunci ke
// key privasi yang sama kayak di Pengaturan > Privasi (profiles.privacy).
const TAB_KEYS = ['postingan', 'favorit', 'efek', 'lagu', 'kreator']
const TAB_LABEL = {
  postingan: 'Postingan',
  favorit: 'Favorit',
  efek: 'Efek',
  lagu: 'Lagu',
  kreator: 'Kreator',
}
const PRIVACY_KEY_FOR = {
  postingan: 'uploads',
  favorit: 'liked_videos',
  efek: 'liked_effects',
  lagu: 'liked_songs',
  kreator: 'followed_creators',
}

// Badge mata-disilang, nempel di pojok atas ikon tab yang diprivasiin kreator
function EyeOffBadge() {
  return (
    <span className="profile-tab-private-badge" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="2.6" />
        <line x1="3" y1="21" x2="21" y2="3" />
      </svg>
    </span>
  )
}

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
  const [avatarOpen, setAvatarOpen] = useState(false)
  const activeVideoRef = useRef(null)
  const postinganPageRef = useRef(null)

  // Video favorit & efek favorit kreator ini — ada tabelnya (favorites), jadi
  // beneran ditampilin ke publik (kecuali di-privasiin). Lagu/Kreator belum
  // punya tabel sama sekali (belum ada fitur ikut-kreator/suka-lagu), jadi
  // masih placeholder di bawah, sama kayak di Profil sendiri.
  const [favPresets, setFavPresets] = useState([])
  const [favPresetsLoaded, setFavPresetsLoaded] = useState(false)
  const [loadingFavPresets, setLoadingFavPresets] = useState(false)
  const [favEffects, setFavEffects] = useState([])
  const [favEffectsLoaded, setFavEffectsLoaded] = useState(false)
  const [loadingFavEffects, setLoadingFavEffects] = useState(false)

  const privacy = creatorProfile?.privacy || {}
  const isTabPrivate = (key) => !!privacy[PRIVACY_KEY_FOR[key]]

  const tabCount = TAB_KEYS.length
  const { activeIndex: activeTab, progress: tabProgress, trackStyle, scrollerRef, goTo: goToTab, touchHandlers } = useSwipePages(tabCount)
  const { containerRef: tabsRef, tabRefs, indicatorStyle, getTabColor } = useTabIndicator(tabProgress, tabCount)

  // Reset data favorit pas ganti-ganti halaman kreator (biar gak ketuker punya kreator lain)
  useEffect(() => {
    setFavPresets([])
    setFavPresetsLoaded(false)
    setFavEffects([])
    setFavEffectsLoaded(false)
  }, [creatorUsername])

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
          .select('id, is_creator, tiktok_link, contact_link, bio, avatar_url, account_name, account_font, account_bold, privacy')
          .eq('creator_username', creatorUsername)
          .maybeSingle()
        if (error) throw error
        if (data) {
          setCreatorProfile(data)
          return
        }
        // Bukan kreator terdaftar -> coba kreator khusus (ditambah admin)
        const { data: guest, error: guestErr } = await supabase
          .from('guest_creators')
          .select('display_name, bio, avatar_url, tiktok_link')
          .eq('creator_username', creatorUsername)
          .maybeSingle()
        if (guestErr) throw guestErr
        setCreatorProfile(
          guest
            ? {
                is_guest: true,
                account_name: guest.display_name,
                bio: guest.bio,
                avatar_url: guest.avatar_url,
                tiktok_link: guest.tiktok_link,
              }
            : null
        )
      } catch (err) {
        console.error('Gagal ambil profil kreator:', err)
      }
    }
    if (creatorUsername) loadCreatorProfile()
  }, [creatorUsername])

  // Tombol share: bagiin link halaman kreator ini
  async function handleShareCreator() {
    const url = `${window.location.origin}/kreator/${creatorUsername}`
    const name = creatorProfile?.account_name || `@${creatorUsername}`
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `Lihat preset dari ${name} di PAM`, url })
      } catch (err) {
        if (err?.name !== 'AbortError') console.error('Gagal share kreator:', err)
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      alert('Link kreator disalin.')
    } catch (err) {
      console.error('Gagal salin link kreator:', err)
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
    video.play().catch(() => {})
    activeVideoRef.current = video
  }

  function handleHoverEnd(video) {
    resetToCover(video)
    if (activeVideoRef.current === video) activeVideoRef.current = null
  }

  useEffect(() => {
    const page = postinganPageRef.current
    if (!page) return
    const onScroll = () => {
      resetToCover(activeVideoRef.current)
      activeVideoRef.current = null
    }
    page.addEventListener('scroll', onScroll, { passive: true })
    return () => page.removeEventListener('scroll', onScroll)
  }, [])

  // Video favorit kreator ini, publik (dipake tab index 1 = 'favorit').
  // Guard "kalau udah loaded -> return" bikin ini cuma jalan sekali per kunjungan
  // halaman kreator (gak query ulang tiap render/swipe), jadi egress aman.
  useEffect(() => {
    if (activeTab !== TAB_KEYS.indexOf('favorit')) return
    if (favPresetsLoaded) return
    if (!creatorProfile?.id || isTabPrivate('favorit')) return
    let cancelled = false
    async function loadFavPresets() {
      setLoadingFavPresets(true)
      try {
        const { data, error } = await supabase
          .from('favorites')
          .select(`
            preset_id,
            presets:preset_id (
              id,
              preview_video_url,
              cover_url,
              creator_username,
              song_id,
              songs:song_id (name)
            )
          `)
          .eq('user_id', creatorProfile.id)
          .not('preset_id', 'is', null)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (cancelled) return
        const clean = (data || []).map((f) => f.presets).filter((p) => p !== null && p !== undefined)
        setFavPresets(clean)
      } catch (err) {
        console.error('Gagal ambil video favorit kreator:', err)
      } finally {
        if (!cancelled) {
          setLoadingFavPresets(false)
          setFavPresetsLoaded(true)
        }
      }
    }
    loadFavPresets()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, favPresetsLoaded, creatorProfile])

  // Efek favorit kreator ini, publik (tab index 2 = 'efek'). Query 2 tahap kayak
  // di Profile.jsx (kolom effect_id belum ada FK ke effects). Guard sama kayak di atas.
  useEffect(() => {
    if (activeTab !== TAB_KEYS.indexOf('efek')) return
    if (favEffectsLoaded) return
    if (!creatorProfile?.id || isTabPrivate('efek')) return
    let cancelled = false
    async function loadFavEffects() {
      setLoadingFavEffects(true)
      try {
        const { data: favRows, error: favError } = await supabase
          .from('favorites')
          .select('effect_id, created_at')
          .eq('user_id', creatorProfile.id)
          .not('effect_id', 'is', null)
          .order('created_at', { ascending: false })
        if (favError) throw favError

        const effectIds = (favRows || []).map((f) => f.effect_id)
        if (effectIds.length === 0) {
          if (!cancelled) setFavEffects([])
          return
        }

        const { data: effectsData, error: effectsError } = await supabase
          .from('effects')
          .select('id, title, preview_video_url, cover_url')
          .in('id', effectIds)
        if (effectsError) throw effectsError

        const effectsById = new Map((effectsData || []).map((e) => [e.id, e]))
        const ordered = effectIds.map((id) => effectsById.get(id)).filter((e) => e !== undefined)
        if (!cancelled) setFavEffects(ordered)
      } catch (err) {
        console.error('Gagal ambil efek favorit kreator:', err)
      } finally {
        if (!cancelled) {
          setLoadingFavEffects(false)
          setFavEffectsLoaded(true)
        }
      }
    }
    loadFavEffects()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, favEffectsLoaded, creatorProfile])

  return (
    <div className="screen">
      <div className="topbar-row">
        <button
          className="back-btn ghost-static"
          onClick={() => { clearCache(cacheKey); navigate(-1) }}
        >
          ← Balik
        </button>
        <button type="button" className="share-icon-btn" onClick={handleShareCreator} aria-label="Bagikan kreator">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
          </svg>
        </button>
      </div>

      <div className="kreator-profile-header">
        {creatorProfile?.avatar_url ? (
          <img
            src={creatorProfile.avatar_url}
            alt=""
            className="kreator-profile-avatar"
            style={{ width: 72, height: 72, objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => setAvatarOpen(true)}
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
          {(creatorProfile?.is_creator || creatorProfile?.is_guest) && (creatorProfile?.contact_link || creatorProfile?.tiktok_link) && (
           <a
              href={safeHref(creatorProfile.contact_link || creatorProfile.tiktok_link)}
              target="_blank"
              rel="noreferrer"
              className="kreator-profile-link"
              onClick={(e) => e.stopPropagation()}
            >
              {creatorProfile.is_guest ? '🔗 TikTok' : '🔗 Link Kontak'}
            </a>
          )}
        </div>
      </div>

      <AvatarViewer open={avatarOpen} src={creatorProfile?.avatar_url} onClose={() => setAvatarOpen(false)} />

      <div className="profile-tabs" ref={tabsRef} style={{ marginTop: 16 }}>
        <div className="tab-indicator" style={indicatorStyle} />
        {TAB_KEYS.map((key, i) => {
          const isPrivate = isTabPrivate(key)
          return (
            <button
              key={key}
              ref={(el) => (tabRefs.current[i] = el)}
              type="button"
              className={`profile-tab${activeTab === i ? ' is-active' : ''}`}
              style={{ color: getTabColor(i) }}
              onClick={() => goToTab(i)}
              aria-label={isPrivate ? `${TAB_LABEL[key]} (diprivasi)` : TAB_LABEL[key]}
              title={isPrivate ? `${TAB_LABEL[key]} (diprivasi)` : TAB_LABEL[key]}
            >
              <span className="profile-tab-icon-wrap">
                <ProfileTabIcon name={key} active={activeTab === i} />
                {isPrivate && <EyeOffBadge />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="profile-tabs-scroller" ref={scrollerRef}>
        <div className="profile-tabs-track" style={trackStyle} {...touchHandlers}>
          {TAB_KEYS.map((key) => (
            <div
              className="profile-tab-page"
              key={key}
              ref={key === 'postingan' ? postinganPageRef : undefined}
            >
              {isTabPrivate(key) ? (
                <div className="empty-state" style={{ padding: 30 }}>
                  🔒 {TAB_LABEL[key]} diprivasi oleh kreator ini.
                </div>
              ) : key === 'postingan' ? (
                <>
                  {loading && <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>}
                  {!loading && presets.length === 0 && (
                    <div className="empty-state" style={{ padding: 30 }}>Belum ada preset dari kreator ini.</div>
                  )}
                  {!loading && presets.length > 0 && (
                    <div className="preset-grid" style={{ flex: 'none' }}>
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
                </>
              ) : key === 'favorit' ? (
                <>
                  {loadingFavPresets && <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>}
                  {!loadingFavPresets && favPresetsLoaded && favPresets.length === 0 && (
                    <div className="empty-state" style={{ padding: 30 }}>Belum ada video yang di-favoritin kreator ini.</div>
                  )}
                  {!loadingFavPresets && favPresets.length > 0 && (
                    <div className="preset-grid" style={{ flex: 'none' }}>
                      {favPresets.map((preset, i) => (
                        <PresetVideoCell
                          key={preset.id}
                          preset={preset}
                          index={i}
                          getCache={getCache}
                          setCache={setCache}
                          showOverlay={false}
                          onNavigate={(p) => navigate(`/preset/${p.id}`, { state: { source: 'kreator-favorit', creatorUsername, favUserId: creatorProfile?.id } })}
                          onHoverStart={handleHoverStart}
                          onHoverEnd={handleHoverEnd}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : key === 'efek' ? (
                <>
                  {loadingFavEffects && <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>}
                  {!loadingFavEffects && favEffectsLoaded && favEffects.length === 0 && (
                    <div className="empty-state" style={{ padding: 30 }}>Belum ada efek yang di-favoritin kreator ini.</div>
                  )}
                  {!loadingFavEffects && favEffects.length > 0 && (
                    <div className="preset-grid" style={{ flex: 'none' }}>
                      {favEffects.map((effect) => (
                        <div
                          key={effect.id}
                          className="grid-cell"
                          onClick={() => navigate(`/efek/${effect.id}`)}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          {effect.preview_video_url ? (
                            <video src={effect.preview_video_url} muted loop preload="metadata" playsInline draggable={false} poster={effect.cover_url} />
                          ) : (
                            <div className="grid-fallback">🎬</div>
                          )}
                          <div className="grid-cell-overlay">{effect.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ padding: 30 }}>Belum ada isinya, segera hadir.</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
