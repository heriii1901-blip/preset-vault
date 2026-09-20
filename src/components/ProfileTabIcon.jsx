// Ikon tab profil ala IG/TikTok:
// - belum aktif  -> cuma garis luar (outline), dalemnya kosong
// - aktif        -> bentuknya keisi penuh, garisnya nyatu sama isinya
export default function ProfileTabIcon({ name, active }) {
  const fill = active ? 'currentColor' : 'none'
  const svgProps = {
    className: 'profile-tab-icon',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: active ? 1.6 : 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  if (name === 'postingan-list') {
    return (
      <svg {...svgProps} fill="none" strokeWidth={active ? 2.5 : 1.9}>
        <line x1="8.6" y1="6" x2="21" y2="6" />
        <line x1="8.6" y1="12" x2="21" y2="12" />
        <line x1="8.6" y1="18" x2="21" y2="18" />
        <circle cx="4.2" cy="6" r="1.3" fill="currentColor" />
        <circle cx="4.2" cy="12" r="1.3" fill="currentColor" />
        <circle cx="4.2" cy="18" r="1.3" fill="currentColor" />
      </svg>
    )
  }

  if (name === 'postingan') {
    return (
      <svg {...svgProps} fill={fill}>
        <rect x="3" y="3" width="7.6" height="7.6" rx="1.7" />
        <rect x="13.4" y="3" width="7.6" height="7.6" rx="1.7" />
        <rect x="3" y="13.4" width="7.6" height="7.6" rx="1.7" />
        <rect x="13.4" y="13.4" width="7.6" height="7.6" rx="1.7" />
      </svg>
    )
  }

  if (name === 'favorit') {
    return (
      <svg {...svgProps} fill={fill}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    )
  }

  if (name === 'efek') {
    return (
      <svg {...svgProps} fill={fill}>
        <path d="M12 2.8l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2 2-5.2z" />
        <path d="M18.4 15.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
      </svg>
    )
  }

  if (name === 'lagu') {
    return (
      <svg {...svgProps} fill="none">
        <path d="M9.2 17.4V6.1l9.6-2.1v11.2" strokeWidth={active ? 2.3 : 1.8} />
        <circle cx="6.6" cy="17.4" r="2.7" fill={fill} />
        <circle cx="16.2" cy="15.2" r="2.7" fill={fill} />
      </svg>
    )
  }

  // kreator
  return (
    <svg {...svgProps} fill={fill}>
      <circle cx="12" cy="8" r="3.9" />
      <path d="M4.4 20.4c0-3.9 3.4-6.4 7.6-6.4s7.6 2.5 7.6 6.4z" />
    </svg>
  )
}
