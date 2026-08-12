import { creatorNameStyle } from '../utils/creatorFont'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'

const CACHE_KEY = 'kreator-list'
const REGISTERED_CACHE_KEY = 'kreator-list-registered'

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

function CreatorAvatar({ displayKey, avatarUrl }) {
  if (avatarUrl) {
    return (
      <div className="song-thumb" style={{ padding: 0, overflow: 'hidden' }}>
        <img
          src={avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }
  return (
    <div className="song-thumb" style={{ background: colorFor(displayKey) }}>
      {displayKey.charAt(0).toUpperCase()}
    </div>
  )
}

export default function Kreator({ hideHeader = false }) {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()
  const [pendingSongCount, setPendingSongCount] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('song_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count, error }) => {
        if (error) return console.error('Gagal ambil jumlah permintaan lagu:', error)
        setPendingSongCount(count || 0)
      })
  }, [isAdmin])

  const cachedList = getCache(CACHE_KEY)
  const cachedRegistered = getCache(REGISTERED_CACHE_KEY)

  const [creatorList, setCreatorList] = useState(cachedList?.data || [])
  const [loadingList, setLoadingList] = useState(!cachedList)
  const [registeredMap, setRegisteredMap] = useState(cachedRegistered?.data || {})
  const [ownProfile, setOwnProfile] = useState(null)

  useEffect(() => {
    async function loadCreatorList() {
      if (getCache(CACHE_KEY)) return
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
        const list = Array.from(map.values())
        setCreatorList(list)
        setCache(CACHE_KEY, list)
      } catch (err) {
        console.error('Gagal ambil daftar kreator:', err)
      } finally {
        setLoadingList(false)
      }
    }
    loadCreatorList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function loadRegistered() {
      if (getCache(REGISTERED_CACHE_KEY)) return
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('creator_username, account_name, avatar_url, account_font, account_bold')
          .eq('is_creator', true)
        if (error) throw error
        const map = {}
        for (const p of data || []) {
          if (p.creator_username) map[p.creator_username] = p
        }
        setRegisteredMap(map)
        setCache(REGISTERED_CACHE_KEY, map)
      } catch (err) {
        console.error('Gagal ambil profil kreator terdaftar:', err)
      }
    }
    loadRegistered()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isAdmin || !user) return
    async function loadOwnProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, creator_username, is_creator, account_name, avatar_url, account_font, account_bold')
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

  const adminKey = isAdmin ? (ownProfile?.creator_username || null) : null
  const otherCreators = isAdmin
    ? creatorList.filter((c) => c.creator_username !== adminKey)
    : creatorList
  const adminCount = adminKey ? creatorList.find((c) => c.creator_username === adminKey)?.count || 0 : 0
  const adminDisplayName = ownProfile?.account_name || adminKey || ownProfile?.username || 'Kamu'
  const adminAvatar = ownProfile?.avatar_url || null

  return (
    <div className="screen">
      {!hideHeader && (
        <div className="kreator-page-header">
          <div className="eyebrow">KREATOR</div>
        </div>
      )}

      <div className="song-list" style={{ padding: '0 18px' }}>
        {loadingList && <div className="empty-state">Memuat...</div>}

        {!loadingList && (
          <>
            {/* Akun admin selalu di-pin di paling atas */}
            {isAdmin && (
              <div
                className="song-row"
                onClick={() => adminKey && navigate(`/kreator/${adminKey}`)}
              >
                <CreatorAvatar displayKey={adminDisplayName} avatarUrl={adminAvatar} />
                <div className="song-text">
                  <h4 style={creatorNameStyle(ownProfile?.account_font, ownProfile?.account_bold)}>
                  {adminDisplayName}{' '}
                  <span style={{ color: '#FF3D3D', fontWeight: 800, fontSize: 12, fontFamily: 'var(--font-sans)' }}>(ADMIN)</span>
                </h4>
                  {adminKey && <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>@{adminKey}</p>}
                </div>
                <span className="song-count">{adminCount}</span>
              </div>
            )}

            {otherCreators.length === 0 && (
              <div className="empty-state">
                {isAdmin ? 'Belum ada kreator lain.' : 'Belum ada kreator terdaftar.'}
              </div>
            )}
            {otherCreators.map((c) => {
              const registered = registeredMap[c.creator_username]
              const displayName = registered?.account_name || c.creator_username
              return (
                <div
                  key={c.creator_username}
                  className="song-row"
                  onClick={() => navigate(`/kreator/${c.creator_username}`)}
                >
                  <CreatorAvatar displayKey={displayName} avatarUrl={registered?.avatar_url} />
                  <div className="song-text">
                    <h4 style={registered ? creatorNameStyle(registered.account_font, registered.account_bold) : undefined}>
                      {registered?.account_name ? displayName : `@${c.creator_username}`}
                    </h4>
                    {registered?.account_name && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>@{c.creator_username}</p>
                    )}
                  </div>
                  <span className="song-count">{c.count}</span>
                </div>
              )
            })}
          </>
        )}
      </div>

      {isAdmin && (
        <div className="admin-shortcut-row" style={{ padding: '0 20px 10px', marginTop: 14 }}>
          <button className="admin-shortcut" onClick={() => navigate('/admin/kreator-pengajuan')}>
            Review Pengajuan
          </button>
          <button className="admin-shortcut" onClick={() => navigate('/admin/song-requests')}>
            Request Lagu{pendingSongCount > 0 ? ` (${pendingSongCount})` : ''}
          </button>
        </div>
      )}
      <div className="bottom-fade" />
    </div>
  )
}
