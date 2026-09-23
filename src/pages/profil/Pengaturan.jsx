import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { applyTheme, getTheme } from '../utils/theme'

const MoonIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

const SunIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4.5" />
    <line x1="12" y1="19.5" x2="12" y2="22" />
    <line x1="2" y1="12" x2="4.5" y2="12" />
    <line x1="19.5" y1="12" x2="22" y2="12" />
    <line x1="5" y1="5" x2="6.8" y2="6.8" />
    <line x1="17.2" y1="17.2" x2="19" y2="19" />
    <line x1="5" y1="19" x2="6.8" y2="17.2" />
    <line x1="17.2" y1="6.8" x2="19" y2="5" />
  </svg>
)

// Isi menu Privasi (kunci disimpan di kolom profiles.privacy)
const PRIVACY_ITEMS = [
  { key: 'uploads', label: 'Video diunggah' },
  { key: 'liked_videos', label: 'Video disukai' },
  { key: 'liked_effects', label: 'Efek disukai' },
  { key: 'liked_songs', label: 'Lagu disukai' },
  { key: 'followed_creators', label: 'Kreator diikuti' },
]

export default function Pengaturan() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [theme, setTheme] = useState(() => getTheme())
  const isLight = theme === 'light'
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [privacyLoaded, setPrivacyLoaded] = useState(false)
  const [privacy, setPrivacy] = useState({})

  function toggleTheme() {
    setTheme(applyTheme(isLight ? 'dark' : 'light'))
  }

  // Data privasi baru diambil pas menu Privasi pertama kali dibuka (hemat egress)
  useEffect(() => {
    if (!privacyOpen || privacyLoaded || !user) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('privacy')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Gagal ambil pengaturan privasi:', error)
        setPrivacy(data?.privacy || {})
        setPrivacyLoaded(true)
      })
    return () => { cancelled = true }
  }, [privacyOpen, privacyLoaded, user])

  async function togglePrivacy(key) {
    if (!user) return
    const before = privacy
    const next = { ...privacy, [key]: !privacy[key] }
    setPrivacy(next)
    const { error } = await supabase.from('profiles').update({ privacy: next }).eq('id', user.id)
    if (error) {
      console.error('Gagal simpan privasi:', error)
      setPrivacy(before)
      alert('Gagal menyimpan pengaturan privasi, coba lagi.')
    }
  }

  return (
    <div className="screen">
      <button
        className="back-btn ghost-static"
        style={{ margin: '14px 0 0 16px', width: 'fit-content' }}
        onClick={() => navigate(-1)}
      >
        ← Balik
      </button>

      <div className="admin-content" style={{ padding: '14px 18px 40px' }}>
        <div className="admin-header">
          <span className="admin-tag">PENGATURAN</span>
          <h2>Pengaturan</h2>
        </div>

        <div className="settings-list">
          <div className="settings-item">
            <span className="settings-title">Mode Tampilan</span>
            <button
              type="button"
              role="switch"
              aria-checked={isLight}
              aria-label="Ganti mode gelap atau cerah"
              className={`theme-toggle${isLight ? ' is-light' : ''}`}
              onClick={toggleTheme}
            >
              <MoonIcon className="theme-toggle-track-icon theme-toggle-track-icon--moon" />
              <SunIcon className="theme-toggle-track-icon theme-toggle-track-icon--sun" />
              <span className="theme-toggle-knob">
                {isLight ? <SunIcon /> : <MoonIcon />}
              </span>
            </button>
          </div>

          <button
            type="button"
            className="settings-item settings-item--button"
            onClick={() => setPrivacyOpen((v) => !v)}
            aria-expanded={privacyOpen}
          >
            <span className="settings-title">Privasi</span>
            <svg
              className={`settings-chevron${privacyOpen ? ' is-open' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {privacyOpen && (
            <div className="settings-sub">
              {PRIVACY_ITEMS.map((item) => (
                <div className="settings-subitem" key={item.key}>
                  <span className="settings-subtitle">{item.label}</span>
                  <button
                    type="button"
                    className={`settings-visibility${privacy[item.key] ? ' is-private' : ''}`}
                    onClick={() => togglePrivacy(item.key)}
                  >
                    {privacy[item.key] ? 'Pribadi' : 'Publik'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
