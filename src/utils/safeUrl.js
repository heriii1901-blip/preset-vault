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
