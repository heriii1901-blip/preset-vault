import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { takePostLoginRedirect } from '../utils/postLoginRedirect'

// Habis login Google, app balik ke "/". Kalau sebelumnya ada tujuan yang disimpen, lanjutin ke sana.
export default function PostLoginRedirect() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !user) return
    if (location.pathname !== '/') return
    const target = takePostLoginRedirect()
    if (target) navigate(target, { replace: true })
  }, [user, loading, location.pathname, navigate])

  return null
}
