import { saatSenggang } from './util.js';

const antrean = [];
let terjadwal = false;

function kirimKeSdk(nama, data) {
    if (window.Lacak) window.Lacak.kirim(nama, data);
}

function jadwalkan() {
    if (terjadwal || antrean.length === 0) return; 
    terjadwal = true;
    saatSenggang(() => {
    terjadwal = false;
    // Satu event per periode senggang: satu panggilan SDK sudah memakan sebagian besar jatah ±50 ms.
    const [nama, data] = antrean.shift();
    kirimKeSdk(nama, data);
    jadwalkan();
});
}

export function kirim(nama, data) {
    antrean.push([nama, data]);
    jadwalkan();
}

function kuras() {
    if (pewaktuImpresi) {
    clearTimeout(pewaktuImpresi);
    kirimImpresi();
}
while (antrean.length) {
    const [nama, data] = antrean.shift();
    kirimKeSdk(nama, data);
}
}

window.addEventListener('pagehide', kuras);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') kuras();
});

// Data produk yang relevan untuk analitik, tanpa field turunan/tampilan.
export function ringkasProduk(p) {
    return { id: p.id, nama: p.nama, merek: p.merek, kategori: p.kategori, harga: p.harga, diskon: p.diskon, flashSale: p.flashSale };
}
