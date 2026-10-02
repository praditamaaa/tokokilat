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

- **Yang teramati di trace (baseline):** di task awal 88 detik, 'formatRupiah' memakan 9.710 ms self dan 'formatRibuan' memakan 1.868 ms self Micro-benchmark CPU 4x
- **Dugaan mekanisme:** 'formatRupiah' memanggil 'new Intl.NumberFormat ('id-ID', {...}') di setiap panggilan. Konstruktor melakukan negosiasi locale, membaca data ICU, dan membangun objek performat. Hasilnya dibuang setelah satu kali 'format()', 'Number.prototype.toLocaleString('id-ID')' (rating,jumlah terjual, ringkasan) juga membuat performa baru setiap kali. Semuanya kerja Javascrip sinkron di dalam task render, jadi memperpanjang task yang memproses setiap ketikan (tahap JS pada pipeline, sebelum Style/Layout)
- **Rencana perubahan:** pada 'util.js' membuat dua performat sekali saat rupiah dan angka biasa. 'formatRupiah', 'formatRibuan', dan fungsi baru 'formatAngka' memakai performat itu. Semua 'toLocaleString('id-ID')' di kode aplikasi diganti 'formatAngka'. Kesetaraan keluaran diuji menghasilkan teks identik.
- **Prediksi terukur:**

1. BIaya pemformatan perkartu turun dari -+ 1,3 ms menjadi -+0,01 ms (CPU 4x). Per render 24 kartu, sekitar 60-100 ms hilang dari task ketikan S1 dan dari task render awal S0.
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


## P-05: Pencarian menormalkan ulang teks 3000 produk di setiap huruf

**Tiket terkait:** TK-1041
**Tanggal dan hash commit entri ini:** 30-09-2026, hash dicatat di bagian "Sesudah"

### Sebelum perbaikan

- **Yang teramati di trace:** setelah P-02 (trace `diagnosis-S1-setelah-P-02.json.gz`, pengukuran awal saat laptop
  masih memakai baterai), `normalkan` di `pencarian.js` memakan **389 ms self** selama S1 (12 ketikan, ±32 ms per
  ketikan). Micro-benchmark CPU 4x: menyaring 3000 produk dengan kata "sepatu" = **26,5 ms** bila teks
  dinormalkan ulang, **4,6 ms** bila teks sudah dinormalkan sebelumnya (hasil sama: 106 produk).
- **Dugaan mekanisme:** `cocok()` membangun string gabungan nama+merek+kategori+kota lalu menjalankan
  `toLowerCase`, `normalize('NFD')`, dan dua `replace` regex untuk setiap produk di setiap huruf yang diketik.
  Teks produk tidak pernah berubah, jadi hasilnya selalu sama. Semua kerja ini JS sinkron di task `input`
  sebelum render.
- **Rencana perubahan:** simpan teks pencarian yang sudah dinormalkan per produk di `Map` (dibuat saat pertama
  dibutuhkan). Kata kunci dipecah sekali per pencarian, tidak sekali per produk.
- **Prediksi terukur:** biaya penyaringan per ketikan turun dari ±26-32 ms menjadi **±5 ms** (CPU 4x). Ketikan
  pertama tetap membayar ±26 ms untuk mengisi cache. Dampak ke INP S1 kecil (±25 ms per ketikan). Ini bukan
  penyebab utama, tetapi murah dan tidak berisiko. Efek samping: memori tambahan ±3000 string pendek (±150 KB).
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** membangun indeks kata (inverted index) atau
  trie. Lebih cepat untuk data besar, tetapi 3000 produk × `includes` sudah < 5 ms, dan pencocokan substring
  (misal "sepa" cocok dengan "sepatu") jadi lebih rumit.

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

---

## P-06: `periksaGulir` di setiap scroll/touchmove/wheel dan listener sentuh non-pasif

**Tiket terkait:** TK-1063 (utama), TK-1057 ("mau scroll juga tidak bisa"), TK-1041
**Tanggal dan hash commit entri ini:** 39-09-2026, hash dicatat di bagian "Sesudah"

### Sebelum perbaikan

- **Yang teramati di trace:** baseline S0: `periksaGulir` memakan **13.721 ms** di task render awal, termasuk satu
  Layout paksa 11.721 ms di baris `window.scrollY` dan `getBoundingClientRect` untuk 3000 kartu. Setelah P-02
  (pengukuran awal, laptop masih memakai baterai): S5 (usapan jari 10 detik, ±19.000 px) mencatat **42 frame > 50 ms
  per 10 detik**, main thread sibuk 96%, dan **310 Layout paksa**. Di S1, `periksaGulir` total 620 ms.
- **Dugaan mekanisme:**
  1. `gulir.js` memasang `periksaGulir` pada `scroll`, `resize`, `touchmove`, dan `wheel`, sehingga satu gerakan
     jari bisa menjalankannya 2-3 kali. Di dalamnya ada pola baca-tulis bergantian: `classList.toggle` dan
     `bar.style.width` (tulis) disusul `scrollHeight` (baca → layout paksa). Lalu `getBoundingClientRect()` untuk
     semua kartu, dan untuk kartu yang baru terlihat `classList.add` + `style.minHeight` (tulis), sehingga
     `getBoundingClientRect` kartu berikutnya memaksa layout lagi (layout thrashing).
  2. Setiap kali ada kartu baru terlihat, `Lacak.kirim('impression')` dipanggil langsung (±41 ms per panggilan pada
     CPU 4x, karena SDK menghitung sidik jari 2 juta iterasi).
  3. `touchstart`, `touchmove`, dan `wheel` didaftarkan `{ passive: false }` pada `#utama`. Compositor tidak boleh
     menggulir sebelum main thread selesai menjalankan listener dan memastikan `preventDefault()` tidak dipanggil.
     Guliran pun ikut antre di main thread yang sedang sibuk (task timer, frame berat), sehingga patah-patah.
     Ini juga menjelaskan TK-1057: saat perhitungan voucher memblokir main thread, halaman bahkan tidak bisa digulir.
- **Rencana perubahan:**
  - Efek kartu muncul dan pencatatan impresi memakai IntersectionObserver (`rootMargin: 80px`, sama dengan logika
    lama). Kartu baru didaftarkan saat dibuat; tidak ada lagi `getBoundingClientRect`, dan `style.minHeight`
    dihapus (tinggi kartu sudah tetap sejak P-01).
  - Bayangan header, tombol "Ke atas", dan bar progres baca diperbarui dari listener `scroll` yang **pasif** dan
    dibatasi sekali per frame (requestAnimationFrame). Bar memakai `transform: scaleX()` (tanpa Layout). Tinggi
    yang bisa digulir disimpan dan hanya dihitung ulang lewat ResizeObserver saat ukuran dokumen berubah.
  - Listener `touchstart`/`touchmove`/`wheel` dihapus. Pencegahan pull-to-refresh diganti CSS
    `overscroll-behavior-y: contain`, yang ditangani compositor tanpa JavaScript.
- **Prediksi terukur:**
  - S5: Layout paksa dari `gulir.js` turun dari ratusan menjadi **0**. Frame > 50 ms per 10 detik turun dari ±42
    menjadi **±10-20**. Sisanya datang dari timer 10 ms yang memaksa layout (`offsetWidth`) dan animasi `top`/
    `box-shadow` pada lencana kilat (P-07), serta panggilan SDK impresi (P-08).
  - Karena tidak ada lagi listener sentuh non-pasif, guliran berjalan di compositor thread walaupun main thread
    sibuk. Jarak gulir S5 untuk usapan yang sama tidak berkurang, dan bisa bertambah karena tidak ada usapan yang
    tertahan.
  - Efek samping: pull-to-refresh kini dicegah di seluruh halaman (sebelumnya hanya saat menarik di area
    `#utama` pada posisi puncak). Impresi dicatat per batch IntersectionObserver, bukan per event gulir. Bentuk
    datanya sama (array id produk).
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Tetap memakai listener `scroll`, tetapi dibatasi dengan rAF dan urutan baca-dulu-baru-tulis: layout paksa
    berkurang, tetapi mengukur ratusan kartu tetap dilakukan di main thread setiap frame.
  - CSS scroll-driven animation (`animation-timeline: scroll()`) untuk bar progres: sepenuhnya di compositor,
    tetapi belum didukung semua browser target (misalnya Firefox) sehingga tetap butuh jalur JavaScript cadangan.

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

- **Hash commit perbaikan:**
- `3fc67ef`
- **Hasil ukur (median 3 kali):**
- dibanding dengan P-07; keduanya diukur malam 26-09. INP S2 424 -> 128 ms (304-424 -> 128-136), ketukan -> tombol berubah 385 menjadi 133 ms, dengan long task S2 dari 396 menjadi 115 ms. INP S3 384 -> 64 ms. INP S1 192 -> 160 ms. S5: frame > 50 ms 10,9 -> 4,0 per 10 detik (4-5), frame main thread 44 -> 48 per detik.
- **Prediksi vs kenyataan:**
- INP S2 ±200-300 ms: menunjukkan lebih baik daripada prediksi (128 ms). Sisa `JSON.parse`/`stringify`/`setItem` riwayat (P-09) ternyata lebih murah daripada perkiraan, yang diukur saat baterai. S1 lebih ringan per huruf: arah sesuai, tetapi di dalam variasi. S5 turun karena tidak ada lagi SDK di callback gulir: sesuai. Dengan 4 frame > 50 ms per 10 detik, S5 pada versi ini hampir mencapai target (≤ 2).
- **Efek samping yang muncul:**
- Event tiba 0-3 detik lebih lambat, dan ketujuh jenis event tetap terkirim (uji fungsional).pengukuran pagi untuk commit yang sama (`data/P-08-pagi`) memberi S5 79-89 frame > 50 ms per 10 detik, 20 kali lipat pengukuran malam. Perbedaan ini bukan efek P-08, melainkan kondisi mesin (Catatan metode). Sehingga perbandingan S5 hanya sah di dalam satu jendela pengukuran
