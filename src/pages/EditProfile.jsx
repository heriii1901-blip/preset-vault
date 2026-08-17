import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

export default function EditProfile() {
  const { user, isCreator, creatorUsername } = useAuth()
  const MAX_AVATAR_BYTES = 2 * 1024 * 1024
  const ALLOWED_AVATAR_TYPES = ['image/png', 'image/gif']
  const navigate = useNavigate()

  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profile, setProfile] = useState(null)

  const [nameInput, setNameInput] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [contactInput, setContactInput] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    async function loadProfile() {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, account_name, bio, contact_link, avatar_url, avatar_is_custom')
          .eq('id', user.id)
          .single()
        if (error) throw error
        setProfile(data)
        setNameInput(isCreator ? (data?.account_name || '') : (data?.username || ''))
        setBioInput(data?.bio || '')
        setContactInput(data?.contact_link || '')
      } catch (err) {
        console.error('Gagal ambil profil:', err)
      } finally {
        setLoadingProfile(false)
      }
    }
    loadProfile()
  }, [user, isCreator])

  function handleAvatarPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setStatusMsg('❌ PP cuma boleh PNG atau GIF.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setStatusMsg('❌ PP kegedean, maksimal 2MB.')
      e.target.value = ''
      return
    }
    setStatusMsg('')
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setStatusMsg('')

    if (!nameInput.trim()) return setStatusMsg('Nama tidak boleh kosong.')

    setSaving(true)
    try {
      let avatarUrl = profile?.avatar_url || null
      let avatarIsCustom = profile?.avatar_is_custom || false
      const oldAvatarUrl = profile?.avatar_url || null

      if (avatarFile) {
        const uploadRes = await fetch('/api/upload-avatar-to-r2', {
          method: 'POST',
          headers: {
            'x-file-name': avatarFile.name,
            'Content-Type': avatarFile.type,
          },
          body: avatarFile,
        })
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}))
          throw new Error(errData.error || 'Upload PP gagal')
        }
        const uploadData = await uploadRes.json()
        avatarUrl = uploadData.url
        avatarIsCustom = true
      }

      const updates = { bio: bioInput.trim(), avatar_url: avatarUrl, avatar_is_custom: avatarIsCustom }
      if (isCreator) {
        updates.account_name = nameInput.trim()
        updates.contact_link = contactInput.trim()
      } else {
        updates.username = nameInput.trim()
      }
      
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (error) throw error

      // Hapus PP lama dari R2 kalau ada yang diganti (fire-and-forget, gak nge-block simpen profil)
      if (avatarFile && avatarIsCustom && oldAvatarUrl && oldAvatarUrl !== avatarUrl && profile?.avatar_is_custom) {
        fetch('/api/delete-avatar-from-r2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: oldAvatarUrl }),
        }).catch((err) => console.error('Gagal hapus PP lama:', err))
      }

      setStatusMsg('✅ Profil berhasil disimpen!')
      setTimeout(() => navigate('/akun'), 700)
    } catch (err) {
      console.error('Gagal simpen profil:', err)
      setStatusMsg('❌ Gagal simpen. Cek koneksi, terus coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const currentPhoto = avatarPreview || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture

  if (loadingProfile) {
    return (
      <div className="screen">
        <div className="admin-content">
          <div className="empty-state">Memuat...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="admin-content">
        <button className="back-btn ghost-static" style={{ marginBottom: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">AKUN</span>
          <h2>Edit Profil</h2>
        </div>

        <form onSubmit={handleSave}>
          {(
            <div className="form-field">
              <label>Foto Profil</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {currentPhoto ? (
                  <img
                    src={currentPhoto}
                    alt="Preview avatar"
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div className="avatar" style={{ width: 64, height: 64, flexShrink: 0 }}>
                    {(nameInput || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="upload-box" style={{ flex: 1, cursor: 'pointer', margin: 0 }}>
                  {avatarFile ? `✅ ${avatarFile.name}` : '⬆ Ganti Foto'}
                  <input
                    type="file"
                    accept="image/png,image/gif"
                    style={{ display: 'none' }}
                    onChange={handleAvatarPick}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="form-field">
            <label>{isCreator ? 'Nama Kreator' : 'Nama Tampilan'}</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="Nama kamu..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              {nameInput && (
                <button type="button" className="input-clear-btn" onClick={() => setNameInput('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          {isCreator && (
            <div className="form-field">
              <label>Username Kreator (permanen, gak bisa diubah)</label>
              <input className="finput-real" value={`@${creatorUsername}`} disabled style={{ opacity: 0.6 }} />
            </div>
          )}

          <div className="form-field">
            <label>Bio</label>
            <div className="input-wrap">
              <textarea
                className="finput-real finput-multiline"
                placeholder="Ceritain dikit tentang kamu..."
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                rows={3}
                maxLength={150}
              />
              {bioInput && (
                <button type="button" className="input-clear-btn" onClick={() => setBioInput('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          {isCreator && (
            <div className="form-field">
              <label>Link Kontak (TikTok, WA, dll)</label>
              <div className="input-wrap">
                <input
                  className="finput-real"
                  placeholder="https://..."
                  value={contactInput}
                  onChange={(e) => setContactInput(e.target.value)}
                />
                {contactInput && (
                  <button type="button" className="input-clear-btn" onClick={() => setContactInput('')} aria-label="Hapus isi">×</button>
                )}
              </div>
            </div>
          )}

          {statusMsg && (
            <p style={{ fontSize: 12.5, marginBottom: 12, color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)' }}>
              {statusMsg}
            </p>
          )}

          <button className="save-btn" type="submit" disabled={saving}>
            {saving ? 'Nyimpen...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  )
}
