import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// requireAdmin=true dipake khusus buat halaman Panel Admin
export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return <div className="loading-screen">Memuat...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    // Bukan admin tapi coba akses panel admin lewat URL langsung -> tendang ke home
    return <Navigate to="/" replace />
  }

  return children
}
