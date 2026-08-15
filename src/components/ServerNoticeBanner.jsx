import { useEffect, useState } from 'react'

const NOTICE_KEY = 'pam_server_notice_dismissed'

// Matiin/nyalain pengumuman di sini. Kalo mau pasang pengumuman baru,
// tinggal ganti NOTICE_ENABLED ke true + ubah judul/teks di bawah.
const NOTICE_ENABLED = false
const NOTICE_TITLE = 'PEMBERITAHUAN!!!'
const NOTICE_TEXT = 'Server lagi kena limit bandwidth dari penyedia hosting, jadi kadang preset baru telat muncul atau video gagal load. Bukan admin males update, murni server lagi dibatasi. Sabar ya, nanti balik normal sendiri sampe limit kena reset.'

export function ServerNoticeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!NOTICE_ENABLED) return
    const dismissed = sessionStorage.getItem(NOTICE_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  const dismiss = () => {
    sessionStorage.setItem(NOTICE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="server-notice-backdrop">
      <div className="server-notice-box">
        <button type="button" className="server-notice-close" onClick={dismiss} aria-label="Tutup">×</button>
        <p className="server-notice-title">{NOTICE_TITLE}</p>
        <p className="server-notice-text">{NOTICE_TEXT}</p>
        <button type="button" className="server-notice-ok" onClick={dismiss}>Oke, Lanjut</button>
      </div>
    </div>
  )
}
