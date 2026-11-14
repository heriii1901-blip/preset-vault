import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Kotak pemutar suara lagu. Muncul di tengah layar pas PP lagu di list diketuk.
// songs   = lagu yang punya audio_url, urutannya sama kayak list di layar
// startId = lagu yang diketuk
export default function SongPlayerModal({ songs, startId, onClose }) {
  const [currentId, setCurrentId] = useState(startId)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const audioRef = useRef(null)

  const idx = Math.max(0, songs.findIndex((s) => s.id === currentId))
  const song = songs[idx]
  const audioUrl = song?.audio_url
  const many = songs.length > 1

  // Ganti lagu (atau baru dibuka): muat ulang audio, langsung putar
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    setTime(0)
    setDuration(0)
    setFailed(false)
    audio.load()
    audio.play().catch(() => setPlaying(false))
  }, [audioUrl])

  // Kotak ditutup / pindah halaman: suara berhenti
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio) audio.pause()
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!song) return null

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  // Prev / next. Kalau cuma ada satu lagu yang bisa diputar, tombolnya ngulang dari awal.
  function go(delta) {
    if (!many) {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
      return
    }
    const next = songs[(idx + delta + songs.length) % songs.length]
    setCurrentId(next.id)
  }

  function handleSeek(e) {
    const audio = audioRef.current
    const value = Number(e.target.value)
    if (audio) audio.currentTime = value
    setTime(value)
  }

  const pct = duration ? `${Math.min(100, (time / duration) * 100)}%` : '0%'

  return createPortal(
    <div className="sp-backdrop" onClick={onClose}>
      <div className="sp-card" role="dialog" aria-label={`Putar ${song.name}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sp-close" onClick={onClose} aria-label="Tutup">×</button>

        <h3 className="sp-title">{song.name}</h3>
        <div className="sp-divider" />

        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={(e) => {
            e.currentTarget.currentTime = 0
            setTime(0)
            setPlaying(false)
          }}
          onError={() => setFailed(true)}
        />

        <input
          type="range"
          className="sp-range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          onChange={handleSeek}
          disabled={!duration}
          style={{ '--pct': pct }}
          aria-label="Posisi lagu"
        />
        <div className="sp-times">
          <span>{fmt(time)}</span>
          <span>{fmt(duration)}</span>
        </div>

        <div className="sp-controls">
          <button type="button" className="sp-btn" onClick={() => go(-1)} aria-label="Lagu sebelumnya">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6z" /><path d="M20 5v14L9 12z" /></svg>
          </button>
          <button type="button" className="sp-btn sp-play" onClick={togglePlay} aria-label={playing ? 'Jeda' : 'Putar'}>
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button type="button" className="sp-btn" onClick={() => go(1)} aria-label="Lagu berikutnya">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2z" /><path d="M4 5v14l11-7z" /></svg>
          </button>
        </div>

        {failed && <p className="sp-error">Suara gagal dimuat. Coba lagi nanti.</p>}
      </div>
    </div>,
    document.body
  )
}
