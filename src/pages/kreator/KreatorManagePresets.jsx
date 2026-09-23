import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useAuth } from '../../context/AuthContext'
import { usePresetCache } from '../../context/PresetCacheContext'
import { dayKeyWIB } from '../../utils/dailyOrder'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function KreatorManagePresets() {
  const navigate = useNavigate()
  const { creatorUsername } = useAuth()
  const { clearCache } = usePresetCache()
  const [presets, setPresets] = useState([])
  const [songNames, setSongNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!creatorUsername) return
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('id, song_id, tiktok_link, link_pending, created_at')
          .eq('creator_username', creatorUsername)
          .order('created_at', { ascending: false })
        if (error) throw error
        setPresets(data || [])

        const songIds = [...new Set((data || []).map((p) => p.song_id).filter(Boolean))]
        if (songIds.length > 0) {
          const { data: songs } = await supabase.from('songs').select('id, name').in('id', songIds)
          setSongNames(Object.fromEntries((songs || []).map((s) => [s.id, s.name])))
        }
      } catch (err) {
        console.error('Gagal ambil preset kamu:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [creatorUsername])

  async function handleDelete(preset) {
    const name = songNames[preset.song_id] || 'preset ini'
    if (!window.confirm(`Hapus preset "${name}"? Video dan cover-nya ikut terhapus dan gak bisa dikembalikan.`)) return
    setDeletingId(preset.id)
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/delete-own-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data?.session?.access_token || ''}`,
        },
        body: JSON.stringify({ presetId: preset.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Server balas ${res.status}`)

      setPresets((prev) => prev.filter((p) => p.id !== preset.id))
      // Buang cache yang masih nyimpen preset ini
      clearCache(`own-presets:${creatorUsername}`)
      clearCache(`kreator-presets:${creatorUsername}`)
      clearCache(`song:${preset.song_id}:${dayKeyWIB()}`)
    } catch (err) {
      console.error('Gagal hapus preset:', err)
      alert(`Gagal hapus preset: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

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
          <span className="admin-tag">KREATOR</span>
          <h2>Kelola Preset</h2>
        </div>

        {loading && <div className="empty-state">Memuat...</div>}

        {!loading && presets.length === 0 && (
          <div className="empty-state">Kamu belum punya preset.</div>
        )}

        {!loading && presets.length > 0 && (
          <div className="preset-manage-list admin-pad">
            {presets.map((preset) => (
              <div className="preset-manage-row" key={preset.id}>
                <div className="pmr-info">
                  <h4>{songNames[preset.song_id] || 'Lagu'}</h4>
                  <p>
                    {formatDate(preset.created_at)}
                    {preset.link_pending ? ' · menunggu link' : ''}
                  </p>
                </div>
                <div className="pmr-actions">
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
        )}
      </div>
    </div>
  )
}
