import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PresetCacheProvider } from './context/PresetCacheContext'
import { UploadQueueProvider } from './context/UploadQueueContext'
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
import EfekGrid from './pages/EfekGrid'
import EfekFeed from './pages/EfekFeed'
import EfekTambah from './pages/EfekTambah'
import DownloadEfek from './pages/DownloadEfek'
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

  const showNavRoutes = ['/', '/lagu', '/efek', '/kreator', '/akun']
  const isFullscreenFromTerbaru = location.pathname.startsWith('/preset/') && location.state?.source === 'terbaru'
  const shouldShowNav = showNavRoutes.includes(location.pathname) || isFullscreenFromTerbaru
  
  return (
    <AuthProvider>
      <PresetCacheProvider>
      <UploadQueueProvider>
        <div className="phone-wrap">
          <div className={`phone${isFullscreenFromTerbaru ? ' phone--nav-overlay' : ''}`}>
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
                  path="/efek"
                  element={
                    <ProtectedRoute>
                      <EfekGrid />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/efek/tambah"
                  element={
                    <ProtectedRoute requireAdmin>
                      <EfekTambah />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/efek/:effectId"
                  element={
                    <ProtectedRoute>
                      <EfekFeed />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/efek-download/:effectId"
                  element={
                    <ProtectedRoute>
                      <DownloadEfek />
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
                    <ProtectedRoute>
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

            {shouldShowNav && <BottomNav />}

            <ServerNoticeBanner />
          </div>
        </div>
      </UploadQueueProvider>
      </PresetCacheProvider>
    </AuthProvider>
  )
}
