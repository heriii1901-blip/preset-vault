import { useLayoutEffect, useRef, useState } from 'react'

// Ngukur posisi tab aktif pakai getBoundingClientRect (bukan persentase),
// biar tetep presisi walau ada padding/gap di tab bar-nya.
// `progress` dari useSwipePages dipakai buat interpolasi real-time antara
// dua tab pas lagi di-swipe (bukan cuma loncat pas landing).
export function useTabIndicator(progress, pageCount) {
  const containerRef = useRef(null)
  const tabRefs = useRef([])
  const [indicatorStyle, setIndicatorStyle] = useState({ opacity: 0 })

  useLayoutEffect(() => {
    const update = () => {
      const container = containerRef.current
      const lower = Math.max(0, Math.min(pageCount - 1, Math.floor(progress)))
      const upper = Math.max(0, Math.min(pageCount - 1, Math.ceil(progress)))
      const frac = progress - lower
      const elLower = tabRefs.current[lower]
      const elUpper = tabRefs.current[upper]

      if (!container || !elLower || !elUpper) {
        setIndicatorStyle((s) => ({ ...s, opacity: 0 }))
        return
      }

      const containerRect = container.getBoundingClientRect()
      const lowerRect = elLower.getBoundingClientRect()
      const upperRect = elUpper.getBoundingClientRect()

      const left = lowerRect.left + (upperRect.left - lowerRect.left) * frac - containerRect.left
      const width = lowerRect.width + (upperRect.width - lowerRect.width) * frac

      setIndicatorStyle({
        opacity: 1,
        width,
        transform: `translateX(${left}px)`,
      })
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [progress, pageCount])

  // Warna teks tab nge-fade dari --muted ke --text, ngikutin jarak
  // progress ke index tab itu (1 = lagi persis di situ, 0 = jauh/nggak keliatan).
  const getTabColor = (index) => {
    const ratio = Math.max(0, 1 - Math.abs(progress - index))
    return `color-mix(in srgb, var(--text) ${Math.round(ratio * 100)}%, var(--muted))`
  }

  return { containerRef, tabRefs, indicatorStyle, getTabColor }
}
