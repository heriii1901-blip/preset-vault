import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useUploadQueue } from '../context/UploadQueueContext'

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  return `Bearer ${data?.session?.access_token || ''}`
}

export default function AdminPostKhusus() {
  const navigate = useNavigate()
  const { enqueuePresetUpload } = useUploadQueue()

  const [guests, setGuests] = useState([])
  const [loadingGuests, setLoadingGuests] = useState(true)
  const [selectedGuestId, setSelectedGuestId] = useState('')
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false)
  const guestDropdownRef = useRef(null)

  const [songs, setSongs] = useState([])
  const [songMode, setSongMode] = useState('existing')
  const [selectedSongId, setSelectedSongId] = useState('')
  const [songDropdownOpen, setSongDropdownOpen] = useState(false)
  const songDropdownRef = useRef(null)
  const [newSongName, setNewSongName] = useState('')

  const [xmlLink, setXmlLink] = useState('')
  const [mbLink, setMbLink] = useState('')
  const [tiktokLink, setTiktokLink] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [skipCompress, setSkipCompress] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [autoFetching, setAutoFetching] = useState(false)
  
  // Ambil daftar kreator khusus SEKALI pas halaman dibuka (dep array kosong, ngga ada state
  // yang berubah di dalamnya yang jadi dependency) -> ngga ada resiko loop / query berulang.
  useEffect(() => {
    async function loadGuests() {
      try {
        const { data, error } = await supabase
          .from('guest_creators')
          .select('id, creator_username, display_name')
          .order('created_at', { ascending: true })
        if (error) throw error
        setGuests(data || [])
      } catch (err) {
        console.error('Gagal ambil kreator khusus:', err)
      } finally {
        setLoadingGuests(false)
      }
    }
    loadGuests()
  }, [])

  // Ambil daftar lagu SEKALI (dep array kosong) -> aman dari loop.
  useEffect(() => {
    async function loadSongs() {
      try {
        const { data, error } = await supabase.from('songs').select('*')
        if (error) throw error
        setSongs([...(data || [])].sort((a, b) => a.name.localeCompare(b.name)))
      } catch (err) {
        console.error('Gagal ambil daftar lagu:', err)
      }
    }
    loadSongs()
  }, [])

  // Tutup dropdown kalau klik di luar (ngga manggil Supabase)
  useEffect(() => {
    function handleClickOutside(e) {
      if (guestDropdownRef.current && !guestDropdownRef.current.contains(e.target)) {
        setGuestDropdownOpen(false)
      }
      if (songDropdownRef.current && !songDropdownRef.current.contains(e.target)) {
        setSongDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  // Kreator yang dipilih SENGAJA ngga di-reset: biar enak spam post buat kreator yang sama.
  const resetForm = () => {
    setXmlLink('')
    setMbLink('')
    setTiktokLink('')
    setPreviewFile(null)
    setSkipCompress(false)
    setNewSongName('')
    setSongMode('existing')
    setSelectedSongId('')
  }

  const handleAutoDownload = async () => {
    setStatusMsg('')
    if (!tiktokLink.trim()) return setStatusMsg('Isi link video TikTok dulu.')

    setAutoFetching(true)
    try {
      const res = await fetch(`/api/download-tiktok-video?url=${encodeURIComponent(tiktokLink.trim())}`, {
        headers: { Authorization: await authHeader() },
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `status ${res.status}`)
      }
      const blob = await res.blob()
      const file = new File([blob], `tiktok-${Date.now()}.mp4`, { type: 'video/mp4' })
      setPreviewFile(file)
      setStatusMsg(`✅ Video keambil otomatis (${(file.size / 1024 / 1024).toFixed(1)} MB). Nanti dikompres otomatis kalau perlu pas disimpan.`)
    } catch (err) {
      setStatusMsg(`Gagal ambil otomatis (${err.message}). Upload manual aja di bawah.`)
    } finally {
      setAutoFetching(false)
    }
  }

  const handleSave = (e) => {
    e.preventDefault()
    setStatusMsg('')

    const guest = guests.find((g) => g.id === selectedGuestId)
    if (!guest) return setStatusMsg('Pilih kreator khusus dulu.')
    if (!mbLink.trim()) return setStatusMsg('Link 5MB (Alight Creative) belum diisi.')
    if (!xmlLink.trim()) {
      const lanjut = window.confirm(
        'Link XML belum diisi. Preset ini bakal disembunyiin dari publik dan masuk tab "Link Kosong" sampe link-nya diisi. Lanjut upload?'
      )
      if (!lanjut) return
    }
    if (!previewFile) return setStatusMsg('Video contoh belum dipilih.')
    if (songMode === 'new' && !newSongName.trim()) return setStatusMsg('Nama lagu baru belum diisi.')
    if (songMode === 'existing' && !selectedSongId) return setStatusMsg('Pilih lagunya dulu.')

    enqueuePresetUpload({
      previewFile,
      songMode,
      selectedSongId,
      newSongName: newSongName.trim(),
      xmlLink: xmlLink.trim(),
      mbLink: mbLink.trim(),
      tiktokLink: tiktokLink.trim(),
      creatorUsername: guest.creator_username,
      directSongCreate: true,
      skipCompress,
      hideFromLatest: true, // post khusus: ngga masuk Terbaru, langsung ke lagu + halaman kreator
    })

    setStatusMsg(`✅ Ditambahin ke antrian upload (atas nama ${guest.display_name || guest.creator_username}). Boleh langsung post lagi.`)
    resetForm()
  }

  const selectedGuest = guests.find((g) => g.id === selectedGuestId)

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
          <h2>Post Khusus</h2>
        </div>

        <form onSubmit={handleSave} className="admin-pad">
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
            Preset dari halaman ini ngga muncul di Terbaru. Langsung masuk ke lagu dan halaman kreatornya.
          </p>

          <div className="form-field">
            <label>Kreator</label>
            {loadingGuests ? (
              <p className="hint" style={{ color: 'var(--muted)' }}>Memuat...</p>
            ) : guests.length === 0 ? (
              <>
                <p className="hint" style={{ color: 'var(--muted)' }}>Belum ada kreator khusus.</p>
                <button
                  type="button"
                  className="save-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => navigate('/admin/kreator-khusus')}
                >
                  Tambah kreator khusus
                </button>
              </>
            ) : (
              <div className="custom-select" ref={guestDropdownRef}>
                <button
                  type="button"
                  className="custom-select-trigger"
                  onClick={() => setGuestDropdownOpen((prev) => !prev)}
                >
                  <span>
                    {selectedGuest
                      ? `${selectedGuest.display_name || selectedGuest.creator_username} (@${selectedGuest.creator_username})`
                      : 'Pilih kreator...'}
                  </span>
                  <span className={guestDropdownOpen ? 'custom-select-arrow open' : 'custom-select-arrow'}>▾</span>
                </button>
                {guestDropdownOpen && (
                  <div className="custom-select-menu">
                    {guests.map((g) => (
                      <div
                        key={g.id}
                        className={g.id === selectedGuestId ? 'custom-select-option active' : 'custom-select-option'}
                        onClick={() => {
                          setSelectedGuestId(g.id)
                          setGuestDropdownOpen(false)
                        }}
                      >
                        {g.display_name || g.creator_username} (@{g.creator_username})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-field">
            <label>Link XML (satu link per baris kalau lebih dari satu)</label>
            <div className="input-wrap">
              <textarea
                className="finput-real finput-multiline"
                placeholder="Paste link XML dari AM..."
                value={xmlLink}
                onChange={(e) => setXmlLink(e.target.value)}
                rows={3}
              />
              {xmlLink && (
                <button type="button" className="input-clear-btn" onClick={() => setXmlLink('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Link 5MB (satu link per baris kalau lebih dari satu)</label>
            <div className="input-wrap">
              <textarea
                className="finput-real finput-multiline"
                placeholder="Paste link 5MB / Alight Creative..."
                value={mbLink}
                onChange={(e) => setMbLink(e.target.value)}
                rows={3}
              />
              {mbLink && (
                <button type="button" className="input-clear-btn" onClick={() => setMbLink('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Link video TikTok kreator</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="tiktok.com/@username/video/..."
                value={tiktokLink}
                onChange={(e) => setTiktokLink(e.target.value)}
              />
              {tiktokLink && (
                <button type="button" className="input-clear-btn" onClick={() => setTiktokLink('')} aria-label="Hapus isi">×</button>
              )}
            </div>
            <button
              type="button"
              className="save-btn"
              style={{ marginTop: 10 }}
              onClick={handleAutoDownload}
              disabled={autoFetching}
            >
              {autoFetching ? 'Mengunduh dari TikTok...' : '⚡ Ambil video otomatis dari link ini'}
            </button>
            <p className="hint" style={{ color: 'var(--muted)', marginTop: 6, fontSize: 11.5 }}>
              Bisa gagal sewaktu-waktu kalau TikTok lagi rewel. Kalau gagal, upload manual di bawah.
            </p>
          </div>

          <div className="form-field">
            <label>Video contoh (buat preview di app)</label>
            <label className="upload-box" style={{ display: 'block', cursor: 'pointer' }}>
              {previewFile ? `✅ ${previewFile.name}` : '⬆ Pilih video dari HP'}
              <input
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
              />
            </label>
            {previewFile && previewFile.size > 5 * 1024 * 1024 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: '#aaa' }}>
                <input type="checkbox" checked={skipCompress} onChange={(e) => setSkipCompress(e.target.checked)} />
                Lewati kompres (upload video mentah - lebih gede, tapi gak nunggu compressor)
              </label>
            )}
          </div>

          <div className="form-field">
            <label>Lagu</label>
            <div className="song-mode-toggle">
              <button
                type="button"
                className={songMode === 'existing' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => setSongMode('existing')}
              >
                Pilih yang ada
              </button>
              <button
                type="button"
                className={songMode === 'new' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => setSongMode('new')}
              >
                Lagu baru
              </button>
            </div>

            {songMode === 'existing' ? (
              songs.length > 0 ? (
                <div className="custom-select" ref={songDropdownRef}>
                  <button
                    type="button"
                    className="custom-select-trigger"
                    onClick={() => setSongDropdownOpen((prev) => !prev)}
                  >
                    <span>{songs.find((s) => s.id === selectedSongId)?.name || 'Pilih lagu...'}</span>
                    <span className={songDropdownOpen ? 'custom-select-arrow open' : 'custom-select-arrow'}>▾</span>
                  </button>
                  {songDropdownOpen && (
                    <div className="custom-select-menu">
                      {songs.map((s) => (
                        <div
                          key={s.id}
                          className={s.id === selectedSongId ? 'custom-select-option active' : 'custom-select-option'}
                          onClick={() => {
                            setSelectedSongId(s.id)
                            setSongDropdownOpen(false)
                          }}
                        >
                          {s.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="hint" style={{ color: 'var(--muted)' }}>Belum ada lagu tersimpen. Pilih "Lagu baru" dulu.</p>
              )
            ) : (
              <div className="input-wrap">
                <input
                  className="finput-real"
                  placeholder="Nama lagu baru..."
                  value={newSongName}
                  onChange={(e) => setNewSongName(e.target.value)}
                />
                {newSongName && (
                  <button type="button" className="input-clear-btn" onClick={() => setNewSongName('')} aria-label="Hapus isi">×</button>
                )}
              </div>
            )}
          </div>

          {statusMsg && (
            <p style={{ fontSize: 12.5, marginBottom: 12, color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)' }}>
              {statusMsg}
            </p>
          )}

          <button className="save-btn" type="submit">
            Simpan Preset
          </button>
        </form>
      </div>
    </div>
  )
}
