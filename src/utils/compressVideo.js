import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpegInstance = null

async function fetchAsBlobURL(url, mimeType, signal, onBytes) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`gagal diunduh (status ${res.status})`)
  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body) {
    const buf = await res.arrayBuffer()
    onBytes?.(buf.byteLength, total || buf.byteLength)
    return URL.createObjectURL(new Blob([buf], { type: mimeType }))
  }
  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onBytes?.(received, total)
  }
  return URL.createObjectURL(new Blob(chunks, { type: mimeType }))
}

// AbortController cuma bisa nyekek fetch() - ffmpeg.load() (init worker/WASM) gak nerima
// signal apapun, jadi kalo itu yang nyangkut, gak ada cara "beneran" ngebatalinnya. Yang bisa
// kita lakuin cuma berenti NUNGGUIN promise-nya (biar kode lanjut jalan / nyerah), walau proses
// aslinya tetep jalan sunyi di background. Ini penting: race manual, bukan cuma AbortController.
function raceWithAbort(promise, ms, externalSignal, message) {
  return new Promise((resolve, reject) => {
    let done = false
    function cleanup() {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onAbort)
    }
    function onAbort() {
      if (done) return
      done = true
      cleanup()
      reject(new Error(message))
    }
    const timer = setTimeout(onAbort, ms)
    if (externalSignal) {
      if (externalSignal.aborted) return onAbort()
      externalSignal.addEventListener('abort', onAbort)
    }
    promise.then(
      (v) => { if (done) return; done = true; cleanup(); resolve(v) },
      (e) => { if (done) return; done = true; cleanup(); reject(e) }
    )
  })
}

// Download file core ffmpeg (js/wasm/worker) LALU nyalain ffmpeg.load() - dua-duanya
// digabung dalam 1 batas waktu bareng, di-share 1 AbortController. Sebelumnya cuma
// download-nya doang yang ke-timeout; ffmpeg.load() (proses init worker/WASM) gak ke-cover
// sama sekali, jadi kalo itu yang nyangkut (misal worker gagal nyala), ya beneran gak
// pernah kelar. Sekarang dua-duanya ikut kena batas waktu yang sama.
async function loadFFmpegCore(ffmpeg, urls, ms, label, onDownloadProgress, externalSignal, includeWorker) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', () => controller.abort())
  }
  const mimeMap = { js: 'text/javascript', wasm: 'application/wasm', worker: 'text/javascript' }
  const keys = Object.keys(urls)
  const totals = {}
  const receiveds = {}
  keys.forEach((k) => { totals[k] = 0; receiveds[k] = 0 })

  function reportProgress() {
    const totalSum = keys.reduce((s, k) => s + totals[k], 0)
    const receivedSum = keys.reduce((s, k) => s + receiveds[k], 0)
    // sisain dikit (max 97%) buat fase ffmpeg.load() sesudah download kelar
    if (totalSum > 0) onDownloadProgress?.(Math.min(receivedSum / totalSum, 0.97))
  }

  try {
    const results = {}
    await Promise.all(
      keys.map(async (k) => {
        results[k] = await fetchAsBlobURL(urls[k], mimeMap[k], controller.signal, (received, total) => {
          receiveds[k] = received
          totals[k] = total || receiveds[k]
          reportProgress()
        })
      })
    )
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    onDownloadProgress?.(1)
    const loadOpts = includeWorker
      ? { coreURL: results.js, wasmURL: results.wasm, workerURL: results.worker }
      : { coreURL: results.js, wasmURL: results.wasm }
    // Dikasih budget sendiri 15s buat fase ini - biasanya cepet (udah lokal, gak ada network lagi)
    await raceWithAbort(ffmpeg.load(loadOpts), 15000, externalSignal, `${label}: compressor kelamaan/gagal nyala (15s)`)
  } catch (err) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`${label} timeout (${ms / 1000}s) - jaringan lambat/CDN gak kebuka atau compressor gagal nyala`)
    }
    throw err
  } finally {
    clearTimeout(timer)
    controller.abort() // pastiin fetch yang belum kelar ikut ke-cancel, sukses atau engga
  }
}

// Matiin worker ffmpeg yang lagi jalan & reset instance-nya. Dipanggil pas user cancel
// job yang lagi dikompres - exec() gak nerima AbortSignal, jadi ini satu2nya cara
// beneran ngehentiin proses yang stuck. Instance baru otomatis ke-load ulang pas
// getFFmpeg() dipanggil lagi buat job berikutnya.
export function terminateFFmpeg() {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate()
    } catch (err) {
      console.warn('Gagal terminate ffmpeg instance:', err)
    }
    ffmpegInstance = null
  }
}

export async function getFFmpeg(onProgress, onDownloadProgress, externalSignal) {
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
    await loadFFmpegCore(
      ffmpeg,
      { js: `${baseURLmt}/ffmpeg-core.js`, wasm: `${baseURLmt}/ffmpeg-core.wasm`, worker: `${baseURLmt}/ffmpeg-core.worker.js` },
      25000,
      'Compressor multi-thread',
      onDownloadProgress,
      externalSignal,
      true
    )
  } catch (mtErr) {
    console.warn('Multi-thread ffmpeg gagal, fallback ke single-thread:', mtErr?.message)
    try {
      await loadFFmpegCore(
        ffmpeg,
        { js: `${baseURLst}/ffmpeg-core.js`, wasm: `${baseURLst}/ffmpeg-core.wasm` },
        25000,
        'Compressor single-thread',
        onDownloadProgress,
        externalSignal,
        false
      )
    } catch (err) {
      console.error('RAW error pas load ffmpeg core:', err)
      throw new Error(`Gagal siapin ffmpeg-core: ${err?.message || String(err)}`)
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
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // Target akhir kalau kena kompres (dulu 6MB)
const HARD_LIMIT_BYTES = 5.5 * 1024 * 1024 // Toleransi nyelos 0.5MB, lebih dari ini DITOLAK (isi 5 * 1024 * 1024 kalau mau ketat)
const AUDIO_BITRATE_KBPS = 64
const MIN_VIDEO_BITRATE_KBPS = 350 // dulu 150 - kegedean turunnya buat konten gerak cepet, jadi pecah/blocky
const SAFETY_MARGIN = 0.88 // jalur ffmpeg.wasm (dulu 0.92) - biar percobaan pertama jarang kegedean
const HW_SAFETY_MARGIN = 0.85 // jalur WebCodecs - encoder hardware suka meleset dari bitrate target, jadi lebih longgar
const RESOLUTION_STEPS = [1280, 960, 720, 540] // sisi terpanjang (px)
const MAX_ATTEMPTS = 5 // jalur ffmpeg.wasm
const FFMPEG_ATTEMPT_SHARES = [0.6, 0.2, 0.1, 0.05, 0.05] // jatah bar progress per percobaan (percobaan 1 paling gede)
const HW_ATTEMPT_SHARES = [0.7, 0.2, 0.1] // jalur WebCodecs: maks 3 percobaan, tiap percobaan cuma hitungan detik
const FFMPEG_EXEC_TIMEOUT_MS = 240000 // 1 percobaan ffmpeg.wasm gak boleh lebih dari 4 menit, kalo iya dianggap macet

// Error yang emang disengaja (bukan bug) - pesannya aman ditampilin ke user apa adanya
function policyError(message) {
  const err = new Error(message)
  err.isPolicyError = true
  return err
}

// Cap sisi terpanjang (landscape: width, portrait: height), gak upscale video kecil
function buildScaleFilter(maxDim) {
  return `if(gt(iw\\,ih)\\,min(iw\\,${maxDim})\\,-2):if(gt(iw\\,ih)\\,-2\\,min(ih\\,${maxDim}))`
}

// Mulai dari resolusi yang emang cocok buat bitrate segini, bukan selalu dari 1280.
// Bitrate rendah di resolusi tinggi = pecah/blocky (terutama konten gerak cepet kayak jedag-jedug).
// Turunin resolusi duluan itu jaga kualitas jauh lebih baik ketimbang maksa bitrate super rendah.
function pickResIndex(videoBitrateKbps) {
  if (videoBitrateKbps < 500) return 3 // 540p
  if (videoBitrateKbps < 800) return 2 // 720p
  if (videoBitrateKbps < 1400) return 1 // 960p
  return 0
}

async function remuxFaststart(file, onStage, signal) {
  try {
    onStage?.('Nyiapin video...')
    const ffmpeg = await getFFmpeg(null, (dlP) => {
      onStage?.(`Download compressor (${Math.round(dlP * 100)}%)...`)
    }, signal)
    const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4')
    const outputName = 'output.mp4'
    await ffmpeg.writeFile(inputName, await fetchFile(file))
    onStage?.('Nyiapin video buat streaming...')
    await ffmpeg.exec(['-i', inputName, '-c', 'copy', '-movflags', '+faststart', outputName])
    const data = await ffmpeg.readFile(outputName)
    const remuxed = new Blob([data.buffer], { type: 'video/mp4' })
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
    if (!remuxed.size) return file
    return new File([remuxed], file.name.replace(/\.\w+$/, '.mp4'), { type: 'video/mp4' })
  } catch (err) {
    console.error('Gagal remux faststart, pake file asli:', err)
    return file
  }
}

// ---------------------------------------------------------------------------
// JALUR UTAMA: WebCodecs (encoder bawaan browser/HP, pake hardware) lewat mediabunny.
// Jauh lebih cepet dari ffmpeg.wasm (detik, bukan menit), gak perlu download core 30MB.
// ---------------------------------------------------------------------------
function canUseWebCodecs() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined'
}

const evenDim = (n) => Math.max(2, Math.round(n / 2) * 2)

async function compressWithWebCodecs(file, duration, onProgress, onStage, signal) {
  // Di-import pas dibutuhin aja, biar gak nambah berat bundle awal
  const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS } = await import('mediabunny')

  const totalKbps = ((MAX_SIZE_BYTES * 8) / 1000 / duration) * HW_SAFETY_MARGIN
  const startKbps = Math.max(Math.floor(totalKbps - AUDIO_BITRATE_KBPS), MIN_VIDEO_BITRATE_KBPS)
  let videoKbps = startKbps
  let resIndex = pickResIndex(videoKbps)
  let resultBuffer = null

  for (let attempt = 1; attempt <= HW_ATTEMPT_SHARES.length; attempt++) {
    if (signal?.aborted) return file
    onStage?.(attempt > 1 ? `Ngompres ulang (percobaan ${attempt})...` : 'Ngompres video...')

    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
    let onAbort = null
    try {
      const videoTrack = await input.getPrimaryVideoTrack()
      if (!videoTrack) throw new Error('Track video ngga ketemu')
      const hasAudio = !!(await input.getPrimaryAudioTrack())

      const srcW = videoTrack.displayWidth
      const srcH = videoTrack.displayHeight
      const scale = Math.min(1, RESOLUTION_STEPS[resIndex] / Math.max(srcW, srcH))

      const output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'in-memory' }), // moov di depan = langsung bisa di-stream, gak perlu remux lagi
        target: new BufferTarget(),
      })
      const conversion = await Conversion.init({
        input,
        output,
        tracks: 'primary',
        video: { width: evenDim(srcW * scale), height: evenDim(srcH * scale), fit: 'fill', codec: 'avc', bitrate: videoKbps * 1000 },
        audio: { codec: 'aac', bitrate: AUDIO_BITRATE_KBPS * 1000 },
      })
      if (!conversion.isValid) throw new Error('Browser ini gak bisa encode video ini lewat WebCodecs')
      // Preset ini sound-first: jangan sampe hasilnya diem2 bisu gara2 encoder audio gak ada
      if (hasAudio && conversion.discardedTracks.some((d) => d.track.isAudioTrack() && d.reason !== 'discarded_by_user')) {
        throw new Error('Encoder audio gak tersedia di browser ini')
      }

      const base = HW_ATTEMPT_SHARES.slice(0, attempt - 1).reduce((a, b) => a + b, 0)
      const share = HW_ATTEMPT_SHARES[attempt - 1]
      conversion.onProgress = (p) => onProgress?.(Math.min(base + Math.max(0, Math.min(p, 1)) * share, 1))

      onAbort = () => { conversion.cancel().catch(() => {}) }
      if (signal) {
        if (signal.aborted) return file
        signal.addEventListener('abort', onAbort)
      }

      try {
        await conversion.execute()
      } catch (err) {
        if (signal?.aborted) return file // user batalin, pemanggil yang ngurus
        throw err
      }

      resultBuffer = output.target.buffer
      if (!resultBuffer) throw new Error('Hasil kompres kosong')
    } finally {
      if (onAbort) signal?.removeEventListener('abort', onAbort)
      input.dispose()
    }

    if (resultBuffer.byteLength <= MAX_SIZE_BYTES) break

    // Masih kegedean: turunin bitrate proporsional sama seberapa kegedean-nya (encoder hardware murah, ulang aja)
    if (videoKbps > MIN_VIDEO_BITRATE_KBPS) {
      const ratio = (MAX_SIZE_BYTES * 0.93) / resultBuffer.byteLength
      videoKbps = Math.max(Math.floor(videoKbps * Math.min(ratio, 0.95)), MIN_VIDEO_BITRATE_KBPS)
    } else if (resIndex < RESOLUTION_STEPS.length - 1) {
      resIndex++
      videoKbps = startKbps
    } else {
      break
    }
  }

  if (!resultBuffer) throw new Error('Hasil kompres kosong')
  if (resultBuffer.byteLength > HARD_LIMIT_BYTES) {
    throw policyError(
      `Hasil kompres masih ${(resultBuffer.byteLength / 1024 / 1024).toFixed(1)} MB (maks 5 MB). Coba video yang lebih pendek.`
    )
  }
  if (resultBuffer.byteLength >= file.size) return file
  return new File([resultBuffer], file.name.replace(/\.\w+$/, '.mp4'), { type: 'video/mp4' })
}

// ---------------------------------------------------------------------------
// JALUR CADANGAN: ffmpeg.wasm - dipake cuma kalo browser gak support WebCodecs
// atau encoder-nya gagal. Lambat (menit di HP), tapi jalan di mana-mana.
// ---------------------------------------------------------------------------
async function compressWithFFmpeg(file, duration, onProgress, onStage, signal) {
  const targetTotalKbps = (MAX_SIZE_BYTES * 8) / 1000 / duration * SAFETY_MARGIN
  let videoBitrateKbps = Math.floor(targetTotalKbps - AUDIO_BITRATE_KBPS)
  if (videoBitrateKbps < MIN_VIDEO_BITRATE_KBPS) videoBitrateKbps = MIN_VIDEO_BITRATE_KBPS

  onStage?.('Nyiapin compressor...')
  // Progress asli dari ffmpeg (0-1) itu progress SATU exec/percobaan doang, dan reset
  // ke 0 tiap percobaan baru mulai. Biar persen gak keliatan mundur pas retry, tiap percobaan
  // dijatah porsi tertentu dari total (percobaan 1 paling gede), dan progress gapernah dibolehin turun.
  let peakProgress = 0
  let currentAttempt = 1
  const ffmpeg = await getFFmpeg(
    (p) => {
      const share = FFMPEG_ATTEMPT_SHARES[currentAttempt - 1] ?? 0
      const base = FFMPEG_ATTEMPT_SHARES.slice(0, currentAttempt - 1).reduce((a, b) => a + b, 0)
      const val = base + Math.max(0, Math.min(p, 1)) * share
      if (val > peakProgress) {
        peakProgress = val
        onProgress?.(val)
      }
    },
    (dlP) => {
      onStage?.(`Download compressor (${Math.round(dlP * 100)}%)...`)
    },
    signal
  )
  const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4')
  const outputName = 'output.mp4'
  await ffmpeg.writeFile(inputName, await fetchFile(file))

  let compressedBlob = null
  let currentBitrateKbps = videoBitrateKbps
  let resIndex = pickResIndex(currentBitrateKbps)
  let attempt = 0

  while (attempt < MAX_ATTEMPTS) {
    attempt++
    currentAttempt = attempt
    onStage?.(attempt > 1 ? `Ngompres ulang (percobaan ${attempt})...` : 'Ngompres video...')
    const maxDim = RESOLUTION_STEPS[resIndex]
    try {
      await raceWithAbort(
        ffmpeg.exec([
          '-i', inputName,
          '-vf', `scale=${buildScaleFilter(maxDim)}`,
          '-c:v', 'libx264',
          '-b:v', `${currentBitrateKbps}k`,
          '-maxrate', `${Math.floor(currentBitrateKbps * 1.15)}k`,
          '-bufsize', `${currentBitrateKbps * 2}k`,
          '-preset', 'ultrafast', // dites: ~2x lebih cepet dari veryfast, hasil ukuran hampir sama
          '-c:a', 'aac',
          '-b:a', `${AUDIO_BITRATE_KBPS}k`,
          '-movflags', '+faststart',
          outputName,
        ]),
        FFMPEG_EXEC_TIMEOUT_MS,
        signal,
        'Compressor macet (kelamaan ngompres)'
      )
    } catch (err) {
      terminateFFmpeg() // exec gak bisa dibatalin baik2, satu2nya cara ngehentiin ya matiin worker-nya
      throw err
    }

    const data = await ffmpeg.readFile(outputName)
    compressedBlob = new Blob([data.buffer], { type: 'video/mp4' })

    if (compressedBlob.size <= MAX_SIZE_BYTES) break

    if (currentBitrateKbps > MIN_VIDEO_BITRATE_KBPS) {
      // Masih kegedean → turunin bitrate proporsional sama seberapa kegedean-nya (bukan asal x0.7)
      const ratio = (MAX_SIZE_BYTES * 0.93) / compressedBlob.size
      currentBitrateKbps = Math.max(Math.floor(currentBitrateKbps * Math.min(ratio, 0.95)), MIN_VIDEO_BITRATE_KBPS)
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

  if (!compressedBlob) throw new Error('Hasil kompres kosong')
  if (compressedBlob.size > HARD_LIMIT_BYTES) {
    throw policyError(
      `Hasil kompres masih ${(compressedBlob.size / 1024 / 1024).toFixed(1)} MB (maks 5 MB). Coba video yang lebih pendek.`
    )
  }
  if (compressedBlob.size >= file.size) return file
  return new File([compressedBlob], file.name.replace(/\.\w+$/, '.mp4'), { type: 'video/mp4' })
}

export async function compressVideoIfNeeded(file, onProgress, onStage, signal) {
  if (!file) return file
  if (file.size <= SKIP_COMPRESS_BYTES) return remuxFaststart(file, onStage, signal)
  try {
    onStage?.('Nyiapin video...')
    const duration = await getVideoDuration(file)
    if (!duration || duration <= 0) throw new Error('Durasi video ngga valid')

    let hwReason = 'WebCodecs gak ada di browser ini'
    if (canUseWebCodecs()) {
      try {
        return await compressWithWebCodecs(file, duration, onProgress, onStage, signal)
      } catch (err) {
        if (err?.isPolicyError || signal?.aborted) throw err
        hwReason = err?.message || String(err)
        console.warn('WebCodecs gagal, fallback ke ffmpeg.wasm:', err)
      }
    }
    try {
      return await compressWithFFmpeg(file, duration, onProgress, onStage, signal)
    } catch (ffErr) {
      if (ffErr?.isPolicyError || signal?.aborted) throw ffErr
      throw policyError(
        `Video ${(file.size / 1024 / 1024).toFixed(1)} MB gagal dikompres. WebCodecs: ${hwReason} | ffmpeg: ${ffErr?.message || String(ffErr)}`
      )
    }
  } catch (err) {
    if (err?.isPolicyError) throw err
    if (signal?.aborted) return file // user batalin, pemanggil yang ngurus
    console.error('Gagal kompres video:', err)
    // Jangan diem2 upload file mentah >5MB - tolak biar bisa dicoba lagi
    throw policyError(
      `Video ${(file.size / 1024 / 1024).toFixed(1)} MB gagal dikompres: ${err?.message || String(err)}`
    )
  }
}
