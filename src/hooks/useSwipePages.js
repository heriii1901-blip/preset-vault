import { useCallback, useRef, useState } from 'react'

// Geser dianggap "pindah tab" kalau jarak drag > 18% lebar layar.
// Di bawah itu, balik lagi ke tab semula.
const SWIPE_THRESHOLD_RATIO = 0.18

export function useSwipePages(pageCount, initialIndex = 0) {
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)
  const dragRef = useRef({ startX: 0, startY: 0, dragging: false, locked: null })

  const goTo = useCallback((index) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, index))
    setActiveIndex(clamped)
    setDragX(0)
  }, [pageCount])

  function handleTouchStart(e) {
    dragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      dragging: true,
      locked: null, // 'x' | 'y', ditentuin sekali di awal drag
    }
    setIsDragging(true)
  }

  function handleTouchMove(e) {
    if (!dragRef.current.dragging) return
    const dx = e.touches[0].clientX - dragRef.current.startX
    const dy = e.touches[0].clientY - dragRef.current.startY

    // Kunci arah gesture sekali doang di awal. Ini yang nyegah "kedip2":
    // sebelumnya arah horizontal & scroll vertikal isi tab bisa rebutan terus.
    if (dragRef.current.locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      dragRef.current.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }

    if (dragRef.current.locked === 'y') return // biarin scroll vertikal jalan normal, jangan diganggu

    e.preventDefault() // matiin scroll native pas geser horizontal, biar gak dobel gerak sama transform kita
    setDragX(dx)
  }

  function handleTouchEnd() {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    setIsDragging(false)

    if (dragRef.current.locked !== 'x') {
      setDragX(0)
      return
    }

    const width = containerRef.current?.clientWidth || 1
    let target = activeIndex
    if (dragX > width * SWIPE_THRESHOLD_RATIO) target = activeIndex - 1
    else if (dragX < -width * SWIPE_THRESHOLD_RATIO) target = activeIndex + 1
    goTo(target)
  }

  const width = containerRef.current?.clientWidth || 0
  const trackStyle = {
    transform: `translateX(${-activeIndex * width + dragX}px)`,
    transition: isDragging ? 'none' : 'transform 0.25s ease',
  }

  return {
    activeIndex,
    goTo,
    containerRef,
    trackStyle,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
