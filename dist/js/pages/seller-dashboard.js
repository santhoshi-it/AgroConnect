(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("seller");

  const gate = document.getElementById("sellerAuthGate");
  const isSeller = user && user.role === "seller";
  if (!isSeller) {
    gate.hidden = false;
  } else {
    document.getElementById("sellerGreeting").textContent =
      `Signed in as ${user.orgName} (${user.location}) — Manage your lots, stock, and industrial orders.`;
  }

  const effectiveSellerId = isSeller ? user.id : "seller-1";

  async function renderDashboard() {
    const [allProducts, allOrders] = await Promise.all([
      window.AgroDB.getProducts(),
      window.AgroDB.getOrders()
    ]);

    const myProducts = allProducts.filter((p) => p.sellerId === effectiveSellerId);
    const myOrders = allOrders.filter((o) => o.sellerId === effectiveSellerId);

    const activeLots = myProducts.filter((p) => p.status !== "archived" && p.quantityKg > 0).length;
    const totalStock = myProducts.reduce((s, p) => s + Number(p.quantityKg || 0), 0);
    const totalEarnings = myOrders.reduce((s, o) => s + Number(o.subtotal || 0), 0);

    document.getElementById("kpiListings").textContent = activeLots;
    document.getElementById("kpiStock").textContent = `${totalStock.toLocaleString()} kg`;
    document.getElementById("kpiOrders").textContent = myOrders.length;
    document.getElementById("kpiEarnings").textContent = window.AgroUI.formatINR(totalEarnings);

    const prodBody = document.getElementById("sellerProductsBody");
    if (!myProducts.length) {
      prodBody.innerHTML = `<tr><td colspan="6" class="text-muted">No waste listings uploaded yet. <a href="upload-waste.html" style="color:var(--forest-700);font-weight:600;">Upload your first lot →</a></td></tr>`;
    } else {
      prodBody.innerHTML = myProducts
        .map(
          (p) => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${p.image}" alt="${p.title}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" />
              <div>
                <div style="font-weight:700;">${p.title}</div>
                <div class="text-xs text-muted">${p.location} · ${p.quality}</div>
              </div>
            </div>
          </td>
          <td><span class="pill pill-green">${p.category}</span></td>
          <td class="mono" style="font-weight:700;">${window.AgroUI.formatINR(p.pricePerKg)}</td>
          <td class="mono">${Number(p.quantityKg).toLocaleString()} kg</td>
          <td><span class="pill ${p.status === "archived" ? "pill-neutral" : "pill-green"}">${p.status || "active"}</span></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn btn-outline btn-sm" data-edit-prod="${p.id}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-del-prod="${p.id}">Delete</button>
            </div>
          </td>
        </tr>`
        )
        .join("");

      prodBody.querySelectorAll("[data-edit-prod]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const item = myProducts.find((x) => x.id === btn.dataset.editProd);
          if (!item) return;
          document.getElementById("editProdId").value = item.id;
          document.getElementById("editProdPrice").value = item.pricePerKg;
          document.getElementById("editProdStock").value = item.quantityKg;
          document.getElementById("editProdStatus").value = item.status || "active";
          document.getElementById("editProductModal").hidden = false;
        });
      });

      prodBody.querySelectorAll("[data-del-prod]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await window.AgroDB.deleteProduct(btn.dataset.delProd);
          window.AgroUI.showToast("Listing deleted.");
          renderDashboard();
        });
      });
    }

    const orderBody = document.getElementById("sellerOrdersBody");
    if (!myOrders.length) {
      orderBody.innerHTML = `<tr><td colspan="6" class="text-muted">No industrial orders received yet.</td></tr>`;
    } else {
      orderBody.innerHTML = myOrders
        .map((o) => {
          const summary = o.items.map((i) => `${i.title} (${i.quantityKg} kg)`).join(", ");
          const statusClass =
            o.status === "Delivered" ? "pill-green" : o.status === "In Transit" ? "pill-earth" : "pill-warn";
          return `
          <tr>
            <td class="mono" style="font-weight:700;">${o.id}</td>
            <td>
              <div style="font-weight:600;">${o.buyerName}</div>
              <div class="text-xs text-muted">${o.buyerLocation} · ${o.distanceKm} km</div>
            </td>
            <td class="text-sm">${summary}</td>
            <td class="mono" style="font-weight:700;">${window.AgroUI.formatINR(o.subtotal)}</td>
            <td><span class="pill ${statusClass}">${o.status}</span></td>
            <td>
              <select class="form-control" data-order-status="${o.id}" style="min-width:140px;padding:6px 10px;">
                <option value="Confirmed" ${o.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
                <option value="In Transit" ${o.status === "In Transit" ? "selected" : ""}>In Transit</option>
                <option value="Delivered" ${o.status === "Delivered" ? "selected" : ""}>Delivered</option>
              </select>
            </td>
          </tr>`;
        })
        .join("");

      orderBody.querySelectorAll("[data-order-status]").forEach((sel) => {
        sel.addEventListener("change", async () => {
          await window.AgroDB.updateOrderStatus(sel.dataset.orderStatus, sel.value);
          window.AgroUI.showToast(`Order ${sel.dataset.orderStatus} marked as ${sel.value}.`);
          renderDashboard();
        });
      });
    }
  }

  document.getElementById("cancelEditProd").addEventListener("click", () => {
    document.getElementById("editProductModal").hidden = true;
  });

  document.getElementById("editProductForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editProdId").value;
    await window.AgroDB.updateProduct(id, {
      pricePerKg: Number(document.getElementById("editProdPrice").value),
      quantityKg: Number(document.getElementById("editProdStock").value),
      status: document.getElementById("editProdStatus").value
    });
    document.getElementById("editProductModal").hidden = true;
    window.AgroUI.showToast("Listing updated and synced to marketplace.");
    renderDashboard();
  });

  window.AgroDB.subscribeProducts(renderDashboard);
})();
