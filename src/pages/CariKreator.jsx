import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { BottomNav } from '../components/BottomNav'

export default function CariKreator() {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = async () => {
    const keyword = inputValue.trim()
    if (!keyword) return
    setSearchTerm(keyword)
    setSearched(true)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('presets')
        .select('*, songs(name)')
        .ilike('creator_username', `%${keyword}%`)
        .order('created_at', { ascending: false })
      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error('Gagal cari kreator:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
      runSearch()
    }
  }

  return (
    <div className="screen">
      <div className="grid-header">
        <div>
          <h3>CARI KREATOR</h3>
        </div>
      </div>

      <div className="search-input-wrap">
        <input
          type="text"
          className="search-input"
          placeholder="Ketik nama kreator..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="search-go-btn" onClick={runSearch}>
          Cari
        </button>
      </div>

      <div className="search-body">
      {!searched && (
        <div className="empty-state" style={{ padding: 30 }}>
          Cari kreator dulu buat liat presetnya di sini.
        </div>
      )}

      {searched && loading && (
        <div className="empty-state" style={{ padding: 30 }}>Memuat...</div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="empty-state" style={{ padding: 30 }}>
          Kreator "{searchTerm}" ngga ketemu.
        </div>
      )}

      {searched && !loading && results.length > 0 && (
        <div className="preset-grid">
          {results.map((preset) => (
            <div
              key={preset.id}
              className="grid-cell"
              onClick={() => navigate(`/preset/${preset.id}`, { state: { source: 'terbaru' } })}
              onContextMenu={(e) => e.preventDefault()}
            >
              {preset.preview_video_url ? (
                <video
                  src={preset.preview_video_url}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  controlsList="nodownload"
                  draggable={false}
                />
              ) : (
                <div className="grid-fallback">🎬</div>
              )}
              <div className="grid-cell-overlay">@{preset.creator_username}</div>
            </div>
          ))}
        </div>
      )}
    </div>

      <BottomNav />
    </div>
  )
}
