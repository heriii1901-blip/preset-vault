import { useEffect, useState } from 'react'

const NOTICE_KEY = 'pam_server_notice_dismissed'

export function ServerNoticeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
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
        <p className="server-notice-title">PEMBERITAHUAN!!!</p>
        <p className="server-notice-text">
          Server lagi kena limit bandwidth dari penyedia hosting, jadi kadang preset baru telat muncul atau video gagal load.
          Bukan admin males update, murni server lagi dibatasi. Sabar ya, nanti balik normal sendiri sampe limit kena reset ><.
        </p>
        <button type="button" className="server-notice-ok" onClick={dismiss}>Oke, Lanjut</button>
      </div>
    </div>
  )
}
