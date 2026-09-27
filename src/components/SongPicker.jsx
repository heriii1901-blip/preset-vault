import { useEffect, useRef, useState } from 'react'
import { rememberLastSong } from '../utils/lastSong'

// Ambil potongan teks lirik di sekitar kata yang cocok, buat preview "...kena di sini..."
function lyricSnippet(lyrics, q) {
  const lower = lyrics.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return ''
  const start = Math.max(0, idx - 18)
  const end = Math.min(lyrics.length, idx + q.length + 18)
  return `${start > 0 ? '…' : ''}${lyrics.slice(start, end)}${end < lyrics.length ? '…' : ''}`
}

export default function SongPicker({ songs, selectedSongId, onSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const justFocusedRef = useRef(false)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? songs.filter((s) => s.name.toLowerCase().includes(q) || (s.lyrics || '').toLowerCase().includes(q))
    : songs

  function handleSelect(id) {
    onSelect(id)
    rememberLastSong(id)
    setOpen(false)
    setQuery('')
  }

  // Ketuk pertama: fokus input, keyboard muncul (biarin). Ketuk lagi pas udah fokus
  // (keyboard lagi muncul): keyboard ditutup (blur), bukan malah nutup dropdown-nya.
  function handleSearchClick() {
    if (justFocusedRef.current) {
      justFocusedRef.current = false
      return
    }
    inputRef.current?.blur()
  }

  return (
    <div className="custom-select" ref={wrapRef}>
      <button type="button" className="custom-select-trigger" onClick={() => setOpen((prev) => !prev)}>
        <span>{songs.find((s) => s.id === selectedSongId)?.name || 'Pilih lagu...'}</span>
        <span className={open ? 'custom-select-arrow open' : 'custom-select-arrow'}>▾</span>
      </button>

      {open && (
        <div className="custom-select-menu">
          <div className="custom-select-search">
            <input
              ref={inputRef}
              type="text"
              placeholder="Cari judul atau lirik lagu..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { justFocusedRef.current = true }}
              onClick={handleSearchClick}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
            />
          </div>

          {filtered.length === 0 && (
            <div className="custom-select-option" style={{ color: 'var(--muted)', cursor: 'default' }}>
              Gak ketemu lagu/lirik yang cocok.
            </div>
          )}

          {filtered.map((s) => {
            const nameMatches = q && s.name.toLowerCase().includes(q)
            const lyricHit = q && !nameMatches && (s.lyrics || '').toLowerCase().includes(q)
            return (
              <div
                key={s.id}
                className={s.id === selectedSongId ? 'custom-select-option active' : 'custom-select-option'}
                onClick={() => handleSelect(s.id)}
              >
                <div>{s.name}</div>
                {lyricHit && <div className="custom-select-option-lyric-hint">{lyricSnippet(s.lyrics, q)}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
