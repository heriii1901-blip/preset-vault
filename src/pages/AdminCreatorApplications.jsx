import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function AdminCreatorApplications() {
  const navigate = useNavigate()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [processingId, setProcessingId] = useState(null)

  useEffect(() => {
    loadApps()
  }, [])

  async function loadApps() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('creator_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setApps(data || [])
    } catch (err) {
      console.error('Gagal ambil daftar pengajuan:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(app) {
    setProcessingId(app.id)
    try {
      const { error: appErr } = await supabase
        .from('creator_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', app.id)
      if (appErr) throw appErr

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          is_creator: true,
          creator_username: app.tiktok_username,
          tiktok_link: app.tiktok_link,
          account_name: app.account_name,account_font: app.account_font,
          account_bold: app.account_bold,
         })
        .eq('id', app.user_id)
      if (profileErr) throw profileErr

      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: 'approved' } : a)))
    } catch (err) {
      console.error('Gagal approve pengajuan:', err)
      alert('Gagal approve, coba lagi.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(app) {
    const ok = window.confirm(`Yakin tolak pengajuan @${app.tiktok_username}?`)
    if (!ok) return
    setProcessingId(app.id)
    try {
      const { error } = await supabase
        .from('creator_applications')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', app.id)
      if (error) throw error
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: 'rejected' } : a)))
    } catch (err) {
      console.error('Gagal reject pengajuan:', err)
      alert('Gagal reject, coba lagi.')
    } finally {
      setProcessingId(null)
    }
  }

  const filteredApps = apps.filter((a) => a.status === filter)

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
          <h2>Pengajuan Kreator</h2>
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

        {!loading && filteredApps.length === 0 && (
          <div className="empty-state">Gak ada pengajuan di kategori ini.</div>
        )}

        {!loading &&
          filteredApps.map((app) => (
            <div
              key={app.id}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{app.account_name || '(tanpa nama akun)'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 4 }}>@{app.tiktok_username}</div>
              <a
                href={app.tiktok_link}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12.5, color: 'var(--pink)', wordBreak: 'break-all' }}
              >
                {app.tiktok_link}
              </a>
              {app.am_version && (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>Versi: {app.am_version}</p>
              )}
              {app.sample_link && (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, wordBreak: 'break-all' }}>
                  Contoh preset: {app.sample_link}
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Diajukan: {new Date(app.created_at).toLocaleDateString('id-ID')}
              </p>

              {app.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    className="admin-shortcut"
                    style={{ color: 'var(--lime)' }}
                    disabled={processingId === app.id}
                    onClick={() => handleApprove(app)}
                  >
                    {processingId === app.id ? '...' : 'Terima'}
                  </button>
                  <button
                    className="admin-shortcut admin-shortcut-danger"
                    disabled={processingId === app.id}
                    onClick={() => handleReject(app)}
                  >
                    {processingId === app.id ? '...' : 'Tolak'}
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
