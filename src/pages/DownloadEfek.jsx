import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'

export default function DownloadEfek() {
  const { effectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [videoUrl, setVideoUrl] = useState(location.state?.videoUrl || '')
  const [effectName, setEffectName] = useState(location.state?.effectName || '')
  const [loadingEffect, setLoadingEffect] = useState(!location.state?.videoUrl)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    if (videoUrl) return
    async function loadEffect() {
      setLoadingEffect(true)
      try {
        const { data, error } = await supabase
          .from('effects')
          .select('*')
          .eq('id', effectId)
          .single()
        if (error) throw error
        setVideoUrl(data.preview_video_url || '')
        setEffectName(data.title || '')
      } catch (err) {
        console.error('Gagal ambil data efek:', err)
        setStatusMsg('❌ Gagal ambil data video.')
      } finally {
        setLoadingEffect(false)
      }
    }
    if (effectId) loadEffect()
  }, [effectId, videoUrl])

  const handleDownload = async (e) => {
    e.preventDefault()
    if (!effectName.trim()) return setStatusMsg('Masukin nama efek dulu.')
    if (!videoUrl) return setStatusMsg('❌ Video ngga ketemu.')

    setDownloading(true)
    setProgress(0)
    setStatusMsg('')
    try {
      const res = await fetch(videoUrl)
      if (!res.ok) throw new Error('Gagal ambil video dari server.')
      const total = Number(res.headers.get('content-length')) || 0
      const reader = res.body.getReader()
      const chunks = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (total) setProgress(Math.round((received / total) * 100))
      }
      const blob = new Blob(chunks, { type: 'video/mp4' })
      const safeFileName = effectName.trim().replace(/[\\/:*?"<>|]/g, '') || 'efek'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeFileName}.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setStatusMsg('✅ Berhasil didownload!')
    } catch (err) {
      console.error('Gagal download MP4:', err)
      setStatusMsg(`❌ ${err.message || 'Gagal download. Coba lagi.'}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="screen">
      <div className="admin-content">
        <button
          className="back-btn ghost-static"
          style={{ marginBottom: 14, width: 'fit-content' }}
          onClick={() => navigate(-1)}
        >
          ← Balik
        </button>

        <div className="admin-header">
          <h2>Download Efek (MP4)</h2>
        </div>

        {loadingEffect ? (
          <div className="empty-state">Memuat...</div>
        ) : (
          <form onSubmit={handleDownload}>
            <div className="form-field">
              <label>Nama file</label>
              <div className="input-wrap">
                <input
                  className="finput-real"
                  placeholder="Masukin nama file sesuai yg kamu mau..."
                  value={effectName}
                  onChange={(e) => setEffectName(e.target.value)}
                  disabled={downloading}
                />
                {effectName && !downloading && (
                  <button
                    type="button"
                    className="input-clear-btn"
                    onClick={() => setEffectName('')}
                    aria-label="Hapus isi"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {statusMsg && (
              <p
                style={{
                  fontSize: 12.5,
                  marginBottom: 12,
                  color: statusMsg.startsWith('✅') ? 'var(--lime)' : 'var(--pink)',
                }}
              >
                {statusMsg}
              </p>
            )}

            <button className="save-btn" type="submit" disabled={downloading}>
              {downloading ? `Ngedownload... ${progress}%` : '⬇ Download MP4'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
