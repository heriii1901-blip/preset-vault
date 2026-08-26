import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin, logout } = useAuth()

  const isTerbaruActive = location.pathname === '/'
  const isLaguActive = location.pathname.startsWith('/lagu')
  const isEfekActive = location.pathname.startsWith('/efek')
  const isKreatorActive = location.pathname.startsWith('/kreator')
  const isAkunActive = location.pathname === '/akun'

  const [pendingSongCount, setPendingSongCount] = useState(0)

  // --- Pill indicator (ala Mihon) ---
  const containerRef = useRef(null)
  const iconRefs = useRef([])
  const [pillStyle, setPillStyle] = useState({ opacity: 0 })

  const activeIndex = isTerbaruActive
    ? 0
    : isEfekActive
      ? 1
      : isLaguActive
        ? 2
        : isKreatorActive
          ? 3
          : isAkunActive
            ? 4
            : -1

  useLayoutEffect(() => {
    const updatePill = () => {
      const container = containerRef.current
      const el = iconRefs.current[activeIndex]

      if (!container || !el || window.innerWidth >= 768) {
        setPillStyle((prev) => ({ ...prev, opacity: 0 }))
        return
      }

      const elRect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const pillWidth = 56
      const pillHeight = 32

      setPillStyle({
        opacity: 1,
        width: pillWidth,
        height: pillHeight,
        transform: `translate(${elRect.left - containerRect.left + elRect.width / 2 - pillWidth / 2}px, ${elRect.top - containerRect.top + elRect.height / 2 - pillHeight / 2}px)`,
      })
    }

    updatePill()
    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [activeIndex])
  
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

  return (
    <div className="bottom-nav" ref={containerRef}>
      <div className="nav-pill" style={pillStyle} />
      <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon" ref={(el) => (iconRefs.current[0] = el)}>
          <svg className="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 2.6-6.3" />
            <path d="M3 5v4h4" />
            <path d="M12 7v5l3 2" />
          </svg>
          <svg className="icon-fill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 2.6-6.3" />
            <path d="M3 5v4h4" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <span>Terbaru</span>
      </NavLink>

      <NavLink to="/efek" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon" ref={(el) => (iconRefs.current[1] = el)}>
          <svg className="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l1.6 5.3L19 9l-5.4 1.7L12 16l-1.6-5.3L5 9l5.4-1.7L12 2z" />
            <path d="M19 15l.8 2.6L22.4 18.4l-2.6.8L19 21.8l-.8-2.6-2.6-.8 2.6-.8L19 15z" />
          </svg>
          <svg className="icon-fill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l1.6 5.3L19 9l-5.4 1.7L12 16l-1.6-5.3L5 9l5.4-1.7L12 2z" />
            <path d="M19 15l.8 2.6L22.4 18.4l-2.6.8L19 21.8l-.8-2.6-2.6-.8 2.6-.8L19 15z" />
          </svg>
        </span>
        <span>Efek</span>
      </NavLink>

      <NavLink to="/lagu" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon" ref={(el) => (iconRefs.current[2] = el)}>
          <svg className="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 11.5l6.7-6.2a1.2 1.2 0 0 1 1.6 0l6.7 6.2" />
            <path d="M5.5 10.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8.5" />
          </svg>
          <svg className="icon-fill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 11.5l6.7-6.2a1.2 1.2 0 0 1 1.6 0l6.7 6.2" />
            <path d="M5.5 10.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8.5" />
          </svg>
        </span>
        <span>lagu</span>
      </NavLink>

      {isLaguActive && isAdmin && (
        <div className="nav-submenu">
          <NavLink to="/admin/tambah-preset" className={({ isActive }) => `nav-subitem${isActive ? ' active' : ''}`}>
            <span>Panel Admin</span>
          </NavLink>
          <NavLink to="/admin/kelola-preset" className={({ isActive }) => `nav-subitem${isActive ? ' active' : ''}`}>
            <span>Kelola Preset</span>
          </NavLink>
        </div>
      )}

      <NavLink to="/kreator" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon" ref={(el) => (iconRefs.current[3] = el)}>
          <svg className="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l4 3 5-6 5 6 4-3-1.5 10h-15L3 8z" />
            <path d="M6.5 18h11" />
          </svg>
          <svg className="icon-fill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l4 3 5-6 5 6 4-3-1.5 10h-15L3 8z" />
            <path d="M6.5 18h11" />
          </svg>
        </span>
        <span>Kreator</span>
      </NavLink>

      {isKreatorActive && isAdmin && (
        <div className="nav-submenu">
          <NavLink to="/admin/kreator-pengajuan" className={({ isActive }) => `nav-subitem${isActive ? ' active' : ''}`}>
            <span>Review Pengajuan</span>
          </NavLink>
          <NavLink to="/admin/song-requests" className={({ isActive }) => `nav-subitem${isActive ? ' active' : ''}`}>
            <span className="nav-subitem-row">
              Request Lagu
              {pendingSongCount > 0 && <span className="nav-subitem-badge">{pendingSongCount}</span>}
            </span>
          </NavLink>
        </div>
      )}

      <NavLink to="/akun" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon" ref={(el) => (iconRefs.current[4] = el)}>
          <svg className="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          <svg className="icon-fill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </span>
        <span>Akun</span>
      </NavLink>
    </div>
  )
}
