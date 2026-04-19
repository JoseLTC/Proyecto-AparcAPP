const API_BASE = "http://localhost:8000";

let map, userMarker;
let spotsLayer = L.layerGroup();
let ws;
let userCity = null;
let userPosition = null;

// ---------------------------------------------------------
// Guardar Coche
// ---------------------------------------------------------

function showSystemMessage(msg) {
  document.getElementById("system-modal-text").textContent = msg;
  document.getElementById("system-modal-overlay").style.display = "flex";
}

document.getElementById("close-system-modal").addEventListener("click", () => {
  document.getElementById("system-modal-overlay").style.display = "none";
});


// ---------------------------------------------------------
// MIS COCHES (Elegir coche)
// ---------------------------------------------------------
let chooseCarBtn, carsModalOverlay, carsList, closeCarsModalBtn;

async function loadCars() {
  const res = await fetch(`${API_BASE}/cars`);
  return await res.json();
}

function openCarsModal(cars) {
  carsList.innerHTML = "";

  if (!cars.length) {
    const li = document.createElement("li");
    li.textContent = "No tienes coches guardados todavía.";
    li.style.cursor = "default";
    carsList.appendChild(li);
  } else {
    cars.forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.brand} ${c.model}`;
      li.addEventListener("click", () => {
        document.getElementById("brand").value = c.brand;
        document.getElementById("model").value = c.model;
        carsModalOverlay.style.display = "none";
      });
      carsList.appendChild(li);
    });
  }

  carsModalOverlay.style.display = "flex";
}

// ---------------------------------------------------------
// MODAL DE ACCIONES (OCUPADO / LIBRE)
// ---------------------------------------------------------
function showActionModal(title, htmlText) {
  document.getElementById("action-title").textContent = title;
  document.getElementById("action-text").innerHTML = htmlText;
  document.getElementById("action-modal-overlay").style.display = "flex";
}

document.getElementById("close-action-modal").addEventListener("click", () => {
  document.getElementById("action-modal-overlay").style.display = "none";
});

// ---------------------------------------------------------
// INICIALIZAR MAPA + GEOLOCALIZACIÓN + DETECTAR CIUDAD
// ---------------------------------------------------------
function initMap() {
  map = L.map('map').setView([43.0, -8.0], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  spotsLayer.addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      userPosition = { lat: latitude, lng: longitude };

      try {
        const rev = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const revData = await rev.json();
        userCity = revData.address.city || revData.address.town || revData.address.village;
      } catch (e) {
        console.warn("No se pudo detectar ciudad:", e);
      }

    }, err => {
      console.warn("Geolocation denied or failed", err);
    }, { enableHighAccuracy: true });
  }
}

// ---------------------------------------------------------
// CARGAR PLAZAS CERCANAS
// ---------------------------------------------------------
async function loadSpotsNearby(lat, lng, radius = 1000) {
  const res = await fetch(`${API_BASE}/spots?lat=${lat}&lng=${lng}&radius=${radius}`);
  return await res.json();
}

// ---------------------------------------------------------
// PINTAR PLAZAS EN EL MAPA (FILTRANDO > 15 MIN)
// ---------------------------------------------------------
function renderSpots(spots) {
  spotsLayer.clearLayers();

  spots.forEach(s => {
    const minutes = Math.floor((new Date() - new Date(s.timestamp)) / 60000);

    if (s.status === "free" && minutes > 15) return;

    const color = s.status === "free" ? "green" : "red";

    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 8,
      color,
      fillColor: color,
      fillOpacity: 0.8
    });

    marker.bindPopup(`
      <b>${s.status.toUpperCase()}</b><br>
      ${s.car_brand || ""} ${s.car_model || ""}<br>
      hace ${minutes} min
    `);

    spotsLayer.addLayer(marker);
  });
}

// ---------------------------------------------------------
// MARCAR PLAZA COMO OCUPADA O LIBRE (CON DIRECCIÓN)
// ---------------------------------------------------------
async function markSpot(state) {
  if (!navigator.geolocation) {
    alert("Geolocalización no disponible");
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude } = pos.coords;

    const brand = localStorage.getItem("car_brand") || "";
    const model = localStorage.getItem("car_model") || "";

    let direccion = "Ubicación desconocida";
    try {
      const rev = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const revData = await rev.json();
      direccion = revData.display_name || direccion;
    } catch (e) {
      console.warn("No se pudo obtener dirección:", e);
    }

    const payload = {
      lat: latitude,
      lng: longitude,
      status: state,
      car_brand: brand,
      car_model: model,
      timestamp: new Date().toISOString()
    };

    await fetch(`${API_BASE}/spots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (state === "occupied") {
      showActionModal(
        "Plaza marcada como ocupada",
        `Su coche ha sido aparcado en:<br><br><b>${direccion}</b>`
      );
    } else {
      showActionModal(
        "Plaza liberada",
        "Ha liberado su plaza correctamente."
      );
    }

  }, err => {
    alert("No se pudo obtener ubicación: " + err.message);
  }, { enableHighAccuracy: true });
}

// ---------------------------------------------------------
// UI: GUARDAR COCHE + BOTONES + BÚSQUEDA + MIS COCHES
// ---------------------------------------------------------
function setupUI() {
  const saveCarBtn = document.getElementById("save-car");
  const markOccupiedBtn = document.getElementById("mark-occupied");
  const markFreeBtn = document.getElementById("mark-free");
  const findSpotBtn = document.getElementById("find-spot");
  const searchSection = document.getElementById("search-section");
  const mapDiv = document.getElementById("map");

  const modalOverlay = document.getElementById("modal-overlay");
  const modalSummary = document.getElementById("modal-summary");
  const modalList = document.getElementById("modal-list");
  const closeModalBtn = document.getElementById("close-modal");

  // NUEVO: elementos del modal Mis coches
  chooseCarBtn = document.getElementById("choose-car");
  carsModalOverlay = document.getElementById("cars-modal-overlay");
  carsList = document.getElementById("cars-list");
  closeCarsModalBtn = document.getElementById("close-cars-modal");

  // ---------------------------------------------------------
  // GUARDAR COCHE (localStorage + base de datos)
  // ---------------------------------------------------------
  saveCarBtn.addEventListener("click", async () => {
    const brand = document.getElementById("brand").value.trim();
    const model = document.getElementById("model").value.trim();

    if (!brand || !model) {
      alert("Introduce marca y modelo");
      return;
    }

    // Guardar en localStorage
    localStorage.setItem("car_brand", brand);
    localStorage.setItem("car_model", model);

    // Guardar en la base de datos
    try {
      await fetch(`${API_BASE}/cars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, model })
      });

      showSystemMessage("Coche guardado correctamente");

    } catch (e) {
      alert("Error guardando coche en la base de datos");
      console.error(e);
    }
  });

  // ---------------------------------------------------------
  // MIS COCHES
  // ---------------------------------------------------------
  chooseCarBtn.addEventListener("click", async () => {
    try {
      const cars = await loadCars();
      openCarsModal(cars);
    } catch (e) {
      alert("No se pudieron cargar tus coches");
      console.error(e);
    }
  });

  closeCarsModalBtn.addEventListener("click", () => {
    carsModalOverlay.style.display = "none";
  });

  // ---------------------------------------------------------
  // MARCAR OCUPADO / LIBRE
  // ---------------------------------------------------------
  markOccupiedBtn.addEventListener("click", () => markSpot("occupied"));
  markFreeBtn.addEventListener("click", () => markSpot("free"));

  // ---------------------------------------------------------
  // MOSTRAR MAPA Y BUSCADOR
  // ---------------------------------------------------------
  findSpotBtn.addEventListener("click", () => {
    searchSection.style.display = "block";
    mapDiv.style.display = "block";

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    if (userPosition) {
      map.setView([userPosition.lat, userPosition.lng], 15);
      if (!userMarker) {
        userMarker = L.marker([userPosition.lat, userPosition.lng])
          .addTo(map)
          .bindPopup("Tú estás aquí");
      }
    }
  });

  // ---------------------------------------------------------
  // BUSCAR DIRECCIÓN Y MOSTRAR PLAZAS LIBRES
  // ---------------------------------------------------------
  document.getElementById("search").addEventListener("click", async () => {
    const addr = document.getElementById("address").value.trim();
    if (!addr) return;

    const query = userCity ? `${addr}, ${userCity}, España` : addr;
    const q = encodeURIComponent(query);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}`
    );
    const data = await res.json();

    if (!data || !data.length) {
      alert("Dirección no encontrada");
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);

    map.setView([lat, lng], 17);

    const spots = await loadSpotsNearby(lat, lng, 1000);

    const freeSpots = spots.filter(s => {
      const minutes = Math.floor((new Date() - new Date(s.timestamp)) / 60000);
      return s.status === "free" && minutes <= 15;
    });

    renderSpots(freeSpots);

    modalList.innerHTML = "";

    if (freeSpots.length === 0) {
      modalSummary.textContent = "No hay plazas libres recientes en un radio de 1 km.";
    } else {
      modalSummary.textContent = `Plazas libres encontradas en 1 km: ${freeSpots.length}`;

      for (const s of freeSpots) {
        try {
          const rev = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${s.lat}&lon=${s.lng}&format=json`
          );
          const revData = await rev.json();
          const direccion = revData.display_name || "Dirección desconocida";

          const minutes = Math.floor((new Date() - new Date(s.timestamp)) / 60000);

          const li = document.createElement("li");
          const coche = s.car_brand && s.car_model ? `${s.car_brand} ${s.car_model}` : "Coche desconocido";
          li.textContent = `${direccion} — libre desde hace ${minutes} min — dejado por ${coche}`;
          modalList.appendChild(li);

        } catch (e) {
          const li = document.createElement("li");
          li.textContent = "Dirección no disponible";
          modalList.appendChild(li);
        }
      }
    }

    modalOverlay.style.display = "flex";
  });

  closeModalBtn.addEventListener("click", () => {
    modalOverlay.style.display = "none";
  });
}

// ---------------------------------------------------------
// WEBSOCKETS
// ---------------------------------------------------------
function connectWS() {
  ws = new WebSocket("ws://localhost:8000/ws");

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === "spot_updated") {
        if (map && map._container.style.display !== "none") {
          const center = map.getCenter();
          loadSpotsNearby(center.lat, center.lng, 1000).then(renderSpots);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  ws.onclose = () => setTimeout(connectWS, 2000);
}

// ---------------------------------------------------------
// INICIO
// ---------------------------------------------------------
window.addEventListener("load", () => {
  initMap();
  setupUI();
  connectWS();
});
