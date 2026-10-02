// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $ } from './util.js';
import { catatImpresi } from './analitik.js';
import { tahanGambar } from './gambar.js';

const sudahTercatat = new Set();
let pengamatKartu = null;

// Kartu yang masuk layar (±80 px) dimunculkan dengan animasi dan dicatat sebagai impresi.
// IntersectionObserver menghitung perpotongan sebagai bagian dari langkah rendering browser,
// jadi tidak ada getBoundingClientRect (layout paksa) di setiap event gulir.
function kartuMasukLayar(entri) {
  const impresiBaru = [];
  for (const e of entri) {
    if (!e.isIntersecting) continue;
    const kartu = e.target;
    kartu.classList.add('terlihat');
    pengamatKartu.unobserve(kartu);
    if (!sudahTercatat.has(kartu.dataset.id)) {
      sudahTercatat.add(kartu.dataset.id);
      impresiBaru.push(kartu.dataset.id);
    }
  }
  if (impresiBaru.length) catatImpresi(impresiBaru);
}

export function amatiKartu(kartu) {
  pengamatKartu.observe(kartu);
}

export function pasangGulir() {
  const kepala = $('#kepala');
  const bar = $('#bar-gulir');
  const keAtas = $('#ke-atas');
  pengamatKartu = new IntersectionObserver(kartuMasukLayar, { rootMargin: '80px 0px' });

  // Tampilan yang bergantung posisi gulir diperbarui paling banyak sekali per frame, dari listener
  // pasif (compositor tidak perlu menunggu main thread untuk menggulir). Bar memakai transform
  // (tanpa layout). Tinggi yang bisa digulir disimpan; ResizeObserver memperbaruinya setelah layout,
  // jadi membacanya di sana tidak memaksa layout baru.
  let tinggiGulir = 1;
  let terjadwal = false;
  let keAtasTampil = !keAtas.hidden;
  let yLalu = window.scrollY;
  let tLalu = performance.now();

  function perbarui(t) {
    terjadwal = false;
    const y = window.scrollY;
    // Saat daftar dikibas cepat (> 1,5 px/ms), gambar yang hanya lewat tidak perlu dimuat (lihat gambar.js).
    if (Math.abs(y - yLalu) / Math.max(t - tLalu, 1) > 1.5) tahanGambar(150);
    yLalu = y;
    tLalu = t;
    kepala.classList.toggle('melayang', y > 8);
    const tampil = y >= 900;
    if (tampil !== keAtasTampil) {
      keAtas.hidden = !tampil;
      keAtasTampil = tampil;
    }
    bar.style.transform = 'scaleX(' + Math.min(y / tinggiGulir, 1).toFixed(4) + ')';
  }

  function jadwalkan() {
    if (terjadwal) return;
    terjadwal = true;
    requestAnimationFrame(perbarui);
  }

  window.addEventListener('scroll', jadwalkan, { passive: true });
  new ResizeObserver(() => {
    tinggiGulir = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    jadwalkan();
  }).observe(document.documentElement);

  // Pull-to-refresh dicegah lewat CSS (overscroll-behavior-y), bukan listener touchmove non-pasif
  // yang membuat setiap gerakan jari menunggu main thread.

  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0 }));
}
