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


## P-02: Website langsung generate seluruh 3000 jenis produk tampilan dalam 1 task

**Tiket terkait:** TK-1041 (utama), TK-1063, TK-1070, TK-1081
**Tanggal dan hash commit entri ini:** 1-10-2026,

### Sebelum perbaikan

* **Yang teramati di trace (baseline):** trace S0 kode awal (ulangan 1, di perpanjang sampai render selesai) memperlihatkan satu task 88.071 ms setelah /api/produk tiba. Isinya (bottom-up, total perfungsi) : renderProduk 76.808 ms, yang terdiri dari samakanTinggiJudul 38.009 ms (24 Layout paksa, total 31.105 ms), buatKartu 23.946 ms (formatRupiah 9.710 ms, el 4.429 ms, createElement 1.478 ms), dan periksaGulir 13.721 ms (satu  Layout paksa 11.721 ms di window.scrollY). Ada 30 event Layout (43,3 detik) dan 31 Recalculate Style (7,5 detik) di dalam tak itu. Setelah P-01 task ini masih 77,9 - 80,3 detik, dan S6 masih sibuk 94-96% dengan Layout -+ 2 detik per 10 detik.
* **Dugaan mekanisme:** renderProduk membuat semua kartu (-+ 15 node per kartu, -+45.000 node) di satu task. Selama task berjalan event loop tidak mengambil task lain, termasuk input dan rendering. Semua biaya sebanding dengan N : membuat node, formatRupiah per kartu, dan setiap Layout (paksa maupun tidak) harus menata grid 3000 item. Ketika pengguna mengetik di kolom cari terapkanSaringan memanggil renderProduk lagi untuk setiap huruf. Menghapus kata kunci berarti membangun ulang 3000 kartu. Di luar interaksi pun, setiap frame yang layoutnya kotor (animasi, timer) menata ualng DOM sebesar itu.

* **Rencana perubahan:** render bertahap. jadi renderProduk hanya membangun 24 kartu pertama (DocumentFragment) di ujung kisi ada penanda #ujung-kisi yang diamati IntersectionObserver dengan rootMargin 1500px. saat  penanda mendekati layar, 24 kartu berikutnya ditambahkan. observe ulang dipakai supaya batch berikutnya ikut dimuat bila penanda masih dekat. penanda berisi tombol "Tampilkan 24 produk berikutnya"untuk pengguna keyboard/pembaca layar. Ringkasan tetap menampilkan jumlah hasil total. Voucher me-render ulang sebanyak kartu yang sudah tampil, tidak kembali ke 24.

* **Prediksi terukur:**

1. S0 : task terlama saat turun dari -+ 80 detik menjadi =< 1,5 detik.  Biaya yang sebanding dengan N turun sekitar 3000/24 = 125 kali (-+ 0,6 detik tersisa), ditambah biaya tetap seperti pasangKaki (-+ 0,5 detik karena inisialisasi ICU pada toLocaleString pertama).
2. S6 : persentase sibuk dari main thread turun dari -+ 95 % menjadi =< 50%. Layout per frame sekarang hanya menata 24 kartu, tetapi timer 10 ms dan animasi tetap ada.
3. S1 : INP turun dari puluhan detik (setiap huruf = render ulang ratusan sampai 3000 kartu) menjadi hanya -+ 0,5 - 1 detik. sisanya berasal dari 24 layout paksa samakanTinggiJudul, formatRupiah baru perkartu, dan panggilan SDK search perhuruf (41 ms). Belum mencapai 200 ms.
4. Prediksi efek samping yang mungkin timbul dan memburuk adalah Ctrl+F browser tidak menemukan produk yang belum di render. scrollbar tidak lagi mewakili panjang daftar, kaki halaman terus terdorong saat daftar dimuat bertahap atau browser menambah batch saat menggulir bisa memunculkan satu frame lambat.

* **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**

1. Visualisasi penuh (hanya -+ 20 kartu di DOM, didaur ulang saat menggulir). jadi DOM konstan, tapi membutuhkan tinggi baris tetap dan penempatan absolut, fokus keyboard dan pembaca layar lebih sulit, dan kodenya jauh lebih rumit untuk tugas tanpa framework.
2. contetnt-visibility: auto pada kartu tanpa render bertahap : layout/paint kartu di luar layar dilewati, tetapi membuat 3000 kartu (JS -+ 24 detik) tetap terjadi di setiap render.
3. Tombol "Muat lebih banyak" saja tanpa pemuatan otomatis : lebih sederhana, tapi pengguna harus menekan tombol 125 kali untuk menjangkau semua produk dengan menggulir (tpi ini melanggar aturan ke 3)

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....
