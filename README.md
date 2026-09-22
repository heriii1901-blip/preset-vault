[README.md](https://github.com/user-attachments/files/32523554/README.md)
<div align="center">

# PAM — Preset Alight Motion

Platform berbagi preset **Alight Motion** buat kreator konten Indonesia.
Gratis, mobile-first, tersedia sebagai web app dan APK Android.

</div>

| Web App | APK Android | Status |
|:-------:|:-----------:|:------:|
| [![Web](https://img.shields.io/badge/web-preset--vault.vercel.app-7C5CFF?labelColor=1e2327)](https://preset-vault.vercel.app) | [![Download](https://img.shields.io/github/v/release/heriii1901-blip/preset-vault?label=download&color=FF3D7F&labelColor=1e2327)](https://github.com/heriii1901-blip/preset-vault/releases/latest) | ![Status](https://img.shields.io/badge/status-aktif_dikembangkan-D4FF3D?labelColor=1e2327) |

<!--
Screenshot: taruh gambar di .github/readme-images/ lalu hapus tanda komentar ini.

<p align="center">
  <img src="./.github/readme-images/terbaru.png" width="24%" />
  <img src="./.github/readme-images/lagu.png" width="24%" />
  <img src="./.github/readme-images/efek.png" width="24%" />
  <img src="./.github/readme-images/kreator.png" width="24%" />
</p>
-->

## Fitur

### Buat pengguna

- **Feed Terbaru** — preset terbaru dalam tampilan fullscreen ala TikTok, autoplay dengan snap scroll.
- **Cari lewat link TikTok** — tempel link video TikTok (termasuk link pendek `vt.tiktok.com`), PAM cocokin dengan preset yang ada lewat ID videonya.
- **Daftar Lagu** — telusuri preset per lagu, lengkap dengan pencarian.
- **Efek** — koleksi efek per kategori: Overlay, Glitch, CC, Efek JJ, Transisi, dan Lainnya.
- **Kreator** — cari kreator, lihat profil dan karya mereka.
- **Favorit** — simpan preset dan efek ke profil kamu.
- **Login Google** — tanpa bikin akun baru.

### Buat kreator

- **Daftar jadi kreator** lewat `/daftar-kreator`, disetujui oleh admin.
- **Hub kreator** — kelola postingan, profil (avatar dengan crop, bio, link kontak, versi Alight Motion), dan contoh preset.
- **Upload preset** dengan kompresi video otomatis di browser sebelum diupload.
- **Upload di background** — tetap jalan walau pindah halaman, dan antreannya tersimpan walau app ditutup.
- **Riwayat Upload** — batalkan, edit, atau kirim ulang upload yang gagal.
- **Link Kosong** — posting preset duluan walau link XML belum ada, dilengkapi belakangan.
- **Cover otomatis** — cover video di-generate dari frame video dan di-cache biar grid gak reload terus.

### Di balik layar

- Bisa dipasang sebagai PWA, dan tersedia APK Android (TWA).
- Pola cache-first (cache preset + cache thumbnail di IndexedDB) buat ngirit request dan kuota.
- Video diupload langsung ke Cloudflare R2 lewat presigned URL, jadi gak kena batas ukuran body serverless.

## Download

**Web app**: buka [preset-vault.vercel.app](https://preset-vault.vercel.app) di browser HP kamu. Kalau mau dipasang seperti aplikasi, di Chrome pilih menu titik tiga, lalu **Tambahkan ke layar utama**.

**APK Android**:

1. Download file APK dari halaman [Releases](https://github.com/heriii1901-blip/preset-vault/releases/latest).
2. Buka file-nya. Kalau diminta, izinkan install dari sumber ini.
3. Selesai, buka PAM dari layar utama.

## Tech Stack

| Bagian | Teknologi |
|--------|-----------|
| Frontend | React + Vite |
| Database & Auth | Supabase (login Google OAuth) |
| Penyimpanan video/gambar | Cloudflare R2 |
| Hosting & serverless | Vercel |
| Kompresi video | ffmpeg.wasm (di browser) |
| APK Android | PWABuilder (TWA) |

## Development

### Prasyarat

- [Node.js](https://nodejs.org) versi LTS
- Project Supabase dan bucket Cloudflare R2 milik kamu sendiri

### Setup

```bash
git clone https://github.com/heriii1901-blip/preset-vault.git
cd preset-vault
npm install
cp .env.example .env
npm run dev
```

Buka `http://localhost:5173` di browser.

### Environment variables

Isi file `.env` dengan kunci Supabase dan R2 milik kamu. Nama variabel yang dibutuhkan ada di `.env.example`.

> **Jangan pernah commit file `.env`.** Isinya rahasia. Untuk deploy, simpan variabel yang sama di Environment Variables Vercel.

### Build

```bash
npm run build
```

### Struktur folder

```
api/       Fungsi serverless Vercel (mis. resolve link pendek TikTok)
public/    Aset statis, service worker, ikon
src/
  components/   Komponen UI bersama
  pages/        Halaman-halaman app
  context/      State global (auth, cache preset, antrean upload)
  utils/        Helper (mis. resolve ID video TikTok)
```

## Kontribusi

Laporan bug dan saran fitur bisa lewat [Issues](https://github.com/heriii1901-blip/preset-vault/issues). Sertakan langkah untuk mengulang masalahnya dan screenshot kalau perlu.

## Disclaimer

PAM adalah proyek independen dan tidak berafiliasi dengan Alight Motion maupun TikTok. Hak cipta preset dan video tetap milik masing-masing kreator.

## Lisensi

Copyright © 2026 Heri. All rights reserved.
