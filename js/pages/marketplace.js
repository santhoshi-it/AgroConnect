(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("marketplace");
  let allProducts = [];

  const hubSelect = document.getElementById("filterHub");
  window.AgroConfig.HUB_CITIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    hubSelect.appendChild(opt);
  });

  if (user && user.location) {
    const match = window.AgroConfig.HUB_CITIES.find((c) => c.name === user.location);
    if (match) hubSelect.value = match.name;
  }

  // Read URL params (e.g. ?cat=Banana+Stem)
  const params = new URLSearchParams(window.location.search);
  const urlCat = params.get("cat");
  if (urlCat) {
    document.getElementById("filterCategory").value = urlCat;
    document.getElementById("procCategory").value = urlCat;
    document.getElementById("compareCatSelect").value = urlCat;
  }

  if (window.location.hash === "#procurement") {
    document.getElementById("procurement").hidden = false;
  }

  function getBuyerCoords() {
    const hub = window.AgroConfig.HUB_CITIES.find((c) => c.name === hubSelect.value);
    return hub ? { lat: hub.lat, lng: hub.lng } : { lat: 11.0168, lng: 76.9558 };
  }

  function renderMarketplace() {
    const search = document.getElementById("filterSearch").value.trim().toLowerCase();
    const category = document.getElementById("filterCategory").value;
    const quality = document.getElementById("filterQuality").value;
    const sortBy = document.getElementById("filterSort").value;
    const maxPrice = Number(document.getElementById("filterMaxPrice").value);
    const maxDist = Number(document.getElementById("filterMaxDist").value);

    document.getElementById("maxPriceLabel").textContent = `₹${maxPrice}`;
    document.getElementById("maxDistLabel").textContent = `${maxDist.toLocaleString()} km`;

    const buyer = getBuyerCoords();
    let list = window.AgroMatching.matchSuppliers(allProducts, {
      category,
      quality,
      requiredKg: 1000,
      maxPricePerKg: maxPrice,
      buyerLat: buyer.lat,
      buyerLng: buyer.lng
    });

    list = list.filter((p) => {
      if (p.pricePerKg > maxPrice) return false;
      if (p.distanceKm > maxDist) return false;
      if (search) {
        const hay = `${p.title} ${p.sellerName} ${p.location} ${p.category} ${p.condition}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    if (sortBy === "distance") list.sort((a, b) => a.distanceKm - b.distanceKm);
    if (sortBy === "priceAsc") list.sort((a, b) => a.pricePerKg - b.pricePerKg);
    if (sortBy === "landedAsc") list.sort((a, b) => a.landedPricePerKg - b.landedPricePerKg);
    if (sortBy === "stockDesc") list.sort((a, b) => b.quantityKg - a.quantityKg);

    document.getElementById("marketplaceCount").textContent = `Showing ${list.length} verified supply lot${list.length === 1 ? "" : "s"} from ${hubSelect.value}`;

    const grid = document.getElementById("marketplaceGrid");
    if (!list.length) {
      grid.innerHTML = `<div class="card card-pad" style="grid-column:1/-1;text-align:center;">No agricultural waste lots match your current filters. Try widening your max price or distance radius.</div>`;
      return;
    }

    grid.innerHTML = list
      .map(
        (p) => `
      <article class="card product-card card-hover">
        <div class="product-thumb">
          <img src="${p.image}" alt="${p.title}" loading="lazy" />
          <span class="pill pill-green product-thumb-badge">${p.matchScore}% Smart Match</span>
          <span class="product-thumb-dist">${p.distanceKm} km · ~${p.transportQuote.etaText}</span>
        </div>
        <div class="product-body">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span class="text-xs mono" style="color:var(--leaf-600);font-weight:700;">${p.category.toUpperCase()}</span>
            <span class="text-xs text-muted">★ ${p.sellerRating || 4.8}</span>
          </div>
          <h3 class="product-title">${p.title}</h3>
          <div class="text-xs text-muted">${p.sellerName} · ${p.location}</div>
          <div class="product-price-row">
            <div>
              <span class="price-tag">${window.AgroUI.formatINR(p.pricePerKg)}</span><span class="text-xs text-muted">/kg</span>
              <div class="text-xs text-muted">Landed est: ~${window.AgroUI.formatINR(p.landedPricePerKg)}/kg</div>
            </div>
            <div style="text-align:right;">
              <div class="mono text-sm" style="font-weight:700;color:var(--forest-900);">${Number(p.quantityKg).toLocaleString()} kg</div>
              <div class="text-xs text-muted">Available ${p.availableDate}</div>
            </div>
          </div>
          <div class="product-specs">
            <span class="pill pill-neutral">${p.quality}</span>
            <span class="pill pill-earth">${p.condition}</span>
          </div>
          <div class="product-footer">
            <a href="product-details.html?id=${encodeURIComponent(p.id)}" class="btn btn-outline btn-sm" style="flex:1;">Details</a>
            <button type="button" class="btn btn-primary btn-sm" data-add-cart="${p.id}" style="flex:1;">Add to Cart</button>
          </div>
        </div>
      </article>`
      )
      .join("");

    grid.querySelectorAll("[data-add-cart]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const prod = allProducts.find((x) => x.id === btn.dataset.addCart);
        if (!prod) return;
        const currUser = await window.AgroDB.getCurrentUser();
        await window.AgroDB.addToCart(currUser ? currUser.id : null, prod, Math.min(500, prod.quantityKg));
        window.AgroUI.showToast(`Added 500 kg of ${prod.title} to Cart.`);
      });
    });
  }

  function renderComparisonTable() {
    const cat = document.getElementById("compareCatSelect").value;
    const buyer = getBuyerCoords();
    const rows = window.AgroMatching.compareSellersByCategory(allProducts, cat, 1000, buyer.lat, buyer.lng);
    const wrap = document.getElementById("compareTableWrap");

    if (!rows.length) {
      wrap.innerHTML = `<p class="text-muted">No active sellers found for ${cat}.</p>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Grade</th>
            <th>Base Price/kg</th>
            <th>Distance</th>
            <th>Landed Price/kg (1T)</th>
            <th>Stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r, idx) => `
            <tr>
              <td>
                <strong>${r.sellerName}</strong>
                ${idx === 0 ? '<span class="pill pill-green" style="margin-left:6px;">Best Landed Cost</span>' : ""}
                <div class="text-xs text-muted">${r.location}</div>
              </td>
              <td>${r.quality}</td>
              <td class="mono">${window.AgroUI.formatINR(r.pricePerKg)}</td>
              <td class="mono">${r.distanceKm} km</td>
              <td class="mono" style="font-weight:700;color:var(--forest-900);">${window.AgroUI.formatINR(r.landedPricePerKg)}</td>
              <td class="mono">${Number(r.quantityKg).toLocaleString()} kg</td>
              <td><a href="product-details.html?id=${encodeURIComponent(r.id)}" class="btn btn-outline btn-sm">Inspect</a></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function runMultiSellerPlan() {
    const cat = document.getElementById("procCategory").value;
    const targetKg = Number(document.getElementById("procQty").value);
    const priority = document.getElementById("procPriority").value;
    const buyer = getBuyerCoords();
    const plan = window.AgroMatching.planMultiSellerProcurement(allProducts, cat, targetKg, buyer.lat, buyer.lng, priority);
    const resEl = document.getElementById("procResult");

    if (!plan.allocations.length) {
      resEl.innerHTML = `<div class="card card-pad">No available stock found for ${cat}.</div>`;
      return;
    }

    resEl.innerHTML = `
      <div class="card card-pad">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;">
          <div>
            <span class="pill ${plan.isFullyFulfilled ? "pill-green" : "pill-warn"}">
              ${plan.isFullyFulfilled ? "100% Order Fulfilled" : `Partial Fulfillment (${plan.fulfilledKg.toLocaleString()} / ${plan.requestedKg.toLocaleString()} kg)`}
            </span>
            <span class="text-sm text-muted" style="margin-left:10px;">Split across ${plan.allocations.length} supplier${plan.allocations.length > 1 ? "s" : ""}</span>
          </div>
          <div class="mono" style="font-weight:700;font-size:1.05rem;color:var(--forest-900);">
            Grand Total: ${window.AgroUI.formatINR(plan.grandTotal)} (Avg ${window.AgroUI.formatINR(plan.avgLandedPerKg)}/kg)
          </div>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Allocated Qty</th>
                <th>Distance</th>
                <th>Vehicle Tier</th>
                <th>Material Cost</th>
                <th>Transport</th>
              </tr>
            </thead>
            <tbody>
              ${plan.allocations
                .map(
                  (a) => `
                <tr>
                  <td><strong>${a.product.sellerName}</strong><div class="text-xs text-muted">${a.product.location}</div></td>
                  <td class="mono" style="font-weight:700;">${a.allocatedKg.toLocaleString()} kg</td>
                  <td class="mono">${a.distanceKm} km (${a.etaText})</td>
                  <td class="text-xs">${a.vehicleName}</td>
                  <td class="mono">${window.AgroUI.formatINR(a.materialCost)}</td>
                  <td class="mono">${window.AgroUI.formatINR(a.transportCost)}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:14px;">
          <button type="button" class="btn btn-primary" id="addBundleToCartBtn">Add Entire Multi-Seller Bundle to Cart</button>
        </div>
      </div>`;

    document.getElementById("addBundleToCartBtn").addEventListener("click", async () => {
      const currUser = await window.AgroDB.getCurrentUser();
      for (const a of plan.allocations) {
        await window.AgroDB.addToCart(currUser ? currUser.id : null, a.product, a.allocatedKg);
      }
      window.AgroUI.showToast(`Added ${plan.allocations.length} supplier lots (${plan.fulfilledKg.toLocaleString()} kg) to Cart!`);
    });
  }

  ["filterSearch", "filterCategory", "filterQuality", "filterHub", "filterSort", "filterMaxPrice", "filterMaxDist"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderMarketplace);
    document.getElementById(id).addEventListener("change", renderMarketplace);
  });

  document.getElementById("openCompareBtn").addEventListener("click", () => {
    renderComparisonTable();
    document.getElementById("compareModal").hidden = false;
  });
  document.getElementById("closeCompareBtn").addEventListener("click", () => {
    document.getElementById("compareModal").hidden = true;
  });
  document.getElementById("compareCatSelect").addEventListener("change", renderComparisonTable);

  document.getElementById("toggleProcurementBtn").addEventListener("click", () => {
    const panel = document.getElementById("procurement");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) runMultiSellerPlan();
  });
  document.getElementById("closeProcBtn").addEventListener("click", () => {
    document.getElementById("procurement").hidden = true;
  });
  document.getElementById("runProcBtn").addEventListener("click", runMultiSellerPlan);

  window.AgroDB.subscribeProducts((products) => {
    allProducts = products;
    renderMarketplace();
    if (!document.getElementById("procurement").hidden) runMultiSellerPlan();
  });
})();
