import { useNavigate } from 'react-router-dom'

export default function TentangAplikasi() {
  const navigate = useNavigate()

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
          <span className="admin-tag">TENTANG</span>
          <h2>PAM - Preset Alight Motion</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, lineHeight: 1.65, color: 'var(--text)' }}>
          <p>
            Nyari preset Alight Motion buat lagu tertentu sering ribet — harus scroll TikTok satu-satu, belum tentu
            ketemu, dan link download-nya kadang nggak jelas asalnya. PAM dibuat buat nyelesain itu.
          </p>

          <p>
            Semua preset dikumpulin berdasarkan lagu. Tinggal cari nama lagunya, langsung ketemu preset yang cocok
            lengkap sama preview video, jadi nggak salah pilih sebelum download. Semua link presetnya juga udah
            dicek dan langsung ke sumber aslinya.
          </p>

          <p>
            Ada sistem Kreator buat yang emang bikin preset sendiri — preset-nya dipajang rapi di satu tempat,
            lengkap dengan nama akun dan link TikTok. Selain preset, PAM juga nampung Efek, buat yang butuh efek AM
            di luar preset lagu.
          </p>

          <p>
            PAM masih terus dikembangin, dikerjain sendirian di sela waktu luang. Kalau nemu bug atau ada ide fitur,
            kasih tau lewat kreator terdaftar atau admin PAM.
          </p>

          <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--surface-2, rgba(255,255,255,0.08))', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>PAM · Versi 1.0.0</p>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Kalo masih suka bug, login ulang aja dulu.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
