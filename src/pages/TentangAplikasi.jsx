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
            PAM lahir dari hal simpel yang sering bikin capek: nyari preset Alight Motion buat lagu tertentu itu ribet banget.
            Biasanya harus scroll TikTok satu-satu, semoga-semoga ketemu kreator yang preview videonya kepake, terus masih harus
            nebak-nebak link download-nya valid apa nggak. PAM dibuat biar proses itu nggak perlu ada lagi.
          </p>

          <p>
            Di sini semua preset dikumpulin berdasarkan lagu, jadi tinggal cari nama lagunya dan langsung ketemu preset-preset
            yang cocok, lengkap sama preview video biar nggak salah pilih sebelum download. Link presetnya juga udah dicek
            dan langsung ke sumbernya, jadi nggak perlu muter-muter lewat shortlink yang suka mencurigakan.
          </p>

          <p>
            Ada juga sistem Kreator, buat kalian yang emang bikin preset sendiri dan mau preset-nya dipajang rapi di satu
            tempat, lengkap sama nama akun dan link TikTok kalian, bukan cuma numpang lewat di FYP orang. Selain preset, PAM
            juga mulai nampung Efek, buat yang nyari-nyari efek AM di luar preset lagu.
          </p>

          <p>
            PAM masih terus dikembangin sedikit-sedikit, dikerjain sendirian di sela-sela waktu luang. Kalau nemu bug atau ada
            ide fitur, kasih tau aja lewat kreator yang terdaftar atau admin PAM ya.
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
