import { NavLink } from 'react-router-dom'

export function BottomNav() {
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
      <NavLink to="/lagu" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18V9h6v9M4 10l8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z" />
        </svg>
        <span>lagu</span>
      </NavLink>
      <NavLink to="/akun" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
        <span>Akun</span>
      </NavLink>
    </div>
  )
}
