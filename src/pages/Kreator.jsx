import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

export default function Kreator() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [isCreator, setIsCreator] = useState(false)
  const [application, setApplication] = useState(null)

  const [tiktokUsername, setTiktokUsername] = useState('')
  const [tiktokLink, setTiktokLink] = useState('')
  const [alasan, setAlasan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadStatus() {
      if (!user) return
      setLoading(true)
      try {
        const [{ data: profile, error: profileErr }, { data: apps, error: appsErr }] = await Promise.all([
          supabase.from('profiles').select('is_creator').eq('id', user.id).single(),
          supabase
            .from('creator_applications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1),
        ])
        if (profileErr) throw profileErr
        if (appsErr) throw appsErr
        setIsCreator(profile?.is_creator || false)
        setApplication(apps?.[0] || null)
      } catch (err) {
        console.error('Gagal ambil status kreator:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStatus()
  }, [user])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!tiktokUsername.trim() || !tiktokLink.trim()) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('creator_applications')
        .insert({
          user_id: user.id,
          tiktok_username: tiktokUsername.trim(),
          tiktok_link: tiktokLink.trim(),
          alasan: alasan.trim() || null,
        })
        .select()
        .single()
      if (error) throw error
      setApplication(data)
    } catch (err) {
      console.error('Gagal kirim pengajuan kreator:', err)
      alert('Gagal kirim pengajuan, coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Memuat...
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="screen">
        <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
          Akan Hadir!!!
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="admin-content">
        {isAdmin && (
          <div className="admin-shortcut-row">
            <button className="admin-shortcut" onClick={() => navigate('/admin/kreator-pengajuan')}>
              Review Pengajuan Kreator
            </button>
          </div>
        )}

        <div className="admin-header">
          <span className="admin-tag">KREATOR</span>
          <h2>Program Kreator PAM</h2>
        </div>

        {isCreator && (
          <div className="empty-state">
            Kamu udah jadi Kreator PAM! 🎉 Fitur upload preset sendiri lagi disiapin, tunggu update selanjutnya ya.
          </div>
        )}

        {!isCreator && application?.status === 'pending' && (
          <div className="empty-state">
            Pengajuan kamu (@{application.tiktok_username}) lagi direview admin. Sabar ya, biasanya gak lama kok.
          </div>
        )}

        {!isCreator && application?.status === 'rejected' && (
          <>
            <div className="empty-state" style={{ marginBottom: 16 }}>
              Pengajuan kamu sebelumnya belum diterima. Boleh coba ajuin lagi di bawah ini.
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label>Username TikTok</label>
                <div className="input-wrap">
                  <input
                    className="finput-real"
                    placeholder="tanpa @"
                    value={tiktokUsername}
                    onChange={(e) => setTiktokUsername(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-field">
                <label>Link Profil TikTok</label>
                <div className="input-wrap">
                  <input
                    className="finput-real"
                    placeholder="https://tiktok.com/@username"
                    value={tiktokLink}
                    onChange={(e) => setTiktokLink(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-field">
                <label>Alasan / Contoh Preset (opsional)</label>
                <div className="input-wrap">
                  <textarea
                    className="finput-real finput-multiline"
                    placeholder="lagi review fiturnya dulu rek"
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <button className="save-btn" type="submit" disabled={submitting}>
                {submitting ? 'Ngirim...' : 'Ajuin Lagi'}
              </button>
            </form>
          </>
        )}

        {!isCreator && !application && (
          <form onSubmit={handleSubmit}>
            <div className="empty-state" style={{ marginBottom: 16, textAlign: 'left' }}>
              Mau jadi kreator dan pajang preset kamu sendiri di PAM? Isi form di bawah, nanti direview manual dulu ya.
            </div>
            <div className="form-field">
              <label>Username TikTok</label>
              <div className="input-wrap">
                <input
                  className="finput-real"
                  placeholder="tanpa @"
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value)}
                />
              </div>
            </div>
            <div className="form-field">
              <label>Link Profil TikTok</label>
              <div className="input-wrap">
                <input
                  className="finput-real"
                  placeholder="https://tiktok.com/@username"
                  value={tiktokLink}
                  onChange={(e) => setTiktokLink(e.target.value)}
                />
              </div>
            </div>
            <div className="form-field">
              <label>Alasan / Contoh Preset (opsional)</label>
              <div className="input-wrap">
                <textarea
                  className="finput-real finput-multiline"
                  placeholder="Ceritain dikit kenapa mau jadi kreator di PAM..."
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <button className="save-btn" type="submit" disabled={submitting}>
              {submitting ? 'Ngirim...' : 'Ajuin Jadi Kreator'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
