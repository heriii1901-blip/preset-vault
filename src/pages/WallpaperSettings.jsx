import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { deleteFromR2 } from '../utils/deleteFromR2'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_RAW_BYTES = 5 * 1024 * 1024

export default function WallpaperSettings() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  // Cuma jalan pas user berubah (login/ganti akun), sekali per sesi, gak ada resiko loop.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    async function loadProfile() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('wallpaper_url')
          .eq('id', user.id)
          .single()
        if (error) throw error
        if (!cancelled) setProfile(data)
      } catch (err) {
        console.error('Gagal ambil wallpaper:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadProfile()
    return () => { cancelled = true }
  }, [user?.id])

  function handlePick(e) {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!ALLOWED_TYPES.includes(picked.type)) {
      setStatusMsg('❌ Wallpaper cuma boleh PNG, JPG, atau WEBP.')
      e.target.value = ''
      return
    }
    if (picked.size > MAX_RAW_BYTES) {
      setStatusMsg('❌ File kegedean, maksimal 5MB.')
      e.target.value = ''
      return
    }
    setStatusMsg('')
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
    e.target.value = ''
  }

  async function handleSave() {
    if (!file) return
    setSaving(true)
    setStatusMsg('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const uploadRes = await fetch('/api/upload-wallpaper-to-r2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData?.session?.access_token || ''}`,
          'x-file-name': file.name,
          'Content-Type': file.type,
        },
        body: file,
      })
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}))
        throw new Error(errData.detail || errData.error || `Upload gagal (status ${uploadRes.status})`)
      }
      const { url } = await uploadRes.json()
      const oldUrl = profile?.wallpaper_url || null

      const { error } = await supabase
        .from('profiles')
        .update({ wallpaper_url: url })
        .eq('id', user.id)
      if (error) throw error

      if (oldUrl) deleteFromR2(oldUrl)

      setProfile({ wallpaper_url: url })
      setFile(null)
      setPreview(null)
      setStatusMsg('✅ Wallpaper berhasil diganti!')
    } catch (err) {
      console.error('Gagal simpen wallpaper:', err)
      setStatusMsg(`❌ DEBUG: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!profile?.wallpaper_url) return
    setSaving(true)
    setStatusMsg('')
    try {
      const oldUrl = profile.wallpaper_url
      const { error } = await supabase
        .from('profiles')
        .update({ wallpaper_url: null })
        .eq('id', user.id)
      if (error) throw error

      deleteFromR2(oldUrl)
      
      setProfile({ wallpaper_url: null })
      setFile(null)
      setPreview(null)
      setStatusMsg('✅ Balik ke wallpaper default.')
    } catch (err) {
      console.error('Gagal reset wallpaper:', err)
      setStatusMsg('❌ Gagal reset, coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const previewSrc = preview || profile?.wallpaper_url || '/terbaru-banner.jpg'

  return (
    <div className="screen">
      <div className="admin-content">
        <button className="back-btn ghost-static" style={{ marginBottom: 14, marginLeft: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">AKUN</span>
          <h2>Ubah Wallpaper</h2>
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            Preview tampilan halaman Terbaru kamu:
          </p>

          <div className="wallpaper-preview">
            <div className="terbaru-banner">
              <img src={previewSrc} alt="" draggable={false} />
              <div className="terbaru-banner-gradient" />
              <h3 className="terbaru-banner-title">Terbaru</h3>
            </div>
          </div>

          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 14 }}>Memuat...</p>
          ) : isAdmin ? (
            <>
              <label className="upload-box" style={{ cursor: 'pointer', marginTop: 16 }}>
                {file ? `✅ ${file.name}` : '⬆ Pilih Gambar Wallpaper'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handlePick}
                />
              </label>

              {statusMsg && (
                <p style={{ fontSize: 12.5, marginTop: 10, color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)' }}>
                  {statusMsg}
                </p>
              )}

              <button className="save-btn" type="button" disabled={!file || saving} onClick={handleSave} style={{ marginTop: 12 }}>
                {saving ? 'Nyimpen...' : 'Simpan Wallpaper'}
              </button>

              {profile?.wallpaper_url && (
                <button
                  className="back-btn ghost-static"
                  type="button"
                  disabled={saving}
                  onClick={handleReset}
                  style={{ marginTop: 10, width: '100%' }}
                >
                  Balik ke Default
                </button>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 16 }}>
              Fitur ganti wallpaper masih tahap testing — buat sekarang cuma admin yang bisa ubah dulu.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
