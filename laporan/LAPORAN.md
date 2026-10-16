# Laporan audit performa dan interaksi TokoKilat

Tim: Neliti Pemdat!

Anggota: 
- Amalia Khoerina (241524003)
- Diaz Putri Izzatunisa (241524008)
- Muhammad Nabil Syauqi Rasyiq (241524018)
- Praditama Ajmal Hasan (241524023)
- Zaidan Arkaan Azharuddya Asshauqi (241524030)   

Tanggal: 25 September 2026
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

## 1. Ringkasan eksekutif (maks. 150 kata)

Apa masalah terbesar, apa yang dilakukan, berapa hasilnya. Tulis untuk manajer produk, bukan untuk engineer.

## 2. Lingkungan pengukuran

- **Laptop:** Lenovo 83D2, Intel Core Ultra 7 155H (6 P-core, 8 E-core, 2 LP E-core), RAM 32 GB, Windows 11 Home
  10.0.26200, tersambung listrik. **Browser:** Chrome 153.0.8010.53 headless, dikendalikan lewat Chrome DevTools
  Protocol oleh `laporan/skrip/ukur.mjs` (Node.js 26), dengan profil baru di setiap pengukuran dan tanpa ekstensi.
- **Protokol:** 412 x 915 mobile, **CPU 4x slowdown**, jaringan tanpa throttling, **3000 produk** (`npm start`),
  `?ukur=1`, median 3 ulangan. S0 memakai pemuatan baru. S1-S6 dijalankan dalam 3 sesi: buka halaman, tunggu tenang,
  lalu S6, S1, …, S5 berurutan, dengan alat ukur di-reset sebelum setiap skenario.

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---|---|---|---|
| S0 | CLS (sejak dokumen dibuat) | 0 (lihat T-09) | 0 | <= 0,1 | ya |
| S0 | Permintaan gambar dalam 10 dtk pertama / total | 0 / **3.000** (3.228 KB) | 6 / **6** (6 KB) | sebanding yang terlihat | ya |
| S0 | Gambar terakhir selesai | 146 dtk | 2,6 dtk | | |
| S0 | Long task terlama saat memuat | **14.402 ms** | 720 ms | | |
| S1 | INP | **64.302 ms** | **96 ms** | <= 200 ms | ya |
| S1 | Long task terlama | 41.983 ms | tidak ada > 50 ms (2 dari 3 ulangan; terburuk 52 ms) | <= 100 ms | ya |
| S2 | INP | 2.532 ms | **80 ms** | <= 200 ms | ya |
| S2 | Ketukan -> tombol berubah | 1.159 ms | 68 ms | | |
| S2 | Long task terlama | 1.534 ms | 59 ms | <= 100 ms | ya |
| S3 | Jumlah pesanan dari 3 ketukan | **3** | **1** | 1 | ya |
| S3 | Umpan balik pertama | tidak ada selama jendela ukur | 69 ms ("Memproses…") | pengguna tahu diproses | ya |
| S3 | INP | 2.634 ms | 32 ms | <= 200 ms | ya |
| S4 | INP | **51.233 ms** | **72 ms** | <= 200 ms | ya |
| S4 | Langkah progres tergambar / frame selama progres | **0 / 0** | 3 / 4 | bertahap | ya |
| S4 | Long task terlama | 30.390 ms | tidak ada > 50 ms | <= 100 ms | ya |
| S4 | Ketuk voucher sampai selesai | 51.163 ms | 1.207 ms | | |
| S5 | Frame > 50 ms per 10 dtk | 0,9 *(lihat catatan)* | **6** (ulangan 3-8) | <= 2 | **tidak** |
| S5 | Waktu menggulir 14.000 px (seharusnya ±10 dtk) | **32.433 ms** | 10.096 ms | | |
| S5 | Frame main thread per detik / frame terburuk | **0,1 fps / 21.012 ms** | 46 fps / 61 ms | | |
| S5 | Long task terlama | 587 ms | tidak ada > 50 ms | <= 100 ms | ya |
| S6 | Frame > 50 ms per 10 dtk | 20 | **0** | <= 2 | ya |
| S6 | Frame main thread per detik / frame terburuk | 2,1 fps / 592 ms | 60 fps / 23 ms | | |
| S6 | Main thread sibuk, **tanpa** alat ukur | 95,8% | **2,9%** | mendekati nol | ya |
| S6 | Main thread sibuk, dengan alat ukur | 96,8% | 39,1% | | (sisa = loop rAF alat ukur, T-08) |

## 4. Temuan

Berikut Temuan yang kami Temukan:

### T-01: Seluruh 3000 kartu dibangun dalam satu task, disertai layout paksa (P-02, P-03, P-04, P-16)

- **Tiket terkait:** TK-1041 (utama). Secara tidak langsung semua tiket, karena selama task ini halaman beku.
- **Gejala bagi pengguna:** setelah data tampil layar beku belasan detik. Setiap huruf yang diketik di kolom cari membekukan layar lagi, dan huruf muncul terlambat.
- **Bukti:** satu task 14,4 detik (median) setelah `/api/produk` diproses. `g3-S1-sebelum.png`:
  huruf kedua yang diketik di detik 0,2 baru diproses di detik 16,2, lalu huruf-huruf yang antre diproses dalam satu
  task 42 detik. Bottom-up S1: `get offsetHeight` 31,7 detik self. Micro-benchmark `formatRupiah` 3000x: 646 ms
  (pemformat dibuat tiap panggilan) vs 3,5 ms (pemformat disimpan).
- **Akar masalah dan mekanismenya:** `renderProduk` (`katalog.js`) membangun semua kartu dalam satu task makro, jadi
  tidak ada rendering opportunity dan input hanya antre. Biayanya linier terhadap N: `formatRupiah` (`util.js`)
  membuat `Intl.NumberFormat` baru per panggilan, `samakanTinggiJudul` menulis `style.height` dan membaca
  `offsetHeight` bergantian 24 kali (layout thrashing pada grid 3000 item), dan `periksaGulir` memaksa layout lagi.
- **Kualitas yang terdampak (ISO/IEC 25010):** *time behaviour* dan *capacity* (linier terhadap jumlah produk), yang
  menghilangkan *operability* dan menurunkan *user engagement* (pembeli pindah toko).
- **Perbaikan:** render bertahap 12 kartu (IntersectionObserver di ujung kisi, tombol "Tampilkan berikutnya" untuk
  keyboard), pemformat Intl dibuat sekali, tinggi judul lewat CSS `line-clamp`, dan kartu dipakai ulang per id.
- **Trade-off:** Ctrl+F tidak menemukan kartu yang belum dirender (pencarian di kolom cari tetap mencakup 3000
  produk), dan judul lebih dari 3 baris (±1,7%) diberi elipsis. Virtualisasi penuh ditolak karena urusan fokus dan
  pembaca layar.
- **Hasil:** long task saat memuat 14.402 → 500 ms; INP S1 64.302 → 152 ms; long task S1 41.983 → 77 ms.

### T-02: Voucher "async" tetap satu task panjang, dan 97% kerjanya sia-sia (P-11, P-12)

- **Tiket terkait:** TK-1057.
- **Gejala bagi pengguna:** layar beku ±51 detik, dan progres diam di 0% lalu tiba-tiba selesai.
- **Bukti:** `g7`: satu task 20 detik berisi `Run Microtasks` dengan 0 frame. Ketukan di detik 0,4 baru diproses di
  detik 20,3. `hitungHargaPromo` untuk 3000 produk: 5.050 ms (41 simulasi per produk) vs 183 ms (1 simulasi).
- **Akar masalah dan mekanismenya:** `terapkanVoucher` (`harga-promo.js`) melakukan `await` pada fungsi `async`
  yang isinya sinkron. Itu hanya menjadwalkan **microtask**, dan microtask checkpoint menguras semuanya sebelum
  rendering, jadi 3000 iterasi tetap satu task. "Cek kestabilan pembulatan" memanggil `simulasiCicilan` 40 kali dengan
  hasil yang dibuang. Setelah itu kisi dirender ulang (T-01).
- **Kualitas yang terdampak:** *time behaviour*, yang merusak *self-descriptiveness* (progres berbohong) dan
  *operability*.
- **Perbaikan:** kerja diiris ±8 ms dengan `scheduler.yield()` (cadangan `MessageChannel`). Hasil ditukar sekaligus,
  penerapan baru membatalkan yang lama, harga di kartu diperbarui di tempat, dan 40 panggilan sia-sia dihapus.
- **Trade-off:** total waktu sedikit bertambah. Web Worker ditolak, karena sisa kerjanya hanya ±0,2 detik.
- **Hasil:** INP 51.233 → 72 ms; long task 30.390 ms → tidak ada yang > 50 ms; progres tergambar 0 → 3 langkah;
  selesai 51,2 → 1,2 detik; ketikan selama perhitungan tetap masuk.

### T-03: SDK analitik dijalankan di tengah interaksi dengan payload 1,2 MB (P-08)

- **Tiket terkait:** TK-1044, TK-1052, TK-1041, TK-1063.
- **Gejala bagi pengguna:** setiap ketukan dan huruf terasa berat.
- **Bukti:** `Lacak.kirim` 28 ms per panggilan (sidik jari 2 juta iterasi dihitung ulang setiap kali), 332 ms dengan
  payload `add_to_cart` asli (1.228.826 byte, seluruh riwayat 9000 entri). `g5`: `lacak.min.js` di dalam task klik.
- **Akar masalah dan mekanismenya:** SDK sinkron dipanggil dari handler `input` (per huruf), klik, callback gulir,
  dan klik promo. Biayanya langsung menjadi *processing time* INP.
- **Kualitas yang terdampak:** *time behaviour* dan *resource utilization*, yang menurunkan *operability*.
- **Perbaikan:** `analitik.js` mengantrekan event ke `requestIdleCallback` dan menguras antrean saat `pagehide`.
  `search` dikirim sekali setelah berhenti mengetik, impresi digabung per detik, dan payload diringkas (1,2 MB → ±0,4-3
  KB). Ketujuh jenis event tetap terkirim.
- **Trade-off:** event tiba 0-3 detik lebih lambat, dan riwayat utuh per event hilang (perlu disepakati tim data).
- **Hasil:** INP S2 424 → 128 ms dan INP S3 384 → 64 ms (P-07 → P-08, jendela ukur yang sama).

### T-04: 3000 gambar diminta sekaligus, tanpa ukuran, dan mahal di main thread (P-01, P-17)

- **Tiket terkait:** TK-1081, TK-1063.
- **Gejala bagi pengguna:** kotak abu-abu lama terisi, dan kuota cepat habis.
- **Bukti:** S0 kode awal: 3000 permintaan sekaligus setelah kartu jadi, dan gambar terakhir selesai di detik 146
  (3.228 KB). Setiap SVG yang tiba membuat dokumen sendiri di main thread (±20 ms per gambar).
- **Akar masalah dan mekanismenya:** `<img>` di `buatKartu` tanpa `loading` langsung diunduh. Dengan 6 koneksi
  HTTP/1.1 per origin, 3000 permintaan mengantre tanpa prioritas bagi gambar yang terlihat. Tanpa `width`/`height`,
  setiap gambar yang tiba memicu Layout ulang.
- **Kualitas yang terdampak:** *resource utilization* (kuota) dan *time behaviour*, yang menurunkan *user
  engagement*. Pak Hendra menyalahkan server (bagian 5).
- **Perbaikan:** `width`/`height`, `loading="lazy"`, `decoding="async"`, dan `gambar.js` yang memasang alamat
  gambar hanya saat kartu dekat layar dan halaman tidak sedang dikibas atau diketik.
- **Trade-off:** saat mengibas, kotak tetap abu-abu sampai ±150 ms setelah guliran melambat.
- **Hasil:** 3.000 → 6 permintaan (3.228 → 6 KB); gambar terakhir 146 → 2,6 detik.

### T-05: "+ Keranjang" memberi umpan balik setelah riwayat 1,2 MB dibaca dan ditulis ulang (P-09)

- **Tiket terkait:** TK-1044.
- **Gejala bagi pengguna:** tombol tidak bereaksi, pengguna menekan lagi, dan isi keranjang bertambah dua-tiga kali.
- **Bukti:** `g5`: ketukan menunggu task 1,5 detik, lalu task klik 636 ms (`bacaRiwayat`, SDK, `simpanRiwayat`);
  tombol berubah 1.159 ms setelah ketukan. `JSON.parse` 20 ms, `stringify` 20 ms, `setItem` 25 ms.
- **Akar masalah dan mekanismenya:** `tambahKeKeranjang` mengerjakan hal yang tidak mendesak (riwayat, SDK) sebelum
  memperbarui lencana/tombol/toast, semuanya di task yang sama, jadi frame baru tergambar paling akhir.
- **Kualitas yang terdampak:** *time behaviour*, yang merusak *operability* dan *user error protection*.
- **Perbaikan:** keranjang kecil disimpan sinkron dan umpan balik tampil lebih dulu. Entri riwayat disisipkan ke
  string JSON tersimpan saat senggang, dengan format `localStorage` yang tetap sama.
- **Trade-off:** entri riwayat yang tertunda hilang bila browser crash sebelum senggang (`pagehide` menutup kasus
  normal).
- **Hasil:** tombol berubah 1.159 → 68 ms; INP 2.532 → 80 ms.

### T-06: "Beli sekarang" tanpa penjaga permintaan ganda (P-10)

- **Tiket terkait:** TK-1052.
- **Gejala bagi pengguna:** tiga ketukan karena tidak ada reaksi menghasilkan tiga pesanan.
- **Bukti:** S3 kode awal: 3 ketukan → **3 pesanan**, tanpa perubahan tombol selama jendela ukur.
- **Akar masalah dan mekanismenya:** `beliSekarang` tidak punya status "sedang diproses", jadi setiap klik memulai
  `fetch` baru. Tombol baru berubah setelah respons tiba, dan server tidak punya kunci idempotensi.
- **Kualitas yang terdampak:** *user error protection* dan *self-descriptiveness*.
- **Perbaikan:** penjaga per produk. "Memproses…" dengan `aria-busy`/`aria-disabled` tampil di task klik yang sama
  (bukan `disabled`, supaya fokus tidak hilang), lalu "Dipesan ✓" selama 1,5 detik, dan pesan bila gagal.
- **Trade-off:** hanya melindungi satu tab, dan pembelian ulang produk yang sama menunggu ±1,5 detik.
- **Hasil:** 3 → **1** pesanan; "Memproses…" 69 ms setelah ketukan; INP 2.634 → 32 ms.

### T-07: Gulir diblokir listener non-pasif dan pemeriksaan semua kartu (P-06, P-15, P-17)

- **Tiket terkait:** TK-1063 (dan "tidak bisa scroll" di TK-1057).
- **Gejala bagi pengguna:** gulir patah-patah dan tertinggal dari jari.
- **Bukti:** `g9`: gulir 14.000 px butuh 32 detik (seharusnya ±10), dengan hanya 4 frame main thread dalam 32 detik
  (terburuk 21 detik). Sampel profiler (`trace/S5-diagnosis-toplevel`) memperlihatkan ratusan task ±15-18 ms untuk
  handler `wheel` → `periksaGulir` (`getBoundingClientRect` 2,0 detik self).
- **Akar masalah dan mekanismenya:** `periksaGulir` dipasang pada `scroll`, `touchmove`, dan `wheel` (dua terakhir
  non-pasif), sehingga compositor harus menunggu main thread. Isinya `getBoundingClientRect` untuk 3000 kartu,
  berselang-seling dengan tulisan gaya (layout paksa per event).
- **Kualitas yang terdampak:** *time behaviour*, yang menurunkan *user engagement* dan *operability*.
- **Perbaikan:** IntersectionObserver untuk efek muncul dan impresi; `scroll` pasif + rAF + `transform` untuk
  header dan bar; `overscroll-behavior-y` menggantikan listener sentuh; `content-visibility: auto` pada kartu; gambar
  tidak dimuat saat dikibas.
- **Trade-off:** hit test saat ketukan bisa memaksa Layout kartu yang dilewati `content-visibility` (44 ms di `g6`),
  dan animasi di dalam kartu seperti itu memaksa frame main thread (T-08).
- **Hasil:** gulir 32,4 → 10,1 detik; frame main thread 0,1 → 46 per detik; frame terburuk 21.012 → 61 ms. Target
  ≤ 2 frame > 50 ms per 10 detik **belum tercapai** (6; ulangan 3-8).

### T-08: Timer 10 ms dan animasi yang memicu frame main thread terus-menerus (P-07, P-18)

- **Tiket terkait:** TK-1070.
- **Gejala bagi pengguna:** HP panas dan baterai cepat habis walau halaman hanya dibiarkan terbuka.
- **Bukti:** `g11`: saat diam, setiap frame berisi Recalculate Style + Layout + Paint seluruh halaman (±270-360
  ms), sibuk 96,8%, dan tidak ada satu pun `Timer Fired` dalam 10 detik (juga tanpa alat ukur: sibuk 95,8%), jadi
  hitung mundur justru macet. Setelah P-07 masih ada sisa yang hanya terlihat **tanpa** alat ukur: P-17 menggambar
  ±600 frame main thread per 10 detik tanpa callback rAF (sibuk 34%). A/B CSS: animasi lencana dimatikan → 3,3%,
  `content-visibility` dimatikan → 3,9%, teks berjalan atau gulungan perseratus detik dimatikan → tetap ±30-35%.
- **Akar masalah dan mekanismenya:** `setInterval` 10 ms untuk hitung mundur (dengan `offsetWidth`) dan teks
  berjalan (`style.left`), lencana beranimasi `top`/`box-shadow`, dan kartu bertransisi `margin-top` membuat main
  thread tidak pernah menganggur. Sisa setelah P-07: lencana ber-`transform` di dalam kartu `content-visibility`
  (P-15) meminta frame main thread di setiap tik animasi.
- **Kualitas yang terdampak:** *resource utilization* (CPU/baterai), yang menurunkan *user engagement*.
- **Perbaikan:** hitung mundur sekali per detik (garis lewat `transform`); perseratus detik sebagai gulungan angka
  dengan animasi `transform` `steps(100)`; teks berjalan dengan `@keyframes`; lencana memakai `transform` dan `::after`
  `opacity`. Animasi dijeda di luar layar dan menghormati `prefers-reduced-motion`. P-18: kartu flash sale (±8%)
  tanpa `content-visibility`.
- **Trade-off:** animasi compositor tetap memakai GPU. Kartu flash sale di luar layar ikut ditata, sehingga S5
  sedikit memburuk (bagian 6).
- **Hasil:** frame > 50 ms 20 → 0. Tanpa alat ukur, sibuk 95,8% → 34% (P-17) → **2,9%** (P-18), dengan 11 frame per
  10 detik. Dengan alat ukur 39,1%, yang sisanya berasal dari loop rAF alat ukur.

### T-09: Konten disisipkan belakangan tanpa ruang yang dipesan (P-13)

- **Tiket terkait:** TK-1078.
- **Gejala bagi pengguna:** tombol melompat saat hendak diketuk, dan yang terketuk malah banner.
- **Bukti:** pada kode awal CLS terukur 0, tetapi hanya karena banner **tidak pernah tampil** (lanjutan `fetch` kalah
  antre dengan frame yang berat). Begitu halaman cepat, CLS menjadi 0,137-0,141 pada P-01 sampai P-12 (banner
  menurunkan konten 218 px), dan 0,61 di sebagian ulangan P-03, P-04, P-06, P-08 (kaki halaman dan toolbar terdorong
  saat kartu dan keping kategori dibuat).
- **Akar masalah dan mekanismenya:** `pasangBannerPromo` melakukan `prepend` banner setelah `/api/promo` (±1,8 detik),
  keping kategori ditambah setelah data tiba, dan kisi tingginya 0 sampai kartu dibuat. Pergeseran tanpa input dalam
  500 ms dihitung ke CLS.
- **Kualitas yang terdampak:** *user error protection* (salah ketuk) dan *user engagement* ("sengaja biar iklannya
  diklik").
- **Perbaikan:** `#promo-banner` ada di HTML dengan `min-height` per breakpoint (248/202/177/132 px), keping
  kategori satu baris yang bisa digeser, dan `.kisi:empty { min-height: 100vh }`.
- **Trade-off:** kotak banner kosong ±1,8 detik, dan keping kategori perlu digeser di layar sempit.
- **Hasil:** CLS 0,137 → **0** di semua ulangan P-13 sampai versi akhir.

### T-10: Mengetik mengulang kerja yang tidak perlu (P-05, P-14, P-16)

- **Tiket terkait:** TK-1041.
- **Gejala bagi pengguna:** setelah T-01 diperbaiki, huruf masih terasa tertunda.
- **Bukti:** setiap perbaikan membuka biaya berikutnya. Setelah P-02, `normalkan` 389 ms self selama S1 (±32 ms per
  huruf; penyaringan 28,4 ms vs 1,9 ms bila teks tersimpan). Setelah P-13, setiap huruf membangun 24 kartu baru
  (Layout 679 ms, Recalculate Style 620 ms selama S1) dan dokumen SVG gambarnya. Setelah P-15, kartu untuk produk
  yang sama tetap dibuat ulang (Paint 227-230 ms).
- **Akar masalah dan mekanismenya:** `cocok` (`pencarian.js`) menormalkan ulang teks 3000 produk di setiap huruf,
  dan kartu hasil dibangun baru meskipun produknya sama.
- **Kualitas yang terdampak:** *time behaviour* dan *resource utilization*, yang menurunkan *operability*.
- **Perbaikan:** teks pencarian dinormalkan sekali saat senggang, halaman 12 kartu, gambar hasil sementara ditunda
  350 ms, dan kartu dipakai ulang.
- **Trade-off:** memori untuk 3000 string dan cache kartu (maks. 600).
- **Hasil:** INP S1 (pagi) P-04 552 → P-05 432; P-13 488 → P-16 232 → P-17 152 ms; versi akhir (malam) **96 ms**.

## 5. Dugaan yang ternyata keliru

| Dugaan | Sumber | Pengukuran | Kesimpulan |
|---|---|---|---|
| Loop bersarang `kategori.js` O(n²) adalah biang kerok | Rudi #1 | 8 kategori → 56 iterasi, **0,2 ms**. Yang terlihat mahal di `pasangKaki` adalah inisialisasi ICU `toLocaleString('id-ID')` pertama (121 ms, sekali) | **Keliru** |
| "API lambat, tambah server" | Rudi #2 | `/api/produk` 261 ms, sekali. `/api/promo` 1,8 detik tetapi asinkron (masalahnya ruang yang tidak dipesan, T-09) | **Keliru** |
| Bubble sort harus diganti quicksort | Rudi #3 | yang diurutkan hanya 12 merek: **0,0-0,1 ms** | **Keliru**, tidak berpengaruh |
| "Voucher sudah async, jadi aman" | Rudi #4 | satu task 20 detik dengan 0 frame (T-02) | **Keliru.** `await` hanya menjadwalkan microtask |
| SDK vendor berat | Rudi #5 | 28 ms per panggilan, 332 ms dengan payload 1,2 MB | **Benar sebagian.** Yang bisa diubah adalah kapan dan apa yang dikirim (T-03) |
| "Servernya yang lemot" | TK-1081 | latensi per gambar 60-300 ms; yang lambat adalah antrean 3000 permintaan dari klien | **Keliru** |
| "Sengaja biar iklannya diklik" | TK-1078 | pergeseran berasal dari banner yang disisipkan tanpa ruang | Bukan disengaja, tetapi efeknya nyata |
| Halaman 12 kartu → INP S1 ≤ 250 ms (P-14); `content-visibility` → frame lambat S5 −30-40% (P-15) | kami | INP S1 488 → 496 ms; S5 62,7 → 69 (jendela pagi) | **Meleset.** Biaya dominan adalah membangun ulang kartu yang sama (turun di P-16) |
| Transisi kartu muncul membebani guliran | kami | A/B: tanpa transisi, S5 tetap ±62 frame lambat | **Keliru** |
| Setelah P-07 halaman diam hampir nol; sisa ±47% di S6 hanya ulah alat ukur | kami (eksplorasi: ±4%) | tanpa alat ukur, P-17 masih 34% (±600 frame per 10 detik) | **Keliru sebagian.** Alat ukur menutupi masalah dari P-15 (diperbaiki P-18) |
| P-18 menurunkan INP S2/S4 ke bawah 200 ms | kami (kesimpulan awal) | diukur ulang di jendela yang sama: S2 80 vs 80 ms, S4 80 vs 72 ms | **Keliru.** Semu, karena kami membandingkan pengukuran pagi dengan malam |

## 6. Yang belum beres dan rekomendasi

- **S5 belum mencapai target** (±6 frame > 50 ms per 10 detik; 72-91 saat laptop terbebani). Dalam kondisi baik
  yang sama, P-16 mendapat 1, P-17 mendapat 3, dan P-18 mendapat 6. P-17 menukar sedikit kelancaran gulir dengan INP
  ketik (120 → 72 ms), dan P-18 dengan prosesor saat diam (34% → 3%). Rekomendasi: **CDN mengirim gambar raster kecil
  (WebP/AVIF ±200 px)**, karena SVG di-parse di main thread sedangkan raster di-decode di thread lain. Selain itu:
  DOM kartu yang lebih sederhana, dan menjeda animasi lencana pada kartu yang jauh dari layar supaya kartu itu bisa
  kembali memakai `content-visibility` (belum diuji).
- **Event sentuh sintetis tidak sampai ke kode awal**, sedangkan klik mouse sampai. Dugaan kami: listener
  `touchstart` non-pasif pada main thread yang jenuh. Belum dibuktikan di perangkat sungguhan.
- **Backend:** kunci idempotensi pada `POST /api/pesanan` (penjaga klien tidak melindungi dua tab), dan
  `Cache-Control` untuk gambar (saat ini `no-store`).
- **Vendor SDK:** simpan sidik jari perangkat (sekarang dihitung ulang 2 juta iterasi di setiap event) dan sediakan
  API asinkron/batch.
- **Tim data:** sepakati payload analitik yang baru. Pertimbangkan IndexedDB untuk riwayat, yang sekarang masih
  ditulis ulang utuh (1,2 MB) ke `localStorage` saat senggang.
- **Tim desain:** keping kategori satu baris dan elipsis judul perlu disetujui, dan `min-height` banner harus
  disesuaikan bila teks promo berubah.

## 7. Pernyataan penggunaan AI dan pembagian kerja

- **Alat AI:** Claude Code dipakai sebagai asisten utama. Atas permintaan tim, AI
  menulis harness pengukuran otomatis (`laporan/skrip/`), menjalankan dan menganalisis pengukuran, mendiagnosis dari
  trace, menulis seluruh perbaikan kode dan uji fungsional, serta menyusun draf `PREDIKSI.md`, `LAPORAN.md`,
  `AUDIT-AI.md`, dan `CATATAN-BELAJAR.md`. Untuk audit, usulan perbaikan dibuat oleh AI lain yang terpisah (Claude
  Sonnet, tanpa akses ke trace), lihat `AUDIT-AI.md`.
- **Yang harus dilakukan tim sebelum menyerahkan:** memverifikasi angka dengan merekam ulang skenario secara manual
  di DevTools dan mengambil tangkapan layar panel Performance; **merekam video demo** (S1-S5 sebelum/sesudah, CPU
  4x; sebelum = `git checkout 3dfa4fb`); mengisi nama tim dan pembagian kerja; dan memastikan setiap anggota bisa
  menjelaskan setiap perbaikan (`CATATAN-BELAJAR.md`).
- **Pembagian kerja:**
| Anggota | Fokus (tiket) | Temuan & perbaikan yang dikuasai | Skenario yang direkam ulang | Berkas kode | Tugas tambahan |
| :---: | :--- | :--- | :--- | :--- | :--- |
| Amalia Khoerina | Pencarian & render kisi (TK-1041) | T-01 (P-02, P-03, P-04, P-16), T-10 (P-05, P-14) | S1 | `katalog.js`, `pencarian.js`, `util.js` | Membuktikan ulang dugaan Rudi #1 (`kategori.js`) dan #3 (bubble sort) yang keliru |
| Diaz Putri Izzatunisa | Voucher (TK-1057) | T-02 (P-11, P-12) | S4 | `harga-promo.js` | Pemilik `AUDIT-AI.md`: cek ulang A-01 sampai A-03 dan tulis refleksi dengan kata-kata tim sendiri |
| Muhammad Nabil Syauqi Rasyiq | Keranjang, Beli sekarang, analitik (TK-1044, TK-1052) | T-03 (P-08), T-05 (P-09), T-06 (P-10) | S2, S3 (cek lencana Pesanan dan log terminal server) | `keranjang.js`, `analitik.js` | Membuktikan dugaan Rudi #5 (SDK) dan memeriksa ketujuh event analitik masih terkirim |
| Praditama Ajmal Hasan | Gulir & gambar (TK-1063, TK-1081) | T-04 (P-01, P-17), T-07 (P-06, P-15) | S0 (panel Network), S5 | `gulir.js`, `gambar.js`, `toko.css` | Pemilik bagian 6 laporan: menjelaskan kenapa target S5 belum tercapai, ditambah dugaan Rudi #2 dan klaim "server lemot" |
| Zaidan Arkaan Azharuddya Asshauqi | Halaman diam & layout shift (TK-1070, TK-1078) + koordinator | T-08 (P-07, P-18), T-09 (P-13) | S6, S0 (CLS) | `promo.js`, `index.html`, `toko.css` | Menyunting video demo, mengisi identitas tim dan bagian 2 & 7 laporan, memeriksa urutan commit PREDIKSI sebelum commit perbaikan |