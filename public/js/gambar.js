// Pemuat gambar produk.
//
// Setiap gambar produk (SVG dari CDN) yang tiba membuat dan menata dokumen SVG sendiri di main thread
// (±20 ms pada CPU 4x). Karena itu alamat gambar baru dipasang bila gambar dekat layar DAN halaman
// sedang "tenang": tidak sedang dikibas cepat dan tidak sedang diketik. Gambar yang hanya lewat saat
// pengguna mengibas daftar, atau milik hasil pencarian sementara, tidak pernah dimuat.

const dekat = new Set(); // <img data-src> yang sedang dalam jarak 800 px dari layar
let tenangPada = 0; // performance.now() paling awal gambar boleh dipasang
let pewaktu = null;

function muat() {
  pewaktu = null;
  const sisa = tenangPada - performance.now();
  if (sisa > 0) {
    pewaktu = setTimeout(muat, sisa);
    return;
  }
  for (const gambar of dekat) {
    gambar.src = gambar.dataset.src;
    gambar.removeAttribute('data-src');
    pengamat.unobserve(gambar);
  }
  dekat.clear();
}

function jadwalkan() {
  if (!pewaktu && dekat.size) pewaktu = setTimeout(muat, Math.max(tenangPada - performance.now(), 0));
}

const pengamat = new IntersectionObserver((entri) => {
  for (const e of entri) {
    if (e.isIntersecting) dekat.add(e.target);
    else dekat.delete(e.target);
  }
  jadwalkan();
}, { rootMargin: '800px 0px' });

// Gambar yang alamatnya ada di data-src; dipasang oleh pemuat saat waktunya tepat.
export function daftarkanGambar(gambar) {
  pengamat.observe(gambar);
}

// Tunda pemasangan gambar setidaknya ms dari sekarang (dipanggil saat mengibas atau mengetik).
export function tahanGambar(ms) {
  tenangPada = Math.max(tenangPada, performance.now() + ms);
}
