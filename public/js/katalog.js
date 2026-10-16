// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, el, formatAngka, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { amatiKartu } from './gulir.js';
import { daftarkanGambar, tahanGambar } from './gambar.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  dirender: 0, // berapa kartu pertama dari `ditampilkan` yang sudah ada di DOM
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
  cicilanVoucher: new Map(), // id produk -> simulasi cicilan 0% ({ tenor, angsuran }) untuk harga voucher
};

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  return keadaan.semuaProduk;
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) {
    // Kartu berlencana tidak diberi content-visibility (lihat toko.css): animasi di dalamnya memaksa frame main thread.
    kartu.classList.add('kartu-kilat');
    kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));
  }

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
  // Alamat gambar dipasang oleh pemuat (gambar.js): saat dekat layar dan halaman tidak sedang
  // dikibas cepat atau diketik.
  gambar.dataset.src = produk.gambar;
  daftarkanGambar(gambar);
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

// Kartu dibangun bertahap: mula-mula satu halaman (12 kartu = 6 baris, lebih dari satu layar plus
// jarak lazy-load), halaman berikutnya baru dibangun saat penanda #ujung-kisi mendekati layar.
// Membangun 3000 kartu sekaligus membuat satu task puluhan detik, dan setiap Layout sesudahnya harus
// menata grid 3000 item.
const UKURAN_HALAMAN = 12;
let pengamatUjung = null;

// Selama pengguna mengetik, hasil sementara berganti tiap huruf dan gambarnya tidak pernah sempat
// dilihat, jadi pemasangan gambar ditahan sampai 350 ms setelah render pencarian terakhir.
const JEDA_GAMBAR_MS = 350;

// Elemen kartu disimpan per id produk. Render berikutnya (misalnya huruf berikutnya di kolom cari)
// memakai elemen yang sama untuk produk yang sama: tidak ada createElement ulang, gambar yang sudah
// dimuat tetap ada, dan kartu yang tetap di kisi tidak dilepas dari DOM sehingga hasil style/layout/
// paint-nya bisa dipakai lagi oleh browser. Paling banyak 600 kartu; yang terlama dan tidak tampil dibuang.
const MAKS_KARTU_TERSIMPAN = 600;
const kartuTersimpan = new Map(); // id produk -> elemen kartu (urutan = terakhir dipakai)

function kartuUntuk(produk) {
  let kartu = kartuTersimpan.get(produk.id);
  if (kartu) {
    kartuTersimpan.delete(produk.id);
    segarkanHargaVoucher(kartu);
  } else {
    kartu = buatKartu(produk);
    amatiKartu(kartu);
  }
  kartuTersimpan.set(produk.id, kartu);
  if (kartuTersimpan.size > MAKS_KARTU_TERSIMPAN) {
    for (const [id, lama] of kartuTersimpan) {
      if (!lama.isConnected) {
        kartuTersimpan.delete(id);
        break;
      }
    }
  }
  return kartu;
}

function tambahKartu(jumlah) {
  const daftar = keadaan.ditampilkan;
  const mulai = keadaan.dirender;
  const akhir = Math.min(mulai + jumlah, daftar.length);
  const potongan = document.createDocumentFragment();
  for (let i = mulai; i < akhir; i++) potongan.append(kartuUntuk(daftar[i]));
  const pertama = potongan.firstElementChild;
  keadaan.dirender = akhir;
  $('#kisi').append(potongan);

  perbaruiUjung();
  return pertama;
}

// Susun isi kisi menjadi `diinginkan` dengan perubahan DOM sekecil mungkin: kartu yang tidak lagi
// dipakai dilepas, kartu yang tetap dibiarkan di tempatnya, kartu baru disisipkan di posisinya.
function susunKisi(kisi, diinginkan) {
  const tetap = new Set(diinginkan);
  for (const anak of [...kisi.children]) if (!tetap.has(anak)) anak.remove();
  let acuan = kisi.firstElementChild;
  for (const el of diinginkan) {
    if (el === acuan) {
      acuan = acuan.nextElementSibling;
      continue;
    }
    kisi.insertBefore(el, acuan);
  }
}

let pesanKosong = null;

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

  const diinginkan = [];
  const jumlah = Math.min(UKURAN_HALAMAN, daftar.length);
  if (tundaGambar) tahanGambar(JEDA_GAMBAR_MS);
  for (let i = 0; i < jumlah; i++) diinginkan.push(kartuUntuk(daftar[i]));
  if (daftar.length === 0) {
    if (!pesanKosong) {
      pesanKosong = el('div', 'kosong');
      pesanKosong.append(el('strong', '', 'Produk tidak ditemukan.'), el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".'));
    }
    diinginkan.push(pesanKosong);
  }
  susunKisi(kisi, diinginkan);
  keadaan.dirender = jumlah;
  perbaruiUjung();

  $('#ringkasan').textContent = formatAngka(daftar.length) + ' produk ditampilkan';
}

// Harga voucher baru: kartu yang sudah tampil diperbarui di tempat (baris harga voucher disisipkan),
// bukan dibangun ulang; posisi gulir dan fokus pengguna tetap.
function segarkanHargaVoucher(kartu) {
  const harga = kartu.querySelector('.harga');
  const lama = harga.querySelector('.harga-voucher');
  const hargaVoucher = keadaan.hargaVoucher.get(Number(kartu.dataset.id));
  const teks = hargaVoucher ? 'Pakai voucher: ' + formatRupiah(hargaVoucher) : null;
  if (lama && lama.textContent === teks) return;
  if (lama) lama.remove();
  if (teks) harga.append(el('span', 'harga-voucher', teks));
}

export function perbaruiHargaVoucherDiKartu() {
  for (const kartu of $('#kisi').querySelectorAll('.kartu')) segarkanHargaVoucher(kartu);
}
