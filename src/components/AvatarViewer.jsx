import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Foto profil dibuka bulat di tengah layar, layar belakang diredupin. Tap area kosong buat nutup.
export default function AvatarViewer({ open, src, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !src) return null

  return createPortal(
    <div className="avatar-viewer-backdrop" onClick={onClose}>
      <img
        className="avatar-viewer-img"
        src={src}
        alt="Foto profil"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}
