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

const FAB_ACTIONS = [
  {
    label: 'Tambah Efek',
    to: '/efek/tambah',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l2 5.4 5.4 2-5.4 2-2 5.4-2-5.4-5.4-2 5.4-2 2-5.4z" />
      </svg>
    ),
  },
  {
    label: 'Tambah Preset',
    to: '/admin/tambah-preset',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  {
    label: 'Kelola Preset',
    to: '/admin/kelola-preset',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="14" y2="17" />
      </svg>
    ),
  },
]

export default function EfekGrid() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { getCache, setCache } = usePresetCache()
  const cached = getCache(CACHE_KEY)
  const [categories, setCategories] = useState(cached?.data || [])
  const [loading, setLoading] = useState(!cached)
  const [fabOpen, setFabOpen] = useState(false)
  
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
        <>
          <div
            className={`efek-fab-backdrop${fabOpen ? ' is-open' : ''}`}
            onClick={() => setFabOpen(false)}
          />

          <div className={`efek-fab-dial${fabOpen ? ' is-open' : ''}`}>
            {FAB_ACTIONS.map((action, i) => (
              <button
                key={action.label}
                type="button"
                className="efek-fab-bubble"
                style={{
                  transitionDelay: `${(fabOpen ? FAB_ACTIONS.length - 1 - i : i) * 45}ms`,
                }}
                onClick={() => { setFabOpen(false); navigate(action.to) }}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}

            <button
              type="button"
              className={`efek-fab${fabOpen ? ' is-open' : ''}`}
              onClick={() => setFabOpen((v) => !v)}
              aria-label="Menu admin efek"
              aria-expanded={fabOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
