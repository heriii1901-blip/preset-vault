import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useAuth } from '../../context/AuthContext'
import { usePresetCache } from '../../context/PresetCacheContext'
import { dayKeyWIB } from '../../utils/dailyOrder'

export default function KreatorEditPreset() {
  const { presetId } = useParams()
  const navigate = useNavigate()
  const { creatorUsername } = useAuth()
  const { clearCache } = usePresetCache()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const [songs, setSongs] = useState([])
  const [selectedSongId, setSelectedSongId] = useState('')
  const [originalSongId, setOriginalSongId] = useState('')
  const [songDropdownOpen, setSongDropdownOpen] = useState(false)
  const songDropdownRef = useRef(null)
  const [xmlLink, setXmlLink] = useState('')
  const [mbLink, setMbLink] = useState('')
  const [tiktokLink, setTiktokLink] = useState('')

  useEffect(() => {
    async function load() {
      if (!creatorUsername) return
      setLoading(true)
      try {
        const { data: songData } = await supabase.from('songs').select('*')
        setSongs([...(songData || [])].sort((a, b) => a.name.localeCompare(b.name)))

        const { data, error } = await supabase
          .from('presets')
          .select('id, song_id, xml_link, mb_link, tiktok_link, creator_username')
          .eq('id', presetId)
          .maybeSingle()
        if (error) throw error
        if (!data || data.creator_username !== creatorUsername) {
          setNotFound(true)
          return
        }
        setSelectedSongId(data.song_id || '')
        setOriginalSongId(data.song_id || '')
        setXmlLink(data.xml_link || '')
        setMbLink(data.mb_link || '')
        setTiktokLink(data.tiktok_link || '')
      } catch (err) {
        console.error('Gagal ambil preset:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [presetId, creatorUsername])

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

  async function handleSave(e) {
    e.preventDefault()
    setStatusMsg('')
    if (!xmlLink.trim()) return setStatusMsg('Link XML belum diisi.')
    if (!mbLink.trim()) return setStatusMsg('Link 5MB belum diisi.')
    if (!selectedSongId) return setStatusMsg('Pilih lagunya dulu.')

    setSaving(true)
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/update-own-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data?.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          presetId,
          songId: selectedSongId,
          xmlLink: xmlLink.trim(),
          mbLink: mbLink.trim(),
          tiktokLink: tiktokLink.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Server balas ${res.status}`)

      clearCache(`own-presets:${creatorUsername}`)
      clearCache(`kreator-presets:${creatorUsername}`)
      clearCache(`song:${originalSongId}:${dayKeyWIB()}`)
      if (selectedSongId !== originalSongId) clearCache(`song:${selectedSongId}:${dayKeyWIB()}`)

      setStatusMsg('✅ Preset berhasil diupdate.')
      setTimeout(() => navigate(-1), 700)
    } catch (err) {
      console.error('Gagal update preset:', err)
      setStatusMsg(`❌ ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="admin-content">
          <div className="empty-state">Memuat...</div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="screen">
        <div className="admin-content">
          <button className="back-btn ghost-static" style={{ margin: '0 0 14px 18px', width: 'fit-content' }} onClick={() => navigate(-1)}>
            ← Balik
          </button>
          <div className="empty-state">Preset gak ditemukan atau bukan punya kamu.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="admin-content">
        <button className="back-btn ghost-static" style={{ margin: '0 0 14px 18px', width: 'fit-content' }} onClick={() => navigate(-1)}>
          ← Balik
        </button>

        <div className="admin-header">
          <span className="admin-tag">KREATOR</span>
          <h2>Edit Preset</h2>
        </div>

        <form onSubmit={handleSave} className="admin-pad">
          <div className="form-field">
            <label>Link XML (satu link per baris kalau lebih dari satu)</label>
            <div className="input-wrap">
              <textarea
                className="finput-real finput-multiline"
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
            <label>Lagu</label>
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
          </div>

          <div className="form-field">
            <label>Link akun/video TikTok kamu</label>
            <div className="input-wrap">
              <input
                className="finput-real"
                value={tiktokLink}
                onChange={(e) => setTiktokLink(e.target.value)}
                placeholder="tiktok.com/@username/video/..."
              />
              {tiktokLink && (
                <button type="button" className="input-clear-btn" onClick={() => setTiktokLink('')} aria-label="Hapus isi">×</button>
              )}
            </div>
          </div>

          <p className="hint" style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 11.5 }}>
            Video contoh belum bisa diganti di sini — cuma info link, lagu, sama link TikTok.
          </p>

          {statusMsg && (
            <p style={{ fontSize: 12.5, marginBottom: 12, color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)' }}>
              {statusMsg}
            </p>
          )}

          <button className="save-btn" type="submit" disabled={saving}>
            {saving ? 'Ngupdate...' : 'Update Preset'}
          </button>
        </form>
      </div>
    </div>
  )
}
