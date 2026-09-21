// Nyimpen halaman tujuan sebelum login Google (yang bikin app pindah ke luar lalu balik ke "/"),
// biar habis login bisa langsung lanjut ke halaman tadi, bukan mentok di beranda.
const KEY = 'pam:post-login-redirect'
const MAX_AGE_MS = 30 * 60 * 1000 // tujuan basi setelah 30 menit

function isSafePath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/login') &&
    path !== '/'
  )
}

// Simpan tujuan. Kalau gak ada tujuan yang valid, sisa tujuan lama dibuang.
export function savePostLoginRedirect(path) {
  try {
    if (isSafePath(path)) {
      localStorage.setItem(KEY, JSON.stringify({ path, ts: Date.now() }))
    } else {
      localStorage.removeItem(KEY)
    }
  } catch {
    /* storage bisa diblokir, abaikan */
  }
}

// Ambil tujuan sekali pakai (langsung dihapus). Balikin null kalau gak ada atau udah basi.
export function takePostLoginRedirect() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    localStorage.removeItem(KEY)
    const { path, ts } = JSON.parse(raw)
    if (!isSafePath(path) || Date.now() - ts > MAX_AGE_MS) return null
    return path
  } catch {
    return null
  }
}
