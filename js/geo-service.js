(function (window) {
  "use strict";

  const EARTH_RADIUS_KM = 6371;
  const ROAD_TORTUOSITY_FACTOR = 1.24; // Realistic Indian highway/rural road multiplier over straight-line distance

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    if (
      typeof lat1 !== "number" ||
      typeof lng1 !== "number" ||
      typeof lat2 !== "number" ||
      typeof lng2 !== "number"
    ) {
      return 85;
    }
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(4, Math.round(EARTH_RADIUS_KM * c * ROAD_TORTUOSITY_FACTOR));
  }

  function selectVehicleForWeight(totalKg) {
    const tiers = window.AgroConfig.VEHICLE_TIERS;
    const qty = Math.max(1, Number(totalKg) || 1000);
    for (let i = 0; i < tiers.length; i++) {
      if (qty <= tiers[i].maxKg) return tiers[i];
    }
    return tiers[tiers.length - 1];
  }

  function calculateTransportQuote(distanceKm, totalKg, vehicleId) {
    const tiers = window.AgroConfig.VEHICLE_TIERS;
    const tier = vehicleId
      ? tiers.find((t) => t.id === vehicleId) || selectVehicleForWeight(totalKg)
      : selectVehicleForWeight(totalKg);

    const loads = Math.max(1, Math.ceil((Number(totalKg) || 1) / tier.maxKg));
    const costPerLoad = tier.baseFee + distanceKm * tier.perKm;
    const totalCost = Math.round(costPerLoad * loads);
    const etaHours = Math.max(0.8, Number((distanceKm / tier.speedKmh + 0.5).toFixed(1)));
    const etaText =
      etaHours < 24
        ? `${etaHours} hrs`
        : `${Math.floor(etaHours / 24)}d ${Math.round(etaHours % 24)}h`;

    return {
      distanceKm,
      vehicle: tier,
      loads,
      cost: totalCost,
      perKgLogistics: Number((totalCost / Math.max(1, totalKg)).toFixed(2)),
      etaHours,
      etaText
    };
  }

  function getBrowserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: Number(pos.coords.latitude.toFixed(4)),
            lng: Number(pos.coords.longitude.toFixed(4))
          });
        },
        (err) => reject(err),
        { timeout: 7000 }
      );
    });
  }

  let googleMapsPromise = null;

  function loadGoogleMapsApi() {
    const apiKey = window.AgroConfig.runtime.googleMapsApiKey;
    if (!apiKey) return Promise.resolve(false);
    if (window.google && window.google.maps) return Promise.resolve(true);
    if (googleMapsPromise) return googleMapsPromise;

    googleMapsPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(Boolean(window.google && window.google.maps));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
    return googleMapsPromise;
  }

  function getGoogleDistance(origin, destination) {
    return new Promise((resolve) => {
      if (!(window.google && window.google.maps && window.google.maps.DistanceMatrixService)) {
        resolve(null);
        return;
      }
      const service = new window.google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [new window.google.maps.LatLng(origin.lat, origin.lng)],
          destinations: [new window.google.maps.LatLng(destination.lat, destination.lng)],
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (response, status) => {
          if (status === "OK" && response.rows[0]?.elements[0]?.status === "OK") {
            const el = response.rows[0].elements[0];
            resolve({
              distanceKm: Math.max(1, Math.round(el.distance.value / 1000)),
              durationText: el.duration.text
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // Interactive Canvas Regional Map (used automatically when Google Maps API key is not configured)
  function renderInteractiveFallbackMap(container, buyerCoords, suppliers, selectedSupplierId, onSelectSupplier) {
    if (!container) return;
    container.innerHTML = "";

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.cursor = "pointer";
    container.appendChild(canvas);

    const badge = document.createElement("div");
    badge.style.cssText =
      "position:absolute;top:12px;left:12px;background:rgba(255,255,255,0.94);padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;color:#1b4332;border:1px solid #d5e2d8;box-shadow:0 2px 6px rgba(0,0,0,0.06);";
    badge.textContent = "Interactive Logistics Geo-Grid (Add Google Maps API Key for Satellite/Traffic)";
    container.appendChild(badge);

    const pts = [buyerCoords, ...suppliers.map((s) => ({ lat: s.lat, lng: s.lng }))];
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats) - 1.2;
    const maxLat = Math.max(...lats) + 1.2;
    const minLng = Math.min(...lngs) - 1.5;
    const maxLng = Math.max(...lngs) + 1.5;

    const hitTargets = [];

    function draw() {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(300, rect.width);
      const h = Math.max(300, rect.height);
      canvas.width = w * dpr;
      canvas.height = h * dpr;

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      // Soft terrain gradient
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#eef6ef");
      bg.addColorStop(1, "#e2efe5");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle lat/lng grid
      ctx.strokeStyle = "rgba(45, 106, 79, 0.12)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const gx = (w / 8) * i;
        const gy = (h / 8) * i;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const project = (lat, lng) => {
        const pad = 48;
        const x = pad + ((lng - minLng) / (maxLng - minLng || 1)) * (w - pad * 2);
        const y = h - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (h - pad * 2);
        return { x, y };
      };

      const buyerPt = project(buyerCoords.lat, buyerCoords.lng);

      // Draw route lines from buyer to each supplier
      hitTargets.length = 0;
      suppliers.forEach((sup) => {
        const sPt = project(sup.lat, sup.lng);
        const isSelected = sup.id === selectedSupplierId;

        ctx.beginPath();
        ctx.setLineDash(isSelected ? [] : [5, 5]);
        ctx.strokeStyle = isSelected ? "#1b4332" : "rgba(111, 78, 55, 0.45)";
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.moveTo(buyerPt.x, buyerPt.y);
        ctx.lineTo(sPt.x, sPt.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Distance label on midpoint
        const mx = (buyerPt.x + sPt.x) / 2;
        const my = (buyerPt.y + sPt.y) / 2;
        if (isSelected) {
          ctx.fillStyle = "#1b4332";
          ctx.fillRect(mx - 28, my - 11, 56, 20);
          ctx.fillStyle = "#ffffff";
          ctx.font = "600 11px JetBrains Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${sup.distanceKm} km`, mx, my + 3);
        }

        // Supplier marker
        ctx.beginPath();
        ctx.arc(sPt.x, sPt.y, isSelected ? 10 : 7, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#40916c" : "#6f4e37";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#16221b";
        ctx.font = isSelected ? "700 12px Inter, sans-serif" : "600 11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(sup.location.split(",")[0], sPt.x, sPt.y - 14);

        hitTargets.push({ id: sup.id, x: sPt.x, y: sPt.y, r: 16 });
      });

      // Draw Buyer pin
      ctx.beginPath();
      ctx.arc(buyerPt.x, buyerPt.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = "#1b4332";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#d8f3dc";
      ctx.stroke();

      ctx.fillStyle = "#1b4332";
      ctx.font = "700 12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Your Delivery Hub", buyerPt.x, buyerPt.y + 24);
    }

    draw();
    canvas.addEventListener("click", (e) => {
      if (!onSelectSupplier) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const hit = hitTargets.find((t) => Math.hypot(t.x - cx, t.y - cy) <= t.r);
      if (hit) onSelectSupplier(hit.id);
    });
    window.addEventListener("resize", draw, { passive: true });
  }

  window.AgroGeo = {
    haversineKm,
    selectVehicleForWeight,
    calculateTransportQuote,
    getBrowserLocation,
    loadGoogleMapsApi,
    getGoogleDistance,
    renderInteractiveFallbackMap
  };
})(window);
