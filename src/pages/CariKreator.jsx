import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import PresetVideoCell from '../components/PresetVideoCell'

const CACHE_KEY = 'cari-kreator'

export default function CariKreator() {
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()
  const cached = getCache(CACHE_KEY)
  const [inputValue, setInputValue] = useState(cached?.data?.searchTerm || '')
  const [searchTerm, setSearchTerm] = useState(cached?.data?.searchTerm || '')
  const [results, setResults] = useState(cached?.data?.results || [])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(Boolean(cached?.data?.searchTerm))

  const runSearch = async (keywordOverride) => {
    const keyword = (keywordOverride ?? inputValue).trim()
    if (!keyword) return
    setSearchTerm(keyword)
    setSearched(true)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('presets')
        .select('*, songs(name)')
        .ilike('creator_username', `%${keyword}%`)
        .eq('link_pending', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      setResults(data || [])
      setCache(CACHE_KEY, { searchTerm: keyword, results: data || [] })
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
      <div className="grid-page">
        <div className="grid-header">
          <h3>CARI KREATOR</h3>
        </div>

        <div className="search-input-wrap">
          <input
            type="search"
            className="search-input"
            placeholder="Ketik nama kreator..."
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value
              setInputValue(val)
              if (!val.trim()) {
                setSearchTerm('')
                setResults([])
                setSearched(false)
                setCache(CACHE_KEY, { searchTerm: '', results: [] })
              }
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            data-lpignore="true"
          />
          <button type="button" className="search-go-btn" onClick={() => runSearch()}>
            Cari
          </button>
        </div>

        <div className="search-body">
          {!searched && (
            <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
              Cari kreator dulu buat liat presetnya di sini.
            </div>
          )}
          {searched && loading && (
            <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30 }}>Memuat...</div>
          )}
          {searched && !loading && results.length === 0 && (
            <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
              Kreator "{searchTerm}" ngga ketemu.
            </div>
          )}
          {searched && !loading && results.length > 0 && (
            <div className="preset-grid">
              {results.map((preset, i) => (
                <PresetVideoCell
                  key={preset.id}
                  preset={preset}
                  index={i}
                  getCache={getCache}
                  setCache={setCache}
                  onNavigate={(p) => navigate(`/preset/${p.id}`, { state: { source: 'kreator', creatorUsername: p.creator_username } })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

