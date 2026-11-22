# NoAdsPlayer - Pemutar Video Bebas Iklan & Popup

Website berbasis **Next.js 16 (App Router)** & **Tailwind CSS** untuk memutar video dari berbagai link/website yang penuh dengan popup, popunder, click-jackers, dan redirect iklan berbahaya.

---

## 🚀 Fitur Utama

1. **Direct Video Stream Extraction**:
   - Backend Next.js (`/api/extract`) secara otomatis membongkar halaman target untuk mencari direct stream URL (`.mp4`, `.webm`, `.m3u8` / HLS).
   - Didukung oleh `yt-dlp` & custom HTML/script parser (JWPlayer / VideoJS / Dean Edwards Unpacker) yang mendukung ribuan platform video.

2. **Custom HTML5 & HLS Video Player**:
   - Pemutar video kustom dengan dukungan HLS streaming adaptif (`hls.js`).
   - Kontrol lengkap: Play/Pause, Seek bar, Kecepatan (0.5x - 2x), Volume & Mute, Pemilihan Kualitas resolusi, Fullscreen.
   - Tombol **Salin Link Stream** dan **Download Video**.

3. **Sandboxed Ad-Shield Player (Fallback Kebal Iklan)**:
   - Jika video terenkripsi atau membutuhkan player bawaan web aslinya, website ini membungkusnya dalam iframe dengan atribut `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"` tanpa izin `allow-popups` dan `allow-top-navigation`.
   - **Hasil**: 99% iklan popunder, tab judi yang terbuka otomatis, dan redirect ke situs lain diblokir langsung di level browser!

4. **Anti-CORS Stream Proxy**:
   - Dilengkapi route `/api/proxy` untuk meneruskan stream jika hosting video membatasi header CORS / Referer.

5. **Riwayat Tontonan & Quick Paste**:
   - Tombol satu klik **Paste dari Clipboard**.
   - Menyimpan riwayat link terakhir di browser (`localStorage`).
   - Tersedia preset demo link untuk testing langsung.

---

## 🛠️ Cara Menjalankan

1. Buka terminal di folder project:
   ```bash
   npm run dev
   ```
2. Buka browser di [http://localhost:3000](http://localhost:3000).
3. Paste link video apa saja yang penuh iklan, lalu klik **"Putar Tanpa Iklan"**!
# gxyervideo
