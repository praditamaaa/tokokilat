// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

<<<<<<< HEAD
import { $, el, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { periksaGulir } from './gulir.js';
=======
import { $, el, formatAngka, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { amatiKartu } from './gulir.js';
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
<<<<<<< HEAD
=======
  dirender: 0, // berapa kartu pertama dari `ditampilkan` yang sudah ada di DOM
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  return keadaan.semuaProduk;
}

<<<<<<< HEAD
function buatKartu(produk) {
=======
function buatKartu(produk, tundaGambar) {
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;
  const gambar = document.createElement('img');
<<<<<<< HEAD
  gambar.src = produk.gambar;
=======
  // Ukuran asli SVG dari CDN 480x480: dengan width/height browser sudah tahu rasio 1:1 sebelum
  // berkasnya tiba, jadi tinggi kartu tidak berubah (tidak ada layout ulang/geser) saat gambar datang.
  gambar.width = 480;
  gambar.height = 480;
  // Diisi sebelum src: gambar baru diunduh saat mendekati layar, bukan 3000 sekaligus.
  gambar.loading = 'lazy';
  gambar.decoding = 'async';
  // Saat pengguna masih mengetik, alamat gambar ditahan dulu (lihat pasangGambarTertunda).
  if (tundaGambar) gambar.dataset.src = produk.gambar;
  else gambar.src = produk.gambar;
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663
  gambar.alt = produk.nama;
  media.append(gambar);

  const badan = el('div', 'kartu-badan');
  badan.append(el('h3', 'kartu-judul', produk.nama));

  const harga = el('div', 'harga');
  harga.append(el('span', 'harga-kini', formatRupiah(hargaSetelahDiskon(produk))));
  if (produk.diskon > 0) {
    harga.append(el('span', 'harga-asli', formatRupiah(produk.harga)));
    harga.append(el('span', 'harga-diskon', '-' + produk.diskon + '%'));
  }
  const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
  if (hargaVoucher) harga.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  badan.append(harga);

<<<<<<< HEAD
  badan.append(el('div', 'keterangan', '★ ' + produk.rating.toLocaleString('id-ID') + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
=======
  badan.append(el('div', 'keterangan', '★ ' + formatAngka(produk.rating) + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663
  badan.append(el('div', 'keterangan', produk.kota));

  const aksi = el('div', 'aksi');
  const tombolTambah = el('button', 'tombol-tambah', '+ Keranjang');
  tombolTambah.type = 'button';
  tombolTambah.addEventListener('click', () => tambahKeKeranjang(produk, tombolTambah));
  const tombolBeli = el('button', 'tombol-beli', 'Beli sekarang');
  tombolBeli.type = 'button';
  tombolBeli.addEventListener('click', () => beliSekarang(produk, tombolBeli));
  aksi.append(tombolTambah, tombolBeli);
  badan.append(aksi);

  kartu.append(media, badan);
  return kartu;
}

<<<<<<< HEAD
// Judul produk panjangnya beda-beda (1-3 baris). Supaya harga & tombol dalam
// satu deret sejajar rapi, tinggi judul disamakan mengikuti judul tertinggi.
// Mengukur semua judul terlalu lambat, jadi cukup ukur sebagian sebagai contoh.
const JUMLAH_CONTOH = 24;

function samakanTinggiJudul() {
  const judul = document.querySelectorAll('.kartu-judul');
  let tertinggi = 0;
  for (let i = 0; i < judul.length && i < JUMLAH_CONTOH; i++) {
    const j = judul[i];
    j.style.height = 'auto';
    const tinggi = j.offsetHeight;
    if (tinggi > tertinggi) tertinggi = tinggi;
    j.style.height = tertinggi + 'px';
  }
  judul.forEach((j) => { j.style.height = tertinggi + 'px'; });
}

export function renderProduk(daftar) {
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
=======
// Judul produk panjangnya beda-beda (1-4 baris). Supaya harga & tombol dalam satu deret sejajar rapi,
// setiap judul menempati tepat 3 baris lewat CSS (.kartu-judul: line-clamp + min-height), tanpa
// mengukur judul dari JavaScript. Mengukur (offsetHeight) setelah menulis style.height memaksa layout
// sinkron seluruh halaman di setiap judul.

// Kartu dibangun bertahap: mula-mula satu halaman (12 kartu = 6 baris, lebih dari satu layar plus
// jarak lazy-load), halaman berikutnya baru dibangun saat penanda #ujung-kisi mendekati layar.
// Membangun 3000 kartu sekaligus membuat satu task puluhan detik, dan setiap Layout sesudahnya harus
// menata grid 3000 item.
const UKURAN_HALAMAN = 12;
let pengamatUjung = null;

// Setiap gambar produk (SVG) yang tiba membuat dokumen SVG sendiri di main thread (±20 ms pada CPU 4x).
// Selama pengguna mengetik, hasil sementara berganti tiap huruf dan gambarnya tidak pernah sempat dilihat,
// jadi alamat gambar baru dipasang setelah tidak ada render pencarian selama 350 ms.
const JEDA_GAMBAR_MS = 350;
let pewaktuGambar = null;

function pasangGambarTertunda() {
  pewaktuGambar = null;
  for (const gambar of $('#kisi').querySelectorAll('img[data-src]')) {
    gambar.src = gambar.dataset.src;
    gambar.removeAttribute('data-src');
  }
}

function tambahKartu(jumlah, tundaGambar = false) {
  const daftar = keadaan.ditampilkan;
  const mulai = keadaan.dirender;
  const akhir = Math.min(mulai + jumlah, daftar.length);
  const potongan = document.createDocumentFragment();
  for (let i = mulai; i < akhir; i++) {
    const kartu = buatKartu(daftar[i], tundaGambar);
    amatiKartu(kartu);
    potongan.append(kartu);
  }
  const pertama = potongan.firstElementChild;
  keadaan.dirender = akhir;
  $('#kisi').append(potongan);

  samakanTinggiJudul();
  perbaruiUjung();
  periksaGulir();
  return pertama;
}

function perbaruiUjung() {
  const ujung = $('#ujung-kisi');
  const sisa = keadaan.ditampilkan.length - keadaan.dirender;
  ujung.hidden = sisa <= 0;
   $('#muat-lagi').textContent = 'Tampilkan ' + Math.min(UKURAN_HALAMAN, sisa) + ' produk berikutnya (' + formatAngka(sisa) + ' lagi)';
  // IntersectionObserver hanya melapor saat status berpotongan berubah. Penanda diamati ulang supaya,
  // bila masih dekat layar setelah kartu ditambah, halaman berikutnya ikut dibangun pada frame berikutnya.
  pengamatUjung.unobserve(ujung);
  if (sisa > 0) pengamatUjung.observe(ujung);
}

function siapkanUjung() {
  if (pengamatUjung) return;
  pengamatUjung = new IntersectionObserver((entri) => {
    if (entri.some((e) => e.isIntersecting)) tambahKartu(UKURAN_HALAMAN);
  }, { rootMargin: '0px 0px 1500px 0px' });
  // Jalur untuk keyboard/pembaca layar: tombol di penanda, fokus pindah ke kartu pertama yang baru.
  $('#muat-lagi').addEventListener('click', () => {
    const pertama = tambahKartu(UKURAN_HALAMAN);
    if (pertama) pertama.querySelector('a').focus();
  });
}

export function renderProduk(daftar, { tundaGambar = false } = {}) {
  siapkanUjung();
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
  keadaan.dirender = 0;
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663
  kisi.innerHTML = '';

  if (daftar.length === 0) {
    const kosong = el('div', 'kosong');
    kosong.append(el('strong', '', 'Produk tidak ditemukan.'), el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".'));
    kisi.append(kosong);
  }

<<<<<<< HEAD
  for (const produk of daftar) {
    kisi.append(buatKartu(produk));
  }

  samakanTinggiJudul();
  $('#ringkasan').textContent = daftar.length.toLocaleString('id-ID') + ' produk ditampilkan';
  periksaGulir();
}

export function perbaruiHargaVoucherDiKartu() {
  renderProduk(keadaan.ditampilkan);
=======
  tambahKartu(UKURAN_HALAMAN, tundaGambar);
  $('#ringkasan').textContent = formatAngka(daftar.length) + ' produk ditampilkan';
  clearTimeout(pewaktuGambar);
  pewaktuGambar = tundaGambar ? setTimeout(pasangGambarTertunda, JEDA_GAMBAR_MS) : null;
}

// Harga voucher baru: bangun ulang sebanyak kartu yang sudah tampil, supaya posisi gulir pengguna tetap.
export function perbaruiHargaVoucherDiKartu() {
  renderProduk(keadaan.ditampilkan, keadaan.dirender);
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663
}
