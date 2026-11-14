import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { uploadToR2 } from '../../utils/uploadToR2'
import { deleteFromR2 } from '../../utils/deleteFromR2'

const MAX_MB = 15

// Admin: atur suara tiap lagu. Kelihatan mana yang udah ada suaranya dan mana yang belum,
// upload / ganti / hapus manual per lagu.
export default function AdminSongAudio() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('semua') // semua | belum | sudah
  const [busyId, setBusyId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [msg, setMsg] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const audioRef = useRef(null)
  const fileInputRef = useRef(null)
  const pickIdRef = useRef(null)

  // Sekali ambil pas halaman dibuka. Kolom lirik sengaja ngga ikut diambil biar ringan.
  // Dep array kosong dan ngga ada setState yang mancing ulang, jadi ngga ada query berulang.
  useEffect(() => {
    async function loadSongs() {
      try {
        const { data, error } = await supabase
          .from('songs')
          .select('id, name, audio_url')
          .order('name', { ascending: true })
        if (error) throw error
        setSongs(data || [])
      } catch (err) {
        console.error('Gagal ambil daftar lagu:', err)
        setMsg('❌ Gagal ambil daftar lagu.')
      } finally {
        setLoading(false)
      }
    }
    loadSongs()
  }, [])

  // Keluar dari halaman: suara preview berhenti
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio) audio.pause()
    }
  }, [])

  const withAudio = songs.filter((s) => s.audio_url).length

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return songs.filter((s) => {
      if (filter === 'belum' && s.audio_url) return false
      if (filter === 'sudah' && !s.audio_url) return false
      return !q || s.name.toLowerCase().includes(q)
    })
  }, [songs, query, filter])

  function pickFile(songId) {
    pickIdRef.current = songId
    fileInputRef.current?.click()
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const songId = pickIdRef.current
    if (!file || !songId) return
    if (!file.type.startsWith('audio/')) {
      setMsg('❌ File harus berupa audio (mp3, m4a, dll).')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setMsg(`❌ Ukuran file maksimal ${MAX_MB}MB.`)
      return
    }
    const oldUrl = songs.find((s) => s.id === songId)?.audio_url
    setBusyId(songId)
    setProgress(0)
    setMsg('')
    try {
      const url = await uploadToR2(file, 'audio', setProgress)
      const { error } = await supabase.from('songs').update({ audio_url: url }).eq('id', songId)
      if (error) {
        await deleteFromR2(url)
        throw error
      }
      setSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, audio_url: url } : s)))
      if (oldUrl) await deleteFromR2(oldUrl)
      setMsg('✅ Suara tersimpan.')
    } catch (err) {
      console.error('Gagal upload suara lagu:', err)
      setMsg(`❌ Gagal upload suara: ${err.message || 'coba lagi'}`)
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(song) {
    if (!window.confirm(`Hapus suara lagu "${song.name}"?`)) return
    setBusyId(song.id)
    setMsg('')
    try {
      const { error } = await supabase.from('songs').update({ audio_url: null }).eq('id', song.id)
      if (error) throw error
      setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, audio_url: null } : s)))
      if (previewId === song.id) {
        audioRef.current?.pause()
        setPreviewId(null)
      }
      await deleteFromR2(song.audio_url)
      setMsg('✅ Suara dihapus.')
    } catch (err) {
      console.error('Gagal hapus suara lagu:', err)
      setMsg('❌ Gagal hapus suara, coba lagi.')
    } finally {
      setBusyId(null)
    }
  }

  function togglePreview(song) {
    const audio = audioRef.current
    if (!audio) return
    if (previewId === song.id) {
      audio.pause()
      setPreviewId(null)
      return
    }
    audio.src = song.audio_url
    audio.play().catch(() => setMsg('❌ Suara gagal diputar.'))
    setPreviewId(song.id)
  }

  return (
    <div className="screen">
      <div className="admin-content">
        <button className="back-btn ghost-static" style={{ margin: '0 0 14px 18px', width: 'fit-content' }} onClick={() => navigate(-1)}>
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">ADMIN</span>
          <h2>Suara Lagu</h2>
        </div>

        <div className="sa-wrap">
          <p className="sa-summary">
            {loading ? 'Memuat...' : `${withAudio} dari ${songs.length} lagu sudah ada suaranya.`}
          </p>

          <input
            type="search"
            className="sa-search"
            placeholder="Cari lagu..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
          />

          <div className="sa-filters">
            {[
              ['semua', `Semua (${songs.length})`],
              ['belum', `Belum (${songs.length - withAudio})`],
              ['sudah', `Sudah (${withAudio})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`sa-filter${filter === key ? ' is-active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {msg && (
            <p className="sa-msg" style={{ color: msg.startsWith('✅') ? 'var(--accent)' : 'var(--pink)' }}>
              {msg}
            </p>
          )}

          {!loading && visible.length === 0 && <div className="empty-state">Gak ada lagu yang cocok.</div>}

          {visible.map((song) => {
            const busy = busyId === song.id
            return (
              <div className="sa-row" key={song.id}>
                <div className="sa-row-top">
                  <div className="sa-name">{song.name}</div>
                  <span className={`sa-badge${song.audio_url ? ' is-ok' : ''}`}>
                    {song.audio_url ? 'Ada' : 'Belum'}
                  </span>
                </div>
                <div className="sa-actions">
                  {song.audio_url && (
                    <button type="button" className="sa-btn" disabled={busy} onClick={() => togglePreview(song)}>
                      {previewId === song.id ? 'Jeda' : 'Putar'}
                    </button>
                  )}
                  <button type="button" className="sa-btn sa-btn-main" disabled={busyId !== null} onClick={() => pickFile(song.id)}>
                    {busy ? `Upload ${Math.round(progress * 100)}%` : song.audio_url ? 'Ganti' : 'Upload suara'}
                  </button>
                  {song.audio_url && (
                    <button type="button" className="sa-btn sa-btn-danger" disabled={busyId !== null} onClick={() => handleRemove(song)}>
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFile} />
      <audio ref={audioRef} onEnded={() => setPreviewId(null)} />
    </div>
  )
}
