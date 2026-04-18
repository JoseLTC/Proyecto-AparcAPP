const API_BASE = "http://localhost:8000";
let map, userMarker;
let spotsLayer = L.layerGroup();
let ws;

function initMap() {
  map = L.map('map').setView([43.0, -8.0], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);
  spotsLayer.addTo(map);
  // try to get location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const {latitude, longitude} = pos.coords;
      map.setView([latitude, longitude], 17);
      userMarker = L.marker([latitude, longitude]).addTo(map).bindPopup("Tú estás aquí").openPopup();
      loadSpotsNearby(latitude, longitude);
    }, err => {
      console.warn("Geolocation denied or failed", err);
    }, {enableHighAccuracy: true});
  }
}

async function loadSpotsNearby(lat, lng) {
  const res = await fetch(`${API_BASE}/spots?lat=${lat}&lng=${lng}&radius=500`);
  const spots = await res.json();
  renderSpots(spots);
}

function renderSpots(spots) {
  spotsLayer.clearLayers();
  spots.forEach(s => {
    const color = s.state === "free" ? "green" : "red";
    const marker = L.circleMarker([s.lat, s.lng], {radius:8, color, fillColor: color, fillOpacity:0.8});
    const minutes = Math.floor((new Date() - new Date(s.timestamp)) / 60000);
    marker.bindPopup(`<b>${s.state.toUpperCase()}</b><br>${s.car_brand || ""} ${s.car_model || ""}<br>hace ${minutes} min`);
    spotsLayer.addLayer(marker);
  });
}

async function markSpot(state) {
  if (!navigator.geolocation) { alert("Geolocalización no disponible"); return; }
  navigator.geolocation.getCurrentPosition(async pos => {
    const brand = localStorage.getItem("car_brand") || "";
    const model = localStorage.getItem("car_model") || "";
    const payload = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      state,
      car_brand: brand,
      car_model: model,
      timestamp: new Date().toISOString()
    };
    const res = await fetch(`${API_BASE}/spots`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const spot = await res.json();
    // optimistic update: add to map
    loadSpotsNearby(pos.coords.latitude, pos.coords.longitude);
  }, err => {
    alert("No se pudo obtener ubicación: " + err.message);
  }, {enableHighAccuracy: true});
}

function setupUI() {
  document.getElementById("save-car").addEventListener("click", () => {
    const brand = document.getElementById("brand").value.trim();
    const model = document.getElementById("model").value.trim();
    if (!brand && !model) return alert("Introduce marca o modelo");
    localStorage.setItem("car_brand", brand);
    localStorage.setItem("car_model", model);
    alert("Coche guardado");
  });

  document.getElementById("mark-occupied").addEventListener("click", () => markSpot("occupied"));
  document.getElementById("mark-free").addEventListener("click", () => markSpot("free"));

  document.getElementById("search").addEventListener("click", async () => {
    const addr = document.getElementById("address").value.trim();
    if (!addr) return;
    // Use Nominatim geocoding (open)
    const q = encodeURIComponent(addr);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
    const data = await res.json();
    if (data && data.length) {
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
      map.setView([lat, lng], 17);
      loadSpotsNearby(lat, lng);
    } else {
      alert("Dirección no encontrada");
    }
  });
}

function connectWS() {
  ws = new WebSocket("ws://localhost:8000/ws");
  ws.onopen = () => console.log("WS connected");
  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === "spot_created" || msg.type === "spot_updated") {
        // refresh visible spots (simple approach)
        if (userMarker) {
          const latlng = userMarker.getLatLng();
          loadSpotsNearby(latlng.lat, latlng.lng);
        } else {
          // reload all
          loadSpotsNearby(map.getCenter().lat, map.getCenter().lng);
        }
      }
    } catch (e) { console.error(e); }
  };
  ws.onclose = () => setTimeout(connectWS, 2000);
}

window.addEventListener("load", () => {
  initMap();
  setupUI();
  connectWS();
});
