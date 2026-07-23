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

const MAX_SIZE_BYTES = 3 * 1024 * 1024 // Batas 3MB

// Cuma dikompres kalo file di atas 3MB, di bawah itu langsung dipake apa adanya
export async function compressVideoIfNeeded(file, onProgress) {
  if (!file || file.size <= MAX_SIZE_BYTES) return file

  try {
    const ffmpeg = await getFFmpeg(onProgress)
    const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4')
    const outputName = 'output.mp4'

    await ffmpeg.writeFile(inputName, await fetchFile(file))

    // scale max 1280px (720p-an), crf 28 = kompresi cukup tapi ngga bikin blur/pecah
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', "scale='min(1280,iw)':-2",
      '-c:v', 'libx264',
      '-crf', '28',
      '-preset', 'fast',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      outputName,
    ])

    const data = await ffmpeg.readFile(outputName)
    const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' })

    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)

    // Jaga-jaga: kalo hasil kompres malah lebih gede, pake file asli aja
    if (compressedBlob.size >= file.size) return file

    return new File([compressedBlob], file.name.replace(/\.\w+$/, '.mp4'), { type: 'video/mp4' })
  } catch (err) {
    console.error('Gagal kompres video, pake file asli:', err)
    return file
  }
}
