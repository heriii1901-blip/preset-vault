import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from './AuthContext'

// Jumlah antrian yang nunggu keputusan admin (request lagu + pengajuan kreator).
// Dipake buat titik merah di nav "Efek" dan tombol + di halaman Efek.
// Cuma admin yang nge-query, dan pakai head count (nggak narik baris data), jadi egress-nya hampir nol.
const AdminPendingContext = createContext({
  songCount: 0,
  applicationCount: 0,
  total: 0,
  refresh: () => {},
})

export function AdminPendingProvider({ children }) {
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const [songCount, setSongCount] = useState(0)
  const [applicationCount, setApplicationCount] = useState(0)
  const prevPathRef = useRef('')

  const refresh = useCallback(async () => {
    if (!isAdmin) return
    try {
      const [songRes, appRes] = await Promise.all([
        supabase.from('song_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('creator_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      if (songRes.error) console.error('Gagal ambil jumlah request lagu:', songRes.error)
      else setSongCount(songRes.count || 0)
      if (appRes.error) console.error('Gagal ambil jumlah pengajuan kreator:', appRes.error)
      else setApplicationCount(appRes.count || 0)
    } catch (err) {
      console.error('Gagal ambil antrian admin:', err)
    }
  }, [isAdmin])

  // Refresh cuma di 3 momen: (1) pertama kali app kebuka, (2) baru keluar dari halaman /admin/*
  // (biasanya habis terima/tolak), (3) masuk ke /efek.
  // Dep array [isAdmin, pathname, refresh]: refresh cuma berubah kalau isAdmin berubah, dan refresh()
  // cuma nyetel state di context ini (nggak ngubah pathname), jadi TIDAK ada loop / query berulang.
  useEffect(() => {
    if (!isAdmin) return
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (prev === '' || prev.startsWith('/admin/') || pathname === '/efek') refresh()
  }, [isAdmin, pathname, refresh])

  // Refresh juga pas app dibuka lagi dari background (APK/TWA). Listener dipasang sekali per status admin.
  useEffect(() => {
    if (!isAdmin) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isAdmin, refresh])

  const songs = isAdmin ? songCount : 0
  const apps = isAdmin ? applicationCount : 0

  return (
    <AdminPendingContext.Provider value={{ songCount: songs, applicationCount: apps, total: songs + apps, refresh }}>
      {children}
    </AdminPendingContext.Provider>
  )
}

export function useAdminPending() {
  return useContext(AdminPendingContext)
}
