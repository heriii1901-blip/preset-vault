import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

const THUMB_COLORS = [
  'linear-gradient(135deg,#7C5CFF,#4A32C9)',
  'linear-gradient(135deg,#FF3D7F,#C91E5A)',
  'linear-gradient(135deg,#D4FF3D,#8FB800)',
  'linear-gradient(135deg,#7C5CFF,#FF3D7F)',
  'linear-gradient(135deg,#4A32C9,#15151D)',
]
function colorFor(username) {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return THUMB_COLORS[Math.abs(hash) % THUMB_COLORS.length]
}

export default function Kreator() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [creatorList, setCreatorList] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [ownProfile, setOwnProfile] = useState(null)

  useEffect(() => {
    async function loadCreatorList() {
      setLoadingList(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('id, creator_username, preview_video_url, created_at')
          .order('created_at', { ascending: false })
        if (error) throw error
        const map = new Map()
        for (const p of data || []) {
          if (!p.creator_username) continue
          if (!map.has(p.creator_username)) {
            map.set(p.creator_username, { ...p, count: 1 })
          } else {
            map.get(p.creator_username).count += 1
          }
        }
        setCreatorList(Array.from(map.values()))
      } catch (err) {
        console.error('Gagal ambil daftar kreator:', err)
      } finally {
        setLoadingList(false)
      }
    }
    loadCreatorList()
  }, [])

  useEffect(() => {
    if (!isAdmin || !user) return
    async function loadOwnProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, creator_username, is_creator')
          .eq('id', user.id)
          .single()
        if (error) throw error
        setOwnProfile(data)
      } catch (err) {
        console.error('Gagal ambil profil admin:', err)
      }
    }
    loadOwnProfile()
  }, [isAdmin, user])

  if (!isAdmin) {
    return (
      <div className="screen">
        <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
          Akan Hadir!!!
        </div>
      </div>
    )
  }

  const adminKey = ownProfile?.creator_username || null
  const otherCreators = creatorList.filter((c) => c.creator_username !== adminKey)
  const adminCount = adminKey ? creatorList.find((c) => c.creator_username === adminKey)?.count || 0 : 0
  const adminDisplayName = adminKey || ownProfile?.username || 'Kamu'

  return (
    <div className="screen">
      <div className="kreator-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="eyebrow">KREATOR</div>
        <button className="admin-shortcut" onClick={() => navigate('/admin/kreator-pengajuan')}>
          Review Pengajuan
        </button>
      </div>

      {loadingList && <div className="empty-state">Memuat...</div>}

      {!loadingList && (
        <div className="song-list" style={{ padding: '0 18px' }}>
          {/* Akun admin selalu di-pin di paling atas */}
          <div
            className="song-row"
            onClick={() => adminKey && navigate(`/kreator/${adminKey}`)}
          >
            <div className="song-thumb" style={{ background: colorFor(adminDisplayName) }}>
              {adminDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="song-text">
              <h4>
                @{adminDisplayName}{' '}
                <span style={{ color: '#FF3D3D', fontWeight: 800, fontSize: 12 }}>(ADMIN)</span>
              </h4>
            </div>
            <span className="song-count">{adminCount}</span>
          </div>

          {otherCreators.length === 0 && (
            <div className="empty-state">Belum ada kreator lain.</div>
          )}
          {otherCreators.map((c) => (
            <div
              key={c.creator_username}
              className="song-row"
              onClick={() => navigate(`/kreator/${c.creator_username}`)}
            >
              <div className="song-thumb" style={{ background: colorFor(c.creator_username) }}>
                {c.creator_username.charAt(0).toUpperCase()}
              </div>
              <div className="song-text">
                <h4>@{c.creator_username}</h4>
              </div>
              <span className="song-count">{c.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
