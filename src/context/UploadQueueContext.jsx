import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase'
import { compressVideoIfNeeded } from '../utils/compressVideo'
import { saveJobToDB, deleteJobFromDB, getAllJobsFromDB } from '../utils/uploadQueueDB'

const UploadQueueContext = createContext(null)

const THUMB_COLORS = [
  'linear-gradient(135deg,#7C5CFF,#4A32C9)',
  'linear-gradient(135deg,#FF3D7F,#C91E5A)',
  'linear-gradient(135deg,#D4FF3D,#8FB800)',
  'linear-gradient(135deg,#7C5CFF,#FF3D7F)',
  'linear-gradient(135deg,#4A32C9,#15151D)',
]

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

        let songId = job.selectedSongId

        if (job.songMode === 'new') {
          if (job.directSongCreate) {
            // Admin: lagu baru langsung dibuat, gak lewat antrian approval
            const { data: existingSong, error: findErr } = await supabase
              .from('songs')
              .select('id')
              .eq('name', job.newSongName)
              .maybeSingle()
            if (findErr) throw findErr

            if (existingSong) {
              songId = existingSong.id
            } else {
              const color = THUMB_COLORS[Math.floor(Math.random() * THUMB_COLORS.length)]
              const { data: newSong, error: insertSongErr } = await supabase
                .from('songs')
                .insert({ name: job.newSongName, preset_count: 0, color })
                .select()
                .single()
              if (insertSongErr) throw insertSongErr
              songId = newSong.id
            }
          } else {
            // Kreator: lagu baru masuk song_requests, nunggu di-approve admin dulu
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

            updateJob(job.id, { status: 'done', stage: 'Nunggu approval lagu baru', progress: 100 })
            setHistory((prev) => [{ ...job, status: 'done', finishedAt: Date.now() }, ...prev].slice(0, 50))
            deleteJobFromDB(job.id)
            removeJobAfterDelay(job.id, 3000)
            continue
          }
        }

        const { error: presetErr } = await supabase.from('presets').insert({
          song_id: songId,
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
          .eq('id', songId)
          .single()
        await supabase
          .from('songs')
          .update({ preset_count: (songRow?.preset_count || 0) + 1 })
          .eq('id', songId)

        updateJob(job.id, { status: 'done', stage: 'Beres!', progress: 100 })
        setHistory((prev) => [{ ...job, status: 'done', finishedAt: Date.now() }, ...prev].slice(0, 50))
      } catch (err) {
        console.error('Upload queue gagal:', err)
        updateJob(job.id, { status: 'error', stage: 'Gagal upload', progress: 0 })
        setHistory((prev) => [{ ...job, status: 'error', finishedAt: Date.now() }, ...prev].slice(0, 50))
      } finally {
        deleteJobFromDB(job.id)
        removeJobAfterDelay(job.id, 3000)
      }
    }

    processingRef.current = false
  }, [updateJob])

  const enqueuePresetUpload = useCallback((payload) => {
    const id = `job-${Date.now()}-${jobCounter++}`
    const job = { id, status: 'queued', stage: 'Nunggu antrian...', progress: 0, createdAt: Date.now(), ...payload }
    setJobs((prev) => [...prev, job])
    queueRef.current.push(job)

    saveJobToDB({
      id: job.id,
      previewFileBlob: job.previewFile || null,
      previewFileName: job.previewFile?.name || null,
      previewFileType: job.previewFile?.type || null,
      songMode: job.songMode,
      selectedSongId: job.selectedSongId,
      newSongName: job.newSongName,
      xmlLink: job.xmlLink,
      mbLink: job.mbLink,
      tiktokLink: job.tiktokLink,
      creatorUsername: job.creatorUsername,
      userId: job.userId,
      directSongCreate: job.directSongCreate || false,
      createdAt: job.createdAt,
    })

    processQueue()
    return id
  }, [processQueue])

  useEffect(() => {
    async function resumePendingJobs() {
      const pending = await getAllJobsFromDB()
      if (!pending.length) return
      for (const p of pending) {
        const previewFile = p.previewFileBlob
          ? new File([p.previewFileBlob], p.previewFileName || 'video.mp4', { type: p.previewFileType || 'video/mp4' })
          : null
        const job = {
          id: p.id,
          status: 'queued',
          stage: 'Lanjutin upload yang sempet kepotong...',
          progress: 0,
          previewFile,
          songMode: p.songMode,
          selectedSongId: p.selectedSongId,
          newSongName: p.newSongName,
          xmlLink: p.xmlLink,
          mbLink: p.mbLink,
          tiktokLink: p.tiktokLink,
          creatorUsername: p.creatorUsername,
          userId: p.userId,
          directSongCreate: p.directSongCreate || false,
        }
        setJobs((prev) => [...prev, job])
        queueRef.current.push(job)
      }
      processQueue()
    }
    resumePendingJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <UploadQueueContext.Provider value={{ jobs, history, enqueuePresetUpload }}>
      {children}
    </UploadQueueContext.Provider>
  )
}

export function useUploadQueue() {
  return useContext(UploadQueueContext)
}
