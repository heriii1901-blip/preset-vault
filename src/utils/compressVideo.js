import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'

let ffmpegInstance = null

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

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  try {
    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    await ffmpeg.load({ coreURL, wasmURL })
  } catch (err) {
    console.error('RAW error pas load ffmpeg core:', err)
    throw new Error(`Gagal fetch ffmpeg-core dari unpkg: ${err?.message || String(err)}`)
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

const MAX_SIZE_BYTES = 3 * 1024 * 1024 // Target akhir: 3MB
const AUDIO_BITRATE_KBPS = 64
const MIN_VIDEO_BITRATE_KBPS = 150
const SAFETY_MARGIN = 0.92
const RESOLUTION_STEPS = [1280, 960, 720] // sisi terpanjang (px), turun kalo bitrate floor masih kurang
const MAX_ATTEMPTS = 6

// Cap sisi terpanjang (landscape: width, portrait: height), gak upscale video kecil
function buildScaleFilter(maxDim) {
  return `if(gt(iw\\,ih)\\,min(iw\\,${maxDim})\\,-2):if(gt(iw\\,ih)\\,-2\\,min(ih\\,${maxDim}))`
}

export async function compressVideoIfNeeded(file, onProgress) {
  if (!file || file.size <= MAX_SIZE_BYTES) return file
  try {
    const duration = await getVideoDuration(file)
    if (!duration || duration <= 0) throw new Error('Durasi video ngga valid')

    const targetTotalKbps = (MAX_SIZE_BYTES * 8) / 1000 / duration * SAFETY_MARGIN
    let videoBitrateKbps = Math.floor(targetTotalKbps - AUDIO_BITRATE_KBPS)
    if (videoBitrateKbps < MIN_VIDEO_BITRATE_KBPS) videoBitrateKbps = MIN_VIDEO_BITRATE_KBPS

    const ffmpeg = await getFFmpeg(onProgress)
    const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4')
    const outputName = 'output.mp4'
    await ffmpeg.writeFile(inputName, await fetchFile(file))

    let compressedBlob = null
    let currentBitrateKbps = videoBitrateKbps
    let resIndex = 0 // mulai dari 1280
    let attempt = 0

    while (attempt < MAX_ATTEMPTS) {
      attempt++
      const maxDim = RESOLUTION_STEPS[resIndex]
      await ffmpeg.exec([
        '-i', inputName,
        '-vf', `scale=${buildScaleFilter(maxDim)}`,
        '-c:v', 'libx264',
        '-b:v', `${currentBitrateKbps}k`,
        '-maxrate', `${currentBitrateKbps}k`,
        '-bufsize', `${currentBitrateKbps * 2}k`,
        '-preset', 'fast',
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
        // Udah di resolusi & bitrate paling minimal (720p) → stop, jangan dipaksa lagi
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
