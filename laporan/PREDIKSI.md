Sebelum perbaikan

# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: 3000 gambar diminta sekaligus dan tanpa ukuran

**Tiket terkait:** TK-1081 (utama), TK-1078, TK-1070
**Tanggal dan hash commit entri ini:** 30/09/2026

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**

  - S0 (3 ulangan): dalam 10 detik pertama **0** permintaan gambar, karena main thread masih membangun kartu. Setelah task render selesai, **3000** permintaan `/img/p/*.svg` dikirim sekaligus. Pada ulangan 1 gambar terakhir baru selesai di detik **207** (3.228 KB). Pada ulangan 2 dan 3, setelah 250 detik baru 2.158 dan
    2.050 gambar yang selesai.
  - Trace pemuatan `diagnosis-muat-awal-4x-sebelum.json.gz`: task render awal sudah berjalan > 20 detik saat rekaman berhenti (bottom-up: `buatKartu` total 19.098 ms). Laju gambar selesai yang tercatat di sisi renderer turun dari ±25/detik menjadi ±3/detik setelah menit ke-4, karena setiap respons perlu main thread yang sedang penuh (event `load`, parse dokumen SVG).
- **Dugaan mekanisme:** `buatKartu` membuat `<img>` tanpa atribut `loading`, sehingga setiap gambar mulai diunduh begitu `src` diisi, termasuk kartu ke-3000 yang jauh di luar layar. Browser membuka paling banyak 6 koneksi HTTP/1.1 per origin, jadi 3000 permintaan mengantre dalam urutan dokumen. Gambar yang kebetulan sedang dilihat pengguna tidak didahulukan, sehingga saat menggulir cepat pengguna menunggu di belakang antrean (kotak abu-abu). Semua gambar tetap diunduh walau tidak pernah dilihat (kuota). Gambar juga tidak punya `width`/`height`, jadi tingginya 0 sampai berkasnya tiba. Setiap gambar yang tiba mengubah tinggi kartu, lalu tinggi baris grid, sehingga layout kisi harus dihitung ulang (tahap Layout) dan konten di bawahnya bergeser. Server tidak lambat: latensi per gambar hanya 60-300 ms. Yang lambat adalah
  antrean yang diciptakan klien.
- **Rencana perubahan:** di `buatKartu`, isi `width=480 height=480` (ukuran asli SVG) supaya browser menghitung rasio aspek sebelum gambar tiba, `loading="lazy"` (diisi sebelum `src`), dan `decoding="async"`.
- **Prediksi terukur:**

  - S0: jumlah permintaan gambar setelah kartu tampil turun dari **3000** menjadi hanya kartu yang berada dalam
    jarak lazy-load Chrome (viewport + 1250 px untuk koneksi cepat). Kartu pertama mulai di y ≈ 844 dengan tinggi
    ±440 px dan 2 kolom, jadi sekitar **6-10 gambar**. Data gambar turun dari ±3.200 KB menjadi **< 15 KB**.
  - Waktu sampai halaman "tenang" (tidak ada gambar tertunda) turun dari > 200 detik menjadi hampir sama dengan waktu render kartu. Render 3000 kartu sendiri masih ±20 detik pada CPU 4x.
  - Efek samping yang mungkin memburuk: saat menggulir sangat cepat, kotak abu-abu tetap muncul sebentar karena gambar baru diminta saat mendekati layar. Antreannya pendek, jadi seharusnya cepat terisi. Karena ukuran kini dipesan, kotak abu-abu tidak lagi "melompat" saat gambar tiba.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**

  - IntersectionObserver buatan sendiri untuk memuat gambar: hasilnya sama dengan `loading="lazy"` bawaan, tetapi kodenya lebih banyak dan tidak bisa memanfaatkan ambang jarak yang disesuaikan browser dengan kondisi jaringan.
  - Placeholder buram (LQIP), sprite, atau HTTP/2: butuh perubahan server/CDN, yang di luar ruang lingkup.
  - Hanya menambah `width`/`height` tanpa lazy: layout ulang hilang, tetapi 3000 permintaan dan boros kuota tetap ada

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



## P-15: Setiap frame gulir menghitung ulang style dan layout kartu yang tidak terlihat

**Tiket terkait:** TK-1063
**Tanggal dan hash commit entri ini:** 26-09-2026, hash dicatat di bagian "Sesudah"

### Sebelum perbaikan

- **Yang teramati:** pengukuran awal commit P-13 (satu ulangan, laptop masih memakai baterai), S5 usapan 10 detik
  (±28.000 px): **80 frame > 50 ms per 10 detik**, main thread sibuk 89-92%. Trace
  `diagnosis-S5-invalidasi-setelah-P-13.json.gz` (dengan kategori `invalidationTracking`):
  - 102 task frame gulir, rata-rata **45,7 ms** (Paint 981 ms, Layout 943 ms, Recalculate Style 776 ms,
    Pre-paint 551 ms, Layerize 380 ms dalam 10 detik);
  - 99 task pembuatan dokumen SVG gambar, **1.977 ms**;
  - invalidasi style karena `Animation` pada `span.lencana-kilat` dan `::after`-nya **660 kali** (hampir setiap
    frame), `Animation` pada `article.kartu.terlihat` 408 kali;
  - invalidasi layout `Style changed` pada `article.kartu.terlihat` 68 kali, dipicu pemberian kelas `terlihat`.
- **Dugaan mekanisme:**
  1. Animasi lencana memang dijalankan compositor, tetapi setiap kali main thread menghasilkan frame (saat gulir,
     dan juga karena loop rAF alat ukur), Blink tetap memperbarui style elemen yang beranimasi. Ini berlaku untuk
     semua lencana di DOM, termasuk yang jauh di luar layar. Makin jauh digulir, makin banyak kartu (dan
     lencana) di DOM, dan makin mahal setiap Layout/Pre-paint.
  2. Kartu yang belum terlihat memakai `transform: translateY(16px)`, sedangkan `.terlihat` memakai
     `transform: none`. Berpindah antara "ada transform" dan "tanpa transform" mengubah stacking context/containing
     block, sehingga Blink menjadwalkan Layout, bukan hanya Composite.
  3. Setiap gambar SVG yang tiba membuat dokumen SVG sendiri di main thread. Ini harga dari format gambar CDN yang
     tidak bisa diubah dari sisi klien. Jumlahnya ditekan oleh lazy-load, tetapi tidak bisa nol saat menggulir.
- **Rencana perubahan:**
  - `.kartu { content-visibility: auto; contain-intrinsic-size: auto 440px; }`. Kartu di luar jangkauan layar
    dilewati browser untuk Style, Layout, dan Paint (termasuk animasi lencana di dalamnya). Ukuran tempatnya
    diingat (`auto`), jadi tinggi daftar tetap.
  - `.kartu.terlihat { transform: translateY(0) }` (bukan `none`), supaya memunculkan kartu hanya mengubah nilai
    transform yang dijalankan compositor, tanpa Layout.
- **Prediksi terukur:**
  - S5: rata-rata biaya frame gulir turun ±30-40% dan frame > 50 ms turun dari ±80 menjadi **±35-50 per 10 detik**.
    Target ≤ 2 **kemungkinan besar belum tercapai** pada CPU 4x dengan usapan secepat ini, karena ±100 dokumen SVG
    (±2 detik main thread) dan paint konten baru tetap ada. Sisanya perlu perubahan di CDN (lihat rekomendasi).
  - S6 (dengan alat ukur): Recalculate Style per frame turun karena lencana di luar layar tidak lagi diperbarui.
  - Efek samping: kartu yang belum pernah dirender memakai tinggi perkiraan 440 px sampai mendekati layar
    (perubahan kecil terjadi di luar layar, jadi tidak terlihat sebagai pergeseran). Posisi scrollbar bisa bergeser
    sedikit saat ukuran sebenarnya menggantikan perkiraan.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Virtualisasi penuh (membuang kartu yang jauh dari layar): DOM tetap kecil, tetapi kartu yang dibuang harus
    dibuat ulang saat kembali (termasuk gambar SVG-nya), dan fokus keyboard/pembaca layar lebih sulit dijaga.
  - Menjeda animasi lencana lewat IntersectionObserver per kartu: menghentikan animasi di luar layar, tetapi tidak
    mengurangi biaya Layout/Paint kartu di luar layar. `content-visibility` mencakup keduanya.
  - Menghapus efek kartu muncul saat menggulir cepat: melanggar aturan 4 (efek kartu muncul harus tetap ada).

### Sesudah perbaikan

- **Hash commit perbaikan:**
- **Hasil ukur (median 3 kali):**
- **Prediksi vs kenyataan:** 
- **Efek samping yang muncul:** 

## P-17: Gambar dimuat dan digambar di tengah guliran cepat

**Tiket terkait:** TK-1063, TK-1081
**Tanggal dan hash commit entri ini:** 30/09/2026

### Sebelum perbaikan

- - **Yang teramati:** commit P-15, laptop sudah tersambung listrik, pengukuran awal: S5 **82-91 frame > 50 ms per
    10 detik**, main thread sibuk ±88-92%, jarak gulir ±28.800 px. Trace S5: 141 task frame gulir (4,7 detik, rata-rata
    33 ms) dan **96 task dokumen SVG gambar (1,56 detik)**, ditambah PaintImage ±0,2 detik. Eksperimen A/B dengan
    dekorasi `.kaki-hias` (blur 60 px + box-shadow besar) dimatikan: S5 turun ke ±60 frame > 50 ms. Karena daftar
    kini pendek, kaki halaman selalu berada di dalam area yang direkam ulang (±4.000 px) setiap kali kartu baru
    ditambahkan.
- **Dugaan mekanisme:** selama pengguna mengibaskan daftar, ±13 kartu per detik masuk ke jarak lazy-load. Setiap
  gambar yang tiba membuat dan menata dokumen SVG di main thread (±20 ms pada CPU 4x), lalu harus direkam
  (PaintImage). Kerja ini mengisi celah antar-frame, sehingga frame gulir berikutnya terlambat. Hampir semua gambar
  itu sudah lewat dari layar sebelum sempat dilihat. Dekorasi kaki halaman ikut direkam ulang ketika posisinya
  bergeser karena batch kartu baru.
- **Rencana perubahan:**

  - Modul `gambar.js` mengambil alih pemasangan `src`: gambar didaftarkan ke IntersectionObserver
    (rootMargin 800 px) dan alamatnya baru dipasang saat dekat layar **dan** halaman "tenang". Tidak tenang berarti
    guliran lebih cepat dari 1,5 px/ms (diukur di callback rAF gulir yang sudah ada) dalam 150 ms terakhir, atau
    ada render pencarian dalam 350 ms terakhir (mekanisme P-14 disatukan ke sini).
  - `.kaki-hias` diberi `will-change: transform` supaya menjadi layer komposit sendiri: digambar sekali, lalu hanya
    dipindahkan compositor.
- **Prediksi terukur:**

  - S5: dokumen SVG yang dibuat selama usapan turun dari ±96 menjadi hanya gambar di sela usapan yang melambat.
    Frame > 50 ms turun dari ±80-90 menjadi **±25-45 per 10 detik**, dan main thread sibuk turun ke ±65-75%. Target
    ≤ 2 **belum tercapai**, karena frame gulir sendiri (Layout/Paint kartu baru, ±33 ms pada CPU 4x) tetap melebihi
    anggaran 16,7 ms per frame.
  - Efek samping: saat mengibas cepat, kotak gambar tetap abu-abu dan baru terisi ±150 ms setelah guliran melambat
    (ini pertukaran yang disengaja; kotak sudah berukuran tetap sejak P-01). Ada satu layer komposit tambahan untuk
    dekorasi kaki (memori GPU kecil).
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**

  - Menghapus dekorasi blur kaki halaman: lebih hemat lagi, tetapi mengubah desain tanpa perlu.
  - Menyuruh CDN mengirim gambar raster kecil (WebP 200 px) alih-alih SVG: solusi paling tepat untuk biaya
    dokumen SVG, tetapi server/CDN di luar ruang lingkup (masuk rekomendasi).
  - Menurunkan jarak lazy-load: tidak mengurangi jumlah gambar yang lewat saat dikibas, hanya menunda sedikit.

  ### Sesudah perbaikan
- **Hash commit perbaikan:**
- **Hasil ukur (median 3 kali):**
- **Prediksi vs kenyataan:**
- **Efek samping yang muncul:**
