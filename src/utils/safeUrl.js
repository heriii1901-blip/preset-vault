// Cuma link http(s) yang boleh dipakai sebagai href. Selain itu (mis. "javascript:...") dibuang.
// Link tanpa skema (mis. "wa.me/62812...") otomatis ditambah https://.
export function safeHref(value) {
  if (!value || typeof value !== 'string') return undefined
  const trimmed = value.trim()
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

// Buat validasi kolom link wajib (mis. Link 5MB) - nolak teks biasa ("lima MB") atau
// satu kata tanpa domain asli ("lima" bakal ke-parse jadi "https://lima/" yang teknisnya
// valid URL tapi jelas bukan link beneran), tanpa nolak link sah tanpa skema (drive.google.com/...).
export function isValidLink(value) {
  const href = safeHref(value)
  if (!href) return false
  try {
    return new URL(href).hostname.includes('.')
  } catch {
    return false
  }
}
