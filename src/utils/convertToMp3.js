import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from './compressVideo'

// Ambil audio dari video (URL video preview) terus diconvert jadi MP3.
// onProgress dipanggil dengan angka 0..1
export async function convertVideoToMp3(videoUrl, onProgress) {
  if (!videoUrl) throw new Error('URL video ngga ada')

  let response
  try {
    response = await fetch(videoUrl, { mode: 'cors' })
  } catch (err) {
    // Ini biasanya kejadian kalo CORS diblokir atau koneksi putus
    throw new Error(`Gagal ambil video dari server (network/CORS): ${err.message}`)
  }

  if (!response.ok) {
    throw new Error(`Gagal ambil video dari server (status ${response.status})`)
  }

  const videoBlob = await response.blob()
  if (!videoBlob || videoBlob.size === 0) {
    throw new Error('File video kosong / rusak')
  }

  let ffmpeg
  try {
    ffmpeg = await getFFmpeg(onProgress)
  } catch (err) {
    throw new Error(`Gagal load ffmpeg: ${err.message}`)
  }

  const inputName = 'sound_input.mp4'
  const outputName = 'sound_output.mp3'

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(videoBlob))

    await ffmpeg.exec([
      '-i', inputName,
      '-vn', // buang video, ambil audionya doang
      '-acodec', 'libmp3lame',
      '-b:a', '128k',
      outputName,
    ])

    const data = await ffmpeg.readFile(outputName)
    const mp3Blob = new Blob([data.buffer], { type: 'audio/mpeg' })

    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)

    return mp3Blob
  } catch (err) {
    throw new Error(`Gagal proses convert (ffmpeg): ${err.message}`)
  }
}
