import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { usePresetCache } from '../../context/PresetCacheContext'
import { deleteFromR2 } from '../../utils/deleteFromR2'

// Terima "@user", "user", atau link profil tiktok.com/@user -> "user" (huruf kecil, tanpa @)
function cleanUsername(raw) {
  const s = String(raw || '').trim()
  const m = s.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i)
  return (m ? m[1] : s.replace(/^@/, '')).toLowerCase()
}

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  return `Bearer ${data?.session?.access_token || ''}`
}

const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif']

export default function AdminKreatorKhusus() {
  const navigate = useNavigate()
  const { clearCache } = usePresetCache()

  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)

  const [usernameInput, setUsernameInput] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [tiktokLink, setTiktokLink] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('') // hasil "Ambil dari TikTok" (udah ada di R2)
  const [avatarFile, setAvatarFile] = useState(null) // foto pilihan manual
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')

  // Ambil daftar kreator khusus SEKALI pas halaman dibuka.
  // Dep array kosong; setelah tambah/hapus state diupdate lokal (ngga refetch) -> ngga ada resiko loop / egress berulang.
  useEffect(() => {
    async function loadGuests() {
      try {
        const { data, error } = await supabase
          .from('guest_creators')
          .select('*')
          .order('created_at', { ascending: true })
        if (error) throw error
        setGuests(data || [])
      } catch (err) {
        console.error('Gagal ambil kreator khusus:', err)
      } finally {
        setLoading(false)
      }
    }
    loadGuests()
  }, [])

  function clearAvatarPreview() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(null)
  }

  function resetForm() {
    setUsernameInput('')
    setDisplayName('')
    setBio('')
    setTiktokLink('')
    setAvatarUrl('')
    setAvatarFile(null)
    clearAvatarPreview()
  }

  function handlePickAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return setStatusMsg('Foto PP maksimal 2MB.')
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return setStatusMsg('Format foto cuma boleh PNG, JPG, atau GIF.')
    }
    clearAvatarPreview()
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setStatusMsg('')
  }

  async function handleFetchTiktok() {
    setStatusMsg('')
    const username = cleanUsername(usernameInput)
    if (!username) return setStatusMsg('Isi username TikTok dulu.')

    setFetching(true)
    try {
      const res = await fetch('/api/tiktok-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
        body: JSON.stringify({ username }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `status ${res.status}`)

      setUsernameInput(json.username || username)
      if (json.nickname) setDisplayName(json.nickname)
      if (json.bio) setBio(json.bio)
      setTiktokLink(json.tiktokLink || `https://www.tiktok.com/@${username}`)

      if (json.avatarUrl) {
        setAvatarUrl(json.avatarUrl)
        setAvatarFile(null)
        clearAvatarPreview()
        setStatusMsg('✅ Data TikTok ke-ambil.')
      } else {
        setStatusMsg('✅ Nama ke-ambil, tapi foto profilnya gak kebaca. Pilih foto manual di bawah.')
      }
    } catch (err) {
      setStatusMsg(`Gagal ambil dari TikTok (${err.message}). Isi manual aja di bawah.`)
    } finally {
      setFetching(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setStatusMsg('')

    const username = cleanUsername(usernameInput)
    if (!/^[a-z0-9._]{1,40}$/.test(username)) {
      return setStatusMsg('Username cuma boleh huruf, angka, titik, dan underscore.')
    }
    if (!displayName.trim()) return setStatusMsg('Nama kreator belum diisi.')
    if (guests.some((g) => g.creator_username === username)) {
      return setStatusMsg('Kreator khusus ini sudah ada.')
    }

    setSaving(true)
    let uploadedNow = null
    try {
      // Jangan sampai bentrok sama kreator yang daftar sendiri
      const { data: taken, error: takenErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('creator_username', username)
        .maybeSingle()
      if (takenErr) throw takenErr
      if (taken) {
        setStatusMsg('Username ini sudah dipakai kreator yang daftar sendiri.')
        return
      }

      let finalAvatar = avatarUrl || null
      if (avatarFile) {
        const uploadRes = await fetch('/api/upload-avatar-to-r2', {
          method: 'POST',
          headers: {
            Authorization: await authHeader(),
            'x-file-name': avatarFile.name,
            'Content-Type': avatarFile.type,
          },
          body: avatarFile,
        })
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}))
          throw new Error(errData.detail || errData.error || `Upload foto gagal (status ${uploadRes.status})`)
        }
        finalAvatar = (await uploadRes.json()).url
        uploadedNow = finalAvatar
      }

      const { data: inserted, error: insErr } = await supabase
        .from('guest_creators')
        .insert({
          creator_username: username,
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          avatar_url: finalAvatar,
          tiktok_link: tiktokLink.trim() || null,
        })
        .select()
        .single()
      if (insErr) throw insErr

      uploadedNow = null
      setGuests((prev) => [...prev, inserted])
      clearCache('kreator-guests')
      resetForm()
      setStatusMsg('✅ Kreator khusus ditambah. Sekarang bisa dipilih di Post Khusus.')
    } catch (err) {
      console.error('Gagal simpan kreator khusus:', err)
      if (uploadedNow) deleteFromR2(uploadedNow) // jangan ninggalin foto yatim di R2
      setStatusMsg(`Gagal simpan: ${err.message || 'coba lagi'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(g) {
    const ok = window.confirm(
      `Hapus kreator khusus "${g.display_name || g.creator_username}"?\n\nPreset yang sudah diposting TIDAK ikut terhapus, cuma profil kreatornya.`
    )
    if (!ok) return

    setDeletingId(g.id)
    try {
      const { data, error } = await supabase
        .from('guest_creators')
        .delete()
        .eq('id', g.id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Ngga ke-hapus (cek policy tabel)')

      if (g.avatar_url) deleteFromR2(g.avatar_url)
      setGuests((prev) => prev.filter((x) => x.id !== g.id))
      clearCache('kreator-guests')
    } catch (err) {
      console.error('Gagal hapus kreator khusus:', err)
      setStatusMsg(`Gagal hapus: ${err.message || 'coba lagi'}`)
    } finally {
      setDeletingId(null)
    }
  }

  const previewSrc = avatarPreview || avatarUrl || null

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
          <h2>Kreator Khusus</h2>
        </div>

        <form onSubmit={handleSave} className="admin-pad">
          <div className="form-field">
            <label>Username TikTok</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="@username atau link profil TikTok"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
              {usernameInput && (
                <button type="button" className="input-clear-btn" onClick={() => setUsernameInput('')} aria-label="Hapus isi">×</button>
              )}
            </div>
            <button
              type="button"
              className="save-btn"
              style={{ marginTop: 10 }}
              onClick={handleFetchTiktok}
              disabled={fetching}
            >
              {fetching ? 'Mengambil...' : 'Ambil dari TikTok'}
            </button>
          </div>

          <div className="form-field">
            <label>Nama kreator</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="Nama yang tampil di PAM"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              {displayName && (
                <button type="button" className="input-clear-btn" onClick={() => setDisplayName('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Bio (opsional)</label>
            <div className="input-wrap">
              <textarea
                className="finput-real finput-multiline"
                placeholder="Bio singkat..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Foto profil</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt=""
                  style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--line)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--muted)', fontSize: 12,
                  }}
                >
                  kosong
                </div>
              )}
              <label className="upload-box" style={{ display: 'block', cursor: 'pointer', flex: 1, margin: 0 }}>
                {avatarFile ? `✅ ${avatarFile.name}` : '⬆ Pilih foto manual'}
                <input type="file" accept="image/png,image/jpeg,image/gif" style={{ display: 'none' }} onChange={handlePickAvatar} />
              </label>
            </div>
          </div>

          <div className="form-field">
            <label>Link TikTok</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="https://www.tiktok.com/@username"
                value={tiktokLink}
                onChange={(e) => setTiktokLink(e.target.value)}
              />
              {tiktokLink && (
                <button type="button" className="input-clear-btn" onClick={() => setTiktokLink('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          {statusMsg && (
            <p style={{ fontSize: 12.5, marginBottom: 12, color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)' }}>
              {statusMsg}
            </p>
          )}

          <button className="save-btn" type="submit" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Kreator Khusus'}
          </button>
        </form>

        <div className="admin-header" style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 16 }}>Daftar kreator khusus</h2>
        </div>

        {loading && <div className="empty-state">Memuat...</div>}
        {!loading && guests.length === 0 && <div className="empty-state">Belum ada kreator khusus.</div>}

        {!loading && guests.length > 0 && (
          <div className="preset-manage-list admin-pad">
            {guests.map((g) => (
              <div className="preset-manage-row" key={g.id}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  {g.avatar_url ? (
                    <img
                      src={g.avatar_url}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', marginRight: 10, flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: '50%', marginRight: 10, flexShrink: 0,
                        background: 'var(--line)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700,
                      }}
                    >
                      {(g.display_name || g.creator_username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="pmr-info">
                    <h4>{g.display_name || g.creator_username}</h4>
                    <p>@{g.creator_username}</p>
                  </div>
                </div>
                <div className="pmr-actions">
                  <button
                    className="pmr-delete"
                    type="button"
                    disabled={deletingId === g.id}
                    onClick={() => handleDelete(g)}
                  >
                    {deletingId === g.id ? '...' : 'Hapus'}
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
