// Salin teks ke clipboard. Ada cadangan buat WebView/browser lama yang gak punya navigator.clipboard.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // lanjut ke cara cadangan di bawah
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

// Tampilan link di profil: buang https:// dan www., maksimal 20 karakter lalu "..."
// Ganti angka 20 kalau mau lebih panjang/pendek.
export function shortLinkLabel(value, max = 20) {
  const clean = String(value || '')
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^www\./i, '')
  return clean.length > max ? `${clean.slice(0, max)}...` : clean
}
