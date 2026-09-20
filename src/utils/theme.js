// Tema disimpen di localStorage, dipasang sebagai atribut di <html>
// (data-theme="light" / "dark"), jadi semua CSS variable tinggal di-override.
const STORAGE_KEY = 'pam-theme'

export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage diblok (mode privat), pake default aja
  }
  return 'dark'
}

export function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', next === 'light' ? '#F5F4FA' : '#1B1B1F')

  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // gagal nyimpen ya udah, tema tetep kepasang buat sesi ini
  }
  return next
}

export function initTheme() {
  return applyTheme(getTheme())
}
