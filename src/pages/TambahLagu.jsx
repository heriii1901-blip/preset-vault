import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

const THUMB_COLORS = [
  'linear-gradient(135deg,#7C5CFF,#4A32C9)',
  'linear-gradient(135deg,#FF3D7F,#C91E5A)',
  'linear-gradient(135deg,#D4FF3D,#8FB800)',
  'linear-gradient(135deg,#7C5CFF,#FF3D7F)',
  'linear-gradient(135deg,#4A32C9,#15151D)',
]

export default function TambahLagu() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  if (!isAdmin) {
    return (
      <div className="screen">
        <div className="admin-content">
          <button className="back-btn ghost-static" style={{ marginBottom: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
            ← Balik
          </button>
          <div className="empty-state">Cuma admin yang bisa nambah lagu.</div>
        </div>
      </div>
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    setStatusMsg('')
    if (!name.trim()) return setStatusMsg('Nama lagu belum diisi.')

    setSaving(true)
    try {
      const { data: existing, error: findErr } = await supabase
        .from('songs')
        .select('id, name')
        .ilike('name', name.trim())
        .maybeSingle()
      if (findErr) throw findErr

      if (existing) {
        setStatusMsg(`Lagu "${existing.name}" udah ada di list.`)
        return
      }

      const color = THUMB_COLORS[Math.floor(Math.random() * THUMB_COLORS.length)]
      const { error: insertErr } = await supabase
        .from('songs')
        .insert({ name: name.trim(), preset_count: 0, color })
      if (insertErr) throw insertErr

      setStatusMsg('✅ Lagu ditambahin!')
      setName('')
    } catch (err) {
      console.error('Gagal nambah lagu:', err)
      setStatusMsg('❌ Gagal nambah lagu. Cek koneksi / setting Supabase.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <div className="admin-content">
        <button className="back-btn ghost-static" style={{ marginBottom: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">PANEL ADMIN</span>
          <h2>Tambah Lagu</h2>
        </div>

        <form onSubmit={handleSave} style={{ padding: '0 14px' }}>
          <div className="form-field">
            <label>Nama lagu</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="Misal: Judul Lagu - Artis..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {name && (
                <button type="button" className="input-clear-btn" onClick={() => setName('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          {statusMsg && (
            <p style={{ fontSize: 12.5, marginBottom: 12, color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)' }}>
              {statusMsg}
            </p>
          )}

          <button className="save-btn" type="submit" disabled={saving}>
            {saving ? 'Nyimpen...' : 'Tambahkan Lagu'}
          </button>
        </form>
      </div>
    </div>
  )
}
