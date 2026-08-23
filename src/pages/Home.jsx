import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { usePresetCache } from '../context/PresetCacheContext'

const CACHE_KEY = 'lagu-list'

export default function Home() {
  const [query, setQuery] = useState('')
  const { getCache, setCache } = usePresetCache()
  const cached = getCache(CACHE_KEY)
  const [songs, setSongs] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const longPressTimer = useRef(null)
  const longPressTriggered = useRef(false)

  useEffect(() => {
    async function loadSongs() {
      // Kalo udah ada cache, tampilin dulu tanpa loading, terus refresh diem-diem
      if (!getCache(CACHE_KEY)) setLoading(true)
      try {
        const [{ data: songList, error: songErr }, { data: presetRows, error: presetErr }] = await Promise.all([
          supabase.from('songs').select('*'),
          supabase.from('presets').select('song_id, cover_url').eq('link_pending', false),
        ])
        if (songErr) throw songErr
        if (presetErr) throw presetErr

        const countMap = {}
        const coverMap = {}
        for (const row of presetRows || []) {
          countMap[row.song_id] = (countMap[row.song_id] || 0) + 1
          if (!coverMap[row.song_id] && row.cover_url) coverMap[row.song_id] = row.cover_url
        }

        const withRealCount = songList
          .map((song) => ({
            ...song,
            presetCount: countMap[song.id] ?? song.preset_count ?? 0,
            coverUrl: coverMap[song.id] || null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))

        setSongs(withRealCount)
        setCache(CACHE_KEY, withRealCount)
      } catch (err) {
        console.error('Gagal ambil daftar lagu:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSongs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredSongs = songs.filter((song) =>
    song.name.toLowerCase().includes(query.toLowerCase())
  )

  const touchStartPos = useRef({ x: 0, y: 0 })

  function startLongPress(song, e) {
    if (!isAdmin) return
    const touch = e.touches ? e.touches[0] : e
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      if (navigator.vibrate) navigator.vibrate(30)
      setSelectionMode(true)
      setSelectedIds((prev) => (prev.includes(song.id) ? prev : [...prev, song.id]))
    }, 400)
  }

  function moveLongPress(e) {
    if (!longPressTimer.current) return
    const touch = e.touches ? e.touches[0] : e
    const dx = Math.abs(touch.clientX - touchStartPos.current.x)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)
    if (dx > 10 || dy > 10) cancelLongPress()
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  function handleRowClick(song) {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    if (selectionMode) {
      setSelectedIds((prev) =>
        prev.includes(song.id) ? prev.filter((id) => id !== song.id) : [...prev, song.id]
      )
      return
    }
    navigate(`/lagu/${song.id}`)
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds([])
  }

  async function handleEditSelected() {
    const song = songs.find((s) => s.id === selectedIds[0])
    if (!song) return
    const newName = window.prompt('Ganti nama lagu jadi:', song.name)
    if (!newName || newName.trim() === '' || newName === song.name) {
      exitSelectionMode()
      return
    }
    try {
      const { error } = await supabase
        .from('songs')
        .update({ name: newName.trim() })
        .eq('id', song.id)
      if (error) throw error
      setSongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, name: newName.trim() } : s))
      )
    } catch (err) {
      console.error('Gagal ganti nama lagu:', err)
      alert('Gagal ganti nama lagu, coba lagi.')
    } finally {
      exitSelectionMode()
    }
  }

  async function handleDeleteSelected() {
    const count = selectedIds.length
    const ok = window.confirm(
      count === 1
        ? 'Yakin mau hapus lagu ini? Semua preset di dalamnya ikut kehapus.'
        : `Yakin mau hapus ${count} lagu? Semua preset di dalamnya ikut kehapus.`
    )
    if (!ok) return
    try {
      const { error: presetErr } = await supabase.from('presets').delete().in('song_id', selectedIds)
      if (presetErr) throw presetErr
      const { error: songErr } = await supabase.from('songs').delete().in('id', selectedIds)
      if (songErr) throw songErr
      setSongs((prev) => prev.filter((s) => !selectedIds.includes(s.id)))
    } catch (err) {
      console.error('Gagal hapus lagu:', err)
      alert('Gagal hapus lagu, coba lagi.')
    } finally {
      exitSelectionMode()
    }
  }

  return (
    <div className="screen">
      <div className="list-content">
        <div className="list-header">
          <div className="eyebrow">BERANDA</div>
          <h1 className="home-tagline">Cari & Download Preset Alight Motion (AM)</h1>
          <div className="search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8A8A96" strokeWidth="2" width="19" height="19">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Cari lagu..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              data-lpignore="true"
            />
          </div>
        </div>

        <div className="song-list">
          {loading && <div className="empty-state">Memuat...</div>}

          {!loading && filteredSongs.length === 0 && songs.length === 0 && (
            <div className="empty-state">
              Belum ada lagu/preset tersimpen.
              {isAdmin && ' Tambahin dulu lewat Panel Admin.'}
            </div>
          )}

          {!loading && filteredSongs.length === 0 && songs.length > 0 && (
            <div className="empty-state">Gak ada lagu yang cocok.</div>
          )}

          {filteredSongs.map((song) => (
            <div
              className={`song-row${selectionMode && selectedIds.includes(song.id) ? ' selected' : ''}`}
              key={song.id}
              onClick={() => handleRowClick(song)}
              onTouchStart={(e) => startLongPress(song, e)}
              onTouchMove={moveLongPress}
              onTouchEnd={cancelLongPress}
              onTouchCancel={cancelLongPress}
              onMouseDown={(e) => startLongPress(song, e)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="song-thumb" style={{ background: song.color }}>
                {song.coverUrl ? <img src={song.coverUrl} alt="" draggable={false} /> : '♪'}
              </div>
              <div className="song-text">
                <h4>{song.name}</h4>
                <div className="song-meta-row">{song.presetCount || 0} preset</div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="song-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectionMode(true)
                    setSelectedIds((prev) => (prev.includes(song.id) ? prev : [...prev, song.id]))
                  }}
                >
                  ⋮
                </button>
              )}
            </div>
          ))}
        </div>

        {isAdmin && !selectionMode && (
          <div className="admin-shortcut-row">
            <button className="admin-shortcut" onClick={() => navigate('/admin/tambah-preset')}>
              ⚙ Panel Admin
            </button>
            <button className="admin-shortcut admin-shortcut-danger" onClick={() => navigate('/admin/kelola-preset')}>
              🗑 Kelola Preset
            </button>
          </div>
        )}
      </div>

      {selectionMode && (
        <div className="selection-bar">
          <button className="selection-cancel" onClick={exitSelectionMode}>Batal</button>
          <span className="selection-count">{selectedIds.length} dipilih</span>
          <div className="selection-actions">
            {selectedIds.length === 1 && (
              <button className="selection-edit" onClick={handleEditSelected}>Edit nama</button>
            )}
            <button className="selection-delete" onClick={handleDeleteSelected}>Hapus</button>
          </div>
        </div>
      )}
    </div>
  )
}
