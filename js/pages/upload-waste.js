(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("upload");
  const isSeller = user && user.role === "seller";
  if (!isSeller) {
    document.getElementById("uploadSellerNotice").hidden = false;
  }

  const locSelect = document.getElementById("wasteLocation");
  window.AgroConfig.HUB_CITIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    locSelect.appendChild(opt);
  });

  if (user && user.location) {
    const match = window.AgroConfig.HUB_CITIES.find((c) => c.name === user.location);
    if (match) locSelect.value = match.name;
  }

  // Default date = today
  const dateInput = document.getElementById("wasteDate");
  dateInput.value = new Date().toISOString().split("T")[0];

  let customImageDataUrl = null;
  let coords = {
    lat: user ? user.lat : 11.3410,
    lng: user ? user.lng : 77.7172
  };

  function updatePreview() {
    const cat = document.getElementById("wasteCategory").value;
    const title = document.getElementById("wasteTitle").value.trim() || `${cat} Industrial Supply Lot`;
    const qty = Number(document.getElementById("wasteQuantity").value || 2500);
    const price = Number(document.getElementById("wastePrice").value || 16.5);
    const quality = document.getElementById("wasteQuality").value;
    const cond = document.getElementById("wasteCondition").value;
    const loc = locSelect.value;

    document.getElementById("previewCat").textContent = cat;
    document.getElementById("previewTitle").textContent = title;
    document.getElementById("previewPrice").textContent = `${window.AgroUI.formatINR(price)} / kg`;
    document.getElementById("previewQty").textContent = `${qty.toLocaleString()} kg available`;
    document.getElementById("previewQuality").textContent = quality;
    document.getElementById("previewCondition").textContent = cond;
    document.getElementById("previewLoc").textContent = `Location: ${loc}`;

    if (!customImageDataUrl) {
      document.getElementById("previewImg").src = window.AgroConfig.CATEGORIES[cat].image;
    }
  }

  locSelect.addEventListener("change", () => {
    const hub = window.AgroConfig.HUB_CITIES.find((c) => c.name === locSelect.value);
    if (hub) {
      coords = { lat: hub.lat, lng: hub.lng };
      document.getElementById("gpsStatusLabel").textContent = `Lat: ${coords.lat}, Lng: ${coords.lng}`;
    }
    updatePreview();
  });

  ["wasteCategory", "wasteTitle", "wasteQuantity", "wastePrice", "wasteQuality", "wasteCondition"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updatePreview);
    document.getElementById(id).addEventListener("change", updatePreview);
  });

  document.getElementById("wasteImageInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) {
      customImageDataUrl = null;
      updatePreview();
      return;
    }
    try {
      customImageDataUrl = await window.AgroDB.uploadImageFile(file, user ? user.id : "guest");
      document.getElementById("previewImg").src = customImageDataUrl;
      window.AgroUI.showToast("Photograph uploaded & compressed.");
    } catch (err) {
      window.AgroUI.showToast(err.message, true);
    }
  });

  document.getElementById("useMyGpsBtn").addEventListener("click", async () => {
    try {
      const gps = await window.AgroGeo.getBrowserLocation();
      coords = gps;
      document.getElementById("gpsStatusLabel").textContent = `GPS Live: ${gps.lat}, ${gps.lng}`;
      window.AgroUI.showToast("GPS coordinates captured.");
    } catch (err) {
      window.AgroUI.showToast(err.message || "Could not detect GPS location.", true);
    }
  });

  document.getElementById("uploadWasteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("publishWasteBtn");
    btn.disabled = true;
    btn.textContent = "Publishing...";

    try {
      const currUser = await window.AgroDB.getCurrentUser();
      const seller = currUser && currUser.role === "seller" ? currUser : window.AgroConfig.SEED_USERS[0];
      const category = document.getElementById("wasteCategory").value;
      const image = customImageDataUrl || window.AgroConfig.CATEGORIES[category].image;

      const created = await window.AgroDB.addProduct({
        sellerId: seller.id,
        sellerName: seller.orgName || seller.name,
        sellerRating: seller.rating || 4.8,
        category,
        title: document.getElementById("wasteTitle").value.trim(),
        quantityKg: Number(document.getElementById("wasteQuantity").value),
        monthlyCapacityKg: Number(document.getElementById("wasteMonthlyCap").value) || 4000,
        pricePerKg: Number(document.getElementById("wastePrice").value),
        quality: document.getElementById("wasteQuality").value,
        condition: document.getElementById("wasteCondition").value,
        location: locSelect.value,
        lat: coords.lat,
        lng: coords.lng,
        availableDate: dateInput.value,
        image,
        gallery: [image, window.AgroConfig.CATEGORIES[category].image],
        description:
          document.getElementById("wasteDescription").value.trim() ||
          `Verified ${category} agricultural residue ready for industrial procurement.`
      });

      window.AgroUI.showToast(`Published "${created.title}" to the live marketplace!`);
      setTimeout(() => {
        window.location.href = "marketplace.html";
      }, 700);
    } catch (err) {
      window.AgroUI.showToast(err.message || "Failed to publish listing.", true);
      btn.disabled = false;
      btn.textContent = "Publish to Live Marketplace";
    }
  });

  updatePreview();
})();
