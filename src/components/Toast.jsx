import { useEffect } from 'react'

export default function Toast({ message, onClose, duration = 2400 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [message, duration, onClose])

  if (!message) return null

  return (
    <div className="pam-toast-wrap">
      <div className="pam-toast">
        <span className="pam-toast-dot" />
        <span className="pam-toast-text">{message}</span>
      </div>
    </div>
  )
}
