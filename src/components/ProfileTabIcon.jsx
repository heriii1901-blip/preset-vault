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
        <path d="M12 20.7S3.5 15.8 3.5 10.2A4.7 4.7 0 0 1 12 7.4a4.7 4.7 0 0 1 8.5 2.8c0 5.6-8.5 10.5-8.5 10.5z" />
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
      <path d="M4.4 20.4c0-3.9 3.4-6.4 7.6-6.4s7.6 2.5 7.6 6.4" />
    </svg>
  )
}
