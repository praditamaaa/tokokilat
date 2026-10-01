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
