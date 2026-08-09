import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { usePresetCache } from '../context/PresetCacheContext'
import Kreator from './Kreator'
import KreatorHubTabs from '../components/KreatorHubTabs'

export default function KreatorHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { getCache, setCache } = usePresetCache()

  const [checkedStatus, setCheckedStatus] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const [creatorUsername, setCreatorUsername] = useState('')

  const ownCacheKey = creatorUsername ? `own-presets:${creatorUsername}` : null
  const cachedOwn = ownCacheKey ? getCache(ownCacheKey) : null
  const [ownPresets, setOwnPresets] = useState(cachedOwn?.data || [])
  const [loadingOwn, setLoadingOwn] = useState(false)

  useEffect(() => {
    async function loadStatus() {
      if (!user) {
        setCheckedStatus(true)
        return
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_creator, creator_username')
          .eq('id', user.id)
          .single()
        if (error) throw error
        setIsCreator(data?.is_creator || false)
        setCreatorUsername(data?.creator_username || '')
      } catch (err) {
        console.error('Gagal ambil status kreator:', err)
      } finally {
        setCheckedStatus(true)
      }
    }
    loadStatus()
  }, [user])

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

  if (!checkedStatus || !isCreator) {
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
