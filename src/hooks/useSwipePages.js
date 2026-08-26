import { useCallback, useRef, useState } from 'react'

// Geser dianggap "pindah tab" kalau jarak drag > 18% lebar layar.
// Di bawah itu, balik lagi ke tab semula.
const SWIPE_THRESHOLD_RATIO = 0.18

export function useSwipePages(pageCount, initialIndex = 0) {
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [dragOffset, setDragOffset] = useState(0) // px, cuma keisi pas lagi drag
  const [progress, setProgress] = useState(initialIndex) // posisi kontinu, buat underline & warna tab
  const scrollerRef = useRef(null) // nempel di viewport (overflow:hidden), buat ukur lebar
  const dragRef = useRef({ startX: 0, dragging: false })

  const goTo = useCallback((index) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, index))
    setActiveIndex(clamped)
    setDragOffset(0)
    setProgress(clamped)
  }, [pageCount])

  function handleTouchStart(e) {
    dragRef.current = { startX: e.touches[0].clientX, dragging: true }
  }

  function handleTouchMove(e) {
    if (!dragRef.current.dragging) return
    const width = scrollerRef.current?.clientWidth || 1
    let dx = e.touches[0].clientX - dragRef.current.startX

    // Kunci biar gak bisa geser ngelewatin tab pertama/terakhir
    const rawProgress = activeIndex - dx / width
    if (rawProgress < 0) dx = activeIndex * width
    if (rawProgress > pageCount - 1) dx = (activeIndex - (pageCount - 1)) * width

    setDragOffset(dx)
    setProgress(Math.max(0, Math.min(pageCount - 1, activeIndex - dx / width)))
  }

  function handleTouchEnd() {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    const width = scrollerRef.current?.clientWidth || 1

    let target = activeIndex
    if (dragOffset < -width * SWIPE_THRESHOLD_RATIO) target = activeIndex + 1
    else if (dragOffset > width * SWIPE_THRESHOLD_RATIO) target = activeIndex - 1
    goTo(target)
  }

  const trackStyle = {
    transform: `translate3d(calc(${-activeIndex * 100}% + ${dragOffset}px), 0, 0)`,
    transition: dragRef.current.dragging ? 'none' : 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
  }

  return {
    activeIndex,
    progress,
    trackStyle,
    scrollerRef,
    goTo,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
