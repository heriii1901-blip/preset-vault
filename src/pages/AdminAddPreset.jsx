import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

const THUMB_COLORS = [
  'linear-gradient(135deg,#7C5CFF,#4A32C9)',
  'linear-gradient(135deg,#FF3D7F,#C91E5A)',
  'linear-gradient(135deg,#D4FF3D,#8FB800)',
  'linear-gradient(135deg,#7C5CFF,#FF3D7F)',
  'linear-gradient(135deg,#4A32C9,#15151D)',
]

export default function AdminAddPreset() {
  const navigate = useNavigate()
  const { presetId } = useParams()
  const isEditMode = Boolean(presetId)

  const [songs, setSongs] = useState([])
  const [songMode, setSongMode] = useState('existing')
  const [selectedSongId, setSelectedSongId] = useState('')
  const [songDropdownOpen, setSongDropdownOpen] = useState(false)
  const songDropdownRef = useRef(null)
  const [newSongName, setNewSongName] = useState('')
  const [xmlLink, setXmlLink] = useState('')
  const [mbLink, setMbLink] = useState('')
  const [creatorUsername, setCreatorUsername] = useState('')
  const [tiktokLink, setTiktokLink] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [existingPreviewUrl, setExistingPreviewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [saveProgress, setSaveProgress] = useState(0)
  const [saveStage, setSaveStage] = useState('')
  const [loadingPreset, setLoadingPreset] = useState(isEditMode)
  const cancelledRef = useRef(false)
  const progressIntervalRef = useRef(null)
  const originalSongIdRef = useRef('')

  useEffect(() => {
    async function loadSongs() {
      try {
        const { data, error } = await supabase.from('songs').select('*')
        if (error) throw error
        const list = [...data].sort((a, b) => a.name.localeCompare(b.name))
        setSongs(list)
        if (list.length > 0 && !isEditMode) setSelectedSongId(list[0].id)
      } catch (err) {
        console.error('Gagal ambil daftar lagu:', err)
        setStatusMsg('Gagal ambil daftar lagu. Cek koneksi / setting Supabase.')
      }
    }
    loadSongs()
  }, [isEditMode])

  // Mode edit: ambil data preset yang mau diubah, isi form-nya
  useEffect(() => {
    if (!isEditMode) return
    async function loadPreset() {
      setLoadingPreset(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .eq('id', presetId)
          .single()
        if (error) throw error

        setXmlLink(data.xml_link || '')
        setMbLink(data.mb_link || '')
        setCreatorUsername(data.creator_username || '')
        setTiktokLink(data.tiktok_link || '')
        setExistingPreviewUrl(data.preview_video_url || '')
        setSelectedSongId(data.song_id || '')
        originalSongIdRef.current = data.song_id || ''
        setSongMode('existing')
      } catch (err) {
        console.error('Gagal ambil data preset:', err)
        setStatusMsg('Gagal ambil data preset yang mau diedit.')
      } finally {
        setLoadingPreset(false)
      }
    }
    loadPreset()
  }, [isEditMode, presetId])

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
    setCreatorUsername('')
    setTiktokLink('')
    setPreviewFile(null)
    setNewSongName('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setStatusMsg('')

    if (!xmlLink.trim()) return setStatusMsg('Link XML belum diisi.')
    if (!mbLink.trim()) return setStatusMsg('Link 5MB (Alight Creative) belum diisi.')
    if (!creatorUsername.trim()) return setStatusMsg('Username kreator belum diisi.')
    if (songMode === 'new' && !newSongName.trim()) return setStatusMsg('Nama lagu baru belum diisi.')
    if (songMode === 'existing' && !selectedSongId) return setStatusMsg('Pilih lagunya dulu.')

    cancelledRef.current = false
    setSaving(true)
    setSaveProgress(0)
    setSaveStage('Nyiapin data...')

    try {
      let songId = selectedSongId
      if (songMode === 'new') {
        const { data: existing, error: findErr } = await supabase
          .from('songs')
          .select('id')
          .eq('name', newSongName.trim())
          .maybeSingle()
        if (findErr) throw findErr
        if (cancelledRef.current) return

        if (existing) {
          songId = existing.id
        } else {
          const color = THUMB_COLORS[Math.floor(Math.random() * THUMB_COLORS.length)]
          const { data: newSong, error: insertErr } = await supabase
            .from('songs')
            .insert({ name: newSongName.trim(), preset_count: 0, color })
            .select()
            .single()
          if (insertErr) throw insertErr
          songId = newSong.id
        }
      }
      setSaveProgress(15)

      let previewVideoUrl = isEditMode ? existingPreviewUrl : ''
      if (previewFile) {
        setSaveStage('Ngupload video contoh...')

        progressIntervalRef.current = setInterval(() => {
          setSaveProgress((prev) => (prev < 75 ? prev + 2 : prev))
        }, 300)

        const filePath = `previews/${Date.now()}_${previewFile.name}`
        const { error: uploadErr } = await supabase.storage
          .from('previews')
          .upload(filePath, previewFile, { cacheControl: '3600', upsert: false })

        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null

        if (cancelledRef.current) return
        if (uploadErr) throw uploadErr

        const { data: publicUrlData } = supabase.storage.from('previews').getPublicUrl(filePath)
        previewVideoUrl = publicUrlData.publicUrl
        setSaveProgress(80)
      } else {
        setSaveProgress(80)
      }

      if (isEditMode) {
        setSaveStage('Update preset...')
        const { error: updateErr } = await supabase
          .from('presets')
          .update({
            song_id: songId,
            xml_link: xmlLink.trim(),
            mb_link: mbLink.trim(),
            creator_username: creatorUsername.trim(),
            tiktok_link: tiktokLink.trim(),
            preview_video_url: previewVideoUrl,
          })
          .eq('id', presetId)
        if (updateErr) throw updateErr

        // Kalau lagu-nya diganti, betulin preset_count lagu lama & lagu baru
        if (originalSongIdRef.current && originalSongIdRef.current !== songId) {
          const { data: oldSongRow } = await supabase
            .from('songs')
            .select('preset_count')
            .eq('id', originalSongIdRef.current)
            .single()
          await supabase
            .from('songs')
            .update({ preset_count: Math.max((oldSongRow?.preset_count || 1) - 1, 0) })
            .eq('id', originalSongIdRef.current)

          const { data: newSongRow } = await supabase
            .from('songs')
            .select('preset_count')
            .eq('id', songId)
            .single()
          await supabase
            .from('songs')
            .update({ preset_count: (newSongRow?.preset_count || 0) + 1 })
            .eq('id', songId)

          originalSongIdRef.current = songId
        }

        setSaveProgress(100)
        setStatusMsg('✅ Preset berhasil diupdate!')
      } else {
        setSaveStage('Nyimpen preset...')
        const { error: presetErr } = await supabase.from('presets').insert({
          song_id: songId,
          xml_link: xmlLink.trim(),
          mb_link: mbLink.trim(),
          creator_username: creatorUsername.trim(),
          tiktok_link: tiktokLink.trim(),
          preview_video_url: previewVideoUrl,
        })
        if (presetErr) throw presetErr
        setSaveProgress(92)

        setSaveStage('Update jumlah preset...')
        const { data: songRow } = await supabase
          .from('songs')
          .select('preset_count')
          .eq('id', songId)
          .single()
        await supabase
          .from('songs')
          .update({ preset_count: (songRow?.preset_count || 0) + 1 })
          .eq('id', songId)
        setSaveProgress(100)

        setStatusMsg('✅ Preset berhasil disimpen!')
        resetForm()
      }
    } catch (err) {
      console.error('Gagal simpen preset:', err)
      setStatusMsg(isEditMode ? '❌ Gagal update. Cek koneksi / setting Supabase.' : '❌ Gagal simpen. Cek koneksi / setting Supabase.')
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

  if (loadingPreset) {
    return (
      <div className="screen">
        <div className="admin-content">
          <div className="empty-state">Memuat data preset...</div>
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
          <span className="admin-tag">PANEL ADMIN</span>
          <h2>{isEditMode ? 'Edit Preset' : 'Tambah Preset Baru'}</h2>
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
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => setXmlLink('')}
                  aria-label="Hapus isi"
                >
                  ×
                </button>
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
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => setMbLink('')}
                  aria-label="Hapus isi"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>
              Video contoh {isEditMode ? '(kosongin biar video lama tetep dipake)' : '(opsional, buat preview di app)'}
            </label>
            <label className="upload-box" style={{ display: 'block', cursor: 'pointer' }}>
              {previewFile
                ? `✅ ${previewFile.name}`
                : existingPreviewUrl
                ? '🎬 Ada video lama · pilih file buat ganti'
                : '⬆ Pilih video dari HP'}
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
            {!isEditMode && (
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
            )}

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
                  <button
                    type="button"
                    className="input-clear-btn"
                    onClick={() => setNewSongName('')}
                    aria-label="Hapus isi"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="form-field">
            <label>Username kreator</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="@username"
                value={creatorUsername}
                onChange={(e) => setCreatorUsername(e.target.value)}
              />
              {creatorUsername && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => setCreatorUsername('')}
                  aria-label="Hapus isi"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Link akun/video TikTok kreator</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                placeholder="tiktok.com/@username/video/..."
                value={tiktokLink}
                onChange={(e) => setTiktokLink(e.target.value)}
              />
              {tiktokLink && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => setTiktokLink('')}
                  aria-label="Hapus isi"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {statusMsg && (
            <p style={{ fontSize: 12.5, marginBottom: 12, color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)' }}>
              {statusMsg}
            </p>
          )}

          <button className="save-btn" type="submit" disabled={saving}>
            {saving ? (isEditMode ? 'Ngupdate...' : 'Nyimpen...') : (isEditMode ? 'Update Preset' : 'Simpan Preset')}
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
