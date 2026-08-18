// Upload file langsung ke R2 (bukan lewat Vercel function) pake presigned URL.
// Ini yang bikin video gede ga ke-block sama limit ukuran body Vercel.
export function uploadToR2(file, folder = 'presets', onProgress) {
  return new Promise((resolve, reject) => {
    fetch('/api/get-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'video/mp4',
        folder,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Gagal minta izin upload')
        return res.json()
      })
      .then(({ uploadUrl, publicUrl }) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(e.loaded / e.total)
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(publicUrl)
          else reject(new Error(`Upload ke R2 gagal (status ${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('Upload ke R2 gagal (koneksi putus)'))
        xhr.send(file)
      })
      .catch(reject)
  })
}
