// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $ } from './util.js';
import { catatImpresi } from './analitik.js';

const sudahTercatat = new Set();
let pengamatKartu = null;

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

  let tinggiGulir = 1;
  let terjadwal = false;
  let keAtasTampil = !keAtas.hidden;

  function perbarui() {
    terjadwal = false;
    const y = window.scrollY;
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
