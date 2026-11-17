import { supabase } from '../supabase'

// Kunci buat nentuin dua lagu itu "sama": huruf besar/kecil & spasi pinggir/dobel diabaikan
export function songKey(name) {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

const byId = (a, b) => String(a.id).localeCompare(String(b.id))

// Gabungin lagu bernama sama jadi satu entri. Lagu "utama" = id terkecil (stabil, gak berubah-ubah).
export function groupSongs(songs) {
  const map = new Map()
  for (const s of songs) {
    const k = songKey(s.name)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(s)
  }
  return [...map.values()].map((members) => {
    const sorted = [...members].sort(byId)
    return {
      ...sorted[0],
      ids: sorted.map((m) => m.id),
      presetCount: members.reduce((n, m) => n + (m.presetCount || 0), 0),
      coverUrl: members.find((m) => m.coverUrl)?.coverUrl || null,
      audio_url: members.find((m) => m.audio_url)?.audio_url || null,
      lyrics: members.map((m) => m.lyrics).filter(Boolean).join('\n') || null,
    }
  })
}

// Dipakai halaman grid & full screen: cari semua id lagu yang "kembar" sama lagu ini.
// Daftar id+nama diingat 5 menit di memori biar gak nembak Supabase tiap buka halaman (jaga egress).
let memo = { at: 0, rows: null }

export async function getSiblingSongIds(songId) {
  if (!memo.rows || Date.now() - memo.at > 5 * 60 * 1000) {
    const { data, error } = await supabase.from('songs').select('id, name')
    if (error) throw error
    memo = { at: Date.now(), rows: data || [] }
  }
  const me = memo.rows.find((r) => String(r.id) === String(songId))
  if (!me) return { ids: [songId], primaryId: songId }
  const k = songKey(me.name)
  const ids = memo.rows
    .filter((r) => songKey(r.name) === k)
    .sort(byId)
    .map((r) => r.id)
  return { ids, primaryId: ids[0] }
}
