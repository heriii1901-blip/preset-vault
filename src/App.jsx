import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PresetCacheProvider } from './context/PresetCacheContext'
import { AdminPendingProvider } from './context/AdminPendingContext'
import { UploadQueueProvider } from './context/UploadQueueContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import PostLoginRedirect from './components/PostLoginRedirect'
import { BottomNav } from './components/BottomNav'
import { ServerNoticeBanner } from './components/ServerNoticeBanner'

import Login from './pages/auth/Login'
import Home from './pages/Home'
import AdminAddPreset from './pages/admin/AdminAddPreset'
import AdminManagePresets from './pages/admin/AdminManagePresets'
import Profile from './pages/profil/Profile'
import SongPresets from './pages/SongPresets'
import Terbaru from './pages/Terbaru'
import EfekGrid from './pages/efek/EfekGrid'
import EfekKategori from './pages/efek/EfekKategori'
import EfekFeed from './pages/efek/EfekFeed'
import AdminManageEfek from './pages/admin/AdminManageEfek'
import DownloadEfek from './pages/efek/DownloadEfek'
import PresetFeed from './pages/PresetFeed'
import KreatorHome from './pages/kreator/KreatorHome'
import DaftarKreator from './pages/kreator/DaftarKreator'
import KreatorPresets from './pages/kreator/KreatorPresets'
import AdminCreatorApplications from './pages/admin/AdminCreatorApplications'
import DownloadPage from './pages/DownloadPage'
import KreatorAddPreset from './pages/kreator/KreatorAddPreset'
import KreatorManagePresets from './pages/kreator/KreatorManagePresets'
import KreatorSongRequests from './pages/kreator/KreatorSongRequests'
import AdminSongRequests from './pages/admin/AdminSongRequests'
import EditProfile from './pages/profil/EditProfile'
import TentangAplikasi from './pages/profil/TentangAplikasi'
import WallpaperSettings from './pages/profil/WallpaperSettings'
import Pengaturan from './pages/profil/Pengaturan'
import AdminKreatorKhusus from './pages/admin/AdminKreatorKhusus'

export default function App() {
  const location = useLocation()

  const showNavRoutes = ['/', '/lagu', '/efek', '/kreator', '/akun']
  const isFullscreenFromTerbaru = location.pathname.startsWith('/preset/') && location.state?.source === 'terbaru'
  const shouldShowNav = showNavRoutes.includes(location.pathname) || isFullscreenFromTerbaru
  
  return (
    <AuthProvider>
      <PresetCacheProvider>
      <AdminPendingProvider>
      <UploadQueueProvider>
        <PostLoginRedirect />
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
                  path="/tentang-aplikasi"
                  element={
                    <ProtectedRoute>
                      <TentangAplikasi />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/ubah-wallpaper"
                  element={
                    <ProtectedRoute>
                      <WallpaperSettings />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/pengaturan"
                  element={
                    <ProtectedRoute>
                      <Pengaturan />
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
                  path="/efek/kategori/:category"
                  element={
                    <ProtectedRoute>
                      <EfekKategori />
                    </ProtectedRoute>
                  }
                />
                
                <Route
                  path="/admin/kelola-efek"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminManageEfek />
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
                  path="/kreator/kelola-preset"
                  element={
                    <ProtectedRoute>
                      <KreatorManagePresets />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kreator/request-lagu"
                  element={
                    <ProtectedRoute>
                      <KreatorSongRequests />
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
                <Route
                  path="/admin/kreator-khusus"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminKreatorKhusus />
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
      </AdminPendingProvider>
      </PresetCacheProvider>
    </AuthProvider>
  )
}
