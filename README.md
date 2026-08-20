# PAM — Preset Alight Motion

Platform berbagi preset Alight Motion buat kreator konten Indonesia. Web app
mobile-first, ada juga versi APK-nya.

**Stack:** React + Vite, Supabase (auth & database), Cloudflare R2 (penyimpanan
video/gambar), hosting di Vercel.

## Fitur

- Feed preset (Terbaru), cari kreator, daftar lagu, hub kreator, profil & favorit
- Upload preset (admin & kreator) — video dikompres otomatis sebelum diupload
- Bisa posting preset duluan walau link XML belum ada ("Link Kosong"), dilengkapi belakangan
- Riwayat upload yang jalan di background, bisa dilanjut walau pindah halaman
- Cover video di grid otomatis di-generate & di-cache biar gak reload-reload mulu
- Upload avatar custom
- Panel admin: kelola preset, approve kreator, approve request lagu
- Login pakai Google

## Struktur folder (garis besar)

```
src/
  context/      <- auth, cache, antrian upload
  components/   <- komponen reusable (video cell grid, nav, dll)
  pages/        <- semua halaman (Home, Admin, Kreator, Profile, dll)
  utils/        <- helper (upload ke R2, kompresi video, IndexedDB)
api/            <- serverless function (generate presigned URL R2)
``
