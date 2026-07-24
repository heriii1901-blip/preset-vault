import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import AdminAddPreset from './pages/AdminAddPreset'
import AdminManagePresets from './pages/AdminManagePresets'
import Profile from './pages/Profile'
import SongPresets from './pages/SongPresets'
import Terbaru from './pages/Terbaru'
import CariKreator from './pages/CariKreator'
import PresetFeed from './pages/PresetFeed'
import CariKreator from './pages/CariKreator'
import Kreator from './pages/Kreator'

export default function App() {
  return (
    <AuthProvider>
      <div className="phone-wrap">
        <div className="phone">
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Terbaru />
                </ProtectedRoute>
              }
            />

            <Route
              path="/lagu"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />

            <Route
              path="/lagu/:songId"
              element={
                <ProtectedRoute>
                  <SongPresets />
                </ProtectedRoute>
              }
            />

            <Route
              path="/preset/:presetId"
              element={
                <ProtectedRoute>
                  <PresetFeed />
                </ProtectedRoute>
              }
            />

            <Route
              path="/akun"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* requireAdmin: cuma email admin yang bisa masuk sini */}
            <Route
              path="/admin/tambah-preset"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminAddPreset />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/edit-preset/:presetId"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminAddPreset />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/kelola-preset"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminManagePresets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Terbaru />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cari"
              element={
                <ProtectedRoute>
                  <CariKreator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kreator"
              element={
                <ProtectedRoute>
                  <Kreator />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  )
}
