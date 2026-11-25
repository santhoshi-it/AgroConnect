(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("marketplace");
  const root = document.getElementById("productDetailRoot");
  const allProducts = await window.AgroDB.getProducts();
  const params = new URLSearchParams(window.location.search);
  const prodId = params.get("id");
  const product = allProducts.find((p) => p.id === prodId) || allProducts[0];

  if (!product) {
    root.innerHTML = `<div class="card card-pad">No product found. <a href="marketplace.html">Return to Marketplace</a></div>`;
    return;
  }

  const buyerLat = user ? user.lat : 11.0168;
  const buyerLng = user ? user.lng : 76.9558;
  const buyerLoc = user ? user.location : "Coimbatore, TN";

  const distanceKm = window.AgroGeo.haversineKm(buyerLat, buyerLng, product.lat, product.lng);
  const defaultQty = Math.min(1000, product.quantityKg || 500);
  const initialQuote = window.AgroGeo.calculateTransportQuote(distanceKm, defaultQty);
  const forecast = window.AgroMatching.predictAvailability(allProducts, product.category);
  const maxForecastKg = Math.max(...forecast.months.map((m) => m.projectedKg), 1);
  const peerSellers = window.AgroMatching.compareSellersByCategory(
    allProducts,
    product.category,
    defaultQty,
    buyerLat,
    buyerLng
  );

  const gallery = product.gallery && product.gallery.length ? product.gallery : [product.image];

  root.innerHTML = `
    <div class="grid-2" style="align-items:start;gap:32px;">
      <!-- Left: Images & Availability Forecast -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div class="card" style="overflow:hidden;">
          <div style="height:360px;background:var(--cream-100);">
            <img id="detailMainImg" src="${gallery[0]}" alt="${product.title}" style="width:100%;height:100%;object-fit:cover;" />
          </div>
          <div style="display:flex;gap:10px;padding:12px;background:var(--cream-50);">
            ${gallery
              .map(
                (src, idx) => `
              <button type="button" class="btn btn-outline btn-sm" data-thumb="${src}" style="padding:3px;border-radius:8px;${idx === 0 ? "border-color:var(--forest-900);" : ""}">
                <img src="${src}" alt="Gallery ${idx + 1}" style="width:64px;height:48px;object-fit:cover;border-radius:6px;" />
              </button>`
              )
              .join("")}
          </div>
        </div>

        <!-- Waste Availability Prediction -->
        <div class="card card-pad">
          <span class="section-kicker">WASTE AVAILABILITY PREDICTION</span>
          <h3 style="margin:4px 0 6px;color:var(--forest-900);">3-Month Regional Supply Forecast (${product.category})</h3>
          <p class="text-xs text-muted" style="margin:0 0 16px;">${forecast.seasonNote}</p>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${forecast.months
              .map((m) => {
                const pct = Math.max(12, Math.round((m.projectedKg / maxForecastKg) * 100));
                return `
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:0.84rem;margin-bottom:4px;">
                    <span><strong>${m.label}</strong> ${m.isPeak ? '<span class="pill pill-green" style="padding:2px 8px;font-size:0.7rem;">Peak Harvest</span>' : ""}</span>
                    <span class="mono">${m.projectedKg.toLocaleString()} kg · <span class="text-muted">${m.confidence}</span></span>
                  </div>
                  <div class="bar-track"><div class="bar-fill" style="width:${pct}%;"></div></div>
                </div>`;
              })
              .join("")}
          </div>
        </div>
      </div>

      <!-- Right: Specs, Seller Info & Order Box -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div class="card card-pad">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <span class="pill pill-green">${product.category}</span>
            <span class="pill pill-earth">${product.quality}</span>
            <span class="pill pill-neutral">${product.condition}</span>
          </div>
          <h1 style="margin:0 0 10px;font-family:var(--font-display);font-size:1.85rem;color:var(--forest-950);">${product.title}</h1>
          <p class="text-muted" style="margin:0 0 18px;">${product.description || ""}</p>

          <div class="grid-specs-3" style="padding:14px;border-radius:12px;background:var(--cream-50);border:1px solid var(--border);margin-bottom:18px;">
            <div>
              <div class="text-xs text-muted">Price / kg</div>
              <div class="mono" style="font-size:1.35rem;font-weight:700;color:var(--forest-900);">${window.AgroUI.formatINR(product.pricePerKg)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Available Stock</div>
              <div class="mono" style="font-size:1.2rem;font-weight:700;">${Number(product.quantityKg).toLocaleString()} kg</div>
            </div>
            <div>
              <div class="text-xs text-muted">Moisture / Ready</div>
              <div class="mono" style="font-size:1.05rem;font-weight:600;">${product.moisturePct || 12}% · ${product.availableDate}</div>
            </div>
          </div>

          <!-- Seller Info -->
          <div style="padding:14px;border-radius:12px;background:var(--leaf-50);border:1px solid var(--leaf-100);margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div class="text-xs mono" style="color:var(--leaf-600);font-weight:700;">VERIFIED SUPPLIER</div>
              <div style="font-weight:700;font-size:1.02rem;">${product.sellerName}</div>
              <div class="text-xs text-muted">${product.location} · ★ ${product.sellerRating || 4.8} Supplier Rating</div>
            </div>
            <div style="text-align:right;">
              <div class="mono text-sm" style="font-weight:700;color:var(--forest-900);">${distanceKm} km from ${buyerLoc}</div>
              <a href="logistics.html?product=${encodeURIComponent(product.id)}" class="text-xs" style="color:var(--leaf-600);font-weight:700;">Open Route Map →</a>
            </div>
          </div>

          <!-- Purchase Calculator -->
          <div class="form-group">
            <label for="detailQtyInput">Select Order Quantity (kg) — Max ${Number(product.quantityKg).toLocaleString()} kg</label>
            <input class="form-control" type="number" id="detailQtyInput" min="50" max="${product.quantityKg}" step="50" value="${defaultQty}" />
          </div>

          <div id="detailQuoteBox" class="text-sm" style="padding:12px 14px;border-radius:10px;background:var(--cream-100);margin-bottom:16px;">
            Material: <strong>${window.AgroUI.formatINR(defaultQty * product.pricePerKg)}</strong> +
            Est. Transport (${initialQuote.vehicle.name}): <strong>${window.AgroUI.formatINR(initialQuote.cost)}</strong>
            (${initialQuote.etaText})
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-lg" id="detailAddCartBtn" style="flex:1;">Add to Cart</button>
            <button type="button" class="btn btn-leaf btn-lg" id="detailBuyNowBtn" style="flex:1;">Proceed to Checkout</button>
          </div>
        </div>

        <!-- Peer Seller Price Comparison -->
        <div class="card card-pad">
          <h3 style="margin:0 0 12px;color:var(--forest-900);">Compare Other ${product.category} Sellers</h3>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Price/kg</th>
                  <th>Distance</th>
                  <th>Landed/kg</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${peerSellers
                  .map(
                    (s) => `
                  <tr>
                    <td><strong>${s.sellerName}</strong><div class="text-xs text-muted">${s.location}</div></td>
                    <td class="mono">${window.AgroUI.formatINR(s.pricePerKg)}</td>
                    <td class="mono">${s.distanceKm} km</td>
                    <td class="mono" style="font-weight:700;">${window.AgroUI.formatINR(s.landedPricePerKg)}</td>
                    <td>${s.id === product.id ? '<span class="pill pill-green">Viewing</span>' : `<a href="product-details.html?id=${encodeURIComponent(s.id)}" class="btn btn-outline btn-sm">View</a>`}</td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll("[data-thumb]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("detailMainImg").src = btn.dataset.thumb;
    });
  });

  const qtyInput = document.getElementById("detailQtyInput");
  const quoteBox = document.getElementById("detailQuoteBox");

  function refreshQuote() {
    const qty = Math.min(product.quantityKg, Math.max(1, Number(qtyInput.value) || 50));
    const q = window.AgroGeo.calculateTransportQuote(distanceKm, qty);
    quoteBox.innerHTML = `
      Material: <strong>${window.AgroUI.formatINR(Math.round(qty * product.pricePerKg))}</strong> +
      Est. Transport (${q.vehicle.name}): <strong>${window.AgroUI.formatINR(q.cost)}</strong>
      (${q.etaText} · ${q.loads} truckload${q.loads > 1 ? "s" : ""})
    `;
  }

  qtyInput.addEventListener("input", refreshQuote);

  async function addSelectedToCart(goToCart) {
    const qty = Math.min(product.quantityKg, Math.max(1, Number(qtyInput.value) || 50));
    const currUser = await window.AgroDB.getCurrentUser();
    await window.AgroDB.addToCart(currUser ? currUser.id : null, product, qty);
    window.AgroUI.showToast(`Added ${qty.toLocaleString()} kg to Cart.`);
    if (goToCart) {
      setTimeout(() => {
        window.location.href = "cart.html";
      }, 350);
    }
  }

  document.getElementById("detailAddCartBtn").addEventListener("click", () => addSelectedToCart(false));
  document.getElementById("detailBuyNowBtn").addEventListener("click", () => addSelectedToCart(true));
})();
