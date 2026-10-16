import { muatProduk, renderProduk } from './katalog.js';
import { pasangPencarian } from './pencarian.js';
import { pasangKeranjang, siapkanRiwayatContoh } from './keranjang.js';
import { pasangVoucher } from './harga-promo.js';
import { pasangPromo } from './promo.js';
import { pasangGulir } from './gulir.js';
import { pasangKaki } from './kategori.js';
<<<<<<< HEAD
=======
import * as analitik from './analitik.js';
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663

async function mulai() {
  pasangPromo();
  pasangGulir();

  const produk = await muatProduk();
  siapkanRiwayatContoh(produk);

  pasangPencarian();
  pasangKeranjang();
  pasangVoucher();
  pasangKaki(produk);
  renderProduk(produk);

<<<<<<< HEAD
  if (window.Lacak) window.Lacak.kirim('page_view', { halaman: 'flashsale-1212', jumlahProduk: produk.length });
=======
  analitik.kirim('page_view', { halaman: 'flashsale-1212', jumlahProduk: produk.length });
>>>>>>> 1b4c6725201f41bd1dc2bd171e060263d96f0663
}

mulai();

// Alat ukur untuk tugas: aktif jika URL diberi ?ukur=1
if (new URLSearchParams(location.search).has('ukur')) {
  import('/alat/ukur.js');
}
