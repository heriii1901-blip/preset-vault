import { useEffect, useState } from 'react'

// Preview video lokal (dari <input type="file">) pake object URL,
// auto-revoke pas file-nya ganti atau komponennya kepop.
export default function VideoPreview({ file }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!url) return null

  return (
    <video
      key={url}
      src={url}
      controls
      playsInline
      style={{
        width: '100%',
        maxHeight: 260,
        borderRadius: 12,
        background: '#000',
        marginTop: 10,
        display: 'block',
      }}
    />
  )
}
