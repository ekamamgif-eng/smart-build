# SmartBuild — Portal Transparansi Proyek & Buku Kas Rumah Ibadah

Sistem manajemen proyek dan pelacakan anggaran transparan berbasis web yang dirancang khusus untuk panitia pembangunan, bendahara, project manager, dan publik/donatur.

---

## Fitur Utama

- **Transparansi Buku Kas Publik**: Pelacakan donasi masuk, mutasi pengeluaran, serta bukti transfer & nota secara terbuka.
- **Manajemen RAB (Rencana Anggaran Biaya)**: Monitoring serapan dana per kategori pekerjaan (Fondasi, Struktur, Kubah/Atap, MEP, Finishing, dll).
- **Progres Fisik & Lini Masa**: Pencatatan kurva kemajuan konstruksi dilengkapi foto dokumentasi lapangan.
- **Integrasi Google Workspace**: Ekspor & sinkronisasi otomatis ke Google Sheets serta arsip bukti nota di Google Drive.
- **Prakiraan Biaya (Cost Forecasting)**: Analisis deviasi anggaran dan proyeksi biaya penyelesaian berbasis data pengeluaran aktual.
- **Keamanan & Audit Trail**: Autentikasi berbasis peran (Admin, Bendahara, Project Manager) dan pencatatan riwayat audit (Audit Log).

---

## Persyaratan Sistem

- **Node.js**: Versi 18 ke atas
- **Database**: PostgreSQL (opsional untuk production, default SQLite/JSON fallback)
- **Cloudinary / Google Drive**: Untuk penyimpanan berkas bukti transfer / foto kemajuan proyek

---

## Menjalankan Secara Lokal

1. **Instal dependensi**:
   ```bash
   npm install
   ```

2. **Siapkan berkas konfigurasi lingkungan**:
   Salin berkas `.env.example` menjadi `.env` lalu sesuaikan isinya:
   ```bash
   cp .env.example .env
   ```

3. **Inisialisasi Prisma Client**:
   ```bash
   npx prisma generate
   ```

4. **Jalankan aplikasi (Development)**:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000` (atau port yang disetel di `.env`).

---

## Build untuk Production

1. **Build bundle frontend & backend**:
   ```bash
   npm run build
   ```

2. **Jalankan production server**:
   ```bash
   npm start
   ```

---

## Lisensi & Hak Cipta

© 2026 SmartBuild Initiative.
