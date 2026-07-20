import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { BottomNav } from '../components/BottomNav'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const [query, setQuery] = useState('')
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const longPressTimer = useRef(null)
  const longPressTriggered = useRef(false)

  useEffect(() => {
    async function loadSongs() {
      try {
        const { data: songList, error } = await supabase.from('songs').select('*')
        if (error) throw error

        const withRealCount = await Promise.all(
          songList.map(async (song) => {
            const { count } = await supabase
              .from('presets')
              .select('*', { count: 'exact', head: true })
              .eq('song_id', song.id)
            return { ...song, presetCount: count ?? song.preset_count ?? 0 }
          })
        )

        withRealCount.sort((a, b) => a.name.localeCompare(b.name))
        setSongs(withRealCount)
      } catch (err) {
        console.error('Gagal ambil daftar lagu:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSongs()
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
          <div className="search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8A8A96" strokeWidth="2" width="16" height="16">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Cari lagu..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
              <div className="song-thumb" style={{ background: song.color }}>♪</div>
              <div className="song-text">
                <h4>{song.name}</h4>
              </div>
              <span className="song-count">{song.presetCount || 0}</span>
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

      <BottomNav />
    </div>
  )
}
