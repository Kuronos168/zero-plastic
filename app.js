/*
 * Unplastic the Plastic (#unplastictheplastic)
 * Pencari tempat setor sampah plastik terdekat di Surabaya.
 *
 * Alur singkat:
 * 1. Data lokasi dibaca dari data/lokasi.json.
 * 2. Pengunjung menekan tombol → browser meminta izin lokasi.
 * 3. Jarak ke setiap lokasi dihitung (rumus haversine), 3 terdekat ditampilkan.
 * 4. Jika izin ditolak, pengunjung bisa mengetuk peta untuk menandai posisinya.
 *
 * Lokasi pengunjung TIDAK disimpan dan TIDAK dikirim ke mana pun.
 */

// ===== Pengaturan (aman diubah) =====
const PENGATURAN = {
  fileData: "data/lokasi.json",
  pusatAwal: [-7.2655, 112.7522], // Surabaya
  zoomAwal: 12,
  jumlahHasil: 3,
  batasJauhKm: 25,
  gayaPetaAwal: "standar"
};

// Nama tampilan untuk jenis plastik. Jenis yang tidak ada di sini tetap
// muncul sebagai filter dengan nama aslinya dari lokasi.json.
const LABEL_PLASTIK = {
  PET: "Botol minum (PET)",
  HDPE: "Botol sampo (HDPE)",
  PP: "Gelas & tutup (PP)",
  kresek: "Kresek",
  sachet: "Sachet",
  styrofoam: "Styrofoam"
};

// Pilihan tampilan peta. Semuanya gratis dan tanpa API key.
// Setiap gaya bisa terdiri dari beberapa lapisan (misalnya peta dasar + nama jalan).
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const ATRIBUSI_ESRI = 'Peta &copy; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const GAYA_PETA = {
  standar: {
    label: "Standar",
    lapisan: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    opsi: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }
  },
  terang: {
    label: "Terang",
    lapisan: [ESRI + "Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
              ESRI + "Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"],
    opsi: { maxNativeZoom: 16, maxZoom: 19, attribution: ATRIBUSI_ESRI }
  },
  gelap: {
    label: "Gelap",
    lapisan: [ESRI + "Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
              ESRI + "Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"],
    opsi: { maxNativeZoom: 16, maxZoom: 19, attribution: ATRIBUSI_ESRI }
  },
  satelit: {
    label: "Satelit",
    lapisan: [ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    opsi: { maxZoom: 19, attribution: "Citra &copy; Esri, Maxar, Earthstar Geographics" }
  }
};

// Ikon garis sederhana (SVG), dipakai di kartu.
const IKON = {
  jam: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  kontak: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/></svg>',
  rute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8-8-2Z"/></svg>'
};

// ===== Perhitungan (tanpa tampilan) =====

// Jarak garis lurus antara dua titik di bumi, dalam kilometer.
function jarakKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function lokasiValid(l) {
  return (
    l && typeof l.nama === "string" &&
    typeof l.lat === "number" && Number.isFinite(l.lat) && l.lat >= -90 && l.lat <= 90 &&
    typeof l.lng === "number" && Number.isFinite(l.lng) && l.lng >= -180 && l.lng <= 180
  );
}

function terimaPlastik(lokasi, jenis) {
  const cari = jenis.toLowerCase();
  return (lokasi.plastik_diterima || []).some(p => String(p).toLowerCase() === cari);
}

// Mengurutkan lokasi dari yang terdekat. Jika jenisPlastik diisi,
// hanya lokasi yang menerima jenis itu yang diikutkan.
function urutkanLokasi(daftarLokasi, lat, lng, jenisPlastik) {
  return daftarLokasi
    .filter(l => !jenisPlastik || terimaPlastik(l, jenisPlastik))
    .map(l => ({ lokasi: l, jarak: jarakKm(lat, lng, l.lat, l.lng) }))
    .sort((a, b) => a.jarak - b.jarak);
}

// Jarak sebagai [angka, satuan], misalnya ["1,3", "km"] atau ["850", "m"].
function bagianJarak(km) {
  if (km < 1) return [String(Math.max(10, Math.round(km * 100) * 10)), "m"];
  return [km.toLocaleString("id-ID", { minimumFractionDigits: km < 10 ? 1 : 0, maximumFractionDigits: 1 }), "km"];
}

function formatJarak(km) {
  return bagianJarak(km).join(" ");
}

function labelPlastik(jenis) {
  const kunci = Object.keys(LABEL_PLASTIK).find(k => k.toLowerCase() === String(jenis).toLowerCase());
  return kunci ? LABEL_PLASTIK[kunci] : jenis;
}

// Link rute Google Maps. Jika lokasi punya "tujuan_gmaps", Google Maps
// mencari tempat itu sendiri (lebih tepat bila koordinat kita hanya perkiraan).
function linkArah(lokasi) {
  const tujuan = lokasi.tujuan_gmaps ? encodeURIComponent(lokasi.tujuan_gmaps) : lokasi.lat + "," + lokasi.lng;
  return "https://www.google.com/maps/dir/?api=1&destination=" + tujuan;
}

function linkCariBankSampah(lat, lng) {
  return "https://www.google.com/maps/search/bank+sampah/@" + lat.toFixed(5) + "," + lng.toFixed(5) + ",14z";
}

// ===== Tampilan =====

const keadaan = {
  semuaLokasi: [],
  posisi: null, // { lat, lng, sumber: "gps" | "manual" }
  filter: null,
  peta: null,
  lapisan: null,
  lapisanDasar: null
};

// Membuat elemen HTML. Teks selalu dipasang sebagai teks biasa (aman).
function el(tag, atribut, isi) {
  const e = document.createElement(tag);
  Object.entries(atribut || {}).forEach(([k, v]) => {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  });
  [].concat(isi || []).forEach(anak => {
    if (anak === null || anak === undefined) return;
    e.append(typeof anak === "string" ? document.createTextNode(anak) : anak);
  });
  return e;
}

// Ikon dari daftar IKON (isi tetap, bukan data dari lokasi.json).
function ikonSvg(nama) {
  const wadah = document.createElement("span");
  wadah.innerHTML = IKON[nama];
  return wadah.firstChild;
}

const $ = id => document.getElementById(id);

function setStatus(teks) {
  $("status").textContent = teks;
}

function simpanPilihan(kunci, nilai) {
  try { localStorage.setItem(kunci, nilai); } catch (e) { /* abaikan */ }
}

function bacaPilihan(kunci) {
  try { return localStorage.getItem(kunci); } catch (e) { return null; }
}

async function muatData() {
  const res = await fetch(PENGATURAN.fileData, { cache: "no-cache" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("lokasi.json harus berupa array [ ... ]");
  return data.filter(l => {
    if (lokasiValid(l)) return true;
    console.warn("Lokasi dilewati karena nama/lat/lng tidak valid:", l);
    return false;
  });
}

function tampilkanInfoData() {
  const semua = keadaan.semuaLokasi.length;
  const belum = keadaan.semuaLokasi.filter(l => !l.terverifikasi).length;
  $("info-data").textContent = belum
    ? belum + " dari " + semua + " lokasi diambil dari sumber publik dan belum dicek langsung oleh tim. Hubungi tempatnya dulu sebelum datang."
    : semua + " lokasi dikumpulkan dari sumber resmi, berita, dan OpenStreetMap. Hubungi tempatnya dulu sebelum datang.";
}

function buatFilter() {
  const urutanLabel = Object.keys(LABEL_PLASTIK).map(k => k.toLowerCase());
  const jenis = new Map();
  keadaan.semuaLokasi.forEach(l =>
    (l.plastik_diterima || []).forEach(p => {
      const k = String(p).toLowerCase();
      if (!jenis.has(k)) jenis.set(k, String(p));
    })
  );
  const urut = [...jenis.keys()].sort((a, b) => {
    const ia = urutanLabel.indexOf(a), ib = urutanLabel.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  const wadah = $("filter");
  wadah.innerHTML = "";
  const pilihan = [{ nilai: null, label: "Semua" }].concat(
    urut.map(k => ({ nilai: jenis.get(k), label: labelPlastik(jenis.get(k)) }))
  );
  pilihan.forEach(p => {
    const chip = el("button", { type: "button", class: "chip", "aria-pressed": String(p.nilai === keadaan.filter) }, p.label);
    chip.addEventListener("click", () => {
      keadaan.filter = p.nilai;
      wadah.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", "true");
      tampilkanHasil();
    });
    wadah.append(chip);
  });
}

function pakaiGayaPeta(kunci) {
  const gaya = GAYA_PETA[kunci] || GAYA_PETA[PENGATURAN.gayaPetaAwal];
  if (keadaan.lapisanDasar) keadaan.peta.removeLayer(keadaan.lapisanDasar);
  keadaan.lapisanDasar = L.layerGroup(gaya.lapisan.map(url => L.tileLayer(url, gaya.opsi))).addTo(keadaan.peta);
  document.querySelectorAll(".pilih-peta button").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.gaya === kunci))
  );
  simpanPilihan("gayaPeta", kunci);
}

// Tombol pilihan gaya peta di pojok kanan atas peta.
function buatPilihanPeta() {
  const Kontrol = L.Control.extend({
    onAdd() {
      const wadah = el("div", { class: "pilih-peta", role: "group", "aria-label": "Gaya peta" });
      Object.entries(GAYA_PETA).forEach(([kunci, gaya]) => {
        const tombol = el("button", { type: "button", "data-gaya": kunci, "aria-pressed": "false" }, gaya.label);
        tombol.addEventListener("click", () => pakaiGayaPeta(kunci));
        wadah.append(tombol);
      });
      L.DomEvent.disableClickPropagation(wadah);
      return wadah;
    }
  });
  new Kontrol({ position: "topright" }).addTo(keadaan.peta);
}

function siapkanPeta() {
  if (keadaan.peta || typeof L === "undefined") return;
  keadaan.peta = L.map("peta", { zoomControl: false }).setView(PENGATURAN.pusatAwal, PENGATURAN.zoomAwal);
  L.control.zoom({ position: "bottomright" }).addTo(keadaan.peta);
  keadaan.lapisan = L.layerGroup().addTo(keadaan.peta);
  buatPilihanPeta();
  const tersimpan = bacaPilihan("gayaPeta");
  pakaiGayaPeta(GAYA_PETA[tersimpan] ? tersimpan : PENGATURAN.gayaPetaAwal);
  keadaan.peta.on("click", e => aturPosisi(e.latlng.lat, e.latlng.lng, "manual"));
}

function ikon(kelas, teks, ukuran) {
  return L.divIcon({
    className: "",
    html: '<div class="penanda ' + kelas + '">' + (teks || "") + "</div>",
    iconSize: [ukuran, ukuran],
    iconAnchor: [ukuran / 2, ukuran / 2],
    popupAnchor: [0, -ukuran / 2]
  });
}

function isiPopup(lokasi, jarak) {
  return el("div", {}, [
    el("strong", {}, lokasi.nama),
    el("br"),
    lokasi.jenis + " · " + formatJarak(jarak),
    el("br"),
    el("a", { href: linkArah(lokasi), target: "_blank", rel: "noopener" }, "Rute di Google Maps →")
  ]);
}

function gambarPeta(teratas, semua) {
  const { peta, lapisan, posisi } = keadaan;
  if (!peta) return [];
  lapisan.clearLayers();

  const idTeratas = new Set(teratas.map(h => h.lokasi));
  semua.filter(h => !idTeratas.has(h.lokasi)).forEach(h =>
    L.marker([h.lokasi.lat, h.lokasi.lng], { icon: ikon("penanda-lain", "", 12) })
      .bindPopup(isiPopup(h.lokasi, h.jarak))
      .addTo(lapisan)
  );

  const penanda = teratas.map((h, i) =>
    L.marker([h.lokasi.lat, h.lokasi.lng], {
      icon: i === 0 ? ikon("penanda-terbaik", "1", 42) : ikon("", String(i + 1), 30),
      zIndexOffset: 1000 - i * 100,
      title: h.lokasi.nama
    })
      .bindPopup(isiPopup(h.lokasi, h.jarak))
      .addTo(lapisan)
  );

  L.marker([posisi.lat, posisi.lng], {
    icon: L.divIcon({ className: "", html: '<div class="penanda-saya"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
    zIndexOffset: 2000,
    keyboard: false
  }).bindPopup(posisi.sumber === "gps" ? "Posisimu" : "Titik yang kamu tandai").addTo(lapisan);

  if (teratas.length) {
    const batas = L.latLngBounds([[posisi.lat, posisi.lng]].concat(teratas.map(h => [h.lokasi.lat, h.lokasi.lng])));
    peta.fitBounds(batas, { padding: [50, 50], maxZoom: 15 });
  } else {
    peta.setView([posisi.lat, posisi.lng], 13);
  }
  return penanda;
}

function baris(namaIkon, teks) {
  return el("p", { class: "meta" }, [ikonSvg(namaIkon), el("span", {}, teks)]);
}

function buatKartu(hasil, urutan, penanda) {
  const { lokasi, jarak } = hasil;
  const terbaik = urutan === 0;
  const [angka, satuan] = bagianJarak(jarak);

  const kartu = el("li", { class: "kartu" + (terbaik ? " kartu-utama" : "") }, [
    el("div", { class: "kartu-atas" }, [
      el("span", {}, terbaik ? (keadaan.filter ? "Paling cocok" : "Paling dekat") : "0" + (urutan + 1)),
      lokasi.terverifikasi ? null : el("span", { class: "belum" }, "Belum dicek")
    ]),
    el("h3", {}, lokasi.nama),
    el("p", { class: "jarak" }, [el("strong", {}, angka), " " + satuan + " · " + (lokasi.jenis || "")]),
    el("ul", { class: "tag-plastik", "aria-label": "Plastik yang diterima" },
      (lokasi.plastik_diterima || []).map(p => el("li", {}, labelPlastik(p)))),
    baris("jam", lokasi.jam_buka || "Belum ada info jam buka"),
    terbaik && lokasi.alamat ? baris("pin", lokasi.alamat) : null,
    lokasi.kontak ? baris("kontak", lokasi.kontak) : null,
    el("a", { class: "tombol-rute", href: linkArah(lokasi), target: "_blank", rel: "noopener" },
      [ikonSvg("rute"), "Rute di Google Maps"])
  ]);

  // Ketuk kartu → tunjukkan tempatnya di peta.
  kartu.addEventListener("click", e => {
    if (e.target.closest("a") || !penanda) return;
    keadaan.peta.setView(penanda.getLatLng(), Math.max(keadaan.peta.getZoom(), 15));
    penanda.openPopup();
    $("peta").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  return kartu;
}

function tampilkanPeringatan(teratas) {
  const kotak = $("peringatan");
  const { lat, lng } = keadaan.posisi;
  const fallback = el("a", { href: linkCariBankSampah(lat, lng), target: "_blank", rel: "noopener" },
    "Cari \"bank sampah\" di sekitarmu lewat Google Maps →");
  let pesan = null;

  if (!teratas.length) {
    pesan = keadaan.filter
      ? "Belum ada tempat di data kami yang menerima " + labelPlastik(keadaan.filter) + ". Coba pilih jenis lain, atau:"
      : "Belum ada data lokasi. Coba cari langsung di Google Maps:";
  } else if (teratas[0].jarak > PENGATURAN.batasJauhKm) {
    pesan = "Tempat terdekat di data kami berjarak " + formatJarak(teratas[0].jarak) +
      " darimu, cukup jauh. Data kami masih terbatas, jadi mungkin ada tempat yang lebih dekat tapi belum tercatat:";
  }

  kotak.innerHTML = "";
  kotak.hidden = !pesan;
  if (pesan) kotak.append(el("p", {}, pesan), fallback);
}

function tampilkanHasil() {
  if (!keadaan.posisi) return;
  const { lat, lng } = keadaan.posisi;
  const semua = urutkanLokasi(keadaan.semuaLokasi, lat, lng, keadaan.filter);
  const teratas = semua.slice(0, PENGATURAN.jumlahHasil);

  const penanda = gambarPeta(teratas, semua);
  tampilkanPeringatan(teratas);

  const daftar = $("daftar");
  daftar.innerHTML = "";
  teratas.forEach((h, i) => daftar.append(buatKartu(h, i, penanda[i])));
}

function aturPosisi(lat, lng, sumber) {
  keadaan.posisi = { lat, lng, sumber };
  setStatus(sumber === "gps"
    ? "Lokasimu ditemukan. Ini tempat terdekat untukmu."
    : "Dihitung dari titik yang kamu tandai. Ketuk peta lagi untuk memindahkannya.");
  tampilkanHasil();
}

function modeManual(alasan) {
  let pesan = alasan + " Ketuk peta untuk menandai posisimu, lalu kami carikan tempat terdekat dari titik itu.";
  if (/Instagram|FBAN|FBAV/i.test(navigator.userAgent)) {
    pesan += " Tips: kalau dibuka dari Instagram, buka lewat Chrome/Safari (menu ⋯ → Buka di browser).";
  }
  setStatus(pesan);
  if (!keadaan.posisi && keadaan.peta) keadaan.peta.setView(PENGATURAN.pusatAwal, PENGATURAN.zoomAwal);
  $("status").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function cari(dataSiap) {
  const tombol = $("tombol-cari");
  $("area-hasil").hidden = false;
  document.querySelector(".hero").classList.add("ringkas");
  siapkanPeta();
  if (keadaan.peta) keadaan.peta.invalidateSize();
  else $("petunjuk-peta").textContent = "Peta gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.";

  try {
    await dataSiap;
  } catch (err) {
    setStatus("Data lokasi gagal dimuat. Coba muat ulang halaman.");
    console.error(err);
    return;
  }

  if (!navigator.geolocation) {
    modeManual("Browser ini tidak mendukung deteksi lokasi.");
    return;
  }

  tombol.disabled = true;
  setStatus("Meminta izin lokasi…");
  navigator.geolocation.getCurrentPosition(
    pos => {
      tombol.disabled = false;
      tombol.querySelector("span").textContent = "Cari ulang dari lokasiku";
      aturPosisi(pos.coords.latitude, pos.coords.longitude, "gps");
      $("status").scrollIntoView({ behavior: "smooth", block: "start" });
    },
    err => {
      tombol.disabled = false;
      const alasan = {
        1: "Izin lokasi ditolak.",
        2: "Lokasimu tidak dapat ditemukan.",
        3: "Pencarian lokasi terlalu lama."
      }[err.code] || "Lokasi tidak tersedia.";
      modeManual(alasan);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

function mulai() {
  const dataSiap = muatData().then(data => {
    keadaan.semuaLokasi = data;
    tampilkanInfoData();
    buatFilter();
  });
  dataSiap.catch(err => console.error("Gagal memuat " + PENGATURAN.fileData + ":", err));
  $("tombol-cari").addEventListener("click", () => cari(dataSiap));
}

if (typeof document !== "undefined") mulai();
