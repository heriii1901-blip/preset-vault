import { useCallback, useRef, useState } from 'react'

// Geser dianggap "pindah tab" kalau jarak drag > 18% lebar layar.
// Di bawah itu, balik lagi ke tab semula.
const SWIPE_THRESHOLD_RATIO = 0.18

export function useSwipePages(pageCount, initialIndex = 0) {
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const scrollerRef = useRef(null)
  const dragRef = useRef({ startX: 0, dragging: false, startScrollLeft: 0 })

  const goTo = useCallback((index) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, index))
    setActiveIndex(clamped)
    const el = scrollerRef.current
    if (el) el.scrollTo({ left: el.clientWidth * clamped, behavior: 'smooth' })
  }, [pageCount])

  function handleTouchStart(e) {
    const el = scrollerRef.current
    if (!el) return
    dragRef.current = {
      startX: e.touches[0].clientX,
      dragging: true,
      startScrollLeft: el.scrollLeft,
    }
  }

  function handleTouchMove(e) {
    const el = scrollerRef.current
    if (!el || !dragRef.current.dragging) return
    const dx = e.touches[0].clientX - dragRef.current.startX
    el.scrollLeft = dragRef.current.startScrollLeft - dx
  }

  function handleTouchEnd() {
    const el = scrollerRef.current
    if (!el || !dragRef.current.dragging) return
    dragRef.current.dragging = false
    const width = el.clientWidth || 1
    const delta = el.scrollLeft - dragRef.current.startScrollLeft

    // Dijamin maksimal pindah 1 tab per swipe, gak peduli sekenceng apa geraknya
    let target = activeIndex
    if (delta > width * SWIPE_THRESHOLD_RATIO) target = activeIndex + 1
    else if (delta < -width * SWIPE_THRESHOLD_RATIO) target = activeIndex - 1
    goTo(target)
  }

  return {
    activeIndex,
    scrollerRef,
    goTo,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
