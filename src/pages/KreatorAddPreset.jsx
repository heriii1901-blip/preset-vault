import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { compressVideoIfNeeded } from '../utils/compressVideo'

export default function KreatorAddPreset() {
  const { user } = useAuth()
  const navigate = useNavigate()

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
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [saveProgress, setSaveProgress] = useState(0)
  const [saveStage, setSaveStage] = useState('')
  const cancelledRef = useRef(false)
  const progressIntervalRef = useRef(null)

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

  const handleSave = async (e) => {
    e.preventDefault()
    setStatusMsg('')

    if (!xmlLink.trim()) return setStatusMsg('Link XML belum diisi.')
    if (!mbLink.trim()) return setStatusMsg('Link 5MB (Alight Creative) belum diisi.')
    if (songMode === 'new' && !newSongName.trim()) return setStatusMsg('Nama lagu baru belum diisi.')
    if (songMode === 'existing' && !selectedSongId) return setStatusMsg('Pilih lagunya dulu.')

    cancelledRef.current = false
    setSaving(true)
    setSaveProgress(0)
    setSaveStage('Nyiapin data...')

    try {
      let previewVideoUrl = ''
      if (previewFile) {
        setSaveStage('Ngompres video...')

        const fileToUpload = await compressVideoIfNeeded(previewFile, (progress) => {
          setSaveProgress(Math.min(Math.floor(progress * 50), 50))
        })

        if (cancelledRef.current) return

        setSaveStage('Ngupload video contoh...')

        progressIntervalRef.current = setInterval(() => {
          setSaveProgress((prev) => (prev < 90 ? prev + 2 : prev))
        }, 300)

        const uploadRes = await fetch('/api/upload-to-r2', {
          method: 'POST',
          headers: {
            'x-file-name': fileToUpload.name,
            'Content-Type': fileToUpload.type || 'video/mp4',
          },
          body: fileToUpload,
        })
        
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null

        if (cancelledRef.current) return
        if (!uploadRes.ok) throw new Error('Upload ke R2 gagal')

        const uploadData = await uploadRes.json()
        previewVideoUrl = uploadData.url
        setSaveProgress(70)
      } else {
        setSaveProgress(70)
      }

      if (songMode === 'existing') {
        setSaveStage('Nyimpen preset...')
        const { error: presetErr } = await supabase.from('presets').insert({
          song_id: selectedSongId,
          xml_link: xmlLink.trim(),
          mb_link: mbLink.trim(),
          creator_username: creatorUsername,
          tiktok_link: tiktokLink.trim(),
          preview_video_url: previewVideoUrl,
        })
        if (presetErr) throw presetErr

        const { data: songRow } = await supabase
          .from('songs')
          .select('preset_count')
          .eq('id', selectedSongId)
          .single()
        await supabase
          .from('songs')
          .update({ preset_count: (songRow?.preset_count || 0) + 1 })
          .eq('id', selectedSongId)

        setSaveProgress(100)
        setStatusMsg('✅ Preset berhasil disimpen!')
        resetForm()
      } else {
        setSaveStage('Ngirim permintaan lagu baru...')
        const { error: reqErr } = await supabase.from('song_requests').insert({
          user_id: user.id,
          creator_username: creatorUsername,
          requested_song_name: newSongName.trim(),
          xml_link: xmlLink.trim(),
          mb_link: mbLink.trim(),
          tiktok_link: tiktokLink.trim(),
          preview_video_url: previewVideoUrl,
        })
        if (reqErr) throw reqErr

        setSaveProgress(100)
        setStatusMsg('✅ Diajukan! Presetnya bakal otomatis tayang begitu admin approve nama lagunya.')
        resetForm()
      }
    } catch (err) {
      console.error('Gagal simpen preset:', err)
      setStatusMsg('❌ Gagal simpen. Cek koneksi / setting Supabase.')
    } finally {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      setSaving(false)
      setSaveProgress(0)
      setSaveStage('')
    }
  }

  const handleCancelSave = () => {
    cancelledRef.current = true
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    setSaving(false)
    setSaveProgress(0)
    setSaveStage('')
    setStatusMsg('Proses simpen dibatalin.')
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

          <button className="save-btn" type="submit" disabled={saving}>
            {saving ? 'Nyimpen...' : 'Simpan Preset'}
          </button>
        </form>

        {saving && (
          <div className="save-overlay">
            <div className="save-overlay-box">
              <div className="save-spinner" />
              <div className="save-progress-pct">{Math.round(saveProgress)}%</div>
              <div className="save-progress-track">
                <div className="save-progress-fill" style={{ width: `${saveProgress}%` }} />
              </div>
              <div className="save-stage-text">{saveStage || 'Memproses...'}</div>
              <button type="button" className="save-cancel-btn" onClick={handleCancelSave}>
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
