import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpegInstance = null
async function getFFmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance
  const ffmpeg = new FFmpeg()
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress))
  }
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  ffmpegInstance = ffmpeg
  return ffmpeg
}

// Ambil durasi video pake elemen <video> biasa, ngga perlu ffprobe
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
const MIN_VIDEO_BITRATE_KBPS = 150 // Jaga-jaga biar ngga jadi pecah banget
const SAFETY_MARGIN = 0.92 // Sisain sedikit ruang biar ngga kelewat target

// Cuma dikompres kalo file di atas batas, di bawah itu langsung dipake apa adanya
export async function compressVideoIfNeeded(file, onProgress) {
  if (!file || file.size <= MAX_SIZE_BYTES) return file

  try {
    const duration = await getVideoDuration(file)
    if (!duration || duration <= 0) throw new Error('Durasi video ngga valid')

    // Hitung total bitrate yang muat biar hasil akhir ~ MAX_SIZE_BYTES
    const targetTotalKbps = (MAX_SIZE_BYTES * 8) / 1000 / duration * SAFETY_MARGIN
    let videoBitrateKbps = Math.floor(targetTotalKbps - AUDIO_BITRATE_KBPS)
    if (videoBitrateKbps < MIN_VIDEO_BITRATE_KBPS) videoBitrateKbps = MIN_VIDEO_BITRATE_KBPS

    const ffmpeg = await getFFmpeg(onProgress)
    const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4')
    const outputName = 'output.mp4'
    await ffmpeg.writeFile(inputName, await fetchFile(file))

    await ffmpeg.exec([
      '-i', inputName,
      '-vf', "scale='min(1280,iw)':-2",
      '-c:v', 'libx264',
      '-b:v', `${videoBitrateKbps}k`,
      '-maxrate', `${videoBitrateKbps}k`,
      '-bufsize', `${videoBitrateKbps * 2}k`,
      '-preset', 'fast',
      '-c:a', 'aac',
      '-b:a', `${AUDIO_BITRATE_KBPS}k`,
      '-movflags', '+faststart',
      outputName,
    ])

    let data = await ffmpeg.readFile(outputName)
    let compressedBlob = new Blob([data.buffer], { type: 'video/mp4' })

    // Terus nyoba turunin bitrate sampe di bawah target, maksimal 4 percobaan
    // biar ga infinite loop kalo emang video-nya ga bisa ditekan lagi
    let attempt = 1
    let currentBitrateKbps = videoBitrateKbps
    const MAX_ATTEMPTS = 4

    while (compressedBlob.size > MAX_SIZE_BYTES && attempt < MAX_ATTEMPTS) {
      attempt++
      currentBitrateKbps = Math.max(Math.floor(currentBitrateKbps * 0.7), MIN_VIDEO_BITRATE_KBPS)
      console.warn(`Percobaan ${attempt}: masih ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB, nurunin bitrate ke ${currentBitrateKbps}k...`)

      await ffmpeg.exec([
        '-i', inputName,
        '-vf', "scale='min(1280,iw)':-2",
        '-c:v', 'libx264',
        '-b:v', `${currentBitrateKbps}k`,
        '-maxrate', `${currentBitrateKbps}k`,
        '-bufsize', `${currentBitrateKbps}k`,
        '-preset', 'fast',
        '-c:a', 'aac',
        '-b:a', `${AUDIO_BITRATE_KBPS}k`,
        '-movflags', '+faststart',
        outputName,
      ])
      data = await ffmpeg.readFile(outputName)
      compressedBlob = new Blob([data.buffer], { type: 'video/mp4' })

      // Kalo udah mentok di bitrate minimum tapi masih kegedean, stop aja
      // (biar ga muter-muter sia-sia dengan bitrate yang sama)
      if (currentBitrateKbps <= MIN_VIDEO_BITRATE_KBPS) break
    }

    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)

    console.log(`Hasil kompresi akhir (percobaan ke-${attempt}): ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`)
