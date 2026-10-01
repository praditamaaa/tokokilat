# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: [judul singkat masalah]

**Tiket terkait:** TK-....
**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** durasi, di track apa, fungsi apa yang dominan di bottom-up.
- **Dugaan mekanisme:** jelaskan memakai istilah event loop (task, microtask, rendering opportunity)
  atau tahap pipeline (JS, Style, Layout, Paint, Composite).
- **Rencana perubahan:** ....
- **Prediksi terukur:** "Setelah perubahan, [metrik] turun dari ... menjadi sekitar ..., karena ...".
  Sertakan juga prediksi efek samping: apa yang mungkin menjadi *lebih buruk*?
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** ....

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

## P-02: Kisi Membangun seluruh 3000 kartu dalam satu task

**Tiket terkait:** TK-1041 (utama), TK-1063, TK-1070, TK-1081
**Tanggal dan hash commit entri ini:** 02-10-2026

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** trace S0 kode awal (ulangan 1, diperpanjang sampai render selesai)
- Memperlihatkan satu task 88.071 ms setelah `/api/produk` tiba
- Isinya (bottom-up, total per fungsi):
- `renderProduk` 76.088 ms, yang terdiri dari `samakanTinggiJudul` 38.009 mas (24 layout paksa, total 31.105 ms),
- `buatKartu` 23.946 ms (`formatRupiah` 9.710 ms, `el` 4.429 ms, `createElement` 1.478 ms), dan `periksaGulir` 13.721 (satu layout paksa 11.721 ms di `window.scrollY`). Ada 30 event layout (43,3 detik) dan 31 Recalculate Style (7,5 detik) di dalam task itu. Setelah P-01 task ini masih 77,9-80,3 detik, dan S6 masih sibuk 94-96% dengan satu layout kurang lebih 2 detik per 10 detik
- **Dugaan mekanisme:** `renderProduk` membuat semua kartu (kurang lebih 15 node per kartu, ± 45.000 node) di satu task
- Selama task berjalan, event loop tidak mengambil task lain, sebanding dengan N: membuat node, `formatRupiah` per kartu, dan setiap layout harus  menata grid 3000 item. Ketika pengguna mengetik di kolom cari, `terapkanSaringan` memanggil `renderProduk` lagi untuk setiap huruf. Menghapus kata kunci artinya membangun ulang setiap frame yang layoutnya kotor (animasi, timer) menata ulang DOM sebesar itu
- **Rencana perubahan:** render bertahap. `renderProduk` hanya membangun 24 kartu pertama (DocumentFragment).Di ujung kisi ada penanda `#ujung-kisi` yang diamati IntersectionObserver dengan rootMargin 1500 px. Saat penanda mendekati layar, 24 kartu berikutnya ditambahkan; observe ulang dipakai supaya batch berikutnya ikut dimuat bila penanda masih dekat. Penanda berisi tombol "Tampilkan 24 produk berikutnya" untuk pengguna keyboard/pembaca layar. Ringkasan tetap menampilkan jumlah hasil total. Voucher me-render ulang sebanyak kartu yang sudah tampil, tidak kembali ke 24.
- **Prediksi terukur:**
- S0: task terlama saat memuat turun dari ±80 detik menjadi **≤ 1,5 detik**. Biaya yang sebanding dengan N turun sekitar 3000/24 = 125 kali (±0,6 detik tersisa), ditambah biaya tetap seperti `pasangKaki` (±0,5 detik karena inisialisasi ICU pada `toLocaleString` pertama).

  - S6: persentase sibuk main thread turun dari ±95% menjadi **≤ 50%**. Layout per frame kini hanya menata 24 kartu, tetapi timer 10 ms dan animasi `top` masih ada (P-06).
  - S1: INP turun dari puluhan detik (setiap huruf = render ulang ratusan sampai 3000 kartu) menjadi **±0,5-1 detik**. Sisanya berasal dari 24 layout paksa `samakanTinggiJudul`, `formatRupiah` baru per kartu, dan panggilan SDK `search` per huruf (41 ms). Belum mencapai 200 ms.
  - Efek samping yang mungkin memburuk: Ctrl+F peramban tidak menemukan produk yang belum dirender; scrollbar tidak lagi mewakili panjang daftar; kaki halaman terus terdorong saat daftar dimuat bertahap; menambah batch saat menggulir bisa memunculkan satu frame lambat.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
- Virtualisasi penuh (hanya ±20 kartu di DOM, didaur ulang saat menggulir): DOM konstan, tetapi butuh tinggi baris tetap dan penempatan absolut, fokus keyboard dan pembaca layar lebih sulit, dan kodenya jauh lebih rumit untuk tugas tanpa framework.
- `content-visibility: auto` pada kartu tanpa render bertahap: layout/paint kartu di luar layar dilewati, tetapi membuat 3000 kartu (JS ±24 detik) tetap terjadi di setiap render.
- Tombol "Muat lebih banyak" saja tanpa pemuatan otomatis: lebih sederhana, tetapi pengguna harus menekan tombol 125 kali untuk menjangkau semua produk dengan menggulir (melanggar semangat aturan 3).

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

## P-08: SDK analitik dipanggil di tengah interaksi, dengan payload riwayat 1,2 MB

**Tiket terkait:** TK-1044, TK-1052, TK-1041, TK-1063
**Tanggal dan hash commit entri ini:** 02-10-2026

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
- micro-benchmark CPU 4x (`uji-dugaan.mjs`): satu `Lacak.kirim` dengan payload kecil = **41-57 ms**, dan dengan payload `add_to_cart` asli (produk + keranjang + riwayat 9000 entri, **1.228.826 byte**) = **371-407 ms**. Uji fungsional mencatat payload `add_to_cart` 1.228.959 byte dan `begin_checkout` 1.229.489 byte. Setelah P-02 (trace `diagnosis-S1-setelah-P-02.json.gz`, pengukuran awal saat laptop masih memakai baterai): fungsi `f` di `lacak.min.js` memakan **630 ms self** selama S1, karena event `search` dikirim di setiap huruf. Setelah P-06 impresi dikirim per batch IntersectionObserver, dan setiap batch tetap membayar ±41 ms.
- **Dugaan mekanisme:**
- `Lacak.kirim()` sinkron. Di setiap panggilan SDK menghitung ulang sidik jari perangkat (`f`: loop 2.000.000 iterasi `Math.imul`, tidak pernah disimpan), men-`JSON.stringify` payload, lalu menghitung tanda tangan (`t`: 12 putaran atas seluruh string JSON). Biayanya tetap ±41 ms plus sebanding dengan ukuran payload. Kode aplikasi memanggilnya di dalam task interaksi: handler `input` (per huruf), handler klik"+ Keranjang" dan "Beli sekarang" (dengan riwayat utuh), dan callback gulir. Browser baru bisa menggambar umpan balik setelah task itu selesai, jadi biaya SDK langsung masuk ke INP. SDK tidak boleh diubah, tetapi *cara, waktu, dan isi data* saat memanggilnya boleh.
- **Rencana perubahan:**
- Event diantrekan dan dikirim **satu per satu di waktu senggang** (`requestIdleCallback`, timeout 3 detik,
  cadangan `setTimeout`). Antrean dikuras sinkron saat `pagehide`/`visibilitychange: hidden` supaya tidak ada event hilang.
- **Prediksi terukur:**
- S2: ±370-400 ms keluar dari task klik. INP S2 turun ke **±200-300 ms**. Sisanya `JSON.parse` riwayat (±79 ms), `JSON.stringify` (±42 ms), dan `localStorage.setItem` 1,2 MB (±41 ms) yang masih berjalan sebelum umpan balik (P-09).
- S1: setiap huruf lebih ringan ±41-57 ms (tidak ada SDK per huruf). S5: tidak ada panggilan SDK di callback gulir, jadi frame > 50 ms turun.
- S3: `begin_checkout` 1,2 MB keluar dari jalur klik (masalah pesanan ganda sendiri ditangani P-10).
- Efek samping: event sampai ke SDK 0-3 detik lebih lambat. Di waktu senggang masih ada task ±41-57 ms per event (biaya tetap SDK). Task ini tidak di jalur interaksi, tetapi bisa menunda satu frame bila jatuh tepat sebelum vsync. Tim data kehilangan riwayat lengkap per event (riwayat tetap tersimpan utuh di `localStorage`). Ini perlu disepakati dengan tim data.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** 

- Menjalankan SDK di Web Worker: SDK menulis ke `window.Lacak` dan membaca `navigator`/`screen` di main thread, dan berkas vendor tidak boleh diubah atau dibungkus ulang.
- `setTimeout(0)` setelah umpan balik: memindahkan biaya keluar dari task klik, tetapi task berikutnya tetap bisa menahan input atau frame berikutnya. Waktu senggang lebih tepat untuk kerja yang tidak mendesak.
- `scheduler.postTask({ priority: 'background' })`: bagus, tetapi belum ada di semua browser target (Safari).

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....
