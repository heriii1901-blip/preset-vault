import { useCallback, useEffect, useRef, useState } from 'react'

const DOUBLE_TAP_MS = 280

// 1x tap = play/pause (ditunda sebentar nunggu tap ke-2).
// 2x tap = love + hati muncul di titik yang disentuh (kayak IG/TikTok, gak bisa unlike lewat double tap).
export function useDoubleTapLike({ onSingleTap, onLike }) {
  const [hearts, setHearts] = useState([])
  const lastTapRef = useRef({ time: 0, id: null })
  const timerRef = useRef(null)
  const heartCounterRef = useRef(0)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleTap = (id, e) => {
    const now = Date.now()
    const last = lastTapRef.current
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (last.id === id && now - last.time < DOUBLE_TAP_MS) {
      clearTimeout(timerRef.current)
      lastTapRef.current = { time: 0, id: null }
      onLike(id)
      const key = ++heartCounterRef.current
      setHearts((prev) => [...prev, { key, id, x, y, tilt: Math.round(Math.random() * 30 - 15) }])
      setTimeout(() => setHearts((prev) => prev.filter((h) => h.key !== key)), 900)
      return
    }

    lastTapRef.current = { time: now, id }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      lastTapRef.current = { time: 0, id: null }
      onSingleTap(id)
    }, DOUBLE_TAP_MS)
  }

  return { hearts, handleTap }
}s
