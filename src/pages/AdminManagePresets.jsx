import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function AdminManagePresets() {
  const navigate = useNavigate()
  const [presets, setPresets] = useState([])
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [selectedSong, setSelectedSong] = useState(null) // null = lagi liat list lagu

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
      setSongs([...songsData].sort((a, b) => a.name.localeCompare(b.name)))
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

  // Hitung jumlah video per lagu dari data preset asli (bukan cuma preset_count di tabel songs,
  // biar akurat kalau kolom itu telat keupdate)
  const presetCountBySong = presets.reduce((acc, p) => {
    if (p.song_id) acc[p.song_id] = (acc[p.song_id] || 0) + 1
    return acc
  }, {})

  const filteredPresets = selectedSong
    ? presets.filter((p) => p.song_id === selectedSong.id)
    : []

  return (
    <div className="screen">
      <div className="admin-content">
        <button
          className="back-btn ghost-static"
          style={{ marginBottom: 14, width: 'fit-content' }}
          onClick={() => (selectedSong ? setSelectedSong(null) : navigate(-1))}
        >
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">PANEL ADMIN</span>
          <h2>{selectedSong ? selectedSong.name : 'Kelola Preset'}</h2>
        </div>

        {loading && <div className="empty-state">Memuat...</div>}

        {/* LEVEL 1: LIST LAGU */}
        {!loading && !selectedSong && (
          songs.length === 0 ? (
            <div className="empty-state">Belum ada lagu.</div>
          ) : (
            <div className="preset-manage-list">
              {songs.map((song) => (
                <div
                  className="preset-manage-row"
                  key={song.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedSong(song)}
                >
                  <div className="pmr-info">
                    <h4>{song.name}</h4>
                    <p>{presetCountBySong[song.id] || 0} video</p>
                  </div>
                  <div className="pmr-actions">
                    <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* LEVEL 2: LIST VIDEO DARI LAGU YANG DIPILIH */}
        {!loading && selectedSong && (
          filteredPresets.length === 0 ? (
            <div className="empty-state">Belum ada preset buat lagu ini.</div>
          ) : (
            <div className="preset-manage-list">
              {filteredPresets.map((preset) => (
                <div className="preset-manage-row" key={preset.id}>
                  <div className="pmr-info">
                    <h4>@{preset.creator_username}</h4>
                    <p>{preset.tiktok_link || 'Gak ada link TikTok'}</p>
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
          )
        )}
      </div>
    </div>
  )
}
