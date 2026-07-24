import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin, logout } = useAuth()
  const isLaguActive = location.pathname.startsWith('/lagu')
  const isAkunActive = location.pathname.startsWith('/akun')

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 2.6-6.3" />
          <path d="M3 5v4h4" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span>Terbaru</span>
      </NavLink>

      <NavLink to="/cari" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Cari</span>
      </NavLink>

      <NavLink to="/lagu" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18V9h6v9M4 10l8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z" />
        </svg>
        <span>lagu</span>
      </NavLink>

      <NavLink to="/kreator" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8l4 3 5-6 5 6 4-3-1.5 10h-15L3 8z" />
          <path d="M6.5 18h11" />
        </svg>
        <span>Kreator</span>
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

      <NavLink to="/akun" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
        <span>Akun</span>
      </NavLink>

      {isAkunActive && (
        <div className="nav-submenu">
          <button type="button" className="nav-subitem nav-subitem-danger" onClick={handleLogout}>
            <span>Keluar Akun</span>
          </button>
        </div>
      )}
    </div>
  )
}
