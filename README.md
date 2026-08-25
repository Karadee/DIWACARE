# DIWACARE

**Perawatan dan Penilaian Luka Digital** — alat bantu dokumentasi, pemantauan, dan edukasi luka kaki diabetik.

Aplikasi web satu halaman tanpa kerangka kerja apa pun: HTML, CSS, dan JavaScript murni. Tidak ada proses *build*, tidak ada `npm install`, dan tidak ada server di belakangnya. Seluruh data tersimpan di peramban pengguna.

---

## Apa yang bisa dilakukan

| Sisi pasien | Sisi tenaga kesehatan |
|---|---|
| Daftar akun dan masuk | Daftar akun profesi dan masuk |
| Janji temu wajib dibuat sebelum asesmen pertama | Kotak masuk asesmen dan konsultasi, bertambah tanpa memuat ulang halaman |
| Kamera terpandu dengan tombol ganti kamera depan/belakang | Ruang tinjauan asesmen: foto, hasil analisis, dan keluhan dalam satu layar |
| Alat ukur dua titik dengan kalibrasi benda acuan | Menulis surat analisis, lalu memilih **Aman** atau **Rujukan** |
| Analisis citra luka di perangkat | Ruang konsultasi janji temu: resep, penjelasan klinis, saran, tindak lanjut |
| Status tiap dokumentasi: Menunggu tinjauan → Aman atau Dirujuk | Daftar pasien dengan penyaring dan pencarian |
| Menghapus dokumentasinya sendiri kapan pun | Rincian rekam pasien lengkap |
| Grafik tren luas luka dan pembanding sebelum–sesudah | Pembanding foto antar-sesi |
| Janji temu daring atau tatap muka, dengan pembayaran simulasi | Catatan klinis otomatis dari setiap tinjauan |
| Runtutan dokumentasi mingguan | Jadwal harian, mingguan, bulanan |
| Suara pemberitahuan saat waktunya asesmen dan saat jadwal terpasang | Ubah atau batalkan janji temu |
| Cek faktor risiko tujuh pertanyaan | |
| Edukasi: 21 bacaan bersumber, 20 kartu obat, 25 soal kuis, 4 peragaan | |

Ditambah mode gelap, kontras tinggi, perbesar teks, kurangi animasi, dan tata letak yang bekerja dari layar 320 px sampai desktop.

---

## Menjalankan di komputer sendiri

> **Penting:** jangan membuka `index.html` dengan klik ganda. Kamera hanya diizinkan peramban pada `https://` atau `http://localhost`, sehingga lewat `file://` fitur kameranya tidak akan menyala.

### Cara paling cepat — ekstensi VS Code

1. Buka folder proyek ini di Visual Studio Code.
2. Pasang ekstensi **Live Server** (Ritwick Dey).
3. Klik kanan `index.html` → **Open with Live Server**.

### Alternatif — server bawaan

```bash
# Python (sudah ada di kebanyakan komputer)
python -m http.server 8000

# atau Node.js
npx serve .
```

Lalu buka `http://localhost:8000` di peramban.

---

## Struktur berkas

```
diwacare/
├── index.html                    Kerangka halaman, kumpulan ikon, pemanggilan skrip
├── assets/
│   ├── css/
│   │   └── gaya.css              Seluruh gaya dan token warna terang/gelap
│   └── js/
│       ├── 01-inti.js            Penyimpanan, sesi, tanggal, sandi, toast, modal, suara, runtutan
│       ├── 02-navigasi-dan-akun.js  Pengarah halaman, validasi, pendaftaran, masuk
│       ├── 03-kerangka.js        Navigasi, grafik, kalender, janji temu
│       ├── 04-pasien-beranda.js  Beranda pasien, Luka Saya, cek faktor risiko
│       ├── 05-pasien-asesmen.js  Kamera, alat ukur, analisis citra, janji temu, edukasi interaktif
│       ├── 06-tenaga-kesehatan.js Beranda nakes, kotak masuk dan ruang konsultasi, pasien, jadwal
│       └── 07-profil-dan-mulai.js Profil, pengaturan tampilan, titik mulai aplikasi
├── README.md
├── LICENSE
├── .gitignore
└── .nojekyll                     Agar GitHub Pages menyajikan berkas apa adanya
```

**Urutan pemuatan skrip tidak boleh diubah.** Setiap berkas memakai fungsi yang disiapkan berkas sebelumnya lewat objek global `window.DW` dan beberapa pembantu `window.DW*`.

---

## Cara kerja bagian pentingnya

### Analisis citra

Berjalan sepenuhnya di peramban, tanpa pustaka luar dan tanpa pengiriman data. Berkas: `05-pasien-asesmen.js`, fungsi `analyzePixels()`.

1. Foto digambar ke `<canvas>` berukuran 180 × 180.
2. Kecerahan rata-rata dan energi tepi dihitung untuk menilai mutu foto.
3. Warna kulit acuan diambil dari nilai tengah kemerahan pada pinggir bingkai.
4. Piksel di dalam oval panduan ditandai sebagai luka bila memenuhi salah satu syarat: lebih merah daripada kulit acuan, kekuningan pada rentang rona 32–68°, atau gelap.
5. Bintik terisolasi dibuang, lalu luas dihitung dari proporsi piksel terhadap luas bidang pandang.

Penilaian statusnya memakai aturan yang ditulis eksplisit di fungsi `tentukanIndikator()`, dan setiap penanda selalu menyebutkan alasannya sendiri di antarmuka. Salah satu aturannya mengikuti ambang prognostik yang lazim dipakai dalam literatur luka: penyusutan kurang dari 50% pada minggu keempat menjadi penanda untuk meninjau ulang rencana perawatan.

### Alat ukur dan kalibrasi

Pengguna menggeser tanda silang ke satu ujung luka, menekan tombol **+**, lalu menggeser ke ujung satunya dan menekan **+** sekali lagi.

Agar angkanya berarti, tab **Kalibrasi** meminta pengguna menandai kedua tepi benda acuan yang diletakkan di samping luka. Ukuran resmi yang dipakai:

| Benda acuan | Ukuran |
|---|---|
| Uang logam Rp1.000 | garis tengah 24,1 mm |
| Uang logam Rp500 | garis tengah 27,0 mm |
| Kartu ATM atau KTP | sisi panjang 85,6 mm |

Hasil kalibrasi disimpan sebagai `cmPerLebar`, yaitu berapa sentimeter yang diwakili oleh lebar penuh foto. Nilai ini juga dipakai untuk memperbaiki perhitungan luas, bukan hanya panjang. Bila belum dikalibrasi, aplikasi tetap memberi angka tetapi menandainya sebagai perkiraan.

### Setiap asesmen selalu ada yang membacanya

Ini yang membedakan alurnya dari sekadar aplikasi pencatat.

1. **Janji temu dulu.** Halaman Asesmen tidak langsung membuka alur pemotretan. Selama pasien belum terhubung dengan satu tenaga kesehatan, yang tampil adalah layar gerbang berisi tiga langkah dan tombol menuju Janji Temu. Alasannya dijelaskan terus terang di layar itu: DIWACARE tidak menilai luka sendirian.
2. **Kirim dokumentasi.** Setelah terhubung, alur lima langkah terbuka. Asesmen yang tersimpan berstatus **Menunggu tinjauan**.
3. **Muncul di dashboard dokter.** Nama pasien, foto kecil, luas terukur, dan status indikatornya langsung tampil di beranda tenaga kesehatan serta di tab **Asesmen baru** — tanpa memuat ulang halaman.
4. **Dokter menulis surat.** Di ruang tinjauan, tenaga kesehatan melihat foto, hasil analisis piksel, komposisi warna, keluhan yang dipilih pasien, dan pembanding dengan dokumentasi sebelumnya. Lalu menulis catatan analisis dan anjuran perawatan.
5. **Dua keputusan, bukan satu.**
   - **Kirim — tandai aman** → status pasien menjadi **Aman**, perawatan di rumah dilanjutkan.
   - **Terbitkan surat rujukan** → tenaga kesehatan mengisi tujuan rujukan, tingkat kecepatan (hari ini juga / 1–3 hari / 1–2 minggu), dan alasannya. Status pasien menjadi **Dirujuk**, dan surat bernomor muncul di beranda mereka.
6. **Pasien bisa menghapus.** Dokumentasi itu milik pasien. Setiap baris riwayat punya tombol hapus, konfirmasinya menyebutkan apa saja yang ikut hilang, dan angka perbandingan antar-sesi dihitung ulang setelahnya.

Isi surat tidak pernah disarankan aplikasi. Seluruhnya diketik tenaga kesehatan.

### Bila tenaga kesehatannya belum memakai DIWACARE

Direktori bawaan berisi lima tenaga kesehatan yang belum tentu punya akun di aplikasi ini. Alurnya tidak dibiarkan menggantung, dan tidak pula dipalsukan:

- **Janji temu** dikonfirmasi otomatis oleh sistem penjadwalan aplikasi, dan hal itu dinyatakan di layar konfirmasi sebelum pasien mengirim.
- **Asesmen** tidak mendapat surat palsu. Beranda pasien menampilkan catatan jujur bahwa tenaga kesehatan yang dipilih belum memakai aplikasi ini, disertai tombol menuju Luka Saya agar grafiknya bisa ditunjukkan langsung saat kunjungan.

### Konsultasi dari sisi pasien sampai sisi dokter

Alurnya satu jalur dan seluruhnya berjalan di dalam peramban:

1. Pasien memilih tenaga kesehatan, lalu memilih **konsultasi daring** atau **tatap muka** — masing-masing punya tarif berbeda.
2. Pasien memilih tanggal dan jam, menulis keluhannya, dan boleh melampirkan asesmen luka terakhir beserta fotonya.
3. Layar pembayaran muncul. **Pembayaran ini simulasi**: tidak ada uang yang berpindah, tidak ada nomor kartu yang diminta, dan tidak ada permintaan jaringan. Bagian ini hanya memperagakan alur layanan.
4. Setelah dikirim, statusnya menjadi **Menunggu**.
5. Di sisi tenaga kesehatan, permintaan itu **langsung muncul tanpa memuat ulang halaman**. Sinkronisasinya memakai `BroadcastChannel` dan peristiwa `storage`, jadi tab lain di peramban yang sama ikut memperbarui tampilannya.
6. Tenaga kesehatan membaca keluhan, melihat foto luka, dan membaca hasil analisisnya, lalu menulis penjelasan klinis, resep, saran perawatan, dan tindak lanjut. Isi resep tidak pernah disarankan aplikasi — seluruhnya diketik manusia.
7. Setelah tombol **Kirim** ditekan, status berubah menjadi **Berhasil**, janji temu pindah ke menu **Riwayat** pasien, pemberitahuan dikirim ke pasien dan ke tenaga kesehatan lain yang menangani pasien yang sama, dan catatan klinisnya ikut tersimpan pada rekam pasien.

Bila tenaga kesehatan yang dipilih berasal dari direktori bawaan dan belum memakai DIWACARE, permintaannya tidak dibiarkan menggantung: sistem penjadwalan aplikasi mengonfirmasi jadwalnya secara otomatis, dan hal itu dinyatakan terus terang pada layar konfirmasi.

### Suara pemberitahuan

Nada dibangkitkan langsung oleh peramban lewat `AudioContext`, tanpa berkas audio sama sekali. Ada empat nada pendek: pemberitahuan, keberhasilan, pengingat, dan pengiriman. Bunyinya muncul saat waktunya asesmen baru, saat jam temu terjadwal, saat jawaban konsultasi dikirim, dan saat jawaban kuis benar. Sakelarnya ada di **Profil → Tampilan & kemudahan akses**, lengkap dengan tombol untuk mencoba nadanya. Masing-masing pengingat hanya berbunyi sekali per hari agar tidak berubah menjadi gangguan.

### Runtutan dokumentasi

Satu minggu dianggap terpenuhi bila ada minimal satu dokumentasi luka pada minggu itu, dihitung dari hari Senin. Kartunya menampilkan runtutan berjalan, rekor terpanjang, total dokumentasi, delapan minggu terakhir dalam bentuk titik, dan tonggak berikutnya. Perhitungannya ada di `01-inti.js`, fungsi `hitungRuntutan()`.

### Edukasi interaktif

Empat bagian dalam satu halaman:

- **Bacaan** — 21 topik dalam enam kategori: Dasar Biologi, Diabetes & Luka, Pemantauan, Pencegahan, Hidup Sehari-hari, dan Panduan DIWACARE. **Setiap bacaan mencantumkan sumbernya** di bagian bawah.
- **Kartu obat** — 20 kartu yang dibalik dengan sekali ketuk: obat diabetes, pelindung pembuluh, cairan dan antiseptik, lima jenis balutan, obat infeksi dan gejala, dua tindakan, serta dua alat pemeriksaan. Urutannya tetap, dan tiap kartu dilewati lewat tiga langkah berurutan yang saling mengunci:

  1. Kartu dibalik dulu — tombol **Sudah Paham** masih mati sampai sisi belakangnya benar-benar dibuka.
  2. **Sudah Paham** ditekan — kartu tercatat, bilah kemajuan naik, dan tombolnya berubah menjadi *Sudah ditandai*.
  3. Barulah **Lanjut** hidup dan membuka kartu berikutnya.

  Kartu yang sudah dilalui tidak muncul lagi, sehingga materinya benar-benar dibaca sekali dengan sungguh-sungguh. Petunjuk *ketuk untuk membalik* hanya ada di sisi depan agar tidak menimpa penjelasan di sisi belakang, dan tinggi kartu mengikuti sisi yang isinya paling panjang sehingga tidak ada teks yang terpotong. Setelah semuanya selesai, seluruh kartu bisa dibuka kembali sebagai arsip. **Tidak ada dosis di mana pun**, karena dosis adalah wewenang tenaga kesehatan yang memeriksa langsung.
- **Kuis** — 10 pertanyaan diambil acak dari 25 soal, dengan posisi jawaban benar yang tersebar merata, sehingga tiap putaran berbeda. Setiap jawaban langsung dijelaskan, benar maupun salah, dan skor terbaiknya tersimpan.
- **Peragaan** — animasi SVG langkah demi langkah untuk memotret, mengukur, kalibrasi, dan membaca tren. Dibangun di dalam aplikasi, bukan berkas video, sehingga tetap berjalan tanpa internet.

#### Sumber materi

Isi bacaan, kartu, dan soal disusun dari:

| Sumber | Dipakai untuk |
|---|---|
| IWGDF Practical Guidelines on the prevention and management of diabetes-related foot disease, pembaruan 2023 | Stratifikasi risiko 0–3 dan jadwal periksanya, lima pilar pencegahan, perawatan kaki mandiri, spesifikasi alas kaki, klasifikasi SINBAD, kriteria infeksi IWGDF/IDSA, ambang PAD, kriteria rujukan |
| IWGDF Guidelines on offloading foot ulcers in persons with diabetes, pembaruan 2023 | Urutan pilihan alat pelega tekanan |
| Physiology of Wound Healing dan Wound Healing Phases, StatPearls (NCBI Bookshelf) | Empat fase penyembuhan, sel yang berperan, pergantian kolagen tipe III ke tipe I, kekuatan tarik akhir sekitar 80% |
| Diabetic peripheral neuropathy: pathogenetic mechanisms and treatment, Frontiers in Endocrinology (2023) | Jalur poliol, AGE–RAGE, PKC, hexosamine, stres oksidatif, iskemia vasa nervorum |
| American Diabetes Association, Standards of Care in Diabetes | HbA1c sebagai rata-rata dua sampai tiga bulan, sasaran yang bersifat perorangan |
| Kementerian Kesehatan RI, artikel perawatan kaki penyandang diabetes | Tiga faktor penyebab kaki diabetik dan anjuran senam kaki |

### Penyimpanan

Seluruh data disimpan pada `localStorage` dengan kunci `diwacare.data.v2`. Struktur datanya:

```
users, patients, professionals, wounds, assessments,
timeline, appointments, reminders, notifications, notes
```

Foto dikecilkan ke lebar maksimum 720 px dan disimpan sebagai JPEG kualitas 0,78 agar tidak cepat memenuhi kuota peramban.

### Sesi dan kata sandi

Sesi masuk hanya hidup di memori, jadi memuat ulang halaman selalu mengembalikan pengguna ke layar masuk. Kata sandi disimpan sebagai hash SHA-256 bersalt melalui Web Crypto API, tidak pernah sebagai teks polos.

---

## Menerbitkan ke GitHub Pages

```bash
git init
git add .
git commit -m "DIWACARE versi awal"
git branch -M main
git remote add origin https://github.com/NAMA-ANDA/diwacare.git
git push -u origin main
```

Lalu di halaman repositori: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `root` → Save.**

Beberapa menit kemudian aplikasi tersedia di `https://NAMA-ANDA.github.io/diwacare/`. Karena GitHub Pages memakai HTTPS, fitur kameranya berfungsi penuh di sana.

---

## Dukungan peramban

Chrome, Edge, Firefox, dan Safari versi terkini. Fitur yang dipakai: `getUserMedia`, Canvas 2D, `crypto.subtle`, `localStorage`, `IntersectionObserver`, dan `visualViewport`. Bila kamera tidak tersedia atau izinnya ditolak, aplikasi otomatis menawarkan pengambilan foto lewat kamera bawaan perangkat atau pemilihan berkas dari galeri.

---

## Batasan

Aplikasi ini adalah purwarupa penelitian, bukan alat kesehatan bersertifikat.

- Perkiraan luas dan panjang luka bukan pengukuran klinis.
- Status pemantauan disusun dari aturan sederhana yang tertulis di kode, bukan hasil pembelajaran mesin, dan bukan diagnosis.
- Model warna belum diuji lintas tipe kulit maupun kondisi pencahayaan yang beragam.
- Hash sandi di sisi peramban memadai untuk purwarupa, tetapi tidak setara dengan sistem autentikasi produksi.
- Data hanya ada di satu peramban pada satu perangkat. Membersihkan data situs akan menghapusnya permanen.
- Pembayaran pada menu janji temu adalah simulasi. Tidak ada transaksi, penyedia pembayaran, maupun tagihan nyata.
- Isi kartu obat adalah pengenalan umum, bukan petunjuk pemakaian. Dosis dan aturan pakai selalu ditentukan tenaga kesehatan.
- Status **Aman** dan **Dirujuk** ditetapkan oleh manusia, bukan oleh aplikasi. DIWACARE hanya menyalurkan dan menyimpannya.

**DIWACARE tidak menggantikan pemeriksaan, penilaian, atau diagnosis oleh tenaga kesehatan.**

---

## Lisensi

MIT — lihat berkas [LICENSE](LICENSE).
