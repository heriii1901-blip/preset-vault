import { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { compressVideoIfNeeded, terminateFFmpeg } from '../utils/compressVideo'
import { uploadToR2 } from '../utils/uploadToR2'
import { generateCoverFromVideo } from '../utils/generateCoverFromVideo'
import {
  saveQueueItem,
  deleteQueueItem,
  getAllQueueItems,
  migrateLegacyQueueData,
} from '../utils/uploadQueueDB'

const UploadQueueContext = createContext(null)

const THUMB_COLORS = [
  'linear-gradient(135deg,#7C5CFF,#4A32C9)',
  'linear-gradient(135deg,#FF3D7F,#C91E5A)',
  'linear-gradient(135deg,#D4FF3D,#8FB800)',
  'linear-gradient(135deg,#7C5CFF,#FF3D7F)',
  'linear-gradient(135deg,#4A32C9,#15151D)',
]

const ACTIVE_STATUSES = ['queued', 'compressing', 'uploading', 'saving']

let jobCounter = 0

// Ubah item (yang di React state, bisa punya previewFile berupa File instance)
// jadi bentuk yang aman disimpen ke IndexedDB.
function toDbRecord(item) {
  return {
    id: item.id,
    status: item.status,
    stage: item.stage,
    progress: item.progress,
    errorMessage: item.errorMessage || null,
    previewFileBlob: item.previewFile || item.previewFileBlob || null,
    previewFileName: item.previewFile?.name || item.previewFileName || null,
    previewFileType: item.previewFile?.type || item.previewFileType || null,
    songMode: item.songMode,
    selectedSongId: item.selectedSongId,
    newSongName: item.newSongName,
    xmlLink: item.xmlLink,
    mbLink: item.mbLink,
    tiktokLink: item.tiktokLink,
    creatorUsername: item.creatorUsername,
    userId: item.userId,
    directSongCreate: item.directSongCreate || false,
    type: item.type || 'preset',
    title: item.title,
    category: item.category,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    finishedAt: item.finishedAt || null,
  }
}

export function UploadQueueProvider({ children }) {
  const [items, setItems] = useState([])
  const itemsRef = useRef([])
  const queueRef = useRef([])
  const processingRef = useRef(false)
  // id -> { cancelled, controller, resolveCancel }, cuma buat job yang lagi jalan (gak persisten)
  const cancelRef = useRef({})

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const updateItem = useCallback((id, patch) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, ...patch, updatedAt: Date.now() } : it))
      const found = next.find((it) => it.id === id)
      if (found) saveQueueItem(toDbRecord(found))
      return next
    })
  }, [])

  const runJob = useCallback(async (job, cancelState) => {
    try {
      updateItem(job.id, { status: 'compressing', stage: 'Nyiapin video...', progress: 2 })

      let previewVideoUrl = ''
      let coverUrl = null

      if (job.previewFile) {
        const compressed = job.skipCompress
          ? job.previewFile
          : await compressVideoIfNeeded(
              job.previewFile,
              (p) => {
                if (cancelState.cancelled) return
                updateItem(job.id, { progress: Math.min(2 + Math.floor(p * 48), 50) })
              },
              (stage) => {
                if (cancelState.cancelled) return
                updateItem(job.id, { stage })
              },
              cancelState.controller.signal
            )
        if (cancelState.cancelled) return

        updateItem(job.id, { status: 'uploading', stage: 'Ngupload...', progress: 55 })

        previewVideoUrl = await uploadToR2(compressed, job.type === 'effect' ? 'effects' : 'presets', (p) => {
          if (cancelState.cancelled) return
          updateItem(job.id, { progress: Math.min(55 + Math.floor(p * 30), 85) })
        })
        if (cancelState.cancelled) return

        updateItem(job.id, { status: 'uploading', stage: 'Bikin cover...', progress: 87 })
        try {
          const coverFile = await generateCoverFromVideo(compressed)
          coverUrl = await uploadToR2(coverFile, job.type === 'effect' ? 'effects-covers' : 'covers')
        } catch (err) {
          console.error('Gagal bikin cover:', err)
        }
      }

      if (cancelState.cancelled) return

      // Jalur efek: ngga ada tabel songs, ngga ada limit MB (skipCompress selalu true dari enqueueEfekUpload)
      if (job.type === 'effect') {
        updateItem(job.id, { status: 'saving', stage: 'Nyimpen efek...', progress: 90 })
        const { error: efekErr } = await supabase.from('effects').insert({
          title: job.title,
          category: job.category || 'lainnya',
          xml_link: job.xmlLink?.trim() || null,
          mb_link: job.mbLink,
          preview_video_url: previewVideoUrl,
          cover_url: coverUrl,
          uploaded_by: job.creatorUsername || null,
          link_pending: !job.xmlLink?.trim(),
        })
        if (efekErr) throw efekErr
        updateItem(job.id, { status: 'done', stage: 'Beres!', progress: 100, finishedAt: Date.now() })
        return
      }

      updateItem(job.id, { status: 'saving', stage: 'Nyimpen preset...', progress: 85 })

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
          if (cancelState.cancelled) return

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
            cover_url: coverUrl,
          })
          if (reqErr) throw reqErr
          if (cancelState.cancelled) return

          updateItem(job.id, { status: 'done', stage: 'Nunggu approval lagu baru', progress: 100, finishedAt: Date.now() })
          return
        }
      }

      if (cancelState.cancelled) return

            const { error: presetErr } = await supabase.from('presets').insert({
        song_id: songId,
        xml_link: job.xmlLink?.trim() || null,
        mb_link: job.mbLink,
        creator_username: job.creatorUsername,
        tiktok_link: job.tiktokLink,
        preview_video_url: previewVideoUrl,
        cover_url: coverUrl,
        link_pending: !job.xmlLink?.trim(),
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

      updateItem(job.id, { status: 'done', stage: 'Beres!', progress: 100, finishedAt: Date.now() })
    } catch (err) {
      if (cancelState.cancelled) return
      console.error('Upload queue gagal:', err)
      updateItem(job.id, {
        status: 'error',
        stage: 'Gagal upload',
        progress: 0,
        errorMessage: err?.message || 'Gagal upload',
      })
    } finally {
      delete cancelRef.current[job.id]
    }
  }, [updateItem])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()
      const cancelState = { cancelled: false, controller: new AbortController(), resolveCancel: null }
      cancelRef.current[job.id] = cancelState

      const jobPromise = runJob(job, cancelState)
      const cancelPromise = new Promise((resolve) => {
        cancelState.resolveCancel = resolve
      })

      // Kalau job ini dibatalin, race ini langsung lanjut ke job berikutnya di antrian
      // walau proses kompres/upload job yang dibatalin masih jalan diam-diam di background -
      // hasil akhirnya bakal diabaikan karena cancelState.cancelled udah true.
      await Promise.race([jobPromise, cancelPromise])
    }

    processingRef.current = false
  }, [runJob])

  const enqueuePresetUpload = useCallback((payload) => {
    const id = `job-${Date.now()}-${jobCounter++}`
    const now = Date.now()
    const item = { id, status: 'queued', stage: 'Nunggu antrian...', progress: 0, errorMessage: null, createdAt: now, updatedAt: now, ...payload }
    setItems((prev) => [...prev, item])
    queueRef.current.push(item)
    saveQueueItem(toDbRecord(item))
    processQueue()
    return id
  }, [processQueue])

  // Video efek ngga dikompres sama sekali (skipCompress: true) - ngga ada limit MB
  // karena file efek biasanya gede (overlay/glitch/transisi kualitas tinggi).
  const enqueueEfekUpload = useCallback((payload) => {
    const id = `job-${Date.now()}-${jobCounter++}`
    const now = Date.now()
    const item = {
      id,
      status: 'queued',
      stage: 'Nunggu antrian...',
      progress: 0,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      type: 'effect',
      skipCompress: true,
      ...payload,
    }
    setItems((prev) => [...prev, item])
    queueRef.current.push(item)
    saveQueueItem(toDbRecord(item))
    processQueue()
    return id
  }, [processQueue])

  // Batalin job. Kalau lagi jalan (compress/upload), fetch-nya di-abort dan antrian
  // langsung lanjut ke bawahnya. Kalau masih nunggu giliran, cukup dicoret dari antrian.
  // Item-nya TETEP ada di riwayat dengan status 'cancelled' biar bisa diedit & diupload ulang.
  const cancelJob = useCallback((id) => {
    const cancelState = cancelRef.current[id]
    if (cancelState) {
      cancelState.cancelled = true
      cancelState.controller.abort()
      // worker ffmpeg gak beneran berhenti cuma dari abort() di atas - matiin
      // paksa biar job berikutnya (termasuk resubmit) ga ikut ngantri stuck
      terminateFFmpeg()
      if (cancelState.resolveCancel) cancelState.resolveCancel()
    } else {
      queueRef.current = queueRef.current.filter((j) => j.id !== id)
    }
    updateItem(id, { status: 'cancelled', stage: 'Dibatalin', progress: 0 })
  }, [updateItem])

  // Ambil ulang data item (buat diisiin ke form edit), lengkap dengan File video
  // hasil rekonstruksi dari blob yang kesimpen di IndexedDB.
  const getQueueItemForEdit = useCallback((id) => {
    const found = itemsRef.current.find((it) => it.id === id)
    if (!found) return null
    let previewFile = found.previewFile || null
    if (!previewFile && found.previewFileBlob) {
      previewFile = new File([found.previewFileBlob], found.previewFileName || 'video.mp4', {
        type: found.previewFileType || 'video/mp4',
      })
    }
    return { ...found, previewFile }
  }, [])

  // Submit ulang item yang statusnya 'cancelled'/'error' (habis diedit di form) -
  // id-nya tetep sama, cuma direset jadi 'queued' lagi dan didorong ke antrian.
  const resubmitQueueItem = useCallback((id, updatedPayload) => {
    const now = Date.now()
    let pushedJob = null
    setItems((prev) => {
      const next = prev.map((it) => {
        if (it.id !== id) return it
        pushedJob = {
          ...it,
          ...updatedPayload,
          status: 'queued',
          stage: 'Nunggu antrian...',
          progress: 0,
          errorMessage: null,
          updatedAt: now,
        }
        return pushedJob
      })
      if (pushedJob) saveQueueItem(toDbRecord(pushedJob))
      return next
    })
    if (pushedJob) queueRef.current.push(pushedJob)
    processQueue()
  }, [processQueue])

  // Hapus permanen dari riwayat (misal abis dibatalin terus gajadi diupload lagi).
  const deleteHistoryItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
    queueRef.current = queueRef.current.filter((j) => j.id !== id)
    delete cancelRef.current[id]
    deleteQueueItem(id)
  }, [])

  // Muat riwayat dari IndexedDB pas app dibuka. Item yang masih 'aktif' (kepotong pas
  // app ditutup paksa) direset jadi 'queued' lagi biar lanjut diproses dari awal.
  useEffect(() => {
    async function init() {
      await migrateLegacyQueueData()
      const stored = await getAllQueueItems()
      if (!stored.length) return

      const restored = stored.map((s) => {
        const previewFile = s.previewFileBlob
          ? new File([s.previewFileBlob], s.previewFileName || 'video.mp4', { type: s.previewFileType || 'video/mp4' })
          : null
        const wasActive = ACTIVE_STATUSES.includes(s.status)
        return {
          ...s,
          previewFile,
          status: wasActive ? 'queued' : s.status,
          stage: wasActive ? 'Lanjutin upload yang sempet kepotong...' : s.stage,
          progress: wasActive ? 0 : s.progress,
        }
      })

      setItems(restored)
      const pending = restored.filter((it) => it.status === 'queued')
      if (pending.length) {
        queueRef.current.push(...pending)
        processQueue()
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Riwayat yang ditampilin di halaman admin: job yang masih aktif (antri/proses)
  // ditaro di paling atas urut FIFO (biar keliatan mana yang stuck), sisanya
  // (selesai/gagal/dibatalin) diurutin dari yang paling baru.
  const history = useMemo(() => {
    const active = items.filter((it) => ACTIVE_STATUSES.includes(it.status)).sort((a, b) => a.createdAt - b.createdAt)
    const rest = items
      .filter((it) => !ACTIVE_STATUSES.includes(it.status))
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    return [...active, ...rest]
  }, [items])

  return (
    <UploadQueueContext.Provider
      value={{ history, enqueuePresetUpload, enqueueEfekUpload, cancelJob, resubmitQueueItem, deleteHistoryItem, getQueueItemForEdit }}
    >
      {children}
    </UploadQueueContext.Provider>
  )
}

export function useUploadQueue() {
  return useContext(UploadQueueContext)
}
