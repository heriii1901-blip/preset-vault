import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUploadQueue } from '../context/UploadQueueContext'

const CATEGORIES = [
  { value: 'overlay', label: 'Overlay' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'cc', label: 'CC' },
  { value: 'jj', label: 'Efek JJ' },
  { value: 'transisi', label: 'Transisi' },
  { value: 'lainnya', label: 'Lainnya' },
]

export default function EfekTambah() {
  const { user, isAdmin, isCreator, creatorUsername } = useAuth()
  const navigate = useNavigate()
  const { enqueueEfekUpload } = useUploadQueue()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('overlay')
  const [xmlLink, setXmlLink] = useState('')
  const [mbLink, setMbLink] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')

  const canUpload = isAdmin || isCreator

  const resetForm = () => {
    setTitle('')
    setCategory('overlay')
    setXmlLink('')
    setMbLink('')
    setPreviewFile(null)
  }

  const handleSave = (e) => {
    e.preventDefault()
    setStatusMsg('')

    if (!title.trim()) return setStatusMsg('Nama efek belum diisi.')
    if (!xmlLink.trim()) return setStatusMsg('Link XML belum diisi.')
    if (!mbLink.trim()) return setStatusMsg('Link 5MB (Alight Creative) belum diisi.')
    if (!previewFile) return setStatusMsg('Video efek belum dipilih.')

    enqueueEfekUpload({
      previewFile,
      title: title.trim(),
      category,
      xmlLink: xmlLink.trim(),
      mbLink: mbLink.trim(),
      creatorUsername: isAdmin ? (creatorUsername || 'admin') : creatorUsername,
      userId: user.id,
    })

    setStatusMsg('✅ Ditambahin ke antrian upload! Boleh langsung tambah efek lain.')
    resetForm()
  }

  if (!canUpload) {
    return (
      <div className="screen">
        <div className="admin-content">
          <button className="back-btn ghost-static" style={{ marginBottom: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
            ← Balik
          </button>
          <div className="empty-state">Cuma admin/kreator yang bisa upload efek.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="admin-content">
        <button className="back-btn ghost-static" style={{ marginBottom: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">EFEK</span>
          <h2>Upload Efek Baru</h2>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-field">
            <label>Nama efek</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="Misal: Glitch Neon..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {title && (
                <button type="button" className="input-clear-btn" onClick={() => setTitle('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Kategori</label>
            <div className="song-mode-toggle" style={{ flexWrap: 'wrap' }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={category === c.value ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>Link XML (satu link per baris kalau lebih dari satu)</label>
            <div className="input-wrap">
              <textarea
                className="finput-real finput-multiline"
                placeholder="Paste link XML dari AM..."
                value={xmlLink}
                onChange={(e) => setXmlLink(e.target.value)}
                rows={3}
              />
              {xmlLink && (
                <button type="button" className="input-clear-btn" onClick={() => setXmlLink('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Link 5MB (satu link per baris kalau lebih dari satu)</label>
            <div className="input-wrap">
              <textarea
                className="finput-real finput-multiline"
                placeholder="Paste link 5MB / Alight Creative..."
                value={mbLink}
                onChange={(e) => setMbLink(e.target.value)}
                rows={3}
              />
              {mbLink && (
                <button type="button" className="input-clear-btn" onClick={() => setMbLink('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Video efek (ngga ada limit ukuran)</label>
            <label className="upload-box" style={{ display: 'block', cursor: 'pointer' }}>
              {previewFile ? `✅ ${previewFile.name}` : '⬆ Pilih video dari HP'}
              <input
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
              />
            </label>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              Video ngga dikompres, langsung diupload apa adanya - proses bisa lebih lama tergantung ukuran file & koneksi.
            </p>
          </div>

          {statusMsg && (
            <p style={{ fontSize: 12.5, marginBottom: 12, color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)' }}>
              {statusMsg}
            </p>
          )}

          <button className="save-btn" type="submit">
            Simpan Efek
          </button>
        </form>
      </div>
    </div>
  )
}
