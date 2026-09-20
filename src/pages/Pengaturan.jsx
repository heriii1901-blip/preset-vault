import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function Pengaturan() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => getTheme())
  const isLight = theme === 'light'

  function toggleTheme() {
    setTheme(applyTheme(isLight ? 'dark' : 'light'))
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

        <div className="settings-group">
          <div className="settings-group-title">Tampilan</div>

          <div className="settings-row">
            <div className="settings-row-text">
              <h4>Mode Tampilan</h4>
              <p>{isLight ? 'Lagi pakai mode cerah' : 'Lagi pakai mode gelap'}</p>
            </div>

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
        </div>
      </div>
    </div>
  )
}
