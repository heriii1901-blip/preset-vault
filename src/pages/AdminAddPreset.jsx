import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { compressVideoIfNeeded } from '../utils/compressVideo'
import { uploadToR2 } from '../utils/uploadToR2'
import { generateCoverFromVideo } from '../utils/generateCoverFromVideo'
import { useUploadQueue } from '../context/UploadQueueContext'

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
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(presetId)
  const fromPending = searchParams.get('from') === 'pending'
  const { enqueuePresetUpload, history, cancelJob, resubmitQueueItem, deleteHistoryItem, getQueueItemForEdit } = useUploadQueue()
  const [editingQueueId, setEditingQueueId] = useState(null)
  const [activePanel, setActivePanel] = useState(0)
  const scrollerRef = useRef(null)
  const [pendingLinkPresets, setPendingLinkPresets] = useState([])
  const [loadingPendingLinks, setLoadingPendingLinks] = useState(true)

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
  const [skipCompress, setSkipCompress] = useState(false)
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

  // Mode edit dari Riwayat Upload: isi form dari item antrian yang mau diedit/diupload ulang
  useEffect(() => {
    if (!editingQueueId) return
    const item = getQueueItemForEdit(editingQueueId)
    if (!item) return
    setXmlLink(item.xmlLink || '')
    setMbLink(item.mbLink || '')
    setCreatorUsername(item.creatorUsername || '')
    setTiktokLink(item.tiktokLink || '')
    setPreviewFile(item.previewFile || null)
    setSongMode(item.songMode || 'existing')
    setSelectedSongId(item.selectedSongId || '')
    setNewSongName(item.newSongName || '')
    setStatusMsg('')
  }, [editingQueueId, getQueueItemForEdit])

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

    useEffect(() => {
    loadPendingLinkPresets()
  }, [])

  async function loadPendingLinkPresets() {
    setLoadingPendingLinks(true)
    try {
      const { data, error } = await supabase
        .from('presets')
        .select('*, songs(name)')
        .eq('link_pending', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      setPendingLinkPresets(data || [])
    } catch (err) {
      console.error('Gagal ambil preset yang link XML-nya kosong:', err)
    } finally {
      setLoadingPendingLinks(false)
    }
  }

  const [missingCoverPresets, setMissingCoverPresets] = useState([])
  const [loadingMissingCovers, setLoadingMissingCovers] = useState(true)
  const [coverGenStatus, setCoverGenStatus] = useState({})
  const [coverGenRunning, setCoverGenRunning] = useState(false)

  // Cuma jalan 1x pas halaman admin dibuka (deps kosong []), bukan tiap render -
  // jadi ga ada resiko query berulang / egress bengkak.
  useEffect(() => {
    loadMissingCoverPresets()
  }, [])

  async function loadMissingCoverPresets() {
    setLoadingMissingCovers(true)
    try {
      const { data, error } = await supabase
        .from('presets')
        .select('id, creator_username, preview_video_url')
        .is('cover_url', null)
        .not('preview_video_url', 'is', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      setMissingCoverPresets(data || [])
    } catch (err) {
      console.error('Gagal ambil preset yang belum punya cover:', err)
    } finally {
      setLoadingMissingCovers(false)
    }
  }

  async function generateCoverForPreset(preset) {
    setCoverGenStatus((prev) => ({ ...prev, [preset.id]: 'Ngambil video...' }))
    try {
      const res = await fetch(preset.preview_video_url)
      if (!res.ok) throw new Error('Gagal ambil video dari R2')
      const videoBlob = await res.blob()

      setCoverGenStatus((prev) => ({ ...prev, [preset.id]: 'Bikin cover...' }))
      const coverFile = await generateCoverFromVideo(videoBlob)
      const coverUrl = await uploadToR2(coverFile, 'covers')

      const { error: updateErr } = await supabase
        .from('presets')
        .update({ cover_url: coverUrl })
        .eq('id', preset.id)
      if (updateErr) throw updateErr

      setMissingCoverPresets((prev) => prev.filter((p) => p.id !== preset.id))
    } catch (err) {
      console.error('Gagal generate cover buat preset', preset.id, err)
      setCoverGenStatus((prev) => ({ ...prev, [preset.id]: '❌ Gagal, coba lagi' }))
    }
  }

  async function generateAllMissingCovers() {
    setCoverGenRunning(true)
    const list = [...missingCoverPresets]
    for (const preset of list) {
      await generateCoverForPreset(preset)
    }
    setCoverGenRunning(false)
  }

  const resetForm = () => {
    setXmlLink('')
    setMbLink('')
    setCreatorUsername('')
    setTiktokLink('')
    setPreviewFile(null)
    setSkipCompress(false)
    setNewSongName('')
  }

  function goToPanel(index) {
    setActivePanel(index)
    const el = scrollerRef.current
    if (el) el.scrollTo({ left: el.clientWidth * index, behavior: 'smooth' })
  }

  function handlePanelScroll(e) {
    const el = e.currentTarget
    const index = Math.round(el.scrollLeft / el.clientWidth)
    if (index !== activePanel) setActivePanel(index)
  }

  const handleSave = (e) => {
    e.preventDefault()
    setStatusMsg('')

    if (!mbLink.trim()) return setStatusMsg('Link 5MB (Alight Creative) belum diisi.')
    if (!xmlLink.trim()) {
      const lanjut = window.confirm(
        'Link XML belum diisi. Preset ini bakal disembunyiin dari publik dan masuk tab "Link Kosong" sampe link-nya diisi. Lanjut upload?'
      )
      if (!lanjut) return
    }
    if (!creatorUsername.trim()) return setStatusMsg('Username kreator belum diisi.')
    if (!isEditMode && !previewFile) return setStatusMsg('Video contoh belum dipilih.')
    if (songMode === 'new' && !newSongName.trim()) return setStatusMsg('Nama lagu baru belum diisi.')
    if (songMode === 'existing' && !selectedSongId) return setStatusMsg('Pilih lagunya dulu.')

    if (isEditMode) {
      handleUpdate()
      return
    }

    const payload = {
      previewFile,
      songMode,
      selectedSongId,
      newSongName: newSongName.trim(),
      xmlLink: xmlLink.trim(),
      mbLink: mbLink.trim(),
      tiktokLink: tiktokLink.trim(),
      creatorUsername: creatorUsername.trim(),
      directSongCreate: true,
    }

    if (editingQueueId) {
      // Lagi ngedit item dari Riwayat Upload (yang dibatalin/gagal) - submit ulang pake id yang sama
      resubmitQueueItem(editingQueueId, payload)
      setStatusMsg('✅ Diupload ulang! Cek progressnya di tab Riwayat Upload.')
      setEditingQueueId(null)
      resetForm()
      return
    }

    // Mode tambah baru: masuk antrian upload, gak nge-block layar.
    // Lagu baru dari admin langsung dibuat (directSongCreate) - beda dari kreator yang harus nunggu approval.
    enqueuePresetUpload(payload)

    setStatusMsg('✅ Ditambahin ke antrian upload! Boleh langsung tambah preset lain.')
    resetForm()
  }

  const handleUpdate = async () => {
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
      let coverUrl = null
      if (previewFile) {
        setSaveStage(skipCompress ? 'Ngupload video contoh (tanpa kompres)...' : 'Ngompres video...')

        const fileToUpload = skipCompress
          ? previewFile
          : await compressVideoIfNeeded(previewFile, (progress) => {
              setSaveProgress(15 + Math.min(Math.floor(progress * 35), 35))
            })

                if (cancelledRef.current) return
        setSaveStage('Ngupload video contoh...')

        previewVideoUrl = await uploadToR2(fileToUpload, 'presets', (p) => {
          if (cancelledRef.current) return
          setSaveProgress(35 + Math.min(Math.floor(p * 45), 45))
        })

        if (cancelledRef.current) return
        setSaveProgress(80)

        setSaveStage('Bikin cover...')
        try {
          const coverFile = await generateCoverFromVideo(fileToUpload)
          coverUrl = await uploadToR2(coverFile, 'covers')
        } catch (err) {
          console.error('Gagal bikin cover:', err)
        }
      } else {
        setSaveProgress(80)
      }

      if (isEditMode) {
        setSaveStage('Update preset...')
        const { error: updateErr } = await supabase
          .from('presets')
          .update({
            song_id: songId,
            xml_link: xmlLink.trim() || null,
            mb_link: mbLink.trim(),
            creator_username: creatorUsername.trim(),
            tiktok_link: tiktokLink.trim(),
            preview_video_url: previewVideoUrl,
            link_pending: !xmlLink.trim(),
            ...(coverUrl ? { cover_url: coverUrl } : {}),
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
        if (fromPending) {
          setTimeout(() => navigate('/'), 600)
        }
      } else {
        setSaveStage('Nyimpen preset...')
        const { error: presetErr } = await supabase.from('presets').insert({
          song_id: songId,
          xml_link: xmlLink.trim() || null,
          mb_link: mbLink.trim(),
          creator_username: creatorUsername.trim(),
          tiktok_link: tiktokLink.trim(),
          preview_video_url: previewVideoUrl,
          cover_url: coverUrl,
          link_pending: !xmlLink.trim(),
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

  const formPanel = (
    <>
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
          {previewFile && previewFile.size > 5 * 1024 * 1024 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: '#aaa' }}>
              <input type="checkbox" checked={skipCompress} onChange={(e) => setSkipCompress(e.target.checked)} />
              Lewati kompres (upload video mentah - lebih gede, tapi gak nunggu compressor)
            </label>
          )}
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

        {editingQueueId && (
          <button
            type="button"
            className="back-btn ghost-static"
            style={{ marginBottom: 10, width: '100%' }}
            onClick={() => {
              setEditingQueueId(null)
              resetForm()
              setStatusMsg('')
            }}
          >
            ✕ Batal edit, balik ke Tambah Preset baru
          </button>
        )}

        <button className="save-btn" type="submit" disabled={saving}>
          {saving
            ? (fromPending ? 'Nge-post...' : isEditMode ? 'Ngupdate...' : 'Nyimpen...')
            : editingQueueId
            ? 'Upload Ulang'
            : fromPending
            ? 'Post'
            : (isEditMode ? 'Update Preset' : 'Simpan Preset')}
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
    </>
  )

  const openEditFromHistory = (id) => {
    setEditingQueueId(id)
    goToPanel(0)
  }

  const RING_R = 18
  const RING_CIRC = 2 * Math.PI * RING_R

  const STATUS_LABEL = {
    queued: 'Nunggu antrian',
    compressing: 'Ngompres video',
    uploading: 'Ngupload',
    saving: 'Nyimpen',
    done: 'Selesai',
    error: 'Gagal',
    cancelled: 'Dibatalin',
  }

  const historyPanel = (
    <div style={{ padding: '0 20px' }}>
      {history.length === 0 ? (
        <div className="empty-state">Belum ada riwayat upload.</div>
      ) : (
        history.map((it) => {
          const isActive = ['queued', 'compressing', 'uploading', 'saving'].includes(it.status)
          const canEdit = it.status === 'cancelled' || it.status === 'error'
          const ringOffset = RING_CIRC - (Math.min(it.progress || 0, 100) / 100) * RING_CIRC
          const icon =
            it.status === 'done' ? '✓' : it.status === 'error' ? '×' : it.status === 'cancelled' ? '‖' : `${Math.round(it.progress || 0)}%`

          return (
            <div key={it.id} className={`queue-history-card queue-history-${it.status}`}>
              <div
                className="queue-history-info"
                role={canEdit ? 'button' : undefined}
                onClick={canEdit ? () => openEditFromHistory(it.id) : undefined}
              >
                <div className="queue-history-title">{it.newSongName || 'Lagu yang udah ada'}</div>
                <div className="queue-history-meta">
                  @{it.creatorUsername || '-'} · {isActive ? (it.stage || STATUS_LABEL[it.status] || it.status) : (STATUS_LABEL[it.status] || it.status)}
                </div>
                {it.status === 'error' && it.errorMessage && (
                  <div className="queue-history-error">❌ {it.errorMessage}</div>
                )}
                {canEdit && <div className="queue-history-hint">Ketuk buat edit &amp; upload ulang</div>}
              </div>

              <div className="queue-history-side">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r={RING_R} className="upload-ring-bg" />
                  <circle
                    cx="20"
                    cy="20"
                    r={RING_R}
                    className={isActive ? 'upload-ring-fg' : `upload-ring-fg queue-ring-${it.status}`}
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={isActive ? ringOffset : 0}
                  />
                </svg>
                <span className="queue-history-icon">{icon}</span>
              </div>

              <div className="queue-history-actions">
                {isActive && (
                  <button type="button" className="back-btn ghost-static" onClick={() => cancelJob(it.id)}>
                    Batalin
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="save-btn"
                    style={{ padding: '6px 12px', fontSize: 12.5 }}
                    onClick={() => openEditFromHistory(it.id)}
                  >
                    Edit
                  </button>
                )}
                {!isActive && (
                  <button type="button" className="back-btn ghost-static" onClick={() => deleteHistoryItem(it.id)}>
                    Hapus
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )

    const pendingLinkPanel = (
    <div style={{ padding: '0 20px' }}>
      {loadingPendingLinks && <div className="empty-state">Memuat...</div>}
      {!loadingPendingLinks && pendingLinkPresets.length === 0 && (
        <div className="empty-state">Semua preset udah punya link XML. 🎉</div>
      )}
      {!loadingPendingLinks &&
        pendingLinkPresets.map((preset) => (
          <div key={preset.id} className="queue-history-card">
            <div className="queue-history-info">
              <div className="queue-history-title">{preset.songs?.name || 'Lagu'}</div>
              <div className="queue-history-meta">@{preset.creator_username}</div>
               <a
                href={preset.mb_link}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 12.5, color: 'var(--lime)', display: 'inline-block', marginTop: 4 }}
              >
                🔗 Buka Link 5MB
              </a>
              <div className="queue-history-hint" style={{ marginTop: 6 }}>Link XML belum diisi</div>
            </div>
            <div className="queue-history-actions">
              <button
                type="button"
                className="save-btn"
                style={{ padding: '6px 12px', fontSize: 12.5 }}
                onClick={() => navigate(`/admin/edit-preset/${preset.id}?from=pending`)}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
    </div>
  )

  const missingCoverPanel = (
    <div style={{ padding: '0 20px' }}>
      {loadingMissingCovers && <div className="empty-state">Memuat...</div>}
      {!loadingMissingCovers && missingCoverPresets.length === 0 && (
        <div className="empty-state">Semua preset udah punya cover. 🎉</div>
      )}
      {!loadingMissingCovers && missingCoverPresets.length > 0 && (
        <div style={{ padding: '0 14px 10px' }}>
          <button
            type="button"
            className="save-btn"
            disabled={coverGenRunning}
            onClick={generateAllMissingCovers}
          >
            {coverGenRunning ? 'Lagi jalan...' : `Generate Semua (${missingCoverPresets.length})`}
          </button>
        </div>
      )}
      {!loadingMissingCovers &&
        missingCoverPresets.map((preset) => (
          <div key={preset.id} className="queue-history-card">
            <div className="queue-history-info">
              <div className="queue-history-title">@{preset.creator_username || 'tanpa username'}</div>
              <div className="queue-history-hint">{coverGenStatus[preset.id] || 'Belum digenerate'}</div>
            </div>
            <div className="queue-history-actions">
              <button
                type="button"
                className="save-btn"
                style={{ padding: '6px 12px', fontSize: 12.5 }}
                disabled={coverGenRunning}
                onClick={() => generateCoverForPreset(preset)}
              >
                Generate
              </button>
            </div>
          </div>
        ))}
    </div>
  )

  return (
    <div className="screen">
      <div className="admin-content">
         <button className="back-btn ghost-static" style={{ marginBottom: 14, marginLeft: 14, width: 'fit-content' }} onClick={() => navigate(-1)}>
          ← Balik
        </button>

        <div className={isEditMode ? 'admin-header' : 'admin-header admin-header-tight'}>
          <span className="admin-tag">PANEL ADMIN</span>
          <h2>{isEditMode ? 'Edit Preset' : 'Tambah Preset Baru'}</h2>
        </div>
        
          {isEditMode ? (
          <div style={{ padding: '0 14px 14px' }}>{formPanel}</div>
        ) : (
          <div className="kreator-hub" style={{ padding: 0 }}>
            <div className="kreator-hub-tabs">
              <button
                type="button"
                className={`kreator-hub-tab${activePanel === 0 ? ' is-active' : ''}`}
                onClick={() => goToPanel(0)}
              >
                {editingQueueId ? 'Edit Upload' : 'Tambah Preset'}
              </button>
                            <button
                type="button"
                className={`kreator-hub-tab${activePanel === 1 ? ' is-active' : ''}`}
                onClick={() => goToPanel(1)}
              >
                Riwayat Upload{history.length > 0 ? ` (${history.length})` : ''}
              </button>
              <button
                type="button"
                className={`kreator-hub-tab${activePanel === 2 ? ' is-active' : ''}`}
                onClick={() => goToPanel(2)}
              >
                🔗 Link Kosong{pendingLinkPresets.length > 0 ? ` (${pendingLinkPresets.length})` : ''}
              </button>
              <button
                type="button"
                className={`kreator-hub-tab${activePanel === 3 ? ' is-active' : ''}`}
                onClick={() => goToPanel(3)}
              >
                🖼️ Cover Lama{missingCoverPresets.length > 0 ? ` (${missingCoverPresets.length})` : ''}
              </button>
            </div>

            <div className="kreator-hub-scroller" ref={scrollerRef} onScroll={handlePanelScroll}>
              <div className="kreator-hub-page">{formPanel}</div>
              <div className="kreator-hub-page">{historyPanel}</div>
              <div className="kreator-hub-page">{pendingLinkPanel}</div>
              <div className="kreator-hub-page">{missingCoverPanel}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
