(function (window) {
  "use strict";

  const NAV_ITEMS = [
    { href: "index.html", label: "Home", id: "home" },
    { href: "marketplace.html", label: "Marketplace", id: "marketplace" },
    { href: "logistics.html", label: "Location & Logistics", id: "logistics" },
    { href: "upload-waste.html", label: "Upload Waste", id: "upload", roles: ["seller"] },
    { href: "seller-dashboard.html", label: "Seller Dashboard", id: "seller", roles: ["seller"] },
    { href: "profile.html", label: "Profile & History", id: "profile" }
  ];

  function showToast(message, isError) {
    let stack = document.getElementById("agroToastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "agroToastStack";
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const t = document.createElement("div");
    t.className = "toast" + (isError ? " error" : "");
    t.textContent = message;
    stack.appendChild(t);
    setTimeout(() => {
      t.remove();
    }, 3600);
  }

  function formatINR(num) {
    return "₹" + Number(num || 0).toLocaleString("en-IN");
  }

  function renderConfigModal() {
    if (document.getElementById("agroConfigModal")) return;
    const cfg = window.AgroConfig.runtime;
    const modal = document.createElement("div");
    modal.id = "agroConfigModal";
    modal.className = "modal-backdrop";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal-panel">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div>
            <span class="section-kicker">DATABASE &amp; MAPS INTEGRATION</span>
            <h2 style="margin:0;font-family:var(--font-display);color:var(--forest-900);">Firebase &amp; Google Maps Setup</h2>
          </div>
          <button class="btn btn-ghost btn-sm" id="closeCfgModal" aria-label="Close">✕</button>
        </div>
        <p class="text-sm text-muted" style="margin-top:0;">
          AgroConnect runs out-of-the-box with persistent <strong>IndexedDB + live cross-tab sync</strong> and an interactive logistics geo-grid.
          Paste your live <strong>Firebase</strong> and <strong>Google Maps API</strong> credentials below to connect cloud Firestore, Firebase Auth, Storage, and live Google Maps routing.
        </p>
        <form id="agroCfgForm">
          <div class="form-grid">
            <div class="form-group">
              <label for="cfgApiKey">Firebase API Key</label>
              <input class="form-control" id="cfgApiKey" value="${cfg.firebase.apiKey || ""}" placeholder="AIzaSy..." />
            </div>
            <div class="form-group">
              <label for="cfgAuthDomain">Firebase Auth Domain</label>
              <input class="form-control" id="cfgAuthDomain" value="${cfg.firebase.authDomain || ""}" placeholder="your-app.firebaseapp.com" />
            </div>
            <div class="form-group">
              <label for="cfgProjectId">Firebase Project ID</label>
              <input class="form-control" id="cfgProjectId" value="${cfg.firebase.projectId || ""}" placeholder="your-app-id" />
            </div>
            <div class="form-group">
              <label for="cfgStorageBucket">Firebase Storage Bucket</label>
              <input class="form-control" id="cfgStorageBucket" value="${cfg.firebase.storageBucket || ""}" placeholder="your-app.appspot.com" />
            </div>
          </div>
          <div class="form-group">
            <label for="cfgMapsKey">Google Maps JavaScript API Key (with Maps &amp; Distance Matrix enabled)</label>
            <input class="form-control" id="cfgMapsKey" value="${cfg.googleMapsApiKey || ""}" placeholder="AIzaSy..." />
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
            <button type="button" class="btn btn-outline" id="clearCfgBtn">Reset to Local DB</button>
            <button type="submit" class="btn btn-primary">Save &amp; Reload</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("closeCfgModal").addEventListener("click", () => {
      modal.hidden = true;
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.hidden = true;
    });
    document.getElementById("clearCfgBtn").addEventListener("click", () => {
      localStorage.removeItem("agroconnect_runtime_config");
      showToast("Reset to local IndexedDB & Geo-Grid mode.");
      setTimeout(() => window.location.reload(), 500);
    });
    document.getElementById("agroCfgForm").addEventListener("submit", (e) => {
      e.preventDefault();
      window.AgroConfig.saveRuntime({
        firebase: {
          apiKey: document.getElementById("cfgApiKey").value.trim(),
          authDomain: document.getElementById("cfgAuthDomain").value.trim(),
          projectId: document.getElementById("cfgProjectId").value.trim(),
          storageBucket: document.getElementById("cfgStorageBucket").value.trim(),
          messagingSenderId: "",
          appId: ""
        },
        googleMapsApiKey: document.getElementById("cfgMapsKey").value.trim()
      });
      showToast("API settings saved. Reloading...");
      setTimeout(() => window.location.reload(), 500);
    });
  }

  async function initShell(activeId) {
    const headerMount = document.getElementById("siteHeader");
    const footerMount = document.getElementById("siteFooter");
    const { mode } = await window.AgroDB.init();
    const user = await window.AgroDB.getCurrentUser();
    const cart = await window.AgroDB.getCart(user ? user.id : null);

    if (headerMount) {
      const visibleLinks = NAV_ITEMS.filter((item) => {
        if (!item.roles) return true;
        if (!user) return true; // Show seller links so users can discover & prompt login if needed
        return item.roles.includes(user.role);
      });

      const navHtml = visibleLinks
        .map(
          (item) =>
            `<a href="${item.href}" class="nav-link ${item.id === activeId ? "active" : ""}">${item.label}</a>`
        )
        .join("");

      const authBtnHtml = user
        ? `<a href="profile.html" class="btn btn-outline btn-sm" title="Signed in as ${user.name}">${user.role === "seller" ? "Seller" : "Buyer"}: ${user.name.split(" ")[0]}</a>`
        : `<a href="auth.html" class="btn btn-primary btn-sm">Login / Signup</a>`;

      headerMount.className = "site-header";
      headerMount.innerHTML = `
        <div class="container header-inner">
          <a href="index.html" class="brand">
            <span class="brand-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
              </svg>
            </span>
            <span>
              AGROCONNECT
              <span class="brand-sub">Agri-Waste Marketplace</span>
            </span>
          </a>

          <nav class="nav-links" aria-label="Main navigation">
            ${navHtml}
          </nav>

          <div class="header-actions">
            <button type="button" class="db-pill" id="openCfgModalBtn" title="Configure Firebase & Google Maps API">
              <span class="db-dot ${mode === "firebase" ? "firebase" : ""}"></span>
              <span class="db-pill-label">${mode === "firebase" ? "Firebase Cloud" : "Live DB + Setup"}</span>
            </button>

            <a href="cart.html" class="icon-btn" aria-label="Cart and Orders">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <span class="badge-count" id="navCartBadge">${cart.length}</span>
            </a>

            ${authBtnHtml}

            <button type="button" class="menu-toggle" id="mobileNavToggle" aria-label="Toggle Menu" aria-expanded="false">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M3 12h18M3 18h18"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="mobile-drawer" id="mobileDrawer" hidden>
          <div class="mobile-nav-list">
            ${navHtml}
            <a href="cart.html" class="nav-link">Cart &amp; Orders (${cart.length})</a>
            ${user ? `<a href="auth.html" class="nav-link">Switch Account</a>` : `<a href="auth.html" class="nav-link">Login / Signup</a>`}
          </div>
        </div>
      `;

      renderConfigModal();

      document.getElementById("openCfgModalBtn").addEventListener("click", () => {
        document.getElementById("agroConfigModal").hidden = false;
      });

      const toggle = document.getElementById("mobileNavToggle");
      const drawer = document.getElementById("mobileDrawer");
      toggle.addEventListener("click", () => {
        const open = !drawer.hidden;
        drawer.hidden = open;
        toggle.setAttribute("aria-expanded", String(!open));
      });
    }

    if (footerMount) {
      footerMount.className = "site-footer";
      footerMount.innerHTML = `
        <div class="container">
          <div class="footer-grid">
            <div>
              <div style="font-weight:800;font-size:1.15rem;color:#fff;margin-bottom:8px;">AGROCONNECT</div>
              <p class="text-sm" style="margin:0;color:rgba(255,255,255,0.72);max-width:320px;">
                Connecting rural farmers and agricultural cooperatives directly with sustainable textile, paper, packaging, and bio-material industries.
              </p>
            </div>
            <div>
              <h4>Marketplace</h4>
              <div class="footer-links">
                <a href="marketplace.html">Browse Waste Supply</a>
                <a href="marketplace.html?cat=Banana+Stem">Banana Stem</a>
                <a href="marketplace.html?cat=Lotus+Stem">Lotus Stem</a>
                <a href="marketplace.html?cat=Sugarcane+Bagasse">Sugarcane Bagasse</a>
                <a href="marketplace.html?cat=Coconut+Husk">Coconut Husk</a>
              </div>
            </div>
            <div>
              <h4>Suppliers &amp; Logistics</h4>
              <div class="footer-links">
                <a href="upload-waste.html">Upload Waste Lot</a>
                <a href="seller-dashboard.html">Seller Dashboard</a>
                <a href="logistics.html">Distance &amp; Freight Calculator</a>
                <a href="cart.html">Cart &amp; Checkout</a>
              </div>
            </div>
            <div>
              <h4>Account</h4>
              <div class="footer-links">
                <a href="auth.html">Seller / Buyer Login</a>
                <a href="profile.html">Profile &amp; Order Tracking</a>
                <a href="#" id="footerApiSetup">Firebase &amp; Maps Setup</a>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© 2026 AgroConnect Circular Biomass Exchange</span>
            <span>Transforming Agricultural Waste into Industrial Value</span>
          </div>
        </div>
      `;

      const fSetup = document.getElementById("footerApiSetup");
      if (fSetup) {
        fSetup.addEventListener("click", (e) => {
          e.preventDefault();
          const modal = document.getElementById("agroConfigModal");
          if (modal) modal.hidden = false;
        });
      }
    }

    window.addEventListener("agro:cart", (e) => {
      const badge = document.getElementById("navCartBadge");
      if (badge) badge.textContent = e.detail.count;
    });

    return { user, mode };
  }

  window.AgroUI = {
    initShell,
    showToast,
    formatINR
  };
})(window);
