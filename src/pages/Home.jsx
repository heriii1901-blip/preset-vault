import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { BottomNav } from '../components/BottomNav'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const [query, setQuery] = useState('')
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  useEffect(() => {
    async function loadSongs() {
      try {
        const { data: songList, error } = await supabase.from('songs').select('*')
        if (error) throw error

        // Itung jumlah preset ASLI per lagu (bukan pake angka counter yang bisa gak akurat)
        const withRealCount = await Promise.all(
          songList.map(async (song) => {
            const { count } = await supabase
              .from('presets')
              .select('*', { count: 'exact', head: true })
              .eq('song_id', song.id)
            return { ...song, presetCount: count ?? song.preset_count ?? 0 }
          })
        )

        withRealCount.sort((a, b) => a.name.localeCompare(b.name))
        setSongs(withRealCount)
      } catch (err) {
        console.error('Gagal ambil daftar lagu:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSongs()
  }, [])

  const filteredSongs = songs.filter((song) =>
    song.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="screen">
      <div className="list-content">
        <div className="list-header">
          <div className="eyebrow">BERANDA</div>
          <div className="search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8A8A96" strokeWidth="2" width="16" height="16">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Cari lagu..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="song-list">
          {loading && <div className="empty-state">Memuat...</div>}

          {!loading && filteredSongs.length === 0 && songs.length === 0 && (
            <div className="empty-state">
              Belum ada lagu/preset tersimpen.
              {isAdmin && ' Tambahin dulu lewat Panel Admin.'}
            </div>
          )}

          {!loading && filteredSongs.length === 0 && songs.length > 0 && (
            <div className="empty-state">Gak ada lagu yang cocok.</div>
          )}

          {filteredSongs.map((song) => (
            <div
              className="song-row"
              key={song.id}
              onClick={() => navigate(`/lagu/${song.id}`)}
            >
              <div className="song-thumb" style={{ background: song.color }}>♪</div>
              <div className="song-text">
                <h4>{song.name}</h4>
              </div>
              <span className="song-count">{song.presetCount || 0}</span>
            </div>
          ))}
        </div>

        {isAdmin && (
          <button className="admin-shortcut" onClick={() => navigate('/admin/tambah-preset')}>
            ⚙ Panel Admin
          </button>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
