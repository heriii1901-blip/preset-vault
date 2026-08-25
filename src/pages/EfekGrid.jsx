import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import { useAuth } from '../context/AuthContext'

const CACHE_KEY = 'efek-grid'

const CATEGORY_LABEL = {
  overlay: 'Overlay',
  glitch: 'Glitch',
  cc: 'CC',
  jj: 'Efek JJ',
  transisi: 'Transisi',
  lainnya: 'Lainnya',
}

export default function EfekGrid() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { getCache, setCache } = usePresetCache()
  const cached = getCache(CACHE_KEY)
  const [effects, setEffects] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    async function loadEffects() {
      if (!getCache(CACHE_KEY)) setLoading(true)
      try {
        const { data, error } = await supabase
          .from('effects')
          .select('*')
          .eq('link_pending', false)
          .order('created_at', { ascending: false })
        if (error) throw error
        setEffects(data || [])
        setCache(CACHE_KEY, data || [])
      } catch (err) {
        console.error('Gagal ambil daftar efek:', err)
      } finally {
        setLoading(false)
      }
    }
    loadEffects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="screen">
      <div className="list-content">
        <div className="list-header">
          <div className="eyebrow">EFEK</div>
          <h1 className="home-tagline">Efek Alight Motion siap pake</h1>
        </div>

        <div className="song-list">
          {loading && <div className="empty-state">Memuat...</div>}

          {!loading && effects.length === 0 && (
            <div className="empty-state">Belum ada efek. Yuk upload pertama!</div>
          )}

          {effects.map((effect) => (
            <div
              className="song-row"
              key={effect.id}
              onClick={() => navigate(`/efek/${effect.id}`)}
            >
              <div className="song-thumb">
                {effect.cover_url ? <img src={effect.cover_url} alt="" draggable={false} /> : '✨'}
              </div>
              <div className="song-text">
                <h4>{effect.title}</h4>
                <div className="song-meta-row">{CATEGORY_LABEL[effect.category] || effect.category}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <button
          type="button"
          className="efek-fab"
          onClick={() => navigate('/efek/tambah')}
          aria-label="Tambah Efek"
        >
          +
        </button>
      )}
    </div>
  )
}
