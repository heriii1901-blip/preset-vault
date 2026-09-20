import { useNavigate } from 'react-router-dom'

const SECTIONS = [
  {
    title: 'Latar Belakang',
    body: [
      'Mencari preset Alight Motion untuk lagu tertentu sering kali memakan waktu. Pengguna harus menelusuri video di media sosial satu per satu, belum tentu menemukan yang dicari, dan tautan unduhan yang dibagikan tidak selalu jelas asal-usulnya. PAM (Preset Alight Motion) dibuat untuk menjawab masalah tersebut dengan menyediakan satu tempat yang rapi, terorganisir, dan mudah dijelajahi.',
    ],
  },
  {
    title: 'Terbaru',
    body: [
      'Halaman Terbaru menampilkan preset yang baru ditambahkan, lengkap dengan pratinjau video pada setiap kotaknya. Pengguna juga dapat menempelkan tautan video TikTok pada kolom pencarian untuk mengetahui apakah preset dari video tersebut sudah tersedia di PAM.',
    ],
  },
  {
    title: 'Lagu',
    body: [
      'Seluruh preset dikelompokkan berdasarkan lagu. Pengguna cukup mencari judul lagu, lalu membuka daftar preset yang tersedia untuk lagu tersebut. Urutan preset diacak setiap hari agar seluruh kreator mendapat kesempatan tampil yang adil.',
      'Setiap preset dapat dibuka dalam tampilan layar penuh dan digulir ke atas atau ke bawah seperti menonton video pendek. Dari sana pengguna dapat menyimpan preset ke favorit, membagikannya, serta membuka tautan XML, tautan 5MB, dan video asli dari kreator.',
    ],
  },
  {
    title: 'Efek',
    body: [
      'Selain preset lagu, PAM menyediakan kumpulan efek Alight Motion yang siap dipakai, seperti overlay, glitch, color correction, efek JJ, dan transisi. Efek dikelompokkan per kategori dan dilengkapi pratinjau agar pengguna dapat menilai hasilnya sebelum mengunduh.',
    ],
  },
  {
    title: 'Kreator',
    body: [
      'PAM memiliki sistem kreator bagi mereka yang membuat preset sendiri. Setiap kreator memiliki halaman yang menampilkan seluruh karyanya, lengkap dengan nama akun dan tautan TikTok. Pengguna biasa dapat mengajukan diri menjadi kreator, dan kreator terdaftar dapat mengunggah preset serta mengusulkan lagu baru yang akan ditinjau oleh admin.',
    ],
  },
  {
    title: 'Profil dan Personalisasi',
    body: [
      'Setiap akun memiliki halaman profil yang memuat preset dan efek favorit. Pengguna dapat mengubah foto profil, nama, bio, dan tautan kontak, mengganti gambar latar pada halaman Terbaru, serta memilih mode tampilan gelap atau terang sesuai kenyamanan.',
    ],
  },
  {
    title: 'Pengembangan',
    body: [
      'PAM dikembangkan secara mandiri dan terus disempurnakan dari waktu ke waktu. Apabila menemukan kendala atau memiliki usulan fitur, silakan sampaikan melalui kreator terdaftar atau admin PAM.',
    ],
  },
]

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>
          {SECTIONS.map((section) => (
            <section key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{section.title}</h3>
              {section.body.map((paragraph, i) => (
                <p key={i} style={{ margin: 0, color: 'var(--muted)' }}>{paragraph}</p>
              ))}
            </section>
          ))}

          <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--surface-2, rgba(255,255,255,0.08))', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>PAM · Versi 1.0.0</p>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Jika masih menemukan kendala, coba masuk ulang terlebih dahulu.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
