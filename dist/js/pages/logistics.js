(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("logistics");
  const allProducts = await window.AgroDB.getProducts();

  const buyerHubSel = document.getElementById("logBuyerHub");
  const catSel = document.getElementById("logCategory");
  const weightInput = document.getElementById("logWeight");
  const vehicleSel = document.getElementById("logVehicle");

  window.AgroConfig.HUB_CITIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    buyerHubSel.appendChild(opt);
  });

  window.AgroConfig.VEHICLE_TIERS.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.name;
    vehicleSel.appendChild(opt);
  });

  if (user && user.location) {
    const match = window.AgroConfig.HUB_CITIES.find((c) => c.name === user.location);
    if (match) buyerHubSel.value = match.name;
  }

  let buyerCoords = (() => {
    const hub = window.AgroConfig.HUB_CITIES.find((c) => c.name === buyerHubSel.value) || window.AgroConfig.HUB_CITIES[0];
    return { lat: hub.lat, lng: hub.lng, label: hub.name };
  })();

  const params = new URLSearchParams(window.location.search);
  const preselectedProduct = params.get("product");
  let selectedId = preselectedProduct || (allProducts[0] ? allProducts[0].id : null);

  let gMap = null;
  let gMarkers = [];
  let gLine = null;
  const useGoogleMaps = await window.AgroGeo.loadGoogleMapsApi();

  if (useGoogleMaps) {
    document.getElementById("mapEngineBadge").textContent = "Google Maps API Live";
    document.getElementById("mapEngineBadge").className = "pill pill-green";
    const mapEl = document.getElementById("logisticsMap");
    gMap = new window.google.maps.Map(mapEl, {
      center: { lat: buyerCoords.lat, lng: buyerCoords.lng },
      zoom: 6,
      mapTypeControl: false
    });
  }

  async function refreshLogistics() {
    const cat = catSel.value;
    const weight = Math.max(100, Number(weightInput.value) || 2500);
    const vehicleId = vehicleSel.value;

    const suppliers = allProducts
      .filter((p) => p.status !== "archived" && p.quantityKg > 0)
      .filter((p) => !cat || p.category === cat)
      .map((p) => {
        const distanceKm = window.AgroGeo.haversineKm(buyerCoords.lat, buyerCoords.lng, p.lat, p.lng);
        const quote = window.AgroGeo.calculateTransportQuote(distanceKm, weight, vehicleId);
        return Object.assign({}, p, { distanceKm, quote });
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (!suppliers.some((s) => s.id === selectedId) && suppliers[0]) {
      selectedId = suppliers[0].id;
    }

    const selected = suppliers.find((s) => s.id === selectedId) || suppliers[0];

    // If Google Maps API is active, refine selected distance with Google Distance Matrix
    if (useGoogleMaps && selected) {
      const dm = await window.AgroGeo.getGoogleDistance(
        { lat: selected.lat, lng: selected.lng },
        { lat: buyerCoords.lat, lng: buyerCoords.lng }
      );
      if (dm) {
        selected.distanceKm = dm.distanceKm;
        selected.quote = window.AgroGeo.calculateTransportQuote(dm.distanceKm, weight, vehicleId);
        selected.quote.etaText = dm.durationText;
      }
    }

    // Render nearby suppliers list
    const listEl = document.getElementById("nearbySuppliersList");
    if (!suppliers.length) {
      listEl.innerHTML = `<p class="text-muted">No suppliers match this category filter.</p>`;
    } else {
      listEl.innerHTML = suppliers
        .map(
          (s) => `
        <div class="card card-pad" data-select-sup="${s.id}" style="padding:14px;cursor:pointer;border-color:${s.id === selectedId ? "var(--forest-900)" : "var(--border)"};background:${s.id === selectedId ? "var(--leaf-50)" : "var(--white)"};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <div style="font-weight:700;color:var(--forest-950);">${s.sellerName}</div>
              <div class="text-xs text-muted">${s.title}</div>
            </div>
            <span class="pill pill-green">${s.distanceKm} km</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:0.82rem;">
            <span>${s.location} · <strong>${window.AgroUI.formatINR(s.pricePerKg)}/kg</strong></span>
            <span class="mono" style="color:var(--earth-800);font-weight:700;">Freight: ${window.AgroUI.formatINR(s.quote.cost)} (${s.quote.etaText})</span>
          </div>
        </div>`
        )
        .join("");

      listEl.querySelectorAll("[data-select-sup]").forEach((card) => {
        card.addEventListener("click", () => {
          selectedId = card.dataset.selectSup;
          refreshLogistics();
        });
      });
    }

    // Selected route summary
    const summaryEl = document.getElementById("selectedRouteSummary");
    if (selected) {
      const materialTotal = Math.round(weight * selected.pricePerKg);
      summaryEl.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center;">
          <div>
            <div class="text-xs mono" style="color:var(--leaf-600);font-weight:700;">SELECTED ROUTE</div>
            <div style="font-weight:700;font-size:1.05rem;">${selected.location} (${selected.sellerName}) → ${buyerCoords.label}</div>
            <div class="text-sm text-muted">
              Distance: <strong>${selected.distanceKm} km</strong> · Vehicle: <strong>${selected.quote.vehicle.name}</strong> (${selected.quote.loads} load${selected.quote.loads > 1 ? "s" : ""})
            </div>
          </div>
          <div style="text-align:right;">
            <div class="mono" style="font-size:1.25rem;font-weight:700;color:var(--forest-900);">Freight: ${window.AgroUI.formatINR(selected.quote.cost)}</div>
            <div class="text-xs text-muted">Est. Delivery: <strong>${selected.quote.etaText}</strong> · Material (${weight.toLocaleString()} kg): ${window.AgroUI.formatINR(materialTotal)}</div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <a href="product-details.html?id=${encodeURIComponent(selected.id)}" class="btn btn-outline btn-sm">Inspect Lot</a>
          <button type="button" class="btn btn-primary btn-sm" id="logAddCartBtn">Add ${Math.min(weight, selected.quantityKg).toLocaleString()} kg to Cart</button>
        </div>`;

      document.getElementById("logAddCartBtn").addEventListener("click", async () => {
        const currUser = await window.AgroDB.getCurrentUser();
        const addQty = Math.min(weight, selected.quantityKg);
        await window.AgroDB.addToCart(currUser ? currUser.id : null, selected, addQty);
        window.AgroUI.showToast(`Added ${addQty.toLocaleString()} kg to Cart.`);
      });
    } else {
      summaryEl.innerHTML = `<span class="text-muted">Select a supplier to calculate route freight.</span>`;
    }

    // Render Map
    if (useGoogleMaps && gMap) {
      gMarkers.forEach((m) => m.setMap(null));
      gMarkers = [];
      if (gLine) gLine.setMap(null);

      const buyerMarker = new window.google.maps.Marker({
        position: { lat: buyerCoords.lat, lng: buyerCoords.lng },
        map: gMap,
        title: `Buyer Hub: ${buyerCoords.label}`
      });
      gMarkers.push(buyerMarker);

      suppliers.forEach((s) => {
        const m = new window.google.maps.Marker({
          position: { lat: s.lat, lng: s.lng },
          map: gMap,
          title: `${s.sellerName} (${s.distanceKm} km)`
        });
        m.addListener("click", () => {
          selectedId = s.id;
          refreshLogistics();
        });
        gMarkers.push(m);
      });

      if (selected) {
        gLine = new window.google.maps.Polyline({
          path: [
            { lat: selected.lat, lng: selected.lng },
            { lat: buyerCoords.lat, lng: buyerCoords.lng }
          ],
          geodesic: true,
          strokeColor: "#1b4332",
          strokeWeight: 3,
          map: gMap
        });
        gMap.panTo({ lat: selected.lat, lng: selected.lng });
      }
    } else {
      window.AgroGeo.renderInteractiveFallbackMap(
        document.getElementById("logisticsMap"),
        buyerCoords,
        suppliers,
        selectedId,
        (clickedId) => {
          selectedId = clickedId;
          refreshLogistics();
        }
      );
    }
  }

  buyerHubSel.addEventListener("change", () => {
    const hub = window.AgroConfig.HUB_CITIES.find((c) => c.name === buyerHubSel.value);
    if (hub) buyerCoords = { lat: hub.lat, lng: hub.lng, label: hub.name };
    refreshLogistics();
  });

  [catSel, weightInput, vehicleSel].forEach((el) => {
    el.addEventListener("change", refreshLogistics);
    el.addEventListener("input", refreshLogistics);
  });

  document.getElementById("detectBuyerGpsBtn").addEventListener("click", async () => {
    try {
      const gps = await window.AgroGeo.getBrowserLocation();
      buyerCoords = { lat: gps.lat, lng: gps.lng, label: `GPS (${gps.lat}, ${gps.lng})` };
      window.AgroUI.showToast("Using your live GPS coordinates.");
      refreshLogistics();
    } catch (err) {
      window.AgroUI.showToast(err.message || "Unable to access GPS.", true);
    }
  });

  refreshLogistics();
})();
