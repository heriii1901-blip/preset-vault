import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'

const CATEGORIES = [
  { value: 'overlay', label: 'Overlay' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'cc', label: 'CC' },
  { value: 'jj', label: 'Efek JJ' },
  { value: 'transisi', label: 'Transisi' },
  { value: 'lainnya', label: 'Lainnya' },
]

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

export default function AdminManageEfek() {
  const navigate = useNavigate()
  const { clearCache } = usePresetCache()

  const [effects, setEffects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('semua')
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({ title: '', category: 'overlay', xml_link: '', mb_link: '' })
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Jalan sekali pas halaman dibuka (dep array kosong) -> nggak ada resiko loop / query berulang.
  useEffect(() => {
    loadEffects()
  }, [])

  async function loadEffects() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('effects')
        .select('id, title, category, xml_link, mb_link, uploaded_by, link_pending, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      setEffects(data || [])
    } catch (err) {
      console.error('Gagal ambil daftar efek:', err)
    } finally {
      setLoading(false)
    }
  }

  // Cache halaman Efek & kategori dibuang biar perubahan langsung keliatan pas admin balik ke sana
  function clearEfekCaches(...categories) {
    clearCache('efek-grid')
    categories.forEach((c) => clearCache(`efek-kategori:${c || 'lainnya'}`))
  }

  function startEdit(effect) {
    setEditingId(effect.id)
    setDraft({
      title: effect.title || '',
      category: effect.category || 'lainnya',
      xml_link: effect.xml_link || '',
      mb_link: effect.mb_link || '',
    })
  }

  async function handleSave(effect) {
    const title = draft.title.trim()
    if (!title) {
      alert('Nama efek nggak boleh kosong.')
      return
    }
    const xmlLink = draft.xml_link.trim()
    const patch = {
      title,
      category: draft.category,
      xml_link: xmlLink || null,
      mb_link: draft.mb_link.trim() || null,
      link_pending: !xmlLink,
    }
    setSavingId(effect.id)
    try {
      const { error } = await supabase.from('effects').update(patch).eq('id', effect.id)
      if (error) throw error
      setEffects((prev) => prev.map((e) => (e.id === effect.id ? { ...e, ...patch } : e)))
      clearEfekCaches(effect.category, patch.category)
      setEditingId(null)
    } catch (err) {
      console.error('Gagal simpan efek:', err)
      alert('Gagal simpan, coba lagi.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(effect) {
    const ok = window.confirm(`Yakin mau hapus efek "${effect.title}"?`)
    if (!ok) return
    setDeletingId(effect.id)
    try {
      // Bersihin favorit yang nunjuk ke efek ini (kolom effect_id belum punya FK).
      // Best-effort: kalau ditolak RLS ya udah, yang penting efeknya kehapus.
      try {
        await supabase.from('favorites').delete().eq('effect_id', effect.id)
      } catch (favErr) {
        console.error('Gagal bersihin favorit efek (lanjut hapus efek):', favErr)
      }

      const { error } = await supabase.from('effects').delete().eq('id', effect.id)
      if (error) throw error
      setEffects((prev) => prev.filter((e) => e.id !== effect.id))
      clearEfekCaches(effect.category)
    } catch (err) {
      console.error('Gagal hapus efek:', err)
      alert('Gagal hapus efek, coba lagi.')
    } finally {
      setDeletingId(null)
    }
  }

  const visible = filter === 'semua'
    ? effects
    : effects.filter((e) => (e.category || 'lainnya') === filter)

  return (
    <div className="screen">
      <div className="admin-content">
        <button
          className="back-btn ghost-static"
          style={{ margin: '0 0 14px 18px', width: 'fit-content' }}
          onClick={() => navigate(-1)}
        >
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">PANEL ADMIN</span>
          <h2>Kelola Efek ({effects.length})</h2>
        </div>

        <div className="admin-pad" style={{ marginBottom: 14 }}>
          <select
            className="finput-real"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="semua">Semua kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {loading && <div className="empty-state">Memuat...</div>}

        {!loading && visible.length === 0 && (
          <div className="empty-state">Belum ada efek di sini.</div>
        )}

        {!loading && visible.length > 0 && (
          <div className="preset-manage-list admin-pad" style={{ paddingBottom: 30 }}>
            {visible.map((effect) => {
              if (editingId === effect.id) {
                return (
                  <div className="request-card" key={effect.id}>
                    <div className="form-field">
                      <label>Nama efek</label>
                      <input
                        className="finput-real"
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                    </div>

                    <div className="form-field">
                      <label>Kategori</label>
                      <select
                        className="finput-real"
                        value={draft.category}
                        onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Link XML (kosongin = efek disembunyiin dari list)</label>
                      <textarea
                        className="finput-real finput-multiline"
                        rows={3}
                        value={draft.xml_link}
                        onChange={(e) => setDraft((d) => ({ ...d, xml_link: e.target.value }))}
                      />
                    </div>

                    <div className="form-field">
                      <label>Link 5MB</label>
                      <textarea
                        className="finput-real finput-multiline"
                        rows={3}
                        value={draft.mb_link}
                        onChange={(e) => setDraft((d) => ({ ...d, mb_link: e.target.value }))}
                      />
                    </div>

                    <div className="pmr-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="ghost-static"
                        onClick={() => setEditingId(null)}
                        disabled={savingId === effect.id}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        className="pmr-edit"
                        style={{ padding: '9px 16px', fontSize: 13 }}
                        onClick={() => handleSave(effect)}
                        disabled={savingId === effect.id}
                      >
                        {savingId === effect.id ? '...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div className="preset-manage-row" key={effect.id}>
                  <div className="pmr-info" style={{ minWidth: 0 }}>
                    <h4>{effect.title}</h4>
                    <p>
                      {CATEGORY_LABEL[effect.category] || 'Lainnya'}
                      {effect.uploaded_by ? ` · @${effect.uploaded_by}` : ''}
                      {effect.link_pending ? ' · link XML belum ada' : ''}
                    </p>
                  </div>
                  <div className="pmr-actions">
                    <button className="pmr-edit" onClick={() => startEdit(effect)}>
                      Edit
                    </button>
                    <button
                      className="pmr-delete"
                      disabled={deletingId === effect.id}
                      onClick={() => handleDelete(effect)}
                    >
                      {deletingId === effect.id ? '...' : 'Hapus'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
