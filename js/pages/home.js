(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("home");
  const buyerLat = user ? user.lat : 11.0168;
  const buyerLng = user ? user.lng : 76.9558;

  function renderCategories() {
    const grid = document.getElementById("homeCategoriesGrid");
    if (!grid) return;

    const cats = Object.values(window.AgroConfig.CATEGORIES);
    grid.innerHTML = cats
      .map(
        (cat) => `
      <a href="marketplace.html?cat=${encodeURIComponent(cat.id)}" class="card category-card card-hover">
        <div class="category-img">
          <img src="${cat.image}" alt="${cat.short}" loading="lazy" />
        </div>
        <div class="category-body">
          <span class="pill pill-green" style="align-self:flex-start;">${cat.avgPriceRange}</span>
          <h3>${cat.short}</h3>
          <p class="text-sm text-muted" style="margin:0;">${cat.uses}</p>
        </div>
      </a>`
      )
      .join("");
  }

  function renderFeatured(products) {
    const grid = document.getElementById("homeFeaturedGrid");
    const lotsEl = document.getElementById("homeStatLots");
    const tonsEl = document.getElementById("homeStatTons");

    const active = products.filter((p) => p.status !== "archived" && p.quantityKg > 0);
    if (lotsEl) lotsEl.textContent = active.length;
    if (tonsEl) {
      const totalKg = active.reduce((s, p) => s + Number(p.quantityKg || 0), 0);
      tonsEl.textContent = (totalKg / 1000).toFixed(1) + "T";
    }

    if (!grid) return;
    const featured = active.slice(0, 6);
    grid.innerHTML = featured
      .map((p) => {
        const dist = window.AgroGeo.haversineKm(buyerLat, buyerLng, p.lat, p.lng);
        return `
        <article class="card product-card card-hover">
          <div class="product-thumb">
            <img src="${p.image}" alt="${p.title}" loading="lazy" />
            <span class="pill pill-green product-thumb-badge">${p.category}</span>
            <span class="product-thumb-dist">${dist} km away</span>
          </div>
          <div class="product-body">
            <h3 class="product-title">${p.title}</h3>
            <div class="text-xs text-muted">${p.sellerName} · ${p.location}</div>
            <div class="product-price-row">
              <span class="price-tag">${window.AgroUI.formatINR(p.pricePerKg)}<span class="text-xs text-muted">/kg</span></span>
              <span class="text-xs mono" style="color:var(--forest-700);font-weight:700;">${Number(p.quantityKg).toLocaleString()} kg</span>
            </div>
            <div class="product-specs">
              <span class="pill pill-neutral">${p.quality}</span>
              <span class="pill pill-earth">${p.condition}</span>
            </div>
            <div class="product-footer">
              <a href="product-details.html?id=${encodeURIComponent(p.id)}" class="btn btn-outline btn-sm" style="flex:1;">View Details</a>
              <button type="button" class="btn btn-primary btn-sm" data-quick-add="${p.id}" style="flex:1;">Add 500 kg</button>
            </div>
          </div>
        </article>`;
      })
      .join("");

    grid.querySelectorAll("[data-quick-add]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const prod = products.find((x) => x.id === btn.dataset.quickAdd);
        if (!prod) return;
        const currUser = await window.AgroDB.getCurrentUser();
        await window.AgroDB.addToCart(currUser ? currUser.id : null, prod, Math.min(500, prod.quantityKg));
        window.AgroUI.showToast(`Added 500 kg of ${prod.category} to Cart.`);
      });
    });
  }

  renderCategories();
  window.AgroDB.subscribeProducts(renderFeatured);
})();
