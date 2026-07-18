import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function AdminManagePresets() {
  const navigate = useNavigate()
  const [presets, setPresets] = useState([])
  const [songsMap, setSongsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: presetsData, error: presetsErr }, { data: songsData, error: songsErr }] =
        await Promise.all([
          supabase.from('presets').select('*').order('created_at', { ascending: false }),
          supabase.from('songs').select('*'),
        ])
      if (presetsErr) throw presetsErr
      if (songsErr) throw songsErr

      const map = {}
      songsData.forEach((s) => { map[s.id] = s.name })
      setSongsMap(map)
      setPresets(presetsData)
    } catch (err) {
      console.error('Gagal ambil daftar preset:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(preset) {
    const ok = window.confirm(`Yakin mau hapus preset dari @${preset.creator_username}?`)
    if (!ok) return

    setDeletingId(preset.id)
    try {
      const { error: delErr } = await supabase.from('presets').delete().eq('id', preset.id)
      if (delErr) throw delErr

      if (preset.song_id) {
        const { data: songRow } = await supabase
          .from('songs')
          .select('preset_count')
          .eq('id', preset.song_id)
          .single()
        await supabase
          .from('songs')
          .update({ preset_count: Math.max((songRow?.preset_count || 1) - 1, 0) })
          .eq('id', preset.song_id)
      }
      setPresets((prev) => prev.filter((p) => p.id !== preset.id))
    } catch (err) {
      console.error('Gagal hapus preset:', err)
      alert('Gagal hapus preset, coba lagi.')
    } finally {
      setDeletingId(null)
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
          <h2>Kelola Preset</h2>
        </div>

        {loading && <div className="empty-state">Memuat...</div>}
        {!loading && presets.length === 0 && (
          <div className="empty-state">Belum ada preset yang di-post.</div>
        )}

        <div className="preset-manage-list">
          {presets.map((preset) => (
            <div className="preset-manage-row" key={preset.id}>
              <div className="pmr-info">
                <h4>{songsMap[preset.song_id] || 'Lagu gak ketemu'}</h4>
                <p>@{preset.creator_username}</p>
              </div>
              <div className="pmr-actions">
                <button
                  className="pmr-edit"
                  onClick={() => navigate(`/admin/edit-preset/${preset.id}`)}
                >
                  Edit
                </button>
                <button
                  className="pmr-delete"
                  disabled={deletingId === preset.id}
                  onClick={() => handleDelete(preset)}
                >
                  {deletingId === preset.id ? '...' : 'Hapus'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
