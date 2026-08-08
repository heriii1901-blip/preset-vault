import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

const TERMS_TEXT = `Dengan mengajukan diri sebagai kreator di PAM, kamu menyatakan setuju bahwa:

1. Preset yang kamu upload adalah hasil buatan/edit kamu sendiri, bukan curian atau reupload dari kreator lain tanpa izin.
2. Kamu tidak akan mengklaim preset milik orang lain sebagai buatanmu sendiri.
3. Kalau ketahuan reupload/plagiat karya kreator lain, status kreator kamu bisa dicabut sewaktu-waktu tanpa pemberitahuan.
4. Data yang kamu isi (username, link akun, dll) adalah benar dan bisa diverifikasi admin.
5. Admin PAM berhak menolak atau membatalkan pengajuan/status kreator kapan pun kalau ada pelanggaran.`

export default function DaftarKreator() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loadingProfile, setLoadingProfile] = useState(true)
  const [isCreator, setIsCreator] = useState(false)
  const [creatorUsername, setCreatorUsername] = useState('')
  const [application, setApplication] = useState(null)

  const [accountName, setAccountName] = useState('')
  const [tiktokUsername, setTiktokUsername] = useState('')
  const [tiktokLink, setTiktokLink] = useState('')
  const [amVersion, setAmVersion] = useState('')
  const [sampleLink, setSampleLink] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [ownPresets, setOwnPresets] = useState([])
  const [loadingOwn, setLoadingOwn] = useState(false)

  useEffect(() => {
    async function loadStatus() {
      if (!user) return
      setLoadingProfile(true)
      try {
        const [{ data: profile, error: profileErr }, { data: apps, error: appsErr }] = await Promise.all([
          supabase.from('profiles').select('is_creator, creator_username').eq('id', user.id).single(),
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
        setCreatorUsername(profile?.creator_username || '')
        setApplication(apps?.[0] || null)
      } catch (err) {
        console.error('Gagal ambil status kreator:', err)
      } finally {
        setLoadingProfile(false)
      }
    }
    loadStatus()
  }, [user])

  useEffect(() => {
    if (!isCreator || !creatorUsername) return
    async function loadOwnPresets() {
      setLoadingOwn(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .eq('creator_username', creatorUsername)
          .order('created_at', { ascending: false })
        if (error) throw error
        setOwnPresets(data || [])
      } catch (err) {
        console.error('Gagal ambil preset kamu:', err)
      } finally {
        setLoadingOwn(false)
      }
    }
    loadOwnPresets()
  }, [isCreator, creatorUsername])

  function isFormValid() {
    return (
      accountName.trim() &&
      tiktokUsername.trim() &&
      tiktokLink.trim() &&
      amVersion &&
      sampleLink.trim() &&
      agreedToTerms
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isFormValid()) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('creator_applications')
        .insert({
          user_id: user.id,
          account_name: accountName.trim(),
          tiktok_username: tiktokUsername.trim(),
          tiktok_link: tiktokLink.trim(),
          am_version: amVersion,
          sample_link: sampleLink.trim(),
          agreed_to_terms: agreedToTerms,
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

  function renderForm(submitLabel) {
    return (
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Nama Akun TikTok</label>
          <div className="input-wrap">
            <input
              className="finput-real"
              placeholder="Nama tampilan di TikTok kamu"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
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
          <label>Email PAM</label>
          <div className="input-wrap">
            <input className="finput-real" value={user?.email || ''} disabled />
          </div>
        </div>
        <div className="form-field">
          <label>Link Akun TikTok</label>
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
          <label>Versi Alight Motion yang Dipakai</label>
          <div className="type-toggle">
            <button
              type="button"
              className="type-opt"
              style={amVersion === 'AM Ori' ? { borderColor: 'var(--pink)', color: 'var(--pink)' } : undefined}
              onClick={() => setAmVersion('AM Ori')}
            >
              AM Ori
            </button>
            <button
              type="button"
              className="type-opt"
              style={amVersion === 'AM Mod' ? { borderColor: 'var(--pink)', color: 'var(--pink)' } : undefined}
              onClick={() => setAmVersion('AM Mod')}
            >
              AM Mod
            </button>
          </div>
        </div>
        <div className="form-field">
          <label>Link Video Contoh Preset (Versi Terbaik)</label>
          <div className="input-wrap">
            <textarea
              className="finput-real finput-multiline"
              placeholder="Link video TikTok kamu yang preset-nya paling bagus"
              value={sampleLink}
              onChange={(e) => setSampleLink(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            margin: '16px 0',
            fontSize: 12.5,
            color: 'var(--muted)',
            lineHeight: 1.5,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            style={{ marginTop: 3, flexShrink: 0 }}
          />
          <span style={{ whiteSpace: 'pre-line' }}>{TERMS_TEXT}</span>
        </label>
        <button className="save-btn" type="submit" disabled={submitting || !isFormValid()}>
          {submitting ? 'Ngirim...' : submitLabel}
        </button>
      </form>
    )
  }

  return (
    <div className="screen">
      <button
        className="back-btn ghost-static"
        style={{ margin: '14px 0 0 16px', width: 'fit-content' }}
        onClick={() => navigate(-1)}
      >
        ← Balik
      </button>

      <div className="admin-content" style={{ padding: '14px 18px 20px' }}>
        {loadingProfile ? (
          <div className="empty-state">Memuat...</div>
        ) : isCreator ? (
          <>
            <div className="admin-header">
              <span className="admin-tag">KREATOR</span>
              <h2>Preset Kamu ({ownPresets.length})</h2>
            </div>
            <button
              className="save-btn"
              style={{ marginBottom: 16 }}
              onClick={() => alert('Fitur upload preset kreator nyusul ya 🙏')}
            >
              + Upload Preset Baru
            </button>
            {loadingOwn && <div className="empty-state">Memuat presetmu...</div>}
            {!loadingOwn && ownPresets.length === 0 && (
              <div className="empty-state">Kamu belum punya preset. Yuk upload pertamamu!</div>
            )}
            {!loadingOwn && ownPresets.length > 0 && (
              <div className="preset-grid" style={{ padding: 0 }}>
                {ownPresets.map((p) => (
                  <div
                    key={p.id}
                    className="grid-cell"
                    onClick={() => navigate(`/preset/${p.id}`, { state: { source: 'kreator', creatorUsername } })}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {p.preview_video_url ? (
                      <video
                        src={p.preview_video_url}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        draggable={false}
                      />
                    ) : (
                      <div className="grid-fallback">🎬</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="admin-header">
              <span className="admin-tag">KREATOR</span>
              <h2>Program Kreator PAM</h2>
            </div>

            {application?.status === 'pending' && (
              <div className="empty-state">
                Pengajuan kamu (@{application.tiktok_username}) lagi direview admin. Sabar ya, biasanya gak lama kok.
              </div>
            )}

            {application?.status === 'rejected' && (
              <>
                <div className="empty-state" style={{ marginBottom: 16 }}>
                  Pengajuan kamu sebelumnya belum diterima. Boleh coba ajuin lagi di bawah ini.
                </div>
                {renderForm('Ajuin Lagi')}
              </>
            )}

            {!application && (
              <>
                <p className="kreator-landing-text" style={{ marginBottom: 16 }}>
                  Mau jadi kreator dan pajang preset kamu sendiri di PAM? Isi data di bawah ini.
                </p>
                {renderForm('Ajuin Jadi Kreator')}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
