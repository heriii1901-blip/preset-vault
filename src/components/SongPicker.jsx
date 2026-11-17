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

export default function SongPicker({ songs, selectedSongId, onSelect, showLyricMark = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [previewId, setPreviewId] = useState(null) // lagu yang lagi "kepilih buat didengerin"
  const [playing, setPlaying] = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const justFocusedRef = useRef(false)
  const audioRef = useRef(null)

  // Berhentiin suara + hapus tanda preview. Cuma pakai ref & setState, aman dipanggil dari mana aja.
  function stopPreview() {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setPlaying(false)
    setPreviewId(null)
  }

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

  // Menu ketutup (klik luar / klik tombol / abis milih): suara ikut berhenti
  useEffect(() => {
    if (!open) stopPreview()
  }, [open])

  // Pindah halaman / komponen dilepas: suara berhenti
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? songs.filter((s) => s.name.toLowerCase().includes(q) || (s.lyrics || '').toLowerCase().includes(q))
    : songs

  function handleSelect(id) {
    stopPreview()
    onSelect(id)
    rememberLastSong(id)
    setOpen(false)
    setQuery('')
  }

  // Tap pertama = muter suara lagu itu. Tap lagi di lagu yang sama = pilih lagu itu.
  // Lagu yang belum ada suaranya langsung kepilih di tap pertama.
  function handleRowClick(song) {
    if (!song.audio_url || previewId === song.id) {
      handleSelect(song.id)
      return
    }

    let audio = audioRef.current
    if (!audio) {
      audio = new Audio()
      audio.preload = 'auto'
      audio.onplay = () => setPlaying(true)
      audio.onpause = () => setPlaying(false)
      audio.onended = () => setPlaying(false)
      audio.onerror = () => {
        setPlaying(false)
        setPreviewId(null) // suara gagal dimuat: tap berikutnya langsung milih
      }
      audioRef.current = audio
    }

    audio.pause()
    audio.src = song.audio_url
    audio.currentTime = 0
    audio.play().catch(() => setPlaying(false))
    setPreviewId(song.id)
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
            const isPreviewing = previewId === s.id
            let cls = 'custom-select-option'
            if (s.id === selectedSongId) cls += ' active'
            if (isPreviewing) cls += ' previewing'
            const hasLyric = showLyricMark && !!s.lyrics?.trim()
            if (hasLyric) cls += ' has-lyric-mark'
            return (
              <div key={s.id} className={cls} onClick={() => handleRowClick(s)}>
                <span className={isPreviewing && playing ? 'custom-select-wave is-playing' : 'custom-select-wave'} aria-hidden="true">
                  <i /><i /><i /><i /><i />
                </span>
                <div>{s.name}</div>
                {hasLyric && (
                  <span className="song-lyric-mark" title="Sudah ada lirik" aria-label="Sudah ada lirik">
                    <i /><i /><i /><i /><i />
                  </span>
                )}
                {lyricHit && <div className="custom-select-option-lyric-hint">{lyricSnippet(s.lyrics, q)}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
