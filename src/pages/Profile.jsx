import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { BottomNav } from '../components/BottomNav'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Ambil nama bawaan dari data metadata Supabase Auth yang sudah ada sebelumnya
  const defaultName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Tanpa nama'

  const [profileName, setProfileName] = useState(defaultName)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [favorites, setFavorites] = useState([])
  const [loadingFavs, setLoadingFavs] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  const photoUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture

  // Update nama lokal jika data user auth berubah
  useEffect(() => {
    if (user) {
      setProfileName(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Tanpa nama')
    }
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
      // Mengubah user_metadata internal Supabase agar permanen meskipun di-logout
      const { data, error } = await supabase.auth.updateUser({
        data: { 
          full_name: trimmed,
          name: trimmed // Di-set dua-duanya biar aman
        }
      })
        
      if (error) throw error
      
      // Update state tampilan layar
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
            {editingName ? (
              <div className="name-edit-row">
                <input
                  className="name-edit-input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={40}
                  autoFocus
                />
                <button className="name-edit-save" onClick={saveName} disabled={savingName}>
                  {savingName ? '...' : '✓'}
                </button>
                <button className="name-edit-cancel" onClick={cancelEditName}>×</button>
              </div>
            ) : (
              <div className="name-display-row">
                <h4>{profileName}</h4>
                <button className="name-edit-trigger" onClick={startEditName} aria-label="Ubah nama">✎</button>
              </div>
            )}
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
                >
                  {preset.preview_video_url ? (
                    <video
                      src={preset.preview_video_url}
                      muted
                      preload="metadata"
                      playsInline
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget
                        if (video.currentTime === 0) video.currentTime = 2.5
                      }}
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

        <button className="logout-btn" onClick={handleLogout}>
          Keluar Akun
        </button>
      </div>

      {menuOpen && (
        <div className="profile-menu-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="profile-menu-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="profile-menu-header">
              <span>Menu</span>
              <button type="button" className="link-modal-close" onClick={() => setMenuOpen(false)}>×</button>
            </div>
            <button type="button" className="profile-menu-item">Pengaturan</button>
            <button type="button" className="profile-menu-item">Bahasa</button>
            <button type="button" className="profile-menu-item">Tentang Aplikasi</button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
