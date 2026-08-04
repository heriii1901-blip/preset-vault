import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'

const CACHE_KEY = 'kreator-list'

function captureThumb(video, key, setCache) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    if (!canvas.width || !canvas.height) return
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    setCache(`thumb:${key}`, canvas.toDataURL('image/jpeg', 0.6))
  } catch {
    // beda origin, skip
  }
}

const THUMB_COLORS = [
  'linear-gradient(135deg,#7C5CFF,#4A32C9)',
  'linear-gradient(135deg,#FF3D7F,#C91E5A)',
  'linear-gradient(135deg,#D4FF3D,#8FB800)',
  'linear-gradient(135deg,#7C5CFF,#FF3D7F)',
  'linear-gradient(135deg,#4A32C9,#15151D)',
]
function colorFor(username) {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return THUMB_COLORS[Math.abs(hash) % THUMB_COLORS.length]
}

export default function Kreator() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()

  const [panel, setPanel] = useState(0) // 0 = Kreator (list), 1 = Kamu
  const [isDragging, setIsDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const dragState = useRef({ startX: 0, dragging: false, deltaX: 0 })

  // status akun
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [isCreator, setIsCreator] = useState(false)
  const [creatorUsername, setCreatorUsername] = useState('')
  const [application, setApplication] = useState(null)

  // form pengajuan
  const [tiktokUsername, setTiktokUsername] = useState('')
  const [tiktokLink, setTiktokLink] = useState('')
  const [alasan, setAlasan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // list kreator
  const [creatorList, setCreatorList] = useState([])
  const [loadingList, setLoadingList] = useState(true)

  // dashboard kreator
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
    async function loadCreatorList() {
      setLoadingList(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('id, creator_username, tiktok_link, preview_video_url, created_at')
          .order('created_at', { ascending: false })
        if (error) throw error
        const map = new Map()
        for (const p of data || []) {
          if (!p.creator_username) continue
          if (!map.has(p.creator_username)) {
            map.set(p.creator_username, { ...p, count: 1 })
          } else {
            map.get(p.creator_username).count += 1
          }
        }
        setCreatorList(Array.from(map.values()))
      } catch (err) {
        console.error('Gagal ambil daftar kreator:', err)
      } finally {
        setLoadingList(false)
      }
    }
    loadCreatorList()
  }, [])

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

  // --- swipe (pointer, jalan buat touch & mouse) ---
  function onPointerDown(e) {
    dragState.current = { startX: e.clientX, dragging: true, deltaX: 0 }
    setIsDragging(true)
  }
  function onPointerMove(e) {
    if (!dragState.current.dragging) return
    const delta = e.clientX - dragState.current.startX
    dragState.current.deltaX = delta
    setDragX(delta)
  }
  function endDrag() {
    if (!dragState.current.dragging) return
    const delta = dragState.current.deltaX
    dragState.current.dragging = false
    setIsDragging(false)
    setDragX(0)
    if (delta < -60 && panel === 0) setPanel(1)
    else if (delta > 60 && panel === 1) setPanel(0)
  }

  const trackStyle = {
    transform: `translateX(calc(${-panel * 50}% + ${dragX}px))`,
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
      <div
        className="kreator-tabs"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <button className={panel === 0 ? 'kreator-tab active' : 'kreator-tab'} onClick={() => setPanel(0)}>
          Kreator
        </button>
        <button className={panel === 1 ? 'kreator-tab active' : 'kreator-tab'} onClick={() => setPanel(1)}>
          Kamu
        </button>
        <div className="kreator-tabs-indicator" style={{ transform: `translateX(${panel * 100}%)` }} />
      </div>
      <div
        className="kreator-swipe-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <div className={isDragging ? 'kreator-swipe-track dragging' : 'kreator-swipe-track'} style={trackStyle}>
          {/* PANEL 1: List semua kreator, style kek list Lagu */}
          <div className="kreator-panel">
            <div className="list-header" style={{ padding: '16px 18px 4px', margin: 0 }}>
              <div className="eyebrow">KREATOR</div>
            </div>
            {loadingList && <div className="empty-state">Memuat...</div>}
            {!loadingList && creatorList.length === 0 && (
              <div className="empty-state">Belum ada kreator.</div>
            )}
            {!loadingList && creatorList.length > 0 && (
              <div className="song-list" style={{ padding: '0 18px' }}>
                {creatorList.map((c) => (
                  <div
                    key={c.creator_username}
                    className="song-row"
                    onClick={() => navigate(`/preset/${c.id}`, { state: { source: 'kreator', creatorUsername: c.creator_username } })}
                  >
                    <div className="song-thumb" style={{ background: colorFor(c.creator_username) }}>
                      {c.creator_username.charAt(0).toUpperCase()}
                    </div>
                    <div className="song-text">
                      <h4>@{c.creator_username}</h4>
                    </div>
                    <span className="song-count">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PANEL 2: Kamu */}
          <div className="kreator-panel">
            <div className="admin-content" style={{ padding: '0 18px 20px' }}>
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

                  {!application && (
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
