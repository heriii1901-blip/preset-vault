import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PresetCacheProvider } from './context/PresetCacheContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BottomNav } from './components/BottomNav'
import { ServerNoticeBanner } from './components/ServerNoticeBanner'

import Login from './pages/Login'
import Home from './pages/Home'
import AdminAddPreset from './pages/AdminAddPreset'
import AdminManagePresets from './pages/AdminManagePresets'
import Profile from './pages/Profile'
import SongPresets from './pages/SongPresets'
import Terbaru from './pages/Terbaru'
import CariKreator from './pages/CariKreator'
import PresetFeed from './pages/PresetFeed'
import KreatorHome from './pages/KreatorHome'
import DaftarKreator from './pages/DaftarKreator'
import KreatorPresets from './pages/KreatorPresets'
import AdminCreatorApplications from './pages/AdminCreatorApplications'
import DownloadPage from './pages/DownloadPage'
import KreatorAddPreset from './pages/KreatorAddPreset'
import AdminSongRequests from './pages/AdminSongRequests'
import EditProfile from './pages/EditProfile'

export default function App() {
  const location = useLocation()

  // Daftar route yang WAJIB nampilin BottomNav
  const showNavRoutes = ['/', '/lagu', '/cari', '/kreator', '/akun']
  const shouldShowNav = showNavRoutes.includes(location.pathname)

  return (
    <AuthProvider>
      <PresetCacheProvider>
        <div className="phone-wrap">
          <div className="phone">
            <div className="page-transition" key={location.pathname}>
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

                <Route
                  path="/edit-profil"
                  element={
                    <ProtectedRoute>
                      <EditProfile />
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
                  path="/admin/kreator-pengajuan"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminCreatorApplications />
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
                      <KreatorHome />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kreator/:creatorUsername"
                  element={
                    <ProtectedRoute>
                      <KreatorPresets />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/daftar-kreator"
                  element={
                    <ProtectedRoute requireAdmin>
                      <DaftarKreator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kreator/tambah-preset"
                  element={
                    <ProtectedRoute>
                      <KreatorAddPreset />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/song-requests"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminSongRequests />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/download/:presetId"
                  element={
                    <ProtectedRoute>
                      <DownloadPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>

            {/* BottomNav dirender di sini agar tidak hilang saat refresh */}
            {shouldShowNav && <BottomNav />}

            <ServerNoticeBanner />
          </div>
        </div>
      </PresetCacheProvider>
    </AuthProvider>
  )
}
