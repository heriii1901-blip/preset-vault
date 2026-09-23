import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Kreator from './Kreator'

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

// Urutan dari ATAS ke BAWAH. Yang paling sering dipakai ditaruh paling bawah (paling dekat tombol +).
const FAB_ACTIONS = [
  {
    label: 'Request Lagu',
    to: '/kreator/request-lagu',
    icon: (
      <svg {...iconProps}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    label: 'Kelola Preset',
    to: '/kreator/kelola-preset',
    icon: (
      <svg {...iconProps}>
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="14" y2="17" />
      </svg>
    ),
  },
  {
    label: 'Tambah Preset',
    to: '/kreator/tambah-preset',
    icon: (
      <svg {...iconProps}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
]

export default function KreatorHome() {
  const { isCreator } = useAuth()
  const navigate = useNavigate()
  const [fabOpen, setFabOpen] = useState(false)

  // Bukan kreator: cuma daftar kreator biasa
  if (!isCreator) return <Kreator />

  // Kreator: daftar kreator + tombol + (speed dial) kayak di menu Efek
  return (
    <div className="screen">
      <Kreator />

      <div
        className={`efek-fab-backdrop${fabOpen ? ' is-open' : ''}`}
        onClick={() => setFabOpen(false)}
      />

      <div className={`efek-fab-dial${fabOpen ? ' is-open' : ''}`}>
        {FAB_ACTIONS.map((action, i) => (
          <button
            key={action.label}
            type="button"
            className="efek-fab-bubble"
            style={{ transitionDelay: `${(fabOpen ? FAB_ACTIONS.length - 1 - i : i) * 45}ms` }}
            onClick={() => { setFabOpen(false); navigate(action.to) }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}

        <button
          type="button"
          className={`efek-fab${fabOpen ? ' is-open' : ''}`}
          onClick={() => setFabOpen((v) => !v)}
          aria-label="Menu kreator"
          aria-expanded={fabOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
