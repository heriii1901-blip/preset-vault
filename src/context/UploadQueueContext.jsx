import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import { compressVideoIfNeeded } from '../utils/compressVideo'

// Antrian upload global (tetep hidup selama app kebuka, provider-nya di atas <Routes>).
// Prosesnya SATU-SATU di belakang layar (bukan paralel), soalnya ffmpeg.wasm cuma bisa
// ngompres 1 video dalam satu waktu. Tapi user tetep bebas nambah antrian & pindah halaman
// kapan aja tanpa nunggu, gak keblokir kayak sebelumnya.
const UploadQueueContext = createContext(null)

let jobCounter = 0

export function UploadQueueProvider({ children }) {
  const [jobs, setJobs] = useState([])
  const [history, setHistory] = useState([])
  const queueRef = useRef([])
  const processingRef = useRef(false)

  const updateJob = useCallback((id, patch) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }, [])

  const removeJobAfterDelay = (id, delay = 3000) => {
    setTimeout(() => {
      setJobs((prev) => prev.filter((j) => j.id !== id))
    }, delay)
  }

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()
      updateJob(job.id, { status: 'compressing', stage: 'Ngompres video...', progress: 2 })

      try {
        let previewVideoUrl = ''

        if (job.previewFile) {
          const compressed = await compressVideoIfNeeded(job.previewFile, (p) => {
            updateJob(job.id, { progress: Math.min(2 + Math.floor(p * 48), 50) })
          })

          updateJob(job.id, { status: 'uploading', stage: 'Ngupload...', progress: 55 })

          const uploadRes = await fetch('/api/upload-to-r2', {
            method: 'POST',
            headers: {
              'x-file-name': compressed.name,
              'Content-Type': compressed.type || 'video/mp4',
            },
            body: compressed,
          })
          if (!uploadRes.ok) throw new Error('Upload ke R2 gagal')
          const uploadData = await uploadRes.json()
          previewVideoUrl = uploadData.url
        }

        updateJob(job.id, { status: 'saving', stage: 'Nyimpen preset...', progress: 85 })

        if (job.songMode === 'existing') {
          const { error: presetErr } = await supabase.from('presets').insert({
            song_id: job.selectedSongId,
            xml_link: job.xmlLink,
            mb_link: job.mbLink,
            creator_username: job.creatorUsername,
            tiktok_link: job.tiktokLink,
            preview_video_url: previewVideoUrl,
          })
          if (presetErr) throw presetErr

          const { data: songRow } = await supabase
            .from('songs')
            .select('preset_count')
            .eq('id', job.selectedSongId)
            .single()
          await supabase
            .from('songs')
            .update({ preset_count: (songRow?.preset_count || 0) + 1 })
            .eq('id', job.selectedSongId)
        } else {
          const { error: reqErr } = await supabase.from('song_requests').insert({
            user_id: job.userId,
            creator_username: job.creatorUsername,
            requested_song_name: job.newSongName,
            xml_link: job.xmlLink,
            mb_link: job.mbLink,
            tiktok_link: job.tiktokLink,
            preview_video_url: previewVideoUrl,
          })
          if (reqErr) throw reqErr
        }

        updateJob(job.id, { status: 'done', stage: 'Beres!', progress: 100 })
        setHistory((prev) => [{ ...job, status: 'done', finishedAt: Date.now() }, ...prev].slice(0, 50))
      } catch (err) {
        console.error('Upload queue gagal:', err)
        updateJob(job.id, { status: 'error', stage: 'Gagal upload', progress: 0 })
        setHistory((prev) => [{ ...job, status: 'error', finishedAt: Date.now() }, ...prev].slice(0, 50))
      } finally {
        removeJobAfterDelay(job.id, 3000)
      }
    }

    processingRef.current = false
  }, [updateJob])

  const enqueuePresetUpload = useCallback((payload) => {
    const id = `job-${Date.now()}-${jobCounter++}`
    const job = { id, status: 'queued', stage: 'Nunggu antrian...', progress: 0, ...payload }
    setJobs((prev) => [...prev, job])
    queueRef.current.push(job)
    processQueue()
    return id
  }, [processQueue])

  return (
    <UploadQueueContext.Provider value={{ jobs, history, enqueuePresetUpload }}>
      {children}
    </UploadQueueContext.Provider>
  )
}

export function useUploadQueue() {
  return useContext(UploadQueueContext)
}
