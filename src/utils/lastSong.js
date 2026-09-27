// Inget lagu terakhir dipilih pas post/tambah preset, biar pas buka lagi form-nya
// (walau abis nutup APK total) posisinya balik ke lagu itu, bukan balik ke paling atas.
const LAST_SONG_KEY = 'pam_last_song_id'

export function rememberLastSong(songId) {
  if (!songId) return
  try {
    localStorage.setItem(LAST_SONG_KEY, songId)
  } catch {
    // localStorage bisa gagal (mode private/penuh) - gapapa, diem aja
  }
}

// Kasih id lagu terakhir KALAU masih ada di daftar lagu yang aktif (jaga-jaga kalau
// lagu itu udah dihapus). Fallback ke lagu pertama di daftar, atau string kosong.
export function getInitialSongId(songs) {
  let lastId = ''
  try {
    lastId = localStorage.getItem(LAST_SONG_KEY) || ''
  } catch {
    lastId = ''
  }
  if (lastId && songs.some((s) => s.id === lastId)) return lastId
  return songs[0]?.id || ''
}
