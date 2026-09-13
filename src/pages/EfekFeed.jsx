import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import { useAuth } from '../context/AuthContext'

const CACHE_KEY = 'efek-grid'

const CATEGORY_ORDER = ['overlay', 'glitch', 'cc', 'jj', 'transisi', 'lainnya']

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
  const [categories, setCategories] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)

  // Cuma jalan sekali pas mount (deps kosong), gak ada resiko infinite
  // loop/query berulang - sama kayak pola fetch efek yang lama.
  useEffect(() => {
    async function loadCategories() {
      if (!getCache(CACHE_KEY)) setLoading(true)
      try {
        const { data, error } = await supabase
          .from('effects')
          .select('category, cover_url')
          .eq('link_pending', false)
        if (error) throw error

        const grouped = {}
        ;(data || []).forEach((effect) => {
          const key = effect.category || 'lainnya'
          if (!grouped[key]) grouped[key] = { count: 0, cover_url: null }
          grouped[key].count += 1
          if (!grouped[key].cover_url && effect.cover_url) {
            grouped[key].cover_url = effect.cover_url
          }
        })

        const list = CATEGORY_ORDER.filter((key) => grouped[key]).map((key) => ({
          key,
          label: CATEGORY_LABEL[key] || key,
          count: grouped[key].count,
          cover_url: grouped[key].cover_url,
        }))

        setCategories(list)
        setCache(CACHE_KEY, list)
      } catch (err) {
        console.error('Gagal ambil kategori efek:', err)
      } finally {
        setLoading(false)
      }
    }
    loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="screen">
      <div className="list-content">
        <div className="list-header">
          <div className="eyebrow">EFEK</div>
          <h1 className="home-tagline">Efek Alight Motion siap pakai</h1>
        </div>

        <div className="song-list">
          {loading && <div className="empty-state">Memuat...</div>}

          {!loading && categories.length === 0 && (
            <div className="empty-state">Belum ada efek yang di tambahkan</div>
          )}

          {categories.map((cat) => (
            <div
              className="song-row"
              key={cat.key}
              onClick={() => navigate(`/efek/kategori/${cat.key}`)}
            >
              <div className="song-thumb">
                {cat.cover_url ? <img src={cat.cover_url} alt="" draggable={false} /> : '✨'}
              </div>
              <div className="song-text">
                <h4>{cat.label}</h4>
                <div className="song-meta-row">{cat.count} efek</div>
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
