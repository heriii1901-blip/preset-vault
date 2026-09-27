// Ubah link TikTok apapun (link panjang atau short link vt./vm.tiktok.com)
// jadi ID video asli, biar dua link beda bentuk yang nunjuk ke video yang
// sama bisa dicocokin lewat ID-nya, bukan lewat teks link mentah.
export async function resolveTiktokVideoId(rawLink) {
  if (!rawLink) return null

  // Link panjang udah ada ID-nya langsung di teks, gak perlu resolve ke server.
  // Sengaja diperketat: cuma ambil angka yang nempel tepat di belakang "/video/"
  // atau "/v/" (pola asli link TikTok), BUKAN angka 15-20 digit pertama yang
  // ketemu di sembarang bagian teks - soalnya param lain di link (mis. ID user)
  // bisa punya panjang digit yang sama dan bikin ID-nya ketuker sama video lain.
  const localMatch = rawLink.match(/\/(?:video|v)\/(\d{15,20})/)
  if (localMatch) return localMatch[1]

  // Short link (vt.tiktok.com/xxx, vm.tiktok.com/xxx) atau format lain yang ID-nya
  // ngga ketauan dari teks - minta server resolve pake tikwm biar dapet ID video
  // asli langsung dari datanya (bukan nebak dari URL redirect)
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
