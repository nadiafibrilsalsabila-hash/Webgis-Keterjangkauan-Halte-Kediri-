
// 1. Konfigurasi basemap

const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// 2. Inisialisasi peta MapLibre
// Center disesuaikan ke koordinat area Kediri berdasarkan data HALTE.geojson
const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP,
  center: [112.008, -7.815],
  zoom: 13
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

// Variabel global menyimpan semua data GeoJSON
let dataHalte    = null;
let dataZona400  = null;
let dataZona800  = null;

// ID source dan layer
const SRC_400  = "src-400";
const SRC_800  = "src-800";
const SRC_HALTE = "src-halte";

const LYR_400_FILL  = "lyr-400-fill";
const LYR_400_LINE  = "lyr-400-line";
const LYR_800_FILL  = "lyr-800-fill";
const LYR_800_LINE  = "lyr-800-line";
const LYR_HALTE_CIRCLE = "lyr-halte-circle";

// 3. Warna berdasarkan NAMZON

// Fungsi ini mengembalikan warna fill berdasarkan jenis zona
function warnaNAMZON() {
  return [
    "match",
    ["get", "NAMZON"],
    "AREA PERUMAHAN", "#f76a0c",
    "AREA KOMERSIAL",  "#d72222",
    "AREA PUBLIK",     "#794919",
    "#d1d5db" // default jika tidak cocok
  ];
}

// 4. Membaca semua file GeoJSON
async function loadSemuaData() {
  try {
    const [r400, r800, rHalte] = await Promise.all([
      fetch("./data/INTERSECT 400.geojson"),
      fetch("./data/INTERSECT 800.geojson"),
      fetch("./data/HALTE.geojson")
    ]);

    dataZona400 = await r400.json();
    dataZona800 = await r800.json();
    dataHalte   = await rHalte.json();

    tambahSemuaLayer();
    buildDropdownHalte();

  } catch (err) {
    console.error("Gagal memuat GeoJSON:", err);
    alert("File GeoJSON gagal dimuat.\nPastikan ketiga file ada di folder data/.");
  }
}

// 5. Menambahkan semua layer ke peta
function tambahSemuaLayer() {
  // -- Zona 800m (di bawah supaya tidak menutup zona 400m) --
  map.addSource(SRC_800, { type: "geojson", data: dataZona800 });

  map.addLayer({
    id: LYR_800_FILL,
    type: "fill",
    source: SRC_800,
    paint: {
      "fill-color": warnaNAMZON(),
      "fill-opacity": 0.35
    }
  });

  map.addLayer({
    id: LYR_800_LINE,
    type: "line",
    source: SRC_800,
    paint: {
      "line-color": "#8b5cf6",
      "line-width": 1.5,
      "line-dasharray": [4, 2],
      "line-opacity": 0.7
    }
  });

  // -- Zona 400m (di atas zona 800m) --
  map.addSource(SRC_400, { type: "geojson", data: dataZona400 });

  map.addLayer({
    id: LYR_400_FILL,
    type: "fill",
    source: SRC_400,
    paint: {
      "fill-color": warnaNAMZON(),
      "fill-opacity": 0.55
    }
  });

  map.addLayer({
    id: LYR_400_LINE,
    type: "line",
    source: SRC_400,
    paint: {
      "line-color": "#f97316",
      "line-width": 1.5,
      "line-opacity": 0.8
    }
  });

  // -- Titik halte (paling atas) --
  map.addSource(SRC_HALTE, { type: "geojson", data: dataHalte });

  map.addLayer({
    id: LYR_HALTE_CIRCLE,
    type: "circle",
    source: SRC_HALTE,
    paint: {
      "circle-radius": 7,
      "circle-color": "#1a56db",
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#ffffff"
    }
  });
}


// Mengambil nama halte unik dari HALTE.geojson (properti: Name)
function buildDropdownHalte() {
  const select = document.getElementById("halteSelect");
  select.innerHTML = '<option value="all">Semua Halte</option>';

  const namaHalte = dataHalte.features
    .map(f => f.properties.Name)
    .filter(Boolean)
    .sort();

  namaHalte.forEach(nama => {
    const opt = document.createElement("option");
    opt.value       = nama;
    opt.textContent = nama;
    select.appendChild(opt);
  });
}


// 7. Filter berdasarkan halte terpilih
// Filter pada zona menggunakan properti "Name" yang sama dengan nama halte
function terapkanFilter(nama) {
  if (nama === "all") {
    [LYR_400_FILL, LYR_400_LINE, LYR_800_FILL, LYR_800_LINE, LYR_HALTE_CIRCLE].forEach(id => {
      map.setFilter(id, null);
    });
    return;
  }

  const filterExpr = ["==", ["get", "Name"], nama];
  [LYR_400_FILL, LYR_400_LINE, LYR_800_FILL, LYR_800_LINE, LYR_HALTE_CIRCLE].forEach(id => {
    map.setFilter(id, filterExpr);
  });

  zoomKeHalte(nama);
}

// 8. Zoom ke halte terpilih
function zoomKeHalte(nama) {
  // Zoom berdasarkan zona 800m (lebih lebar)
  const fitur = dataZona800.features.filter(
    f => f.properties.Name === nama
  );

  if (fitur.length === 0) return;

  const bounds = new maplibregl.LngLatBounds();
  fitur.forEach(f => perluas(bounds, f.geometry.coordinates));

  map.fitBounds(bounds, { padding: 60, duration: 800 });
}

function perluas(bounds, coords) {
  coords.forEach(c => {
    if (typeof c[0] === "number") {
      bounds.extend(c);
    } else {
      perluas(bounds, c);
    }
  });
}


// 9. Popup
function setupPopup() {
  // Popup untuk zona 400m
  map.on("click", LYR_400_FILL, e => {
    const p = e.features[0].properties;
    const luas = p.LUAS ? (p.LUAS / 10000).toFixed(2) : "-"; // m² → hektar

    new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-tag">Zona 400m</div>
        <div class="popup-kelurahan">${p.Name || "Tanpa Nama"}</div>
        <div class="popup-row">
          <span>Jenis Zona</span>
          <strong>${p.NAMZON || "-"}</strong>
        </div>
        <div class="popup-row">
          <span>Luas</span>
          <strong>${luas} ha</strong>
        </div>
      `)
      .addTo(map);
  });

  // Popup untuk zona 800m
  map.on("click", LYR_800_FILL, e => {
    const p = e.features[0].properties;
    const luas = p.LUAS ? (p.LUAS / 10000).toFixed(2) : "-";

    new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-tag">Zona 800m</div>
        <div class="popup-kelurahan">${p.Name || "Tanpa Nama"}</div>
        <div class="popup-row">
          <span>Jenis Zona</span>
          <strong>${p.NAMZON || "-"}</strong>
        </div>
        <div class="popup-row">
          <span>Luas</span>
          <strong>${luas} ha</strong>
        </div>
      `)
      .addTo(map);
  });

  // Popup untuk titik halte
  map.on("click", LYR_HALTE_CIRCLE, e => {
    const p = e.features[0].properties;

    new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-tag">Titik Halte</div>
        <div class="popup-kelurahan">${p.Name || "Tanpa Nama"}</div>
        <div class="popup-row">
          <span>Keterangan</span>
          <strong>${p.REMARK || "-"}</strong>
        </div>
      `)
      .addTo(map);
  });

  // Cursor pointer saat hover
  [LYR_400_FILL, LYR_800_FILL, LYR_HALTE_CIRCLE].forEach(id => {
    map.on("mouseenter", id, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", id, () => map.getCanvas().style.cursor = "");
  });
}

// 10. Toggle visibilitas layer

function setupToggle() {
  const toggleMap = {
    "toggleHalte": [LYR_HALTE_CIRCLE],
    "toggle400":   [LYR_400_FILL, LYR_400_LINE],
    "toggle800":   [LYR_800_FILL, LYR_800_LINE]
  };

  Object.entries(toggleMap).forEach(([checkboxId, layerIds]) => {
    document.getElementById(checkboxId).addEventListener("change", e => {
      const visibility = e.target.checked ? "visible" : "none";
      layerIds.forEach(id => map.setLayoutProperty(id, "visibility", visibility));
    });
  });
}

// 11. Event listener UI
document.getElementById("halteSelect").addEventListener("change", e => {
  terapkanFilter(e.target.value);
});

document.getElementById("resetFilterBtn").addEventListener("click", () => {
  document.getElementById("halteSelect").value = "all";
  terapkanFilter("all");
  map.flyTo({ center: [112.008, -7.815], zoom: 13, duration: 900 });
});

// 12. Entry point
map.on("load", () => {
  loadSemuaData();
  setupPopup();
  setupToggle();
});