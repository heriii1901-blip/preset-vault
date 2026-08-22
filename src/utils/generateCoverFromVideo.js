// Ambil 1 frame dari video (default detik ke-2, atau setengah durasi kalau videonya
// lebih pendek dari itu) terus dijadiin file JPEG buat cover/thumbnail preset.
export function generateCoverFromVideo(videoFile, seekTime = 2) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    const objectUrl = URL.createObjectURL(videoFile)
    video.src = objectUrl

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
      video.remove()
    }

    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timeout ambil frame video'))
    }, 15000)

    video.onloadedmetadata = () => {
      const target = Math.min(seekTime, Math.max(video.duration - 0.1, 0.1))
      video.currentTime = target
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            clearTimeout(timeout)
            cleanup()
            if (!blob) return reject(new Error('Gagal generate cover'))
            resolve(new File([blob], 'cover.jpg', { type: 'image/jpeg' }))
          },
          'image/jpeg',
          0.8
        )
      } catch (err) {
        clearTimeout(timeout)
        cleanup()
        reject(err)
      }
    }

    video.onerror = () => {
      clearTimeout(timeout)
      cleanup()
      reject(new Error('Gagal load video buat ambil cover'))
    }

    video.load()
  })
}
