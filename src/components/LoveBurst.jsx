// Bentuk hati ala emoji ❤️ (sudut atas tegas), dipakai tombol love & animasi double tap
export const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'

// Gradien ungu -> merah muda -> biru. Taruh SEKALI per halaman, dipakai lewat url(#pamLoveGradient).
export function LoveGradientDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pamLoveGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="0.5" stopColor="#FF3D7F" />
          <stop offset="1" stopColor="#3D8BFF" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Hati yang muncul di titik yang di-double-tap
export function LoveBurst({ hearts }) {
  return hearts.map((h) => (
    <svg
      key={h.key}
      className="love-burst"
      viewBox="0 0 24 24"
      style={{ left: h.x, top: h.y, '--tilt': `${h.tilt}deg` }}
    >
      <path d={HEART_PATH} fill="url(#pamLoveGradient)" />
    </svg>
  ))
}
