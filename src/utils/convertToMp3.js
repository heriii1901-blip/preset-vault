// Ambil audio dari video (URL video preview) terus diconvert jadi MP3.
// Tanpa ffmpeg: suara dibaca browser sendiri (WebAudio), lalu di-encode ke MP3 pake
// library JS kecil (lamejs). Jadi gak ada download core 30MB dan gak kena aturan CSP wasm/blob.
// onProgress dipanggil dengan angka 0..1

const CHUNK = 1152 // ukuran frame MP3
const YIELD_EVERY = 40 // tiap sekian chunk, kasih napas ke UI

function floatToInt16(float32) {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

// channels = array Float32Array (1 atau 2 channel), return Blob MP3
export async function encodePcmToMp3(channels, sampleRate, onProgress, kbps = 128) {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const numCh = Math.min(channels.length, 2)
  const encoder = new Mp3Encoder(numCh, sampleRate, kbps)
  const left = floatToInt16(channels[0])
  const right = numCh === 2 ? floatToInt16(channels[1]) : null
  const total = left.length
  const parts = []

  let chunkCount = 0
  for (let i = 0; i < total; i += CHUNK) {
    const l = left.subarray(i, i + CHUNK)
    const buf = numCh === 2 ? encoder.encodeBuffer(l, right.subarray(i, i + CHUNK)) : encoder.encodeBuffer(l)
    if (buf.length > 0) parts.push(buf)
    chunkCount++
    if (chunkCount % YIELD_EVERY === 0) {
      onProgress?.(Math.min(i / total, 0.99))
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  const tail = encoder.flush()
  if (tail.length > 0) parts.push(tail)
  onProgress?.(1)
  return new Blob(parts, { type: 'audio/mpeg' })
}

// Browser lama ada yang decodeAudioData-nya pake callback, bukan promise
function decodeAudio(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(arrayBuffer, resolve, reject)
    if (p && typeof p.then === 'function') p.then(resolve, reject)
  })
}

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

  const arrayBuffer = await response.arrayBuffer()
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('File video kosong / rusak')
  }
  onProgress?.(0.05)

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) throw new Error('Browser ini gak support baca audio (WebAudio)')
  const ctx = new AudioCtx()

  let audioBuffer
  try {
    audioBuffer = await decodeAudio(ctx, arrayBuffer)
  } catch (err) {
    throw new Error(`Gagal baca suara dari video (video gak ada suaranya atau formatnya gak didukung browser): ${err?.message || err}`)
  } finally {
    ctx.close?.().catch(() => {})
  }
  onProgress?.(0.15)

  const channels = []
  for (let c = 0; c < Math.min(audioBuffer.numberOfChannels, 2); c++) {
    channels.push(audioBuffer.getChannelData(c))
  }

  try {
    // 0.15..1 buat fase encode
    return await encodePcmToMp3(channels, audioBuffer.sampleRate, (p) => onProgress?.(0.15 + p * 0.85))
  } catch (err) {
    throw new Error(`Gagal encode ke MP3: ${err.message}`)
  }
}
