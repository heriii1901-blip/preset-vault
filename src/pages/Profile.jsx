import { isRunningAsApk } from '../utils/isTWA'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import { creatorNameStyle } from '../utils/creatorFont'

const COVER_TIME = 2

function captureThumb(video, presetId, setCache) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    if (!canvas.width || !canvas.height) return
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    setCache(`thumb:${presetId}`, canvas.toDataURL('image/jpeg', 0.6))
  } catch {
    // video beda origin tanpa izin CORS baca pixel, skip aja
  }
}

export default function Profile() {
  const { user, logout, isAdmin, isCreator, creatorUsername } = useAuth()
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()

  const fallbackName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Tanpa nama'

  const [profile, setProfile] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [loadingFavs, setLoadingFavs] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const isApk = isRunningAsApk()
  const activeVideoRef = useRef(null)

  // Tab Postingan/Favorit (cuma kreator yang punya postingan sendiri)
  const [activeTab, setActiveTab] = useState(0)
  const scrollerRef = useRef(null)

  const ownCacheKey = isCreator && creatorUsername ? `own-presets:${creatorUsername}` : null
  const cachedOwn = ownCacheKey ? getCache(ownCacheKey) : null
  const [ownPresets, setOwnPresets] = useState(cachedOwn?.data || [])
  const [loadingOwn, setLoadingOwn] = useState(false)

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

  // Ambil data profile (nama, bio, link kontak, avatar custom)
  useEffect(() => {
    async function loadProfile() {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, account_name, account_font, account_bold, bio, contact_link, avatar_url')
          .eq('id', user.id)
          .single()
        if (error) throw error
        setProfile(data)
      } catch (err) {
        console.error('Gagal ambil data profile:', err)
      }
    }
    loadProfile()
  }, [user])

  // Load data Favorit
  useEffect(() => {
    async function loadFavorites() {
      if (!user) return
      setLoadingFavs(true)
      try {
        const { data, error } = await supabase
          .from('favorites')
          .select(`
            preset_id,
            presets:preset_id (
              id,
              preview_video_url,
              creator_username,
              song_id,
              songs:song_id (name)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        const cleanFavs = (data || [])
          .map(f => f.presets)
          .filter(p => p !== null && p !== undefined)

        setFavorites(cleanFavs)
      } catch (err) {
        console.error('Gagal ambil favorit:', err)
      } finally {
        setLoadingFavs(false)
      }
    }

    loadFavorites()
  }, [user])

  // Load preset yang di-upload sendiri (khusus kreator), dishare cache-nya sama halaman Kreator
  useEffect(() => {
    if (!isCreator || !creatorUsername) return
    if (getCache(`own-presets:${creatorUsername}`)) return
    async function loadOwnPresets() {
      setLoadingOwn(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .eq('creator_username', creatorUsername)
          .order('created_at', { ascending: false })
        if (error) throw error
        setOwnPresets(data || [])
        setCache(`own-presets:${creatorUsername}`, data || [])
      } catch (err) {
        console.error('Gagal ambil preset kamu:', err)
      } finally {
        setLoadingOwn(false)
      }
    }
    loadOwnPresets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, creatorUsername])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  function goToTab(index) {
    setActiveTab(index)
    const el = scrollerRef.current
    if (el) el.scrollTo({ left: el.clientWidth * index, behavior: 'smooth' })
  }

  function handleTabScroll(e) {
    const el = e.currentTarget
    const index = Math.round(el.scrollLeft / el.clientWidth)
    if (index !== activeTab) setActiveTab(index)
  }

  const displayName = isCreator
    ? (profile?.account_name || (creatorUsername ? `@${creatorUsername}` : fallbackName))
    : (profile?.username || fallbackName)

  const nameStyle = isCreator ? creatorNameStyle(profile?.account_font, profile?.account_bold) : undefined

  const photoUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture

  const initials = (displayName || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function renderGrid(list, navState) {
    return (
      <div className="preset-grid" style={{ flex: 'none' }}>
        {list.map((preset) => (
          <div
            key={preset.id}
            className="grid-cell"
            onClick={() => navigate(`/preset/${preset.id}`, navState ? { state: navState } : undefined)}
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
                preload="metadata"
                playsInline
                disablePictureInPicture
                controlsList="nodownload"
                draggable={false}
                poster={getCache(`thumb:${preset.id}`)?.data}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget
                  if (video.currentTime === 0) video.currentTime = COVER_TIME
                }}
                onSeeked={(e) => captureThumb(e.currentTarget, preset.id, setCache)}
              />
            ) : (
              <div className="grid-fallback">🎬</div>
            )}
            {preset.songs && (
              <div className="grid-cell-overlay">
                {preset.songs?.name || 'Unknown Song'} · @{preset.creator_username}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="profile-content">
        <button
          type="button"
          className="profile-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>

        <div className="profile-header">
          {photoUrl ? (
            <img className="avatar-img" style={{ width: 76, height: 76 }} src={photoUrl} alt="Foto profil" />
          ) : (
            <div className="avatar" style={{ width: 76, height: 76, fontSize: 22 }}>{initials}</div>
          )}
          <div className="profile-info">
            <h4 style={nameStyle}>{displayName}</h4>
            {isCreator ? (
              <p>@{creatorUsername}</p>
            ) : (
              <p>{user?.email}</p>
            )}
            {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
            {isCreator && profile?.contact_link && (
              
                href={profile.contact_link}
                target="_blank"
                rel="noreferrer"
                className="profile-link"
                onClick={(e) => e.stopPropagation()}
              >
                🔗 Link Kontak
              </a>
            )}
          </div>
        </div>

        <button type="button" className="profile-edit-btn" onClick={() => navigate('/edit-profil')}>
          Edit Profil
        </button>

        {isCreator ? (
          <>
            <div className="profile-tabs">
              <button
                type="button"
                className={`profile-tab${activeTab === 0 ? ' is-active' : ''}`}
                onClick={() => goToTab(0)}
              >
                Postingan
              </button>
              <button
                type="button"
                className={`profile-tab${activeTab === 1 ? ' is-active' : ''}`}
                onClick={() => goToTab(1)}
              >
                Favorit
              </button>
            </div>

            <div className="profile-tabs-scroller" ref={scrollerRef} onScroll={handleTabScroll}>
              <div className="profile-tab-page">
                {loadingOwn && <div className="empty-state">Memuat...</div>}
                {!loadingOwn && ownPresets.length === 0 && (
                  <div className="empty-state">Kamu belum upload preset apapun.</div>
                )}
                {!loadingOwn && ownPresets.length > 0 &&
                  renderGrid(ownPresets, { source: 'kreator', creatorUsername })}
              </div>

              <div className="profile-tab-page">
                {loadingFavs && <div className="empty-state">Memuat...</div>}
                {!loadingFavs && favorites.length === 0 && (
                  <div className="empty-state">
                    Belum ada preset yang di-favoritin. Pencet ikon ♡ di halaman video buat nyimpen.
                  </div>
                )}
                {!loadingFavs && favorites.length > 0 && renderGrid(favorites)}
              </div>
            </div>
          </>
        ) : (
          <div className="profile-scroll">
            <div className="section-label">
              <span className="eyebrow" style={{ color: 'var(--lime)' }}>TERSIMPAN</span>
              <h4>Preset Favorit</h4>
            </div>

            {loadingFavs && <div className="empty-state">Memuat...</div>}

            {!loadingFavs && favorites.length === 0 && (
              <div className="empty-state">
                Belum ada preset yang di-favoritin. Pencet ikon ♡ di halaman video buat nyimpen.
              </div>
            )}

            {!loadingFavs && favorites.length > 0 && renderGrid(favorites)}
          </div>
        )}
      </div>

      <div className={`profile-menu-backdrop${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)}>
        <div className={`profile-menu-drawer${menuOpen ? ' is-open' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="profile-menu-header">
            <span>Menu</span>
            <button type="button" className="link-modal-close" onClick={() => setMenuOpen(false)}>×</button>
          </div>

          <button type="button" className="profile-menu-item" onClick={() => { setMenuOpen(false); navigate('/edit-profil') }}>
            <svg className="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <span className="profile-menu-label">Edit Profil</span>
            <svg className="profile-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
          </button>

          <button type="button" className="profile-menu-item" onClick={() => alert('Coming Soon')}>
            <svg className="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="profile-menu-label">Pengaturan</span>
            <svg className="profile-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
          </button>

          <button type="button" className="profile-menu-item" onClick={() => alert('Coming Soon')}>
            <svg className="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="profile-menu-label">Bahasa</span>
            <svg className="profile-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
          </button>

          <button type="button" className="profile-menu-item" onClick={() => { setMenuOpen(false); setAboutOpen(true) }}>
            <svg className="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="profile-menu-label">Tentang Aplikasi</span>
            <svg className="profile-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
          </button>

          <button type="button" className="profile-menu-item" onClick={() => { setMenuOpen(false); navigate('/daftar-kreator') }}>
            <svg className="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="profile-menu-label">Kreator</span>
            <svg className="profile-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
          </button>

          {!isApk && (
            <button
              type="button"
              className="profile-menu-item"
              onClick={() => window.open('https://sl1nk.com/pam-v1-0-0')}
            >
              <svg className="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="profile-menu-label">Download Apk</span>
              <svg className="profile-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
            </button>
          )}

          <button
            type="button"
            className="profile-menu-item profile-menu-item-danger"
            onClick={() => { setMenuOpen(false); handleLogout() }}
          >
            <svg className="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="profile-menu-label">Keluar Akun</span>
          </button>
        </div>
      </div>

      {aboutOpen && (
        <div className="link-modal-backdrop" onClick={() => setAboutOpen(false)}>
          <div className="link-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="link-modal-header">
              <span>Tentang Aplikasi</span>
              <button type="button" className="link-modal-close" onClick={() => setAboutOpen(false)}>×</button>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 0 18px' }}>
              <h3 style={{ fontSize: 20, marginBottom: 4 }}>PAM</h3>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Preset Alight Motion</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Versi 1.0.0</p>
              <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>kalo masih suka bug login ulang aja</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
