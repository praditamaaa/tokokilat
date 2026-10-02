// Elemen kampanye: hitung mundur, teks berjalan, dan banner promo.

import { $, el, tampilkanToast } from './util.js';
import * as analitik from './analitik.js';

// Flash sale berakhir tengah malam nanti (waktu perangkat).
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');

const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pasangHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik'), senti = $('#hm-senti');

  // Perseratus detik: "gulungan" angka 99..00 yang digeser animasi transform steps(100) sekali per detik.
  // Animasi transform dijalankan compositor, jadi angka tetap bergerak mulus tanpa JavaScript tiap 10 ms.
  let gulungan = null;
  if (!kurangiGerak) {
    senti.textContent = Array.from({ length: 100 }, (_, i) => duaDigit(99 - i)).join('\n');
    gulungan = senti.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
      { duration: 1000, iterations: Infinity, easing: 'steps(100, end)' },
    );
  }
  // Posisikan gulungan sesuai milidetik yang sudah berlalu dalam detik ini.
  const selaraskan = () => {
    if (gulungan) gulungan.currentTime = (1000 - (Math.max(akhir - Date.now(), 0) % 1000)) % 1000;
  };

  // Jam, menit, detik, dan garis cukup diperbarui sekali per detik, tepat saat detik berganti.
  // Garis memakai transform (tanpa layout) dan tidak lagi membaca offsetWidth.
  function detak() {
    const sisa = Math.max(akhir - Date.now(), 0);
    jam.textContent = duaDigit(Math.floor(sisa / 3600000));
    menit.textContent = duaDigit(Math.floor((sisa % 3600000) / 60000));
    detik.textContent = duaDigit(Math.floor((sisa % 60000) / 1000));
    garis.style.transform = 'scaleX(' + (sisa / (akhir - awal + 1)).toFixed(5) + ')';
    if (sisa === 0) {
      if (gulungan) gulungan.cancel();
      senti.textContent = '00';
      return;
    }
    setTimeout(detak, (sisa % 1000) + 5);
  }
  detak();
  selaraskan();

  // Hemat baterai: animasi bagian flash sale dijeda saat bagian itu tidak terlihat.
  const bagian = $('.kilat');
  new IntersectionObserver(([e]) => {
    bagian.classList.toggle('jeda', !e.isIntersecting);
    if (!gulungan || gulungan.playState === 'idle') return;
    if (e.isIntersecting) {
      selaraskan();
      gulungan.play();
    } else {
      gulungan.pause();
    }
  }).observe(bagian);
}

// Teks berjalan: animasi CSS transform (lihat .berjalan-teks di toko.css) yang dijalankan compositor.
// JS hanya menghitung titik awal dan durasi saat ukuran berubah, dengan kecepatan sama seperti versi
// lama (1 px per 10 ms = 100 px/detik). ResizeObserver berjalan setelah layout, jadi membaca lebar di
// sini tidak memaksa layout.
function pasangTeksBerjalan() {
  const teks = $('#berjalan-teks');
  const wadah = teks.parentElement;
  new ResizeObserver(() => {
    const lebarWadah = wadah.clientWidth;
    teks.style.setProperty('--mulai-berjalan', lebarWadah + 'px');
    teks.style.setProperty('--durasi-berjalan', (lebarWadah + teks.offsetWidth) / 100 + 's');
    wadah.classList.add('siap');
  }).observe(wadah);
}

async function pasangBannerPromo() {
  const respons = await fetch('/api/promo');
  const promo = await respons.json();

  const banner = el('section', 'promo-banner');
  const teks = el('div');
  teks.append(el('h2', '', promo.judul), el('p', '', promo.isi));
  const tombol = el('button', '', promo.tombol);
  tombol.type = 'button';
  tombol.addEventListener('click', () => {
    tampilkanToast('Syarat promo: berlaku 12 Desember, satu voucher per akun, tidak bisa digabung.');
    analitik.kirim('promo_click', { judul: promo.judul });
  });
  banner.append(teks, tombol);

  $('#utama').prepend(banner);
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangTeksBerjalan();
  pasangBannerPromo();
}
