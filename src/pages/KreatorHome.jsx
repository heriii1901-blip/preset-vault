import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import Kreator from './Kreator'
import KreatorHubTabs from '../components/KreatorHubTabs'

export default function KreatorHome() {
  const { isCreator, creatorUsername } = useAuth()
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()

  const ownCacheKey = creatorUsername ? `own-presets:${creatorUsername}` : null
  const cachedOwn = ownCacheKey ? getCache(ownCacheKey) : null
  const [ownPresets, setOwnPresets] = useState(cachedOwn?.data || [])
  const [loadingOwn, setLoadingOwn] = useState(false)

  useEffect(() => {
    if (!isCreator || !creatorUsername) return
    if (getCache(`own-presets:${creatorUsername}`)) return
    async function loadOwnPresets() {
      setLoadingOwn(true)
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('*')
          .eq('creator_username', creatorUsername)
          .order('created_at', { ascending: false })
        if (error) throw error
        setOwnPresets(data || [])
        setCache(`own-presets:${creatorUsername}`, data || [])
      } catch (err) {
        console.error('Gagal ambil preset kamu:', err)
      } finally {
        setLoadingOwn(false)
      }
    }
    loadOwnPresets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, creatorUsername])

  if (!isCreator) {
    return <Kreator />
  }

  return (
    <div className="screen">
      <KreatorHubTabs
        creatorUsername={creatorUsername}
        ownPresets={ownPresets}
        loadingOwn={loadingOwn}
        navigate={navigate}
      />
    </div>
  )
}
