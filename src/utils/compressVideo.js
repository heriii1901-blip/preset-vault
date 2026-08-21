import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'

let ffmpegInstance = null

async function loadWithTimeout(loadFn, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout (${ms / 1000}s) - jaringan lambat/CDN gak kebuka`)), ms)
  })
  try {
    return await Promise.race([loadFn(), timeout])
  } finally {
    clearTimeout(timer)
  }
}

export async function getFFmpeg(onProgress) {
  if (ffmpegInstance) {
    if (onProgress) {
      ffmpegInstance.off?.('progress')
      ffmpegInstance.on('progress', ({ progress }) => onProgress(progress))
    }
    return ffmpegInstance
  }

  const ffmpeg = new FFmpeg()
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress))
  }

  // Pake core-mt (multi-thread) - jauh lebih cepet dari versi single-thread.
  // Butuh header COOP/COEP di vercel.json biar SharedArrayBuffer diizinin browser.
  // Kalo gagal (browser gak support / header belom kepasang), fallback ke single-thread.
  const baseURLmt = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'
  const baseURLst = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  try {
    if (typeof SharedArrayBuffer === 'undefined' || !window.crossOriginIsolated) {
      throw new Error('cross-origin isolation belom aktif, skip multi-thread')
    }
    await loadWithTimeout(async () => {
      const coreURL = await toBlobURL(`${baseURLmt}/ffmpeg-core.js`, 'text/javascript')
      const wasmURL = await toBlobURL(`${baseURLmt}/ffmpeg-core.wasm`, 'application/wasm')
      const workerURL = await toBlobURL(`${baseURLmt}/ffmpeg-core.worker.js`, 'text/javascript')
      await ffmpeg.load({ coreURL, wasmURL, workerURL })
    }, 20000, 'Load ffmpeg multi-thread')
  } catch (mtErr) {
    console.warn('Multi-thread ffmpeg gagal, fallback ke single-thread:', mtErr?.message)
    try {
      await loadWithTimeout(async () => {
        const coreURL = await toBlobURL(`${baseURLst}/ffmpeg-core.js`, 'text/javascript')
        const wasmURL = await toBlobURL(`${baseURLst}/ffmpeg-core.wasm`, 'application/wasm')
        await ffmpeg.load({ coreURL, wasmURL })
      }, 20000, 'Load ffmpeg single-thread')
    } catch (err) {
      console.error('RAW error pas load ffmpeg core:', err)
      throw new Error(`Gagal fetch ffmpeg-core dari unpkg: ${err?.message || String(err)}`)
    }
  }

  ffmpegInstance = ffmpeg
  return ffmpeg
}

// Ambil durasi video pake elemen <video> biasa
function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration || 0)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal baca durasi video'))
    }
    video.src = url
  })
}

const SKIP_COMPRESS_BYTES = 5 * 1024 * 1024 // Di bawah ini, auto post tanpa kompres sama sekali
const MAX_SIZE_BYTES = 6 * 1024 * 1024 // Target akhir kalau kena kompres
const AUDIO_BITRATE_KBPS = 64
const MIN_VIDEO_BITRATE_KBPS = 350 // dulu 150 - kegedean turunnya buat konten gerak cepet, jadi pecah/blocky
const SAFETY_MARGIN = 0.92
const RESOLUTION_STEPS = [1280, 960, 720, 540] // sisi terpanjang (px)
const MAX_ATTEMPTS = 5

// Cap sisi terpanjang (landscape: width, portrait: height), gak upscale video kecil
function buildScaleFilter(maxDim) {
  return `if(gt(iw\\,ih)\\,min(iw\\,${maxDim})\\,-2):if(gt(iw\\,ih)\\,-2\\,min(ih\\,${maxDim}))`
}

export async function compressVideoIfNeeded(file, onProgress, onStage) {
  if (!file || file.size <= SKIP_COMPRESS_BYTES) return file
  try {
    onStage?.('Nyiapin video...')
    const duration = await getVideoDuration(file)
    if (!duration || duration <= 0) throw new Error('Durasi video ngga valid')

    const targetTotalKbps = (MAX_SIZE_BYTES * 8) / 1000 / duration * SAFETY_MARGIN
    let videoBitrateKbps = Math.floor(targetTotalKbps - AUDIO_BITRATE_KBPS)
    if (videoBitrateKbps < MIN_VIDEO_BITRATE_KBPS) videoBitrateKbps = MIN_VIDEO_BITRATE_KBPS

    onStage?.('Nyiapin compressor...')
    // Progress asli dari ffmpeg (0-1) itu progress SATU exec/percobaan doang, dan reset
    // ke 0 tiap percobaan baru mulai (kalo hasil kompres masih kegedean & diulang lagi).
    // Kalo dikirim mentah-mentah ke UI, persen keliatan mundur pas retry. Makanya di sini
    // tiap percobaan dijatah 1/MAX_ATTEMPTS dari total, dan progress gapernah dibolehin turun.
    let peakProgress = 0
    let currentAttempt = 1
    const ffmpeg = await getFFmpeg((p) => {
      const attemptShare = 1 / MAX_ATTEMPTS
      const base = (currentAttempt - 1) * attemptShare
      const val = base + Math.max(0, Math.min(p, 1)) * attemptShare
      if (val > peakProgress) {
        peakProgress = val
        onProgress?.(val)
      }
    })
    const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4')
    const outputName = 'output.mp4'
    await ffmpeg.writeFile(inputName, await fetchFile(file))

    let compressedBlob = null
    let currentBitrateKbps = videoBitrateKbps

    // Mulai dari resolusi yang emang cocok buat bitrate segini, bukan selalu dari 1280.
    // Bitrate rendah di resolusi tinggi = pecah/blocky (terutama konten gerak cepet kayak jedag-jedug).
    // Turunin resolusi duluan itu jaga kualitas jauh lebih baik ketimbang maksa bitrate super rendah.
    let resIndex = 0
    if (currentBitrateKbps < 500) resIndex = 3      // 540p
    else if (currentBitrateKbps < 800) resIndex = 2 // 720p
    else if (currentBitrateKbps < 1400) resIndex = 1 // 960p
    let attempt = 0

    while (attempt < MAX_ATTEMPTS) {
      attempt++
      currentAttempt = attempt
      onStage?.(attempt > 1 ? `Ngompres ulang (percobaan ${attempt})...` : 'Ngompres video...')
      const maxDim = RESOLUTION_STEPS[resIndex]
      await ffmpeg.exec([
        '-i', inputName,
        '-vf', `scale=${buildScaleFilter(maxDim)}`,
        '-c:v', 'libx264',
        '-b:v', `${currentBitrateKbps}k`,
        '-maxrate', `${Math.floor(currentBitrateKbps * 1.15)}k`,
        '-bufsize', `${currentBitrateKbps * 2}k`,
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-b:a', `${AUDIO_BITRATE_KBPS}k`,
        '-movflags', '+faststart',
        outputName,
      ])

      const data = await ffmpeg.readFile(outputName)
      compressedBlob = new Blob([data.buffer], { type: 'video/mp4' })

      if (compressedBlob.size <= MAX_SIZE_BYTES) break

      if (currentBitrateKbps > MIN_VIDEO_BITRATE_KBPS) {
        // Masih kegedean → turunin bitrate dulu di resolusi yang sama
        currentBitrateKbps = Math.max(Math.floor(currentBitrateKbps * 0.7), MIN_VIDEO_BITRATE_KBPS)
      } else if (resIndex < RESOLUTION_STEPS.length - 1) {
        // Bitrate udah mentok di floor tapi masih kegedean → turunin resolusi, reset bitrate ke target awal
        resIndex++
        currentBitrateKbps = videoBitrateKbps
      } else {
        // Udah di resolusi & bitrate paling minimal (540p) → stop, jangan dipaksa lagi
        break
      }
    }

    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)

    if (!compressedBlob || compressedBlob.size >= file.size) return file
    return new File([compressedBlob], file.name.replace(/\.\w+$/, '.mp4'), { type: 'video/mp4' })
  } catch (err) {
    console.error('Gagal kompres video, pake file asli:', err)
    return file
  }
}
