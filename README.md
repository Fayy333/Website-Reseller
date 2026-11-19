# Holy Store - Website Penjualan Makanan & Minuman Multi-Seller

Website katalog kuliner reseller modern dengan sistem pembayaran **QRIS**, **Upload Bukti Screenshot (SS)**, **Sistem Manajemen Stok Cepat**, **Akses Pengelola Tersembunyi (Anti-Hacking)**, **Pendaftaran Reseller & Pengajuan Produk Otomatis**, dan **Sistem Backup Data**.

> **Nomor WhatsApp Resmi Holy Store**: `085741832972` (Format Internasional: `6285741832972`)

---

## 🔒 Akses Panel Pengelola Tersembunyi (Anti-Hacking)
Untuk mencegah percobaan hacking atau akses sembarangan dari pengunjung publik, **tombol Panel Admin telah dihilangkan sepenuhnya dari tampilan publik**. 

Hanya pemilik / pengelola toko yang dapat membuka panel dengan salah satu cara rahasia berikut:

1. **Klik Logo 4x (Paling Cepat & Praktis)**:
   - Klik logo **Holy Store** di kiri atas navbar sebanyak **4 kali berturut-turut**.
   - Jendela popup PIN keamanan akan otomatis muncul.
2. **Kombinasi Keyboard**:
   - Tekan tombol **`Ctrl + Shift + A`** (atau `Cmd + Shift + A` pada Mac) di keyboard.
3. **Melalui Link URL**:
   - Tambahkan `?admin=true` di akhir URL browser (contoh: `http://localhost:3000/?admin=true`).
4. **Ikon Gembok Rahasia di Footer**:
   - Di bagian paling bawah halaman (footer), di samping tulisan hak cipta `© 2026 Holy Store`, terdapat ikon gembok kecil yang dapat diklik.

> **PIN Default**: `1234` (dapat diubah di tab Pengaturan).

---

## ⚡ Cara Mudah Mengedit Stok Menu

Setelah masuk ke Panel Pengelola, buka tab pertama **"⚡ Kelola Stok Cepat"**:

1. **Ubah Status 1-Klik**:
   - Klik tombol **"Tersedia" / "Habis"** di samping menu.
   - Jika ditandai **"Habis"**, menu di katalog otomatis redup, diberi pita **"STOK HABIS"**, dan tombol "Pesan" dinonaktifkan sehingga pembeli tidak bisa memesan menu kosong tersebut.
2. **Atur Angka Stok**:
   - Gunakan tombol `+` dan `-` atau ketik langsung angka sisa porsi. Jika stok mencapai `0`, status otomatis menjadi Habis.
3. **Tombol Cepat**:
   - Tombol **"Semua Tersedia"**: Mengaktifkan semua menu sekaligus.
   - Tombol **"Semua Habis"**: Menandai semua menu habis (misal saat toko tutup).

## 🧾 Memantau Pesanan & Bukti Pembayaran

Panel admin menggunakan beberapa tab dalam satu dashboard. Pilih tab dari navigasi atas dan gunakan **"Kembali ke Dashboard"** untuk kembali ke ringkasan kapan saja.

1. **Ringkasan Admin** menampilkan jumlah pesanan hari ini, belum ditangani, pembayaran terverifikasi, penjualan minggu berjalan, dan tombol ekspor CSV/notifikasi.
2. **Pesanan Hari Ini** menampilkan daftar pesanan yang dapat dicari dan difilter. Klik **"Lihat Bukti SS"**, cocokkan nominal, lalu pilih **"Bukti cocok — verifikasi & proses"** untuk mencatat admin/waktu verifikasi QRIS sekaligus mengubah status menjadi **Sedang Diproses**.
3. **Edit Menu** memungkinkan admin memperbarui nama, kategori, harga, harga coret, deskripsi, dan gambar, serta menambah atau menghapus menu.
4. **Edit Stok** mengubah jumlah stok menggunakan tombol `+`/`-`, angka langsung, dan status tersedia/habis; tab ini menampilkan riwayat stok.
5. **Tambah Stok** mencatat stok masuk berdasarkan menu, jumlah, dan catatan opsional.
6. Nama admin pada ringkasan dicatat sebagai pihak yang menangani/verifikasi. Ekspor CSV hanya menghitung pembayaran terverifikasi dan pesanan yang tidak dibatalkan.
7. Aktifkan notifikasi browser pada Ringkasan Admin untuk pemberitahuan pesanan baru saat izin browser diberikan.

Pesanan, bukti SS, dan riwayat stok tersimpan di browser yang digunakan untuk checkout. Notifikasi antar-tab hanya tersedia pada browser dan origin yang sama; sinkronisasi lintas perangkat memerlukan backend/database.

---

## 🛡️ Solusi Backup & Mitigasi Apabila Website Down

Jika website Anda mengalami kendala atau hosting down, berikut strategi pengamanan dan pemulihan:

### 1. Backup Data Berkala (Fitur Bawaan Website)
- Masuk ke Panel Pengelola > Tab **"💾 Backup & Pulihkan"**.
- Klik tombol **"Unduh File Backup Sekarang"**.
- Sistem akan mengunduh file `.json` berisi seluruh katalog menu, stok terbaru, mitra seller, dan riwayat pesanan.
- Jika berganti perangkat / browser ter-reset, cukup klik **"Pilih File Backup JSON"** untuk memulihkan seluruh data dalam 1 detik.

### 2. Multi-Hosting Gratis & Anti-Down (Uptime 99.99%)
Karena website ini dibuat murni menggunakan teknologi statis (HTML, CSS, JS), website ini **tidak memerlukan database server SQL yang berat**, sehingga sangat tahan banting:
- **Deploy ke GitHub Pages** (100% Gratis, server global Microsoft/GitHub).
- **Deploy ke Vercel / Netlify** (100% Gratis, CDN global berkecepatan tinggi, tidak pernah down karena kehabisan RAM).
- Anda dapat membuat 2 link (misal link utama di Vercel, link cadangan di GitHub Pages).

### 3. Backup Offline di Laptop / HP
- Seluruh folder website ini dapat dijalankan langsung secara **offline tanpa internet** cukup dengan mengklik ganda file `index.html`.
- Jika server online down, Anda tetap dapat membuka katalog di laptop/HP lokal untuk melayani pesanan manual.

### 4. Saluran Cadangan Darurat (Fallback WhatsApp)
- Semua pesanan pelanggan terformat otomatis untuk dikirim ke nomor WhatsApp Anda.
- WhatsApp tidak melampirkan gambar dari formulir secara otomatis. Setelah nota terbuka, pelanggan perlu mengunduh bukti screenshot dari halaman konfirmasi lalu melampirkannya sendiri di chat sebelum mengirim pesan.
- Jika website down, Anda dapat langsung mengarahkan pelanggan ke Katalog WhatsApp Business Anda dengan format pemesanan yang sama.

---

## 🤝 Fitur Pendaftaran Reseller & Pengajuan Produk Baru

Calon mitra atau reseller dapat langsung mendaftar sekaligus mengajukan produk makanan/minuman mereka:

1. **Tombol "Daftar Reseller"**:
   - Terletak di navigasi atas (navbar) dan banner utama (hero section).
2. **Formulir Pendaftaran & Pengajuan Menu**:
   - Nama lengkap, nomor WhatsApp aktif, kota domisili, dan tipe kemitraan.
   - **Subform Menu yang Diajukan**: Calon mitra dapat menginput nama menu, kategori (Makanan / Minuman), harga jual, deskripsi, dan link foto.
   - Tersedia tombol **"+ Menu Lain"** jika calon mitra ingin mengajukan lebih dari 1 produk sekaligus!
3. **Pemberitahuan Otomatis via WhatsApp**:
   - Setelah formulir dikirim, format pendaftaran lengkap beserta daftar produk & harga yang diajukan otomatis terbuka di WhatsApp ke nomor Anda.
4. **Fitur "ACC & Upload ke Katalog" (1-Klik)**:
   - Di Panel Pengelola (klik logo 4x) > Tab **"👥 Pendaftar Reseller"**, Anda dapat melihat data calon mitra beserta produk yang diajukan.
   - Jika Anda menyetujui produk tersebut, cukup klik tombol **"✅ ACC & Upload ke Katalog"**.
   - Sistem akan **otomatis membuatkan profil mitra baru** dan **menerbitkan seluruh menu yang diajukan ke katalog Holy Store** secara instan!
   - Terdapat konfirmasi untuk langsung mengabari calon mitra via WhatsApp bahwa produk mereka sudah resmi tayang di website.

---

## 📁 Struktur File
```
website jualan/
├── index.html        # Halaman katalog, modal QRIS, upload SS, & panel stok rahasia
├── server.js         # HTTP server lokal ringan (Node.js)
├── README.md         # Dokumentasi petunjuk penggunaan & backup
├── css/
│   └── style.css     # Styling tampilan modern, responsif & animasi
└── js/
    ├── data.js       # Data awal menu, stok default, dan mitra seller
    └── app.js        # Logika katalog, keranjang, stok real-time, backup JSON, & WhatsApp
```
