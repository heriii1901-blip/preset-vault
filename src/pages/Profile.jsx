import { isRunningAsApk } from '../utils/isTWA'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'

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
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()

  // Ambil nama bawaan dari data metadata Supabase Auth yang sudah ada sebelumnya
  const fallbackName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Tanpa nama'

  const [profileName, setProfileName] = useState(fallbackName)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [favorites, setFavorites] = useState([])
  const [loadingFavs, setLoadingFavs] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [pendingSongCount, setPendingSongCount] = useState(0)
  const isApk = isRunningAsApk()
  const activeVideoRef = useRef(null)

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
  
  const photoUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture

  // Update nama lokal jika data user auth berubah
  useEffect(() => {
  async function loadProfileName() {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setProfileName(data?.username || fallbackName)
    } catch (err) {
      console.error('Gagal ambil username profile:', err)
      setProfileName(fallbackName)
    }
  }
  loadProfileName()
}, [user])

  // Jumlah permintaan lagu yang belum direview (buat badge, admin doang)
  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('song_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count, error }) => {
        if (error) return console.error('Gagal ambil jumlah permintaan lagu:', error)
        setPendingSongCount(count || 0)
      })
  }, [isAdmin])

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

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const startEditName = () => {
    setNameInput(profileName)
    setEditingName(true)
  }

  const cancelEditName = () => {
    setEditingName(false)
  }

  // Fungsi simpan nama langsung ke metadata Supabase Auth agar permanen melekat di akun
  const saveName = async () => {
  const trimmed = nameInput.trim()
  if (!trimmed) return
  setSavingName(true)
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', user.id)

    if (error) throw error

    setProfileName(trimmed)
    setEditingName(false)
  } catch (err) {
    console.error('Gagal ubah nama:', err)
    alert('Gagal ubah nama, silakan coba lagi.')
  } finally {
    setSavingName(false)
  }
}

  const initials = (profileName || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

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
            <img className="avatar-img" src={photoUrl} alt="Foto profil" />
          ) : (
            <div className="avatar">{initials}</div>
          )}
          <div className="profile-info">
            <h4>{profileName}</h4>
            <p>{user?.email}</p>
          </div>
        </div>
        
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

        {!loadingFavs && favorites.length > 0 && (
          <div className="preset-grid" style={{ flex: 'none' }}>
            {favorites.map((preset) => {
              return (
                <div
                  key={preset.id}
                  className="grid-cell"
                  onClick={() => navigate(`/preset/${preset.id}`)}
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
                  <div className="grid-cell-overlay">
                    {preset.songs?.name || 'Unknown Song'} · @{preset.creator_username}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </div>
      </div>

      <div className={`profile-menu-backdrop${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)}>
        <div className={`profile-menu-drawer${menuOpen ? ' is-open' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="profile-menu-header">
            <span>Menu</span>
            <button type="button" className="link-modal-close" onClick={() => setMenuOpen(false)}>×</button>
          </div>

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

          {isAdmin && (
            <button type="button" className="profile-menu-item" onClick={() => { setMenuOpen(false); navigate('/admin/song-requests') }}>
              <svg className="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="profile-menu-label">Permintaan Lagu</span>
              {pendingSongCount > 0 && <span className="profile-menu-badge">{pendingSongCount}</span>}
              <svg className="profile-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
            </button>
          )}

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
