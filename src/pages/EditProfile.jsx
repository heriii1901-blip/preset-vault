import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

const CROP_SIZE = 260 // ukuran kotak crop di layar (px)
const OUTPUT_SIZE = 480 // ukuran akhir avatar yang di-generate (px)

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

export default function EditProfile() {
  const { user, isCreator, creatorUsername } = useAuth()
  const MAX_RAW_AVATAR_BYTES = 15 * 1024 * 1024 // batas file MENTAH sebelum di-crop (hasil akhir selalu kecil, jadi ini cuma jaga2 biar ga nge-hang browser)
  const ALLOWED_AVATAR_TYPES = ['image/png', 'image/gif', 'image/jpeg', 'image/jpg', 'image/webp']
  const ALLOWED_AVATAR_EXT = /\.(png|gif|jpe?g|webp)$/i
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

  // --- state buat modal crop foto ---
  const [cropSrc, setCropSrc] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const dragRef = useRef(null)
  const cropImgRef = useRef(null)

  const baseScale = naturalSize.w && naturalSize.h ? Math.max(CROP_SIZE / naturalSize.w, CROP_SIZE / naturalSize.h) : 1
  const displayScale = baseScale * zoom
  const displayedW = naturalSize.w * displayScale
  const displayedH = naturalSize.h * displayScale

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

    const typeOk = ALLOWED_AVATAR_TYPES.includes(file.type) || (!file.type && ALLOWED_AVATAR_EXT.test(file.name))
    if (!typeOk) {
      setStatusMsg('❌ PP cuma boleh PNG, JPG, WEBP, atau GIF.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_RAW_AVATAR_BYTES) {
      setStatusMsg('❌ Foto kegedean, maksimal 15MB (sebelum di-crop).')
      e.target.value = ''
      return
    }

    setStatusMsg('')
    setCropSrc(URL.createObjectURL(file))
    e.target.value = '' // biar bisa pilih file yang sama lagi kalo mau ulang
  }

  function handleCropImgLoad(e) {
    const img = e.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    setNaturalSize({ w, h })
    const scale = Math.max(CROP_SIZE / w, CROP_SIZE / h)
    const dW = w * scale
    const dH = h * scale
    setOffset({ x: (CROP_SIZE - dW) / 2, y: (CROP_SIZE - dH) / 2 })
    setZoom(1)
  }

  function clampOffset(x, y, dW, dH) {
    const minX = CROP_SIZE - dW
    const minY = CROP_SIZE - dH
    return { x: clamp(x, minX, 0), y: clamp(y, minY, 0) }
  }

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const next = clampOffset(
      dragRef.current.startOffset.x + dx,
      dragRef.current.startOffset.y + dy,
      displayedW,
      displayedH
    )
    setOffset(next)
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleZoomChange(e) {
    const newZoom = parseFloat(e.target.value)
    const newScale = baseScale * newZoom
    const dW = naturalSize.w * newScale
    const dH = naturalSize.h * newScale
    setZoom(newZoom)
    setOffset((prev) => clampOffset(prev.x, prev.y, dW, dH))
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setNaturalSize({ w: 0, h: 0 })
  }

  function confirmCrop() {
    const img = cropImgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    const sx = -offset.x / displayScale
    const sy = -offset.y / displayScale
    const sSize = CROP_SIZE / displayScale
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        setAvatarFile(file)
        setAvatarPreview(URL.createObjectURL(blob))
        closeCropper()
      },
      'image/jpeg',
      0.9
    )
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
        <button className="back-btn ghost-static" style={{ marginBottom: 14, marginLeft: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">AKUN</span>
          <h2>Edit Profil</h2>
        </div>

        <form onSubmit={handleSave} style={{ padding: '0 14px 14px' }}>
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
                  accept="image/png,image/gif,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleAvatarPick}
                />
              </label>
            </div>
          </div>

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

      {cropSrc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
            gap: 18,
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Geser buat posisi, slider buat zoom</p>

          <div
            style={{
              width: CROP_SIZE,
              height: CROP_SIZE,
              borderRadius: '50%',
              overflow: 'hidden',
              position: 'relative',
              touchAction: 'none',
              background: '#000',
              cursor: 'grab',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              ref={cropImgRef}
              src={cropSrc}
              alt=""
              onLoad={handleCropImgLoad}
              draggable={false}
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: displayedW || 'auto',
                height: displayedH || 'auto',
                maxWidth: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          </div>

          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={handleZoomChange}
            style={{ width: CROP_SIZE }}
          />

          <div style={{ display: 'flex', gap: 10, width: CROP_SIZE }}>
            <button type="button" className="back-btn ghost-static" style={{ flex: 1, justifyContent: 'center' }} onClick={closeCropper}>
              Batal
            </button>
            <button type="button" className="save-btn" style={{ flex: 1 }} onClick={confirmCrop}>
              Pakai Foto Ini
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
