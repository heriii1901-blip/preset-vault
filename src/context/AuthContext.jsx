import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, ADMIN_EMAIL } from '../supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isCreator, setIsCreator] = useState(false)
  const [creatorUsername, setCreatorUsername] = useState('')
  const [hasCustomAvatar, setHasCustomAvatar] = useState(false)
  const avatarSyncedRef = useRef(null)
  
  async function loadCreatorStatus(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_creator, creator_username, avatar_is_custom')
        .eq('id', userId)
        .single()
      if (error) throw error
      setIsCreator(data?.is_creator || false)
      setCreatorUsername(data?.creator_username || '')
      setHasCustomAvatar(data?.avatar_is_custom || false)
    } catch (err) {
      console.error('Gagal ambil status kreator:', err)
    }
  }

  useEffect(() => {
    // Cek session yang lagi aktif pas app pertama kali dibuka
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) await loadCreatorStatus(sessionUser.id)
      setLoading(false)
    })

    // Dengerin perubahan status login (login/logout) secara real-time
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) {
        await loadCreatorStatus(sessionUser.id)
      } else {
        setIsCreator(false)
        setCreatorUsername('')
      }
      setLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Sinkron foto profil Google ke tabel profiles, biar bisa ditampilin di list Kreator
  // Kreator skip: avatar mereka custom upload, jangan ditimpa Google
    useEffect(() => {
    if (!user || loading) return
    if (isCreator || hasCustomAvatar) return
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null
    if (!avatarUrl) return
    if (avatarSyncedRef.current === user.id) return
    avatarSyncedRef.current = user.id
    supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) console.error('Gagal sync avatar:', error)
      })
  }, [user, isCreator, hasCustomAvatar, loading])

  const loginWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })

  const logout = () => supabase.auth.signOut()

  // Ini "penjaga pintu" yang kita omongin: cek email yang login sama admin
  const isAdmin = user?.email === ADMIN_EMAIL

  const value = { user, loading, isAdmin, isCreator, creatorUsername, hasCustomAvatar, loginWithGoogle, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
