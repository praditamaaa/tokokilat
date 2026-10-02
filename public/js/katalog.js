// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, el, formatAngka, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { amatiKartu } from './gulir.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  dirender: 0, // berapa kartu pertama dari `ditampilkan` yang sudah ada di DOM
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  return keadaan.semuaProduk;
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;
  const gambar = document.createElement('img');
  // Ukuran asli SVG dari CDN 480x480: dengan width/height browser sudah tahu rasio 1:1 sebelum
  // berkasnya tiba, jadi tinggi kartu tidak berubah (tidak ada layout ulang/geser) saat gambar datang.
  gambar.width = 480;
  gambar.height = 480;
  // Diisi sebelum src: gambar baru diunduh saat mendekati layar, bukan 3000 sekaligus.
  gambar.loading = 'lazy';
  gambar.decoding = 'async';
  gambar.src = produk.gambar;
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

  badan.append(el('div', 'keterangan', '★ ' + formatAngka(produk.rating) + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
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

// Judul produk panjangnya beda-beda (1-4 baris). Supaya harga & tombol dalam satu deret sejajar rapi,
// setiap judul menempati tepat 3 baris lewat CSS (.kartu-judul: line-clamp + min-height), tanpa
// mengukur judul dari JavaScript. Mengukur (offsetHeight) setelah menulis style.height memaksa layout
// sinkron seluruh halaman di setiap judul.

// Kartu dibangun bertahap: mula-mula satu halaman (24 kartu), halaman berikutnya baru dibangun saat
// penanda #ujung-kisi mendekati layar. Membangun 3000 kartu sekaligus membuat satu task puluhan detik,
// dan setiap Layout sesudahnya harus menata grid 3000 item.
const UKURAN_HALAMAN = 24;
let pengamatUjung = null;

function tambahKartu(jumlah) {
  const daftar = keadaan.ditampilkan;
  const mulai = keadaan.dirender;
  const akhir = Math.min(mulai + jumlah, daftar.length);
  const potongan = document.createDocumentFragment();
  for (let i = mulai; i < akhir; i++) {
    const kartu = buatKartu(daftar[i]);
    amatiKartu(kartu);
    potongan.append(kartu);
  }
  const pertama = potongan.firstElementChild;
  keadaan.dirender = akhir;
  $('#kisi').append(potongan);

  perbaruiUjung();
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

export function renderProduk(daftar, jumlahAwal = UKURAN_HALAMAN) {
  siapkanUjung();
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
  keadaan.dirender = 0;
  kisi.innerHTML = '';

  if (daftar.length === 0) {
    const kosong = el('div', 'kosong');
    kosong.append(el('strong', '', 'Produk tidak ditemukan.'), el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".'));
    kisi.append(kosong);
  }

  tambahKartu(Math.max(jumlahAwal, UKURAN_HALAMAN));
  $('#ringkasan').textContent = formatAngka(daftar.length) + ' produk ditampilkan';
}

// Harga voucher baru: bangun ulang sebanyak kartu yang sudah tampil, supaya posisi gulir pengguna tetap.
export function perbaruiHargaVoucherDiKartu() {
  renderProduk(keadaan.ditampilkan, keadaan.dirender);
}
