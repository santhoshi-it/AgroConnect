(async function () {
  "use strict";

  const { user } = await window.AgroUI.initShell("auth");

  let mode = "login";
  let role = "buyer";

  const hubSelect = document.getElementById("authHub");
  window.AgroConfig.HUB_CITIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    hubSelect.appendChild(opt);
  });

  function syncLabels() {
    const signupFields = document.getElementById("signupOnlyFields");
    const roleBanner = document.getElementById("roleBanner");
    const submitBtn = document.getElementById("authSubmitBtn");
    const orgLabel = document.getElementById("authOrgLabel");

    signupFields.hidden = mode === "login";
    document.getElementById("authName").required = mode === "signup";
    document.getElementById("authOrg").required = mode === "signup";
    document.getElementById("authPhone").required = mode === "signup";

    const roleName = role === "seller" ? "Farmer / Waste Seller" : "Industrial Buyer";
    roleBanner.textContent = `${mode === "login" ? "Signing in" : "Registering"} as ${roleName}`;
    roleBanner.className = `pill ${role === "seller" ? "pill-earth" : "pill-green"}`;
    submitBtn.textContent = `${mode === "login" ? "Login" : "Create Account"} as ${roleName}`;
    orgLabel.textContent = role === "seller" ? "Farm / Cooperative Name" : "Company / Mill Name";
  }

  document.querySelectorAll("[data-auth-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-auth-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.authMode;
      syncLabels();
    });
  });

  document.querySelectorAll("[data-auth-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-auth-role]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      role = btn.dataset.authRole;
      syncLabels();
    });
  });

  if (user) {
    const card = document.getElementById("activeSessionCard");
    card.hidden = false;
    document.getElementById("sessionUserName").textContent = `${user.name} (${user.orgName || ""})`;
    document.getElementById("sessionUserMeta").textContent = `${user.role.toUpperCase()} · ${user.email} · ${user.location}`;
  }

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await window.AgroDB.logoutUser();
    window.AgroUI.showToast("Signed out.");
    setTimeout(() => window.location.reload(), 400);
  });

  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("authError");
    errEl.hidden = true;

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    try {
      let signedUser;
      if (mode === "login") {
        signedUser = await window.AgroDB.loginUser(email, password, role);
      } else {
        const hubName = hubSelect.value;
        const hubObj = window.AgroConfig.HUB_CITIES.find((c) => c.name === hubName) || window.AgroConfig.HUB_CITIES[0];
        signedUser = await window.AgroDB.registerUser({
          name: document.getElementById("authName").value,
          orgName: document.getElementById("authOrg").value,
          phone: document.getElementById("authPhone").value,
          location: hubObj.name,
          lat: hubObj.lat,
          lng: hubObj.lng,
          role,
          email,
          password
        });
      }

      window.AgroUI.showToast(`Welcome, ${signedUser.name}!`);
      setTimeout(() => {
        window.location.href = signedUser.role === "seller" ? "seller-dashboard.html" : "marketplace.html";
      }, 450);
    } catch (err) {
      errEl.textContent = err.message || "Authentication failed.";
      errEl.hidden = false;
    }
  });

  document.querySelectorAll("[data-demo-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const u = await window.AgroDB.quickLoginDemo(btn.dataset.demoUser);
        window.AgroUI.showToast(`Signed in as ${u.orgName}`);
        setTimeout(() => {
          window.location.href = u.role === "seller" ? "seller-dashboard.html" : "marketplace.html";
        }, 400);
      } catch (err) {
        window.AgroUI.showToast(err.message, true);
      }
    });
  });

  syncLabels();
})();
