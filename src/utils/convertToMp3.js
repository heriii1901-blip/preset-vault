import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from './compressVideo'

// Ambil audio dari video (URL video preview) terus diconvert jadi MP3.
// onProgress dipanggil dengan angka 0..1
export async function convertVideoToMp3(videoUrl, onProgress) {
  if (!videoUrl) throw new Error('URL video ngga ada')

  const ffmpeg = await getFFmpeg(onProgress)

  const response = await fetch(videoUrl)
  if (!response.ok) throw new Error('Gagal ambil file video')
  const videoBlob = await response.blob()

  const inputName = 'sound_input.mp4'
  const outputName = 'sound_output.mp3'

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
}
