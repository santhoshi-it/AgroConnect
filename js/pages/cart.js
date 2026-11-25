(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("cart");
  const root = document.getElementById("cartRoot");

  let selectedHub = (() => {
    const loc = user && user.location ? user.location : "Coimbatore, TN";
    return window.AgroConfig.HUB_CITIES.find((c) => c.name === loc) || window.AgroConfig.HUB_CITIES[0];
  })();

  async function renderCart() {
    const currUser = await window.AgroDB.getCurrentUser();
    const items = await window.AgroDB.getCart(currUser ? currUser.id : null);

    if (!items.length) {
      root.innerHTML = `
        <div class="card card-pad" style="text-align:center;padding:48px 24px;">
          <h2 style="margin:0 0 8px;color:var(--forest-900);">Your Procurement Cart is Empty</h2>
          <p class="text-muted" style="margin:0 0 20px;">Explore available Banana Stem, Lotus Stem, Sugarcane Bagasse, and Coconut Husk supply lots.</p>
          <a href="marketplace.html" class="btn btn-primary">Browse Buyer Marketplace</a>
        </div>`;
      return;
    }

    // Group items by seller for per-supplier logistics calculation
    const groupsMap = new Map();
    items.forEach((item) => {
      if (!groupsMap.has(item.sellerId)) {
        groupsMap.set(item.sellerId, {
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          location: item.location,
          lat: item.lat,
          lng: item.lng,
          items: []
        });
      }
      groupsMap.get(item.sellerId).items.push(item);
    });

    const groups = Array.from(groupsMap.values()).map((g) => {
      const totalKg = g.items.reduce((s, it) => s + Number(it.quantityKg), 0);
      const subtotal = g.items.reduce((s, it) => s + Math.round(it.quantityKg * it.pricePerKg), 0);
      const distanceKm = window.AgroGeo.haversineKm(selectedHub.lat, selectedHub.lng, g.lat, g.lng);
      const quote = window.AgroGeo.calculateTransportQuote(distanceKm, totalKg);
      const platformFee = Math.round(subtotal * 0.02);
      const total = subtotal + quote.cost + platformFee;
      return Object.assign(g, {
        totalKg,
        subtotal,
        distanceKm,
        vehicleName: quote.vehicle.name,
        transportFee: quote.cost,
        etaHours: quote.etaHours,
        etaText: quote.etaText,
        platformFee,
        total
      });
    });

    const grandSubtotal = groups.reduce((s, g) => s + g.subtotal, 0);
    const grandTransport = groups.reduce((s, g) => s + g.transportFee, 0);
    const grandPlatform = groups.reduce((s, g) => s + g.platformFee, 0);
    const grandTotal = groups.reduce((s, g) => s + g.total, 0);

    root.innerHTML = `
      <div class="grid-cart-split">
        <div style="display:flex;flex-direction:column;gap:20px;">
          ${groups
            .map(
              (g) => `
            <div class="card card-pad">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:14px;">
                <div>
                  <span class="text-xs mono" style="color:var(--leaf-600);font-weight:700;">SUPPLIER SHIPMENT</span>
                  <h3 style="margin:2px 0 0;color:var(--forest-900);">${g.sellerName}</h3>
                </div>
                <span class="pill pill-earth">${g.location} · ${g.distanceKm} km · ${g.etaText}</span>
              </div>

              <div style="display:flex;flex-direction:column;gap:14px;">
                ${g.items
                  .map(
                    (it) => `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:12px;min-width:220px;flex:1;">
                      <img src="${it.image}" alt="${it.title}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;" />
                      <div>
                        <div style="font-weight:700;">${it.title}</div>
                        <div class="text-xs text-muted">${it.category} · ${window.AgroUI.formatINR(it.pricePerKg)}/kg · Max ${Number(it.maxStockKg).toLocaleString()} kg</div>
                      </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <label class="text-xs text-muted">Qty (kg)</label>
                      <input class="form-control" type="number" min="50" max="${it.maxStockKg}" step="50" value="${it.quantityKg}" data-cart-qty="${it.productId}" style="width:110px;" />
                      <div class="mono" style="font-weight:700;min-width:90px;text-align:right;">${window.AgroUI.formatINR(Math.round(it.quantityKg * it.pricePerKg))}</div>
                      <button type="button" class="btn btn-danger btn-sm" data-cart-remove="${it.productId}">Remove</button>
                    </div>
                  </div>`
                  )
                  .join("")}
              </div>

              <div style="margin-top:16px;padding:12px;border-radius:10px;background:var(--cream-50);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:0.84rem;">
                <span>Vehicle: <strong>${g.vehicleName}</strong></span>
                <span>Freight: <strong class="mono">${window.AgroUI.formatINR(g.transportFee)}</strong></span>
              </div>
            </div>`
            )
            .join("")}
        </div>

        <!-- Order Summary Card -->
        <div class="card card-pad" style="position:sticky;top:90px;">
          <span class="section-kicker">CHECKOUT SUMMARY</span>
          <h3 style="margin:4px 0 14px;color:var(--forest-900);">Order &amp; Delivery</h3>

          <div class="form-group">
            <label for="checkoutHub">Delivery Factory City</label>
            <select class="form-control" id="checkoutHub">
              ${window.AgroConfig.HUB_CITIES.map(
                (c) => `<option value="${c.name}" ${c.name === selectedHub.name ? "selected" : ""}>${c.name}</option>`
              ).join("")}
            </select>
          </div>

          <div class="form-group">
            <label for="checkoutAddress">Factory Gate Address</label>
            <textarea class="form-control" id="checkoutAddress" placeholder="Plot / Industrial Estate, Gate No., Contact Person">${currUser ? `${currUser.orgName}, ${selectedHub.name}` : `Industrial Estate Phase II, ${selectedHub.name}`}</textarea>
          </div>

          <div style="border-top:1px solid var(--border);padding-top:14px;display:flex;flex-direction:column;gap:8px;font-size:0.9rem;">
            <div style="display:flex;justify-content:space-between;">
              <span class="text-muted">Material Subtotal</span>
              <span class="mono">${window.AgroUI.formatINR(grandSubtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span class="text-muted">Transportation Charges (${groups.length} shipment${groups.length > 1 ? "s" : ""})</span>
              <span class="mono">${window.AgroUI.formatINR(grandTransport)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span class="text-muted">Platform Quality &amp; Escrow (2%)</span>
              <span class="mono">${window.AgroUI.formatINR(grandPlatform)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border);font-size:1.1rem;font-weight:700;color:var(--forest-900);">
              <span>Total Payable</span>
              <span class="mono">${window.AgroUI.formatINR(grandTotal)}</span>
            </div>
          </div>

          <button type="button" class="btn btn-primary btn-lg btn-full" id="placeOrderBtn" style="margin-top:18px;">
            Place Order Now
          </button>
          <p class="text-xs text-muted" style="margin:10px 0 0;text-align:center;">
            Stock is reserved immediately upon confirmation and tracked in Profile &amp; History.
          </p>
        </div>
      </div>`;

    document.getElementById("checkoutHub").addEventListener("change", (e) => {
      selectedHub = window.AgroConfig.HUB_CITIES.find((c) => c.name === e.target.value) || selectedHub;
      renderCart();
    });

    root.querySelectorAll("[data-cart-qty]").forEach((input) => {
      input.addEventListener("change", async () => {
        const pid = input.dataset.cartQty;
        const target = items.find((i) => i.productId === pid);
        if (!target) return;
        target.quantityKg = Math.min(target.maxStockKg, Math.max(50, Number(input.value) || 50));
        await window.AgroDB.saveCart(currUser ? currUser.id : null, items);
        renderCart();
      });
    });

    root.querySelectorAll("[data-cart-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const filtered = items.filter((i) => i.productId !== btn.dataset.cartRemove);
        await window.AgroDB.saveCart(currUser ? currUser.id : null, filtered);
        window.AgroUI.showToast("Item removed from cart.");
        renderCart();
      });
    });

    document.getElementById("placeOrderBtn").addEventListener("click", async () => {
      const btn = document.getElementById("placeOrderBtn");
      btn.disabled = true;
      btn.textContent = "Processing Order...";

      try {
        let buyer = await window.AgroDB.getCurrentUser();
        if (!buyer) {
          buyer = await window.AgroDB.quickLoginDemo("buyer-1");
          window.AgroUI.showToast("Signed in with Demo Buyer account to complete order.");
        }
        const buyerWithCity = Object.assign({}, buyer, { location: selectedHub.name });
        const orders = await window.AgroDB.createOrdersFromCheckout(buyerWithCity, groups);

        root.innerHTML = `
          <div class="card card-pad" style="max-width:620px;margin:0 auto;text-align:center;padding:42px 28px;">
            <div class="pill pill-green" style="margin-bottom:12px;">Order Confirmed</div>
            <h2 style="margin:0 0 10px;font-family:var(--font-display);color:var(--forest-900);">Thank You! ${orders.length} Shipment${orders.length > 1 ? "s" : ""} Scheduled</h2>
            <p class="text-muted">Order IDs: <strong class="mono">${orders.map((o) => o.id).join(", ")}</strong></p>
            <p class="text-sm text-muted">Seller inventory has been updated automatically across the marketplace.</p>
            <div style="display:flex;justify-content:center;gap:12px;margin-top:22px;flex-wrap:wrap;">
              <a href="profile.html" class="btn btn-primary">Track Order Status</a>
              <a href="marketplace.html" class="btn btn-outline">Continue Sourcing</a>
            </div>
          </div>`;
      } catch (err) {
        window.AgroUI.showToast(err.message || "Failed to place order.", true);
        btn.disabled = false;
        btn.textContent = "Place Order Now";
      }
    });
  }

  renderCart();
})();
