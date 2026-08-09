import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const THUMB_COLORS = [
  'linear-gradient(135deg,#7C5CFF,#4A32C9)',
  'linear-gradient(135deg,#FF3D7F,#C91E5A)',
  'linear-gradient(135deg,#D4FF3D,#8FB800)',
  'linear-gradient(135deg,#7C5CFF,#FF3D7F)',
  'linear-gradient(135deg,#4A32C9,#15151D)',
]

export default function AdminSongRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [processingId, setProcessingId] = useState(null)
  const [editedNames, setEditedNames] = useState({})

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('song_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRequests(data || [])
    } catch (err) {
      console.error('Gagal ambil permintaan lagu:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(req) {
    setProcessingId(req.id)
    try {
      const finalName = (editedNames[req.id] ?? req.requested_song_name).trim()
      if (!finalName) {
        alert('Nama lagu ga boleh kosong.')
        setProcessingId(null)
        return
      }

      const { data: existing, error: findErr } = await supabase
        .from('songs')
        .select('id, preset_count')
        .eq('name', finalName)
        .maybeSingle()
      if (findErr) throw findErr

      let songId
      if (existing) {
        songId = existing.id
        await supabase
          .from('songs')
          .update({ preset_count: (existing.preset_count || 0) + 1 })
          .eq('id', songId)
      } else {
        const color = THUMB_COLORS[Math.floor(Math.random() * THUMB_COLORS.length)]
        const { data: newSong, error: insertErr } = await supabase
          .from('songs')
          .insert({ name: finalName, preset_count: 1, color })
          .select()
          .single()
        if (insertErr) throw insertErr
        songId = newSong.id
      }

      const { error: presetErr } = await supabase.from('presets').insert({
        song_id: songId,
        xml_link: req.xml_link,
        mb_link: req.mb_link,
        creator_username: req.creator_username,
        tiktok_link: req.tiktok_link,
        preview_video_url: req.preview_video_url,
      })
      if (presetErr) throw presetErr

      const { error: reqErr } = await supabase
        .from('song_requests')
        .update({ status: 'approved', requested_song_name: finalName, reviewed_at: new Date().toISOString() })
        .eq('id', req.id)
      if (reqErr) throw reqErr

      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: 'approved', requested_song_name: finalName } : r))
      )
    } catch (err) {
      console.error('Gagal approve permintaan lagu:', err)
      alert('Gagal approve, coba lagi.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(req) {
    const reason = window.prompt(`Alasan tolak "${req.requested_song_name}" (kosongin kalau ga perlu):`, '')
    if (reason === null) return
    setProcessingId(req.id)
    try {
      const { error } = await supabase
        .from('song_requests')
        .update({ status: 'rejected', admin_note: reason.trim() || null, reviewed_at: new Date().toISOString() })
        .eq('id', req.id)
      if (error) throw error
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: 'rejected', admin_note: reason.trim() || null } : r))
      )
    } catch (err) {
      console.error('Gagal tolak permintaan lagu:', err)
      alert('Gagal tolak, coba lagi.')
    } finally {
      setProcessingId(null)
    }
  }

  const filteredRequests = requests.filter((r) => r.status === filter)

  return (
    <div className="screen">
      <div className="admin-content">
        <button
          className="back-btn ghost-static"
          style={{ marginBottom: 14, width: 'fit-content' }}
          onClick={() => navigate(-1)}
        >
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">PANEL ADMIN</span>
          <h2>Permintaan Lagu Baru</h2>
        </div>

        <div className="type-toggle">
          <button
            type="button"
            className="type-opt"
            style={filter === 'pending' ? { borderColor: 'var(--pink)', color: 'var(--pink)' } : undefined}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            type="button"
            className="type-opt"
            style={filter === 'approved' ? { borderColor: 'var(--lime)', color: 'var(--lime)' } : undefined}
            onClick={() => setFilter('approved')}
          >
            Diterima
          </button>
          <button
            type="button"
            className="type-opt"
            style={filter === 'rejected' ? { borderColor: '#FF5C5C', color: '#FF5C5C' } : undefined}
            onClick={() => setFilter('rejected')}
          >
            Ditolak
          </button>
        </div>

        {loading && <div className="empty-state">Memuat...</div>}
        {!loading && filteredRequests.length === 0 && (
          <div className="empty-state">Gak ada permintaan di kategori ini.</div>
        )}

        {!loading &&
          filteredRequests.map((req) => (
            <div
              key={req.id}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>@{req.creator_username}</div>

              {req.status === 'pending' ? (
                <div className="input-wrap" style={{ marginBottom: 8 }}>
                  <input
                    className="finput-real"
                    value={editedNames[req.id] ?? req.requested_song_name}
                    onChange={(e) => setEditedNames((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  />
                </div>
              ) : (
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{req.requested_song_name}</div>
              )}

              {req.preview_video_url && (
                <video
                  src={req.preview_video_url}
                  muted
                  loop
                  playsInline
                  controls
                  style={{ width: '100%', borderRadius: 10, marginBottom: 8 }}
                />
              )}

              {req.tiktok_link && (
                <a
                  href={req.tiktok_link}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12.5, color: 'var(--pink)', wordBreak: 'break-all', display: 'block', marginBottom: 4 }}
                >
                  {req.tiktok_link}
                </a>
              )}

              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Diajukan: {new Date(req.created_at).toLocaleDateString('id-ID')}
              </p>

              {req.status === 'rejected' && req.admin_note && (
                <p style={{ fontSize: 12, color: '#FF5C5C', marginTop: 6 }}>Alasan: {req.admin_note}</p>
              )}

              {req.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    className="admin-shortcut"
                    style={{ color: 'var(--lime)' }}
                    disabled={processingId === req.id}
                    onClick={() => handleApprove(req)}
                  >
                    {processingId === req.id ? '...' : 'Approve'}
                  </button>
                  <button
                    className="admin-shortcut admin-shortcut-danger"
                    disabled={processingId === req.id}
                    onClick={() => handleReject(req)}
                  >
                    {processingId === req.id ? '...' : 'Tolak'}
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
