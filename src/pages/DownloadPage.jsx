import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { convertVideoToMp3 } from '../utils/convertToMp3'

export default function DownloadPage() {
  const { presetId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [videoUrl, setVideoUrl] = useState(location.state?.videoUrl || '')
  const [soundName, setSoundName] = useState(location.state?.songName || '')
  const [loadingPreset, setLoadingPreset] = useState(!location.state?.videoUrl)
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')

  // Kalo halaman ini dibuka langsung (misal reload), ambil ulang data dari Supabase
  useEffect(() => {
    if (videoUrl) return
    async function loadPreset() {
      setLoadingPreset(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*, songs(name)')
          .eq('id', presetId)
          .single()
        if (error) throw error
        setVideoUrl(data.preview_video_url || '')
        setSoundName(data.songs?.name || '')
      } catch (err) {
        console.error('Gagal ambil data video:', err)
        setStatusMsg('❌ Gagal ambil data video.')
      } finally {
        setLoadingPreset(false)
      }
    }
    if (presetId) loadPreset()
  }, [presetId, videoUrl])

  const handleDownload = async (e) => {
    e.preventDefault()
    if (!soundName.trim()) return setStatusMsg('Masukin nama sound dulu.')
    if (!videoUrl) return setStatusMsg('❌ Video ngga ketemu.')

    setConverting(true)
    setProgress(0)
    setStatusMsg('')
    try {
      const mp3Blob = await convertVideoToMp3(videoUrl, (p) => setProgress(Math.round(p * 100)))
      const safeFileName = soundName.trim().replace(/[\\/:*?"<>|]/g, '') || 'sound'
      const url = URL.createObjectURL(mp3Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeFileName}.mp3`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setStatusMsg('✅ Berhasil didownload!')
    } catch (err) {
      console.error('Gagal convert ke MP3:', err)
      setStatusMsg(`❌ ${err.message || 'Gagal convert ke MP3. Coba lagi.'}`)
    } finally {
      setConverting(false)
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
          <h2>Download Sound (MP3)</h2>
        </div>

        {loadingPreset ? (
          <div className="empty-state">Memuat...</div>
        ) : (
          <form onSubmit={handleDownload}>
            <div className="form-field">
              <label>Nama sound</label>
              <div className="input-wrap">
                <input
                  className="finput-real"
                  placeholder="Masukin nama sound sesuai yg kamu mau..."
                  value={soundName}
                  onChange={(e) => setSoundName(e.target.value)}
                  disabled={converting}
                />
                {soundName && !converting && (
                  <button
                    type="button"
                    className="input-clear-btn"
                    onClick={() => setSoundName('')}
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

            <button className="save-btn" type="submit" disabled={converting}>
              {converting ? `Ngonvert ke MP3... ${progress}%` : '⬇ Download MP3'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
