import { useEffect, useRef, useState } from 'react'

const COVER_TIME = 2
const MAX_SEEK_RETRY = 6
const SEEK_RETRY_DELAY = 1200

// Antrian global biar nggak semua video di grid nge-seek/decode bareng pas scroll cepet.
// Ini yang paling ngaruh ke jank di hp kentang -> burst decode ditahan, jalan bergantian.
const MAX_CONCURRENT_SEEK = 3
let activeSeekCount = 0
const seekQueue = []

function runNextInQueue() {
  if (activeSeekCount >= MAX_CONCURRENT_SEEK) return
  const next = seekQueue.shift()
  if (!next) return
  activeSeekCount += 1
  next()
}

function enqueueSeek(fn) {
  seekQueue.push(fn)
  runNextInQueue()
}

function releaseSeekSlot() {
  activeSeekCount = Math.max(0, activeSeekCount - 1)
  runNextInQueue()
}

function captureThumb(video, presetId, setCache) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    if (!canvas.width || !canvas.height) return
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    setCache(`thumb:${presetId}`, canvas.toDataURL('image/jpeg', 0.6))
  } catch {
    // video beda origin tanpa izin CORS baca pixel, skip aja
  }
}

export default function PresetVideoCell({
  preset,
  index = 0,
  getCache,
  setCache,
  onNavigate,
  onHoverStart,
  onHoverEnd,
  showOverlay = true,
  className = 'grid-cell',
}) {
  const cellRef = useRef(null)
  const seekRetryRef = useRef(0)
  const seekTimerRef = useRef(null)
  const inQueueRef = useRef(false)
  const [isVisible, setIsVisible] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = cellRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect() // sekali kelihatan cukup, ga perlu terus mantau
          }
        })
      },
      { rootMargin: '80px 0px 80px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Bebersihin antrian & timer kalo cell-nya di-unmount di tengah proses seek
  useEffect(() => {
    return () => {
      clearTimeout(seekTimerRef.current)
      if (inQueueRef.current) {
        inQueueRef.current = false
        releaseSeekSlot()
      }
    }
  }, [])

  function doSeek(video, target) {
    if (seekRetryRef.current >= MAX_SEEK_RETRY) {
      inQueueRef.current = false
      releaseSeekSlot()
      return
    }
    seekRetryRef.current += 1
    video.currentTime = target
    clearTimeout(seekTimerRef.current)
    seekTimerRef.current = setTimeout(() => {
      if (video.currentTime < target - 0.1) {
        doSeek(video, target) // network macet, coba lagi (masih di dalem slot antrian yang sama)
      } else {
        inQueueRef.current = false
        releaseSeekSlot()
      }
    }, SEEK_RETRY_DELAY)
  }

  function handleLoadedMetadata(e) {
    const video = e.currentTarget
    const target = video.duration && video.duration < COVER_TIME ? video.duration / 2 : COVER_TIME
    if (video.currentTime !== 0) return
    seekRetryRef.current = 0
    inQueueRef.current = true
    enqueueSeek(() => doSeek(video, target))
  }

  function handleSeeked(e) {
    clearTimeout(seekTimerRef.current)
    if (inQueueRef.current) {
      inQueueRef.current = false
      releaseSeekSlot()
    }
    captureThumb(e.currentTarget, preset.id, setCache)
  }

  function handleError() {
    if (inQueueRef.current) {
      inQueueRef.current = false
      releaseSeekSlot()
    }
    setFailed(true)
  }

  const snakeDelay = `${Math.min(index, 24) * 35}ms`

  return (
    <div
      className={className}
      data-preset-id={preset.id}
      ref={cellRef}
      style={{ '--snake-delay': snakeDelay }}
      onClick={() => onNavigate?.(preset)}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => onHoverStart?.(e.currentTarget.querySelector('video'))}
      onMouseEnter={(e) => onHoverStart?.(e.currentTarget.querySelector('video'))}
      onMouseLeave={(e) => onHoverEnd?.(e.currentTarget.querySelector('video'))}
    >
            {(() => {
        const cachedThumb = getCache?.(`thumb:${preset.id}`)?.data
        if (preset.preview_video_url && !failed) {
          return (
            <video
              src={isVisible ? preset.preview_video_url : undefined}
              muted
              loop
              playsInline
              preload={isVisible ? 'metadata' : 'none'}
              crossOrigin="anonymous"
              disablePictureInPicture
              controlsList="nodownload"
              draggable={false}
              poster={cachedThumb}
              onLoadedMetadata={handleLoadedMetadata}
              onSeeked={handleSeeked}
              onError={handleError}
            />
          )
        }
        if (cachedThumb) {
          return <img src={cachedThumb} alt="" className="grid-fallback-thumb" draggable={false} />
        }
        return <div className="grid-fallback">🎬</div>
      })()}
      {showOverlay && <div className="grid-cell-overlay">@{preset.creator_username}</div>}
    </div>
  )
}
