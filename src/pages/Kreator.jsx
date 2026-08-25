import { creatorNameStyle } from '../utils/creatorFont'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'

const CACHE_KEY = 'kreator-list'
const REGISTERED_CACHE_KEY = 'kreator-list-registered'
const ADMIN_PROFILE_CACHE_KEY = 'kreator-admin-profile'

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
  const { isAdmin } = useAuth()
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
  const [adminProfile, setAdminProfile] = useState(getCache(ADMIN_PROFILE_CACHE_KEY)?.data || null)

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

  // Diambil buat SEMUA viewer (bukan cuma pas login admin), biar baris admin
  // ke-pin + label "Admin" konsisten muncul di akun user biasa juga.
  // Query publik ke tabel profiles doang, dep array kosong + dijaga cache -> ngga ada resiko egress loop.
  useEffect(() => {
    async function loadAdminProfile() {
      if (getCache(ADMIN_PROFILE_CACHE_KEY)) return
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, creator_username, account_name, avatar_url, account_font, account_bold')
          .eq('is_admin', true)
          .maybeSingle()
        if (error) throw error
        setAdminProfile(data)
        setCache(ADMIN_PROFILE_CACHE_KEY, data)
      } catch (err) {
        console.error('Gagal ambil profil admin:', err)
      }
    }
    loadAdminProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [searchTerm, setSearchTerm] = useState('')

  const adminKey = adminProfile?.creator_username || null
  const otherCreatorsAll = adminKey
    ? creatorList.filter((c) => c.creator_username !== adminKey)
    : creatorList
  const adminDisplayName = adminProfile?.account_name || adminKey || adminProfile?.username || 'Admin'
  const adminAvatar = adminProfile?.avatar_url || null

  const keyword = searchTerm.trim().toLowerCase()
  const otherCreators = keyword
    ? otherCreatorsAll.filter((c) => {
        const registered = registeredMap[c.creator_username]
        const displayName = registered?.account_name || c.creator_username
        return (
          c.creator_username.toLowerCase().includes(keyword) ||
          displayName.toLowerCase().includes(keyword)
        )
      })
    : otherCreatorsAll
  const adminMatches = keyword
    ? adminKey && (adminKey.toLowerCase().includes(keyword) || adminDisplayName.toLowerCase().includes(keyword))
    : true

  return (
    <div className="screen">
      {!hideHeader && (
        <div className="kreator-page-header">
          <div className="eyebrow">KREATOR</div>
        </div>
      )}

      <div className="search-input-wrap" style={{ padding: '0 20px', marginBottom: 10 }}>
        <input
          type="search"
          className="search-input"
          placeholder="Cari kreator..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          data-lpignore="true"
        />
      </div>

      <div className="song-list kreator-creator-list" style={{ padding: '0 20px' }}>
        {loadingList && <div className="empty-state">Memuat...</div>}

        {!loadingList && (
          <>
            {/* Akun admin selalu di-pin di paling atas, buat semua viewer */}
            {adminKey && adminMatches && (
              <div
                className="song-row"
                onClick={() => navigate(`/kreator/${adminKey}`)}
              >
                <CreatorAvatar displayKey={adminDisplayName} avatarUrl={adminAvatar} />
                <div className="song-text">
                  <h4 style={creatorNameStyle(adminProfile?.account_font, adminProfile?.account_bold)}>
                  {adminDisplayName}{' '}
                  <span style={{ color: '#FF3D3D', fontWeight: 800, fontSize: 12, fontFamily: 'var(--font-sans)' }}>(ADMIN)</span>
                </h4>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>@{adminKey}</p>
                </div>
              </div>
            )}

            {otherCreators.length === 0 && !(keyword && adminMatches) && (
              <div className="empty-state">
                {keyword
                  ? `Kreator "${searchTerm.trim()}" ngga ketemu.`
                  : (isAdmin ? 'Belum ada kreator lain.' : 'Belum ada kreator terdaftar.')}
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
    </div>
  )
}
