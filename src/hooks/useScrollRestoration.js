import { useEffect, useRef } from 'react'

// Nyimpen posisi scroll per "key" (biasanya cache key halaman) di luar siklus
// render React, jadi walaupun komponennya di-unmount terus remount lagi (misal
// abis balik dari halaman full screen video), posisi scroll-nya gak ilang.
const scrollPositions = new Map()

export function useScrollRestoration(ref, key, ready = true) {
  const restoredKeyRef = useRef(null)

  // Pulihin posisi scroll begitu kontennya udah siap (baru ada tinggi buat discroll)
  useEffect(() => {
    if (!ready || !key) return
    const el = ref.current
    if (!el) return
    if (restoredKeyRef.current === key) return
    const saved = scrollPositions.get(key)
    if (saved) el.scrollTop = saved
    restoredKeyRef.current = key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key])

  // Terus catet posisi scroll-nya tiap kali digeser, sampe komponennya unmount
  useEffect(() => {
    const el = ref.current
    if (!el || !key) return
    const handleScroll = () => scrollPositions.set(key, el.scrollTop)
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollPositions.set(key, el.scrollTop)
      el.removeEventListener('scroll', handleScroll)
    }
  }, [key])
}
