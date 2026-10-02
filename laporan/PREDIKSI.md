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

## P-03: Pemformat angka dibuat ulang disetiap panggilan

**Tiket terkait:** TK-1041, TK-1057 (render setelah voucher), TK-1081 (render awal)

**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** di task awal 88 detik, 'formatRupiah' memakan 9.710 ms self dan 'formatRibuan' memakan 1.868 ms self Micro-benchmark CPU 4x ('uji-dugaan.mjs'): 3000x 'formatRupiah' = 1.161-4.036 ms (Inisialisasi data locate ICU). Setelah P-02, pengukuran awal saat laptop masih memakai baterai: selama S1 'formatRupiah'masih 276,5 ms self dari 12 kali render kartu
- **Dugaan mekanisme:** 'formatRupiah' memanggil 'new Intl.NumberFormat ('id-ID', {...}') di setiap panggilan. Konstruktor melakukan negosiasi locale, membaca data ICU, dan membangun objek performat. Hasilnya dibuang setelah satu kali 'format()', 'Number.prototype.toLocaleString('id-ID')' (rating,jumlah terjual, ringkasan) juga membuat performa baru setiap kali. Semuanya kerja Javascrip sinkron di dalam task render, jadi memperpanjang task yang memproses setiap ketikan (tahap JS pada pipeline, sebelum Style/Layout)
- **Rencana perubahan:** pada 'util.js' membuat dua performat sekali saat rupiah dan angka biasa. 'formatRupiah', 'formatRibuan', dan fungsi baru 'formatAngka' memakai performat itu. Semua 'toLocaleString('id-ID')' di kode aplikasi diganti 'formatAngka'. Kesetaraan keluaran diuji menghasilkan teks identik.
- **Prediksi terukur:**

1. Biaya pemformatan perkartu turun dari -+ 1,3 ms menjadi -+0,01 ms (CPU 4x). Per render 24 kartu, sekitar 60-100 ms hilang dari task ketikan S1 dan dari task render awal S0.
2. Belum Cukup membawa INP S1 ke bawah 200 ms, karena yang dominan setelah P-02 adalah layout paksanya 'samakanTinggiJudul' yang memakan waktu -+3,2 detik per skenario, P-04.
3. Efek samping yang mungkin terjadi adalah biaya dari inisialisasi ICU (selama -+ 190 ms) pindah ke saat modul 'util.js' dievaluasi. Waktu totalnya sama, hanya terjadi lebih awal sebelum produk tiba.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**

1. Memformat angka secara manual dengan regex pemisah ribuan memang lebih cepat tetapi rawan salah locate dan karena mata uangnya. Keuntungannya kecil dibanding pemformat yang disimpan.
2. Memoisasi string per nilai harga (Map) dapat menambah memori string dan kompleksitas, sedangkan 'format()' pada performat tersimpan sudah -+ 5 microsecond.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

## P-04: Memaksa layout sinkron 24 kali per render

**Tiket terkait:** TK-1041, TK-1081
**Tanggal dan hash commit entri ini:** 2-10-2026

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** di task render awal 88 detik, 'samakanTinggiJudul' memakan 38.009 ms (total). Di dalamnya ada 24 event Layout yang dipicu dari 'katalog.js:73' ('j.offsetHeight') dengan total 31.105 ms, -+,3 detik per layout karena setiap layout menata grid 3000 kartu. Setelah P-02(trace `diagnosis-S1-setelah-P-02.json.gz`, pengukuran awal saat laptop masih memakai baterai):`samakanTinggiJudul` masih 3.207 ms self selama S1 (12 render × 24 kartu), atau -+53% dari waktu penanganan input. Ada 403 Layout paksa di skenario itu.
- **Dugaan mekanisme:** Layout thrashing. Loop menulis 'j.style.height = 'auto''(layout menjadi kotor), lalu langsung membaca 'j.offsetHeight'. Pembacaan geometri ketika layout kotor memaksa browser menjalankan tahap Style + Layout secara sinkron di tengah JavaScript. Baris berikutnya menulis 'style.height' lagi (kotor lagi), dan iterasi berikutnya membaca lagi, sehingga terjadi 24 layout paksa per render. Layout yang dipaksa ini tidak menggantikan layout frame; setelah 'judul.forEach(...)' menulis tinggi ke semua judul, frame berikutnya tetap menata ulang. Ada juga bug kebenaran: tinggi diambil dari judul tertinggi di 24 contoh pertama, jadi judul yang lebih panjang terpotong di tengah baris tanpa elipsis ('overflow:hidden').
- **Rencana perubahan:** hapus 'samakanTinggiJudul'dan serahkan pada CSS. '.kartu-judul' memakai '-webkit-line-clamp: 3' (plus 'line-clamp') dengan 'min-height' setinggi 3 baris. Semua judul menempati ruang yang sama, sehingga harga dan tombol dalam satu deret tetap sejajar, tanpa satu pun pembacaan layout dari JS. Data sampel 300 produk di 412 px: 7,7% judul 1 baris, 71,7% 2 baris, 19% 3 baris, 1,7% 4 baris.
- **Prediksi terukur:**

1. Layout paksa yang berasal dari 'katalog.js' turun dari 24 per render menjadi 0. Sisa layout paksa di S1 datang dari 'periksaGulir' dan timer hitung mundur/teks berjalan ('offsetWidth').
2. Waktu penanganan per ketikan S1 turun sekitar 250 ms (CPU 4x). INP S1 turun ke kisaran 1-2 detik, karena masih ada 'periksaGulir', panggilan SDK per huruf, 'normalkan', dan frame yang berat akibat timer.
3. Efek samping: 1,7% judul (4 baris di layar 412 px) kini terpotong di baris ke-3 dengan elipsis "...". Sebelumnya judul semacam ini terpotong di tempat acak tanpa tanda. Nama lengkap tetap ada di DOM (dibaca oleh pembaca layar) dan di 'alt' gambar.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**

1. Memisahkan baca dan tulis (semua tulis 'auto', baru semua baca, baru semua tulis): tetap 1 layout paksa per render dan tetap bergantung pada 24 contoh.
2. CSS subgrid (baris kartu berbagi track grid): tinggi judul sejajar tepat per deret tanpa memotong, tetapi struktur kartu harus diubah (setiap kartu merentang 6 baris grid) dan lebih sulit dirawat. Layak dipertimbangkan jika tim desain menolak elipsis.
3. Mengukur dengan ResizeObserver lalu menulis tinggi: tidak memaksa layout, tetapi menulis sesudah layout memicu layout kedua dan pergeseran tata letak yang terlihat.

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
