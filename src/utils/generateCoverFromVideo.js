// Ambil 1 frame dari video (default detik ke-2, atau setengah durasi kalau videonya
// lebih pendek dari itu) terus dijadiin file JPEG buat cover/thumbnail preset.
const MAX_SEEK_RETRY = 6
const SEEK_RETRY_DELAY = 300

export function generateCoverFromVideo(videoFile, seekTime = 2) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    const objectUrl = URL.createObjectURL(videoFile)
    video.src = objectUrl

    let retryCount = 0
    let retryTimer = null
    let target = seekTime

    const cleanup = () => {
      clearTimeout(retryTimer)
      URL.revokeObjectURL(objectUrl)
      video.remove()
    }

    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timeout ambil frame video'))
    }, 15000)

    function doSeek() {
      retryCount += 1
      video.currentTime = target
      retryTimer = setTimeout(() => {
        // browser kadang nembak 'seeked' padahal frame-nya belum bener2 pindah
        // (misal belum sempet ke-buffer) - kalo posisinya masih meleset jauh, ulang
        if (video.currentTime < target - 0.15 && retryCount < MAX_SEEK_RETRY) {
          doSeek()
        }
      }, SEEK_RETRY_DELAY)
    }

    video.onloadedmetadata = () => {
      target = Math.min(seekTime, Math.max(video.duration - 0.1, 0.1))
      doSeek()
    }

    video.onseeked = () => {
      // masih jauh dari target & retry belum abis -> jangan capture dulu, tunggu retry
      if (video.currentTime < target - 0.15 && retryCount < MAX_SEEK_RETRY) return
      clearTimeout(retryTimer)
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
