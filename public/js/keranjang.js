// Keranjang belanja, riwayat penelusuran, dan "Beli sekarang".
// Semua disimpan di localStorage supaya tetap ada walau halaman dimuat ulang.
import { $, el, formatRupiah, hargaSetelahDiskon, saatSenggang, salinDalam, tampilkanToast } from './util.js';
import * as analitik from './analitik.js';

const KUNCI_KERANJANG = 'tk_keranjang';
const KUNCI_RIWAYAT = 'tk_riwayat';

const KONFIG = { maksPerProduk: 99, mataUang: 'IDR', sumber: 'web-flashsale-1212' };

function bacaKeranjang() {
  return JSON.parse(localStorage.getItem(KUNCI_KERANJANG) || '[]');
}
function simpanKeranjang(isi) {
  localStorage.setItem(KUNCI_KERANJANG, JSON.stringify(isi));
}
function bacaRiwayat() {
  return JSON.parse(localStorage.getItem(KUNCI_RIWAYAT) || '[]');
}
function simpanRiwayat(riwayat) {
  localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(riwayat));
}

// Riwayat (±9000 entri, ±1,2 MB JSON) tidak lagi di-parse lalu di-stringify utuh di setiap klik.
// Entri baru ditampung di memori, lalu di waktu senggang teks JSON-nya disisipkan sebelum "]" pada
// string yang tersimpan: format di localStorage tetap array JSON yang sama untuk tim rekomendasi.
const riwayatTertunda = [];
const riwayatSesi = []; // hingga 20 aktivitas terakhir sesi ini, untuk konteks analitik
let simpanTerjadwal = false;

function catatRiwayat(entri) {
  riwayatTertunda.push(entri);
  riwayatSesi.push(entri);
  if (riwayatSesi.length > 20) riwayatSesi.shift();
  if (!simpanTerjadwal) {
    simpanTerjadwal = true;
    saatSenggang(simpanRiwayatTertunda);
  }
}

function simpanRiwayatTertunda() {
  simpanTerjadwal = false;
  if (!riwayatTertunda.length) return;
  const entri = riwayatTertunda.splice(0);
  const lama = localStorage.getItem(KUNCI_RIWAYAT) || '[]';
  if (lama === '[]') {
    localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(entri));
  } else if (lama.endsWith(']')) {
    localStorage.setItem(KUNCI_RIWAYAT, lama.slice(0, -1) + ',' + entri.map((e) => JSON.stringify(e)).join(',') + ']');
  } else {
    // teks tersimpan tidak berbentuk array utuh: pakai jalur lama supaya tidak menulis JSON rusak
    const riwayat = bacaRiwayat();
    riwayat.push(...entri);
    simpanRiwayat(riwayat);
  }
}

// Jangan kehilangan entri yang masih tertunda saat halaman ditutup atau ditinggal.
window.addEventListener('pagehide', simpanRiwayatTertunda);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') simpanRiwayatTertunda();
});

// Riwayat aktivitas dipakai tim rekomendasi ("Karena kamu melihat...").
// Untuk pengembangan, kita isi dengan data contoh pelanggan lama yang aktif
// sejak 2023 supaya kondisinya mirip pengguna sungguhan.
export function siapkanRiwayatContoh(semuaProduk) {
  if (localStorage.getItem(KUNCI_RIWAYAT)) return;
  const riwayat = [];
  const jenis = ['lihat', 'lihat', 'lihat', 'cari', 'keranjang', 'beli'];
  let waktu = Date.parse('2023-01-05T08:00:00+07:00');
  for (let i = 0; i < 9000; i++) {
    const p = semuaProduk[(i * 131) % semuaProduk.length];
    waktu += 1000 * 60 * (7 + (i % 190));
    riwayat.push({ t: waktu, jenis: jenis[i % jenis.length], id: p.id, nama: p.nama, kategori: p.kategori, harga: p.harga });
  }
  simpanRiwayat(riwayat);
}

export function perbaruiLencana(isi = bacaKeranjang()) {
  const total = isi.reduce((n, item) => n + item.jumlah, 0);
  $('#lencana-keranjang').textContent = total;
}

function gambarPanel() {
  const daftar = $('#daftar-keranjang');
  const isi = bacaKeranjang();
  daftar.innerHTML = '';
  let total = 0;
  if (isi.length === 0) daftar.append(el('li', '', 'Keranjang masih kosong. Tambahkan produk dari daftar.'));
  for (const item of isi) {
    total += item.harga * item.jumlah;
    const baris = el('li');
    baris.append(el('span', '', item.nama), el('span', 'jumlah', item.jumlah + ' x ' + formatRupiah(item.harga)));
    const hapus = el('button', 'hapus', 'Hapus dari keranjang');
    hapus.type = 'button';
    hapus.addEventListener('click', () => {
      simpanKeranjang(bacaKeranjang().filter((x) => x.id !== item.id));
      perbaruiLencana();
      gambarPanel();
    });
    baris.append(hapus);
    daftar.append(baris);
  }
  $('#total-keranjang').textContent = formatRupiah(total);
}

export function tambahKeKeranjang(produk, tombol) {
  const konfig = salinDalam(KONFIG);
  const keranjang = bacaKeranjang();

  const ada = keranjang.find((item) => item.id === produk.id);
  if (ada) ada.jumlah = Math.min(ada.jumlah + 1, konfig.maksPerProduk);
  else keranjang.push({ id: produk.id, nama: produk.nama, harga: hargaSetelahDiskon(produk), jumlah: 1 });

  simpanKeranjang(keranjang);

  // Umpan balik di task yang sama, sehingga tergambar di frame berikutnya.
  perbaruiLencana(keranjang);
  tombol.textContent = 'Ditambahkan ✓';
  tombol.classList.add('sudah');
  setTimeout(() => {
    tombol.textContent = '+ Keranjang';
    tombol.classList.remove('sudah');
  }, 1500);
  tampilkanToast('Ditambahkan ke keranjang: ' + produk.nama);
  
  // Yang tidak mendesak menyusul di waktu senggang: riwayat dan analitik (produk, isi keranjang,
  // dan aktivitas terakhir sesi ini; bukan riwayat 9000 entri yang harus di-parse dulu).
  catatRiwayat({ t: Date.now(), jenis: 'keranjang', id: produk.id, nama: produk.nama, kategori: produk.kategori, harga: produk.harga });
  analitik.kirim('add_to_cart', { produk: analitik.ringkasProduk(produk), keranjang, riwayatTerakhir: riwayatSesi.slice(), sumber: konfig.sumber });

}

export async function beliSekarang(produk, tombol) {
  const konfig = salinDalam(KONFIG);
  catatRiwayat({ t: Date.now(), jenis: 'beli', id: produk.id, nama: produk.nama, kategori: produk.kategori, harga: produk.harga });
  analitik.kirim('begin_checkout', { produk: analitik.ringkasProduk(produk), riwayatTerakhir: riwayatSesi.slice(), sumber: konfig.sumber });

  const respons = await fetch('/api/pesanan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produkId: produk.id, nama: produk.nama }),
  });
  const pesanan = await respons.json();

  tombol.textContent = 'Dipesan ✓';
  setTimeout(() => { tombol.textContent = 'Beli sekarang'; }, 1500);
  tampilkanToast('Pesanan ' + pesanan.id + ' dibuat: ' + produk.nama);
  perbaruiLencanaPesanan();
}

export async function perbaruiLencanaPesanan() {
  const respons = await fetch('/api/pesanan');
  const pesanan = await respons.json();
  $('#lencana-pesanan').textContent = pesanan.length;
  return pesanan;
}

export function pasangKeranjang() {
  const panel = $('#panel-keranjang');
  const tombolBuka = $('#tombol-keranjang');
  const buka = (ya) => {
    panel.hidden = !ya;
    tombolBuka.setAttribute('aria-expanded', String(ya));
    if (ya) gambarPanel();
  };
  tombolBuka.addEventListener('click', () => buka(panel.hidden));
  $('#tutup-keranjang').addEventListener('click', () => buka(false));
  $('#kosongkan-keranjang').addEventListener('click', () => {
    simpanKeranjang([]);
    perbaruiLencana();
    gambarPanel();
  });

  $('#tombol-pesanan').addEventListener('click', async () => {
    const pesanan = await perbaruiLencanaPesanan();
    if (pesanan.length === 0) return tampilkanToast('Belum ada pesanan. Tekan "Beli sekarang" pada produk untuk memesan.');
    const terakhir = pesanan.slice(-3).map((p) => p.id + ' (produk #' + p.produkId + ')').join(', ');
    tampilkanToast(pesanan.length + ' pesanan. Terakhir: ' + terakhir);
  });

  perbaruiLencana();
  perbaruiLencanaPesanan();
}
