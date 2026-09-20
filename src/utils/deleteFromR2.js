import { supabase } from '../supabase'

// Hapus file di R2 (video, cover, avatar, wallpaper). Bucket-nya dikenali otomatis dari URL.
// Best-effort: kalo gagal cuma dicatat di console, gak ngelempar error,
// jadi proses hapus data di Supabase tetap jalan.
export async function deleteFromR2(urls) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean)
  if (list.length === 0) return { ok: true, deleted: 0 }
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token || ''
    const res = await fetch('/api/delete-from-r2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ urls: list }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.success === false) {
      console.error('Hapus file di R2 gagal/sebagian:', res.status, json)
      return { ok: false, ...json }
    }
    return { ok: true, ...json }
  } catch (err) {
    console.error('Gagal hubungi /api/delete-from-r2:', err)
    return { ok: false }
  }
}
