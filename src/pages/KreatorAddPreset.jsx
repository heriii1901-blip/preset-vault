import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { useUploadQueue } from '../context/UploadQueueContext'

export default function KreatorAddPreset() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { enqueuePresetUpload } = useUploadQueue()

  const [checkingCreator, setCheckingCreator] = useState(true)
  const [creatorUsername, setCreatorUsername] = useState('')

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
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    async function loadCreator() {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_creator, creator_username')
          .eq('id', user.id)
          .single()
        if (error) throw error
        if (data?.is_creator) setCreatorUsername(data.creator_username || '')
      } catch (err) {
        console.error('Gagal cek status kreator:', err)
      } finally {
        setCheckingCreator(false)
      }
    }
    loadCreator()
  }, [user])

  useEffect(() => {
    async function loadSongs() {
      try {
        const { data, error } = await supabase.from('songs').select('*')
        if (error) throw error
        const list = [...data].sort((a, b) => a.name.localeCompare(b.name))
        setSongs(list)
        if (list.length > 0) setSelectedSongId(list[0].id)
      } catch (err) {
        console.error('Gagal ambil daftar lagu:', err)
      }
    }
    loadSongs()
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
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

  const resetForm = () => {
    setXmlLink('')
    setMbLink('')
    setTiktokLink('')
    setPreviewFile(null)
    setNewSongName('')
    setSongMode('existing')
  }

  const handleSave = (e) => {
    e.preventDefault()
    setStatusMsg('')

    if (!xmlLink.trim()) return setStatusMsg('Link XML belum diisi.')
    if (!mbLink.trim()) return setStatusMsg('Link 5MB (Alight Creative) belum diisi.')
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
      creatorUsername,
      userId: user.id,
    })

    setStatusMsg('✅ Ditambahin ke antrian upload! Boleh langsung tambah preset lain.')
    resetForm()
  }

  if (checkingCreator) {
    return (
      <div className="screen">
        <div className="admin-content">
          <div className="empty-state">Memuat...</div>
        </div>
      </div>
    )
  }

  if (!creatorUsername) {
    return (
      <div className="screen">
        <div className="admin-content">
          <button className="back-btn ghost-static" style={{ marginBottom: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
            ← Balik
          </button>
          <div className="empty-state">Kamu belum jadi kreator terdaftar.</div>
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
          <span className="admin-tag">KREATOR</span>
          <h2>Upload Preset Baru</h2>
        </div>

        <form onSubmit={handleSave}>
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
            <label>Video contoh (opsional, buat preview di app)</label>
            <label className="upload-box" style={{ display: 'block', cursor: 'pointer' }}>
              {previewFile ? `✅ ${previewFile.name}` : '⬆ Pilih video dari HP'}
              <input
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
              />
            </label>
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
                Request lagu baru
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
                <p className="hint" style={{ color: 'var(--muted)' }}>Belum ada lagu tersimpen. Pilih "Request lagu baru" dulu.</p>
              )
            ) : (
              <>
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
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  Preset bakal disimpen dulu, baru tayang setelah admin approve nama lagunya.
                </p>
              </>
            )}
          </div>

          <div className="form-field">
            <label>Link akun/video TikTok kamu</label>
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
