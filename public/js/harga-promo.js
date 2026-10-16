// Voucher: menghitung harga promo untuk setiap produk.
// Aturan promo bertingkat + simulasi cicilan ditentukan tim bisnis.

import { $, formatAngka, hargaSetelahDiskon, tampilkanToast } from './util.js';
import { keadaan, perbaruiHargaVoucherDiKartu } from './katalog.js';
import * as analitik from './analitik.js';

const VOUCHER = {
  KILAT1212: { persen: 12, maksPotongan: 120000, minBelanja: 50000 },
  HEMAT50: { persen: 5, maksPotongan: 50000, minBelanja: 0 },
};

// Cicilan 0% sampai 24 bulan: cari tenor dengan angsuran paling ringan yang
// masih memenuhi batas minimal angsuran per bulan dari mitra pembiayaan.
function simulasiCicilan(harga) {
  let terbaik = { tenor: 1, angsuran: harga };
  for (let tenor = 1; tenor <= 24; tenor++) {
    let sisa = harga;
    let angsuran = Math.ceil(harga / tenor / 100) * 100;
    for (let bulan = 1; bulan <= tenor; bulan++) {
      const biayaAdmin = Math.round(sisa * 0.0005 * Math.log2(bulan + 1));
      sisa = sisa - angsuran + biayaAdmin;
      if (sisa < 0) sisa = 0;
    }
    angsuran += Math.ceil(sisa / tenor);
    if (angsuran >= 25000 && angsuran < terbaik.angsuran) terbaik = { tenor, angsuran };
  }
  return terbaik;
}

// Fungsi biasa (sinkron). Menandainya async tidak membuat perhitungan berhenti memblokir halaman:
// await pada promise yang sudah selesai hanya menjadwalkan microtask, dan semua microtask dikuras
// dalam task yang sama sebelum browser sempat menggambar atau menangani input.
function hitungHargaPromo(produk, aturan) {
  const dasar = hargaSetelahDiskon(produk);
  if (dasar < aturan.minBelanja) return null;
  let potongan = Math.min(Math.round((dasar * aturan.persen) / 100), aturan.maksPotongan);
  if (produk.flashSale) potongan = Math.round(potongan / 2); // flash sale hanya dapat setengah
  const hargaAkhir = Math.max(dasar - potongan, 100);
  // Dulu di sini ada 40 panggilan simulasiCicilan(hargaAkhir + i) sebagai "cek kestabilan pembulatan".
  // simulasiCicilan adalah fungsi murni dan hasil ke-40 panggilan itu tidak pernah dipakai, jadi
  // dihapus: 97% kerja CPU voucher hilang tanpa mengubah hasil.
  const cicilan = simulasiCicilan(hargaAkhir);
  return { hargaAkhir, cicilan };
}

// Menyerahkan giliran ke event loop dengan task baru, supaya input dan rendering yang tertunda sempat
// berjalan. scheduler.yield() mendahulukan lanjutan ini dibanding task lain; MessageChannel sebagai cadangan
// (tanpa jeda minimum 4 ms seperti setTimeout bersarang).
function beriGiliran() {
  if (globalThis.scheduler && typeof globalThis.scheduler.yield === 'function') return globalThis.scheduler.yield();
  return new Promise((selesai) => {
    const kanal = new MessageChannel();
    kanal.port1.onmessage = () => selesai();
    kanal.port2.postMessage(null);
  });
}

const JATAH_IRISAN_MS = 8; // lama satu irisan kerja sebelum giliran diserahkan (setengah frame 60 Hz)
let generasi = 0; // penerapan voucher baru membatalkan perhitungan yang masih berjalan

async function terapkanVoucher(kode) {
  const aturan = VOUCHER[kode];
  if (!aturan) {
    tampilkanToast('Kode voucher "' + kode + '" tidak dikenal. Coba KILAT1212.');
    return;
  }

  const saya = ++generasi;
  const tombol = $('#tombol-voucher');
  const progres = $('#progres');
  const isi = $('#progres-isi');
  const teks = $('#progres-teks');
  const produk = keadaan.semuaProduk;
  const total = produk.length;
  const tampilkanProgres = (selesai) => {
    const persen = Math.round((selesai / total) * 100);
    isi.style.width = persen + '%';
    teks.textContent = 'Menghitung harga promo… ' + persen + '% (' + selesai + ' dari ' + total + ' produk)';
  };
  tombol.setAttribute('aria-busy', 'true');
  progres.hidden = false;
  tampilkanProgres(0);

  // Hasil ditampung di Map baru dan ditukar sekaligus di akhir: kartu yang dirender selama perhitungan
  // (misalnya karena pengguna mengetik) tidak menampilkan harga voucher setengah jadi.
  const hargaBaru = new Map();
  const cicilanBaru = new Map();
  let i = 0;
  await beriGiliran(); // biarkan progres 0% tergambar dulu
  while (i < total) {
    if (saya !== generasi) return;
    const batas = performance.now() + JATAH_IRISAN_MS;
    do {
      const hasil = hitungHargaPromo(produk[i], aturan);
      if (hasil) {
        hargaBaru.set(produk[i].id, hasil.hargaAkhir);
        cicilanBaru.set(produk[i].id, hasil.cicilan);
      }
      i++;
    } while (i < total && performance.now() < batas);
    tampilkanProgres(i);
    await beriGiliran();
  }
  if (saya !== generasi) return;

  keadaan.hargaVoucher = hargaBaru;
  keadaan.cicilanVoucher = cicilanBaru;
  perbaruiHargaVoucherDiKartu();
  progres.hidden = true;
  tombol.removeAttribute('aria-busy');
  tampilkanToast('Voucher ' + kode + ' dipakai di ' + formatAngka(keadaan.hargaVoucher.size) + ' produk.');
  analitik.kirim('apply_voucher', { kode, jumlah: keadaan.hargaVoucher.size });
}

export function pasangVoucher() {
  const kolom = $('#kolom-voucher');
  $('#tombol-voucher').addEventListener('click', () => terapkanVoucher(kolom.value.trim().toUpperCase()));
  kolom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') terapkanVoucher(kolom.value.trim().toUpperCase());
  });
}
