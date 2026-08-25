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
  const [menuSong, setMenuSong] = useState(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
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

  function openRowMenu(song, e) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 6, right: Math.max(12, window.innerWidth - rect.right) })
    setMenuSong(song)
  }
  function closeRowMenu() {
    setMenuSong(null)
  }
  async function handleMenuEdit() {
    const song = menuSong
    closeRowMenu()
    if (song) await handleEditSelected([song.id])
  }
  async function handleMenuDelete() {
    const song = menuSong
    closeRowMenu()
    if (song) await handleDeleteSelected([song.id])
  }

  async function handleEditSelected(ids = selectedIds) {
    const song = songs.find((s) => s.id === ids[0])
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

  async function handleDeleteSelected(ids = selectedIds) {
    const count = ids.length
    const ok = window.confirm(
      count === 1
        ? 'Yakin mau hapus lagu ini? Semua preset di dalamnya ikut kehapus.'
        : `Yakin mau hapus ${count} lagu? Semua preset di dalamnya ikut kehapus.`
    )
    if (!ok) return
    try {
      const { error: presetErr } = await supabase.from('presets').delete().in('song_id', ids)
      if (presetErr) throw presetErr
      const { error: songErr } = await supabase.from('songs').delete().in('id', ids)
      if (songErr) throw songErr
      setSongs((prev) => prev.filter((s) => !ids.includes(s.id)))
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
          <h1 className="home-tagline">Cari & Download Preset Alight Motion</h1>
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
              {selectionMode && (
                <span className={`song-radio${selectedIds.includes(song.id) ? ' is-checked' : ''}`} />
              )}
              <div className="song-thumb" style={{ background: song.color }}>
                {song.coverUrl ? <img src={song.coverUrl} alt="" draggable={false} /> : '♪'}
              </div>
              <div className="song-text">
                <h4>{song.name}</h4>
                <div className="song-meta-row">{song.presetCount || 0} preset</div>
              </div>
              {isAdmin && !selectionMode && (
                <button type="button" className="song-menu-btn" onClick={(e) => openRowMenu(song, e)}>
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
          <div className="selection-bar-top">
            <span className="selection-count">{selectedIds.length} dipilih</span>
            <button className="selection-cancel" onClick={exitSelectionMode}>Batal</button>
          </div>
          <div className="selection-actions">
            {selectedIds.length === 1 && (
              <button className="selection-action-btn" onClick={() => handleEditSelected()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                <span>Edit Nama</span>
              </button>
            )}
            <button className="selection-action-btn selection-action-danger" onClick={() => handleDeleteSelected()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
              <span>Hapus</span>
            </button>
          </div>
        </div>
      )}

      {menuSong && (
        <>
          <div className="row-menu-backdrop" onClick={closeRowMenu} />
          <div className="row-menu" style={{ top: menuPos.top, right: menuPos.right }}>
            <button type="button" className="row-menu-item" onClick={handleMenuEdit}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span>Edit Nama</span>
            </button>
            <button type="button" className="row-menu-item row-menu-danger" onClick={handleMenuDelete}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
              <span>Hapus</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
