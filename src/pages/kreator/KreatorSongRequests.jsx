import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

const HISTORY_DAYS = 30

const STATUS = {
  pending: { label: 'Menunggu', color: 'var(--muted)' },
  approved: { label: 'Disetujui', color: 'var(--accent)' },
  rejected: { label: 'Ditolak', color: 'var(--pink)' },
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function KreatorSongRequests() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      try {
        // Riwayat cuma nampilin request 30 hari terakhir
        const cutoff = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('song_requests')
          .select('id, requested_song_name, status, admin_note, created_at')
          .eq('user_id', user.id)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
        if (error) throw error
        setRequests(data || [])
      } catch (err) {
        console.error('Gagal ambil riwayat request lagu:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

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
          <h2>Request Lagu</h2>
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 18px 14px' }}>
          Riwayat disimpan {HISTORY_DAYS} hari terakhir.
        </p>

        {loading && <div className="empty-state">Memuat...</div>}

        {!loading && requests.length === 0 && (
          <div className="empty-state">Belum ada request lagu dalam {HISTORY_DAYS} hari terakhir.</div>
        )}

        {!loading && requests.length > 0 && (
          <div className="preset-manage-list admin-pad">
            {requests.map((req) => {
              const status = STATUS[req.status] || STATUS.pending
              return (
                <div className="preset-manage-row" key={req.id}>
                  <div className="pmr-info">
                    <h4>{req.requested_song_name}</h4>
                    <p>
                      {formatDate(req.created_at)}
                      {req.status === 'rejected' && req.admin_note ? ` · ${req.admin_note}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: status.color, flexShrink: 0 }}>
                    {status.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
