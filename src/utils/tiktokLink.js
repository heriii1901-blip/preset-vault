// Ubah link TikTok apapun (link panjang atau short link vt./vm.tiktok.com)
// jadi ID video asli, biar dua link beda bentuk yang nunjuk ke video yang
// sama bisa dicocokin lewat ID-nya, bukan lewat teks link mentah.
export async function resolveTiktokVideoId(rawLink) {
  if (!rawLink) return null

  // Link panjang udah ada ID-nya langsung di teks, gak perlu resolve ke server
  const localMatch = rawLink.match(/(\d{15,20})/)
  if (localMatch) return localMatch[1]

  // Short link (vt.tiktok.com/xxx, vm.tiktok.com/xxx) gak ada ID di teksnya -
  // minta server buka redirect-nya dulu buat dapetin link panjang aslinya
  try {
    const res = await fetch('/api/resolve-tiktok-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: rawLink }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.videoId || null
  } catch {
    return null
  }
}
