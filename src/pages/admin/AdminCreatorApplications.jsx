import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { safeHref } from '../utils/safeUrl'

export default function AdminCreatorApplications() {
  const navigate = useNavigate()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [processingId, setProcessingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  
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
          creator_since: new Date().toISOString(),
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
          style={{ margin: '0 0 14px 18px', width: 'fit-content' }}
          onClick={() => navigate(-1)}
        >
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">PANEL ADMIN</span>
          <h2>Pengajuan Kreator</h2>
        </div>

        <div className="type-toggle admin-pad">
          <button
            type="button"
            className="type-opt"
            style={filter === 'pending' ? { borderColor: 'var(--pink)', color: 'var(--pink)' } : undefined}
            onClick={() => { setFilter('pending'); setExpandedId(null) }}
          >
            Pending
          </button>
          <button
            type="button"
            className="type-opt"
            style={filter === 'approved' ? { borderColor: 'var(--lime)', color: 'var(--lime)' } : undefined}
            onClick={() => { setFilter('approved'); setExpandedId(null) }}
          >
            Diterima
          </button>
          <button
            type="button"
            className="type-opt"
            style={filter === 'rejected' ? { borderColor: '#FF5C5C', color: '#FF5C5C' } : undefined}
            onClick={() => { setFilter('rejected'); setExpandedId(null) }}
          >
            Ditolak
          </button>
        </div>

        {loading && <div className="empty-state">Memuat...</div>}

        {!loading && filteredApps.length === 0 && (
          <div className="empty-state">Gak ada pengajuan di kategori ini.</div>
        )}

                {!loading && (
          <div className="admin-pad">
            {filteredApps.map((app) => {
              // Detail pengajuan: dipake langsung kalau pending, disembunyiin di balik
              // panah kalau udah diterima/ditolak.
              const detail = (
                <>
                  <a
                    href={safeHref(app.tiktok_link)}
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
                </>
              )

              // PENDING: tetep kebuka semua kayak sebelumnya
              if (app.status === 'pending') {
                return (
                  <div className="app-card" key={app.id} style={{ padding: 14 }}>
                    <div className="app-card-name" style={{ whiteSpace: 'normal' }}>
                      {app.account_name || '(tanpa nama akun)'}
                    </div>
                    <div className="app-card-user" style={{ marginBottom: 4, whiteSpace: 'normal' }}>
                      @{app.tiktok_username}
                    </div>
                    {detail}
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
                  </div>
                )
              }

              // DITERIMA / DITOLAK: cuma nama + username, detailnya dibuka pakai panah
              const open = expandedId === app.id
              return (
                <div className="app-card" key={app.id}>
                  <button
                    type="button"
                    className="app-card-head"
                    onClick={() => setExpandedId(open ? null : app.id)}
                    aria-expanded={open}
                  >
                    <div className="app-card-head-text">
                      <div className="app-card-name">{app.account_name || '(tanpa nama akun)'}</div>
                      <div className="app-card-user">@{app.tiktok_username}</div>
                    </div>
                    <svg
                      className={`app-card-chevron${open ? ' is-open' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="18"
                      height="18"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {open && <div className="app-card-body">{detail}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
