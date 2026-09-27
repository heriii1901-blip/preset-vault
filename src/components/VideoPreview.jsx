import { useEffect, useRef, useState } from 'react'

// Preview video lokal (dari <input type="file">) pake object URL, auto-revoke
// pas file-nya ganti atau komponennya kepop.
//
// Sengaja GAK pake atribut `controls` bawaan browser: kontrol native itu
// internalnya pake <input type="range"> buat seek bar, dan di WebView/TWA
// (APK PAM), elemen itu suka salah kepicu jadi manggil keyboard pas disentuh.
// Diganti tombol play/pause custom sendiri (cuma div + SVG, gak ada <input>
// sama sekali) biar bug keyboard itu gak ada alasan buat muncul lagi.
export default function VideoPreview({ file }) {
  const [url, setUrl] = useState('')
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    if (!file) {
      setUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    setPlaying(false)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!url) return null

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxHeight: 260,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#000',
        marginTop: 10,
      }}
      onClick={togglePlay}
    >
      <video
        key={url}
        ref={videoRef}
        src={url}
        playsInline
        loop
        onEnded={() => setPlaying(false)}
        style={{ width: '100%', maxHeight: 260, display: 'block' }}
      />
      {!playing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#111">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
