(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("profile");
  const root = document.getElementById("profileRoot");

  if (!user) {
    root.innerHTML = `
      <div class="card card-pad" style="text-align:center;padding:48px 24px;">
        <h2 style="margin:0 0 8px;color:var(--forest-900);">Sign In to View Your Profile &amp; Order History</h2>
        <p class="text-muted" style="margin:0 0 20px;">Manage your buyer or seller profile, inspect invoices, and track live shipment status.</p>
        <a href="auth.html" class="btn btn-primary">Login / Create Account</a>
      </div>`;
    return;
  }

  const allOrders = await window.AgroDB.getOrders();
  const myPurchases = allOrders.filter((o) => o.buyerId === user.id);
  const mySales = allOrders.filter((o) => o.sellerId === user.id);
  const relevantOrders = user.role === "seller" ? mySales : myPurchases;

  const STEPS = ["Confirmed", "Dispatched", "In Transit", "Delivered"];

  function renderOrderCard(order, isSellerView) {
    const stepIndex = Math.max(0, STEPS.indexOf(order.status));
    const dateStr = new Date(order.createdAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    return `
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <span class="mono" style="font-weight:700;color:var(--forest-900);">${order.id}</span>
            <span class="text-xs text-muted" style="margin-left:8px;">Placed ${dateStr}</span>
            <div style="font-weight:700;margin-top:4px;">
              ${isSellerView ? `Buyer: ${order.buyerName}` : `Supplier: ${order.sellerName}`}
            </div>
            <div class="text-sm text-muted">
              ${order.items.map((i) => `${i.title} (${i.quantityKg.toLocaleString()} kg)`).join(" · ")}
            </div>
          </div>
          <div style="text-align:right;">
            <div class="mono" style="font-size:1.15rem;font-weight:700;color:var(--forest-900);">${window.AgroUI.formatINR(order.total)}</div>
            <div class="text-xs text-muted">${order.distanceKm} km · ${order.vehicleName}</div>
          </div>
        </div>

        <div class="timeline">
          ${STEPS.map(
            (st, idx) => `<div class="timeline-step ${idx <= stepIndex ? "done" : ""}">${idx <= stepIndex ? "✓ " : ""}${st}</div>`
          ).join("")}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:10px;">
          <span class="text-xs text-muted">Current Status: <strong>${order.status}</strong></span>
          ${
            order.status !== "Delivered"
              ? `<button type="button" class="btn btn-outline btn-sm" data-advance-order="${order.id}" data-next="${STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]}">
                  Simulate Next Stage → ${STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]}
                </button>`
              : `<span class="pill pill-green">Completed</span>`
          }
        </div>
      </div>`;
  }

  root.innerHTML = `
    <div class="grid-profile-split">
      <!-- Profile Editor -->
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <span class="pill ${user.role === "seller" ? "pill-earth" : "pill-green"}">${user.role.toUpperCase()} ACCOUNT</span>
          <button type="button" class="btn btn-outline btn-sm" id="profileLogoutBtn">Sign Out</button>
        </div>

        <form id="profileForm">
          <div class="form-group">
            <label for="profName">Full Name</label>
            <input class="form-control" id="profName" value="${user.name}" required />
          </div>
          <div class="form-group">
            <label for="profOrg">Organization / Farm Name</label>
            <input class="form-control" id="profOrg" value="${user.orgName || ""}" required />
          </div>
          <div class="form-group">
            <label for="profPhone">Phone</label>
            <input class="form-control" id="profPhone" value="${user.phone || ""}" />
          </div>
          <div class="form-group">
            <label for="profLocation">Primary City / Hub</label>
            <select class="form-control" id="profLocation">
              ${window.AgroConfig.HUB_CITIES.map(
                (c) => `<option value="${c.name}" ${c.name === user.location ? "selected" : ""}>${c.name}</option>`
              ).join("")}
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-full">Save Profile Changes</button>
        </form>
      </div>

      <!-- Order Tracking & History -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h2 style="margin:0;color:var(--forest-900);">${user.role === "seller" ? "Sales & Dispatch History" : "Purchase History & Live Tracking"}</h2>
          <span class="mono text-sm text-muted">${relevantOrders.length} order${relevantOrders.length === 1 ? "" : "s"}</span>
        </div>

        ${
          relevantOrders.length
            ? relevantOrders.map((o) => renderOrderCard(o, user.role === "seller")).join("")
            : `<div class="card card-pad text-muted">No orders yet. <a href="${user.role === "seller" ? "upload-waste.html" : "marketplace.html"}" style="color:var(--forest-700);font-weight:700;">Get started →</a></div>`
        }
      </div>
    </div>`;

  document.getElementById("profileLogoutBtn").addEventListener("click", async () => {
    await window.AgroDB.logoutUser();
    window.AgroUI.showToast("Signed out.");
    setTimeout(() => {
      window.location.href = "auth.html";
    }, 400);
  });

  document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const hub = window.AgroConfig.HUB_CITIES.find((c) => c.name === document.getElementById("profLocation").value);
    await window.AgroDB.updateUserProfile(user.id, {
      name: document.getElementById("profName").value.trim(),
      orgName: document.getElementById("profOrg").value.trim(),
      phone: document.getElementById("profPhone").value.trim(),
      location: hub ? hub.name : user.location,
      lat: hub ? hub.lat : user.lat,
      lng: hub ? hub.lng : user.lng
    });
    window.AgroUI.showToast("Profile updated.");
  });

  root.querySelectorAll("[data-advance-order]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await window.AgroDB.updateOrderStatus(btn.dataset.advanceOrder, btn.dataset.next);
      window.AgroUI.showToast(`Order ${btn.dataset.advanceOrder} updated to ${btn.dataset.next}.`);
      setTimeout(() => window.location.reload(), 350);
    });
  });
})();
