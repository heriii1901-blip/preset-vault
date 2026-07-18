import { useNavigate } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'

// Halaman sementara buat bagian yang belum kita garap detailnya bareng-bareng.
// Nanti tiap halaman ini diganti satu-satu (SongPresets, VideoPlayer, Profile, AdminAddPreset).
export default function Placeholder({ title, showNav = false }) {
  const navigate = useNavigate()
  return (
    <div className="screen">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
        <button className="back-btn ghost-static" onClick={() => navigate(-1)}>← Balik</button>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
          Halaman ini belum digarap, nanti kita bikin bareng-bareng.
        </p>
      </div>
      {showNav && <BottomNav />}
    </div>
  )
}
