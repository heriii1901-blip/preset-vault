# PAM — Preset Vault

Project awal: sistem login Google + halaman list Sound. Halaman lain (grid preset,
video player, profil, panel admin) masih placeholder, nanti kita isi bareng-bareng.

## Yang udah jalan
- Login pake Google (Firebase Auth)
- Halaman kebuka otomatis ke-block kalau belum login
- Panel Admin ke-block otomatis kalau bukan email admin
- Halaman Home: list Sound + search (data masih statis, belum dari database)

## Cara jalanin di laptop

### 1. Install Node.js
Download dari https://nodejs.org (pilih versi LTS). Setelah install, cek di terminal:
```
node -v
```

### 2. Install dependency project
Buka terminal di folder project ini, jalankan:
```
npm install
```

### 3. Setup Firebase (WAJIB sebelum login bisa jalan)
1. Buka https://console.firebase.google.com, bikin project baru (gratis).
2. Di menu **Build > Authentication**, klik "Get started", aktifin provider **Google**.
3. Di menu **Build > Firestore Database**, klik "Create database", pilih mode production/test terserah dulu.
4. Di menu **Build > Storage**, klik "Get started" (buat nyimpen video contoh nanti).
5. Balik ke **Project Settings** (ikon gear) > scroll ke bawah ke "Your apps" > klik ikon web `</>` > kasih nama app > nanti muncul kode konfigurasi kayak gini:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "nama-project.firebaseapp.com",
     projectId: "nama-project",
     storageBucket: "nama-project.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   }
   ```
6. Copy semua nilai itu, paste ke file `src/firebase.js`, ganti bagian yang masih tulisan
   `GANTI_DENGAN_...`.
7. Di file yang sama, ganti `ADMIN_EMAIL` jadi email Gmail kamu sendiri — ini yang
   nentuin akun mana yang bisa buka Panel Admin nanti.

### 4. Jalanin project
```
npm run dev
```
Nanti muncul link kayak `http://localhost:5173`, buka di browser.

## Struktur folder
```
src/
  firebase.js          <- config Firebase (WAJIB diisi)
  context/AuthContext.jsx   <- ngurus status login & cek admin
  components/
    ProtectedRoute.jsx      <- penjaga halaman (butuh login / khusus admin)
    BottomNav.jsx            <- navigasi bawah (Sound / Akun)
  pages/
    Login.jsx
    Home.jsx
    Placeholder.jsx     <- halaman sementara, nanti diganti satu-satu
  data/mockSongs.js      <- data Sound sementara (belum dari database)
  styles/global.css      <- semua styling
```

## Langkah selanjutnya
Kabarin aja mau lanjut ke bagian mana dulu: Grid Preset per Sound, Tampilan Video,
Profil & Favorit, atau Panel Admin Tambah Preset — nanti kita garap satu-satu
biar gampang ditest.
