(function (window) {
  "use strict";

  const DB_NAME = "AgroConnectDB";
  const DB_VERSION = 1;
  const SYNC_CHANNEL = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("agroconnect_sync") : null;

  let idbPromise = null;
  let firebaseReadyPromise = null;
  let fbApp = null;
  let fbAuth = null;
  let fbDb = null;
  let fbStorage = null;
  const productListeners = new Set();

  const memStore = { users: new Map(), products: new Map(), orders: new Map(), cart: new Map(), meta: new Map() };
  let useMemFallback = false;

  function memKey(storeName) {
    return storeName === "cart" || storeName === "meta" ? "key" : "id";
  }

  function openIDB() {
    if (useMemFallback) return Promise.resolve(null);
    if (typeof indexedDB === "undefined") {
      useMemFallback = true;
      return Promise.resolve(null);
    }
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("users")) db.createObjectStore("users", { keyPath: "id" });
          if (!db.objectStoreNames.contains("products")) db.createObjectStore("products", { keyPath: "id" });
          if (!db.objectStoreNames.contains("orders")) db.createObjectStore("orders", { keyPath: "id" });
          if (!db.objectStoreNames.contains("cart")) db.createObjectStore("cart", { keyPath: "key" });
          if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          useMemFallback = true;
          resolve(null);
        };
      } catch (err) {
        useMemFallback = true;
        resolve(null);
      }
    });
    return idbPromise;
  }

  async function idbGetAll(storeName) {
    const db = await openIDB();
    if (!db) return Array.from(memStore[storeName].values());
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(storeName, key) {
    const db = await openIDB();
    if (!db) return memStore[storeName].get(key) || null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(storeName, value) {
    const db = await openIDB();
    if (!db) {
      memStore[storeName].set(value[memKey(storeName)], value);
      return value;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(storeName, key) {
    const db = await openIDB();
    if (!db) {
      memStore[storeName].delete(key);
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function ensureSeedDataIDB() {
    const seeded = await idbGet("meta", "seeded_v1");
    if (seeded) return;

    for (const u of window.AgroConfig.SEED_USERS) {
      await idbPut("users", u);
    }
    for (const p of window.AgroConfig.SEED_PRODUCTS) {
      await idbPut("products", p);
    }
    for (const o of window.AgroConfig.SEED_ORDERS) {
      await idbPut("orders", o);
    }
    await idbPut("meta", { key: "seeded_v1", at: new Date().toISOString() });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function initFirebaseIfConfigured() {
    if (!window.AgroConfig.isFirebaseConfigured()) return false;
    if (firebaseReadyPromise) return firebaseReadyPromise;

    firebaseReadyPromise = (async () => {
      try {
        if (!window.firebase) {
          const base = "https://www.gstatic.com/firebasejs/10.14.1";
          await loadScript(`${base}/firebase-app-compat.js`);
          await loadScript(`${base}/firebase-auth-compat.js`);
          await loadScript(`${base}/firebase-firestore-compat.js`);
          await loadScript(`${base}/firebase-storage-compat.js`);
        }
        const cfg = window.AgroConfig.runtime.firebase;
        fbApp = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(cfg);
        fbAuth = fbApp.auth();
        fbDb = fbApp.firestore();
        fbStorage = fbApp.storage();

        // Seed products into Firestore if empty
        const snap = await fbDb.collection("products").limit(1).get();
        if (snap.empty) {
          const batch = fbDb.batch();
          window.AgroConfig.SEED_PRODUCTS.forEach((p) => {
            batch.set(fbDb.collection("products").doc(p.id), p);
          });
          await batch.commit();
        }
        return true;
      } catch (err) {
        console.warn("Firebase initialization failed, falling back to IndexedDB:", err);
        fbApp = null;
        fbAuth = null;
        fbDb = null;
        fbStorage = null;
        return false;
      }
    })();

    return firebaseReadyPromise;
  }

  async function init() {
    await ensureSeedDataIDB();
    const useFb = await initFirebaseIfConfigured();
    return { mode: useFb ? "firebase" : "indexeddb" };
  }

  function broadcastUpdate(type, payload) {
    if (SYNC_CHANNEL) {
      SYNC_CHANNEL.postMessage({ type, payload, ts: Date.now() });
    }
    if (type === "products_changed") {
      getProducts().then((list) => {
        productListeners.forEach((cb) => cb(list));
      });
    }
  }

  if (SYNC_CHANNEL) {
    SYNC_CHANNEL.addEventListener("message", (event) => {
      if (event.data?.type === "products_changed") {
        getProducts().then((list) => {
          productListeners.forEach((cb) => cb(list));
        });
      }
      window.dispatchEvent(new CustomEvent("agro:sync", { detail: event.data }));
    });
  }

  // ---------------- AUTH & PROFILES ----------------

  async function getCurrentUser() {
    await init();
    if (fbAuth && fbDb) {
      const fbUser = await new Promise((resolve) => {
        const unsub = fbAuth.onAuthStateChanged((u) => {
          unsub();
          resolve(u);
        });
      });
      if (!fbUser) return null;
      const doc = await fbDb.collection("users").doc(fbUser.uid).get();
      return doc.exists ? Object.assign({ id: fbUser.uid }, doc.data()) : null;
    }

    const session = await idbGet("meta", "current_user_id");
    if (!session || !session.userId) return null;
    return await idbGet("users", session.userId);
  }

  async function registerUser(payload) {
    await init();
    const {
      name,
      orgName,
      role,
      email,
      password,
      phone,
      location,
      lat,
      lng
    } = payload;

    const cleanEmail = email.trim().toLowerCase();

    if (fbAuth && fbDb) {
      const cred = await fbAuth.createUserWithEmailAndPassword(cleanEmail, password);
      const profile = {
        id: cred.user.uid,
        name: name.trim(),
        orgName: orgName.trim(),
        role,
        email: cleanEmail,
        phone: phone.trim(),
        location: location.trim(),
        lat: Number(lat) || 11.0168,
        lng: Number(lng) || 76.9558,
        verified: true,
        rating: 4.8,
        createdAt: new Date().toISOString()
      };
      await fbDb.collection("users").doc(cred.user.uid).set(profile);
      broadcastUpdate("auth_changed", profile.id);
      return profile;
    }

    const users = await idbGetAll("users");
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error("An account with this email already exists.");
    }

    const profile = {
      id: `${role}-${Date.now()}`,
      name: name.trim(),
      orgName: orgName.trim(),
      role,
      email: cleanEmail,
      password,
      phone: phone.trim(),
      location: location.trim(),
      lat: Number(lat) || 11.0168,
      lng: Number(lng) || 76.9558,
      verified: true,
      rating: 4.8,
      createdAt: new Date().toISOString()
    };

    await idbPut("users", profile);
    await idbPut("meta", { key: "current_user_id", userId: profile.id });
    broadcastUpdate("auth_changed", profile.id);
    return profile;
  }

  async function loginUser(email, password, expectedRole) {
    await init();
    const cleanEmail = email.trim().toLowerCase();

    if (fbAuth && fbDb) {
      const cred = await fbAuth.signInWithEmailAndPassword(cleanEmail, password);
      const doc = await fbDb.collection("users").doc(cred.user.uid).get();
      const profile = doc.exists ? Object.assign({ id: cred.user.uid }, doc.data()) : null;
      if (!profile) throw new Error("User profile missing in Firestore.");
      if (expectedRole && profile.role !== expectedRole) {
        await fbAuth.signOut();
        throw new Error(`This account is registered as a ${profile.role}. Please use the ${profile.role} login tab.`);
      }
      broadcastUpdate("auth_changed", profile.id);
      return profile;
    }

    const users = await idbGetAll("users");
    const found = users.find((u) => u.email.toLowerCase() === cleanEmail && u.password === password);
    if (!found) {
      throw new Error("Invalid email or password.");
    }
    if (expectedRole && found.role !== expectedRole) {
      throw new Error(`This account is registered as a ${found.role}. Please switch to the ${found.role} tab.`);
    }
    await idbPut("meta", { key: "current_user_id", userId: found.id });
    broadcastUpdate("auth_changed", found.id);
    return found;
  }

  async function quickLoginDemo(userId) {
    await init();
    const user = await idbGet("users", userId);
    if (!user) throw new Error("Demo user not found.");
    await idbPut("meta", { key: "current_user_id", userId: user.id });
    broadcastUpdate("auth_changed", user.id);
    return user;
  }

  async function logoutUser() {
    await init();
    if (fbAuth) {
      await fbAuth.signOut();
    }
    await idbPut("meta", { key: "current_user_id", userId: null });
    broadcastUpdate("auth_changed", null);
  }

  async function updateUserProfile(userId, updates) {
    await init();
    if (fbDb) {
      await fbDb.collection("users").doc(userId).update(updates);
      const doc = await fbDb.collection("users").doc(userId).get();
      return Object.assign({ id: userId }, doc.data());
    }
    const existing = await idbGet("users", userId);
    if (!existing) throw new Error("User not found.");
    const updated = Object.assign({}, existing, updates);
    await idbPut("users", updated);
    broadcastUpdate("auth_changed", userId);
    return updated;
  }

  // ---------------- PRODUCTS & IMAGES ----------------

  async function uploadImageFile(file, userId) {
    await init();
    if (fbStorage && file) {
      try {
        const ref = fbStorage.ref(`products/${userId || "anon"}/${Date.now()}_${file.name}`);
        const snap = await ref.put(file);
        return await snap.ref.getDownloadURL();
      } catch (err) {
        console.warn("Firebase Storage upload failed, compressing locally:", err);
      }
    }

    // Compress image into crisp data URL for IndexedDB/Firestore document storage
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxW = 900;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  }

  async function getProducts() {
    await init();
    if (fbDb) {
      const snap = await fbDb.collection("products").orderBy("createdAt", "desc").get();
      return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    }
    const items = await idbGetAll("products");
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function getProductById(id) {
    await init();
    if (fbDb) {
      const doc = await fbDb.collection("products").doc(id).get();
      return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
    }
    return await idbGet("products", id);
  }

  async function addProduct(productData) {
    await init();
    const id = productData.id || `prod-${Date.now()}`;
    const record = Object.assign(
      {
        id,
        status: "active",
        sellerRating: 4.8,
        createdAt: new Date().toISOString()
      },
      productData
    );

    if (fbDb) {
      await fbDb.collection("products").doc(id).set(record);
    } else {
      await idbPut("products", record);
    }
    broadcastUpdate("products_changed", record);
    return record;
  }

  async function updateProduct(id, updates) {
    await init();
    if (fbDb) {
      await fbDb.collection("products").doc(id).update(updates);
      const doc = await fbDb.collection("products").doc(id).get();
      const res = Object.assign({ id }, doc.data());
      broadcastUpdate("products_changed", res);
      return res;
    }
    const existing = await idbGet("products", id);
    if (!existing) throw new Error("Product not found.");
    const updated = Object.assign({}, existing, updates);
    await idbPut("products", updated);
    broadcastUpdate("products_changed", updated);
    return updated;
  }

  async function deleteProduct(id) {
    await init();
    if (fbDb) {
      await fbDb.collection("products").doc(id).delete();
    } else {
      await idbDelete("products", id);
    }
    broadcastUpdate("products_changed", { id, deleted: true });
  }

  function subscribeProducts(callback) {
    productListeners.add(callback);
    let fbUnsub = null;
    init().then(() => {
      if (fbDb) {
        fbUnsub = fbDb
          .collection("products")
          .orderBy("createdAt", "desc")
          .onSnapshot((snap) => {
            const list = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
            callback(list);
          });
      } else {
        getProducts().then(callback);
      }
    });
    return () => {
      productListeners.delete(callback);
      if (fbUnsub) fbUnsub();
    };
  }

  // ---------------- CART ----------------

  async function getCart(userId) {
    await init();
    const owner = userId || "guest";
    if (fbDb && userId) {
      const doc = await fbDb.collection("carts").doc(owner).get();
      return doc.exists ? doc.data().items || [] : [];
    }
    const rec = await idbGet("cart", owner);
    return rec ? rec.items || [] : [];
  }

  async function saveCart(userId, items) {
    await init();
    const owner = userId || "guest";
    if (fbDb && userId) {
      await fbDb.collection("carts").doc(owner).set({ items, updatedAt: new Date().toISOString() });
    } else {
      await idbPut("cart", { key: owner, items });
    }
    broadcastUpdate("cart_changed", items.length);
    window.dispatchEvent(new CustomEvent("agro:cart", { detail: { count: items.length } }));
    return items;
  }

  async function addToCart(userId, product, quantityKg) {
    const qty = Math.max(1, Number(quantityKg) || 1);
    const items = await getCart(userId);
    const idx = items.findIndex((i) => i.productId === product.id);
    if (idx >= 0) {
      items[idx].quantityKg = Math.min(product.quantityKg, items[idx].quantityKg + qty);
    } else {
      items.push({
        productId: product.id,
        sellerId: product.sellerId,
        sellerName: product.sellerName,
        title: product.title,
        category: product.category,
        pricePerKg: product.pricePerKg,
        maxStockKg: product.quantityKg,
        location: product.location,
        lat: product.lat,
        lng: product.lng,
        image: product.image,
        quantityKg: Math.min(product.quantityKg, qty)
      });
    }
    return await saveCart(userId, items);
  }

  // ---------------- ORDERS ----------------

  async function getOrders() {
    await init();
    if (fbDb) {
      const snap = await fbDb.collection("orders").orderBy("createdAt", "desc").get();
      return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    }
    const orders = await idbGetAll("orders");
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function createOrdersFromCheckout(buyer, groupedSellerOrders) {
    await init();
    const created = [];

    for (const group of groupedSellerOrders) {
      const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const order = {
        id: orderId,
        buyerId: buyer.id,
        buyerName: buyer.orgName || buyer.name,
        buyerLocation: buyer.location,
        sellerId: group.sellerId,
        sellerName: group.sellerName,
        items: group.items.map((it) => ({
          productId: it.productId,
          title: it.title,
          category: it.category,
          quantityKg: it.quantityKg,
          pricePerKg: it.pricePerKg
        })),
        distanceKm: group.distanceKm,
        vehicleName: group.vehicleName,
        subtotal: group.subtotal,
        transportFee: group.transportFee,
        platformFee: group.platformFee,
        total: group.total,
        status: "Confirmed",
        etaHours: group.etaHours,
        createdAt: new Date().toISOString()
      };

      // Deduct stock from each product
      for (const it of group.items) {
        const prod = await getProductById(it.productId);
        if (prod) {
          const nextStock = Math.max(0, Number(prod.quantityKg) - Number(it.quantityKg));
          await updateProduct(prod.id, { quantityKg: nextStock });
        }
      }

      if (fbDb) {
        await fbDb.collection("orders").doc(orderId).set(order);
      } else {
        await idbPut("orders", order);
      }
      created.push(order);
    }

    await saveCart(buyer.id, []);
    broadcastUpdate("orders_changed", created);
    return created;
  }

  async function updateOrderStatus(orderId, status) {
    await init();
    if (fbDb) {
      await fbDb.collection("orders").doc(orderId).update({ status });
      const doc = await fbDb.collection("orders").doc(orderId).get();
      return Object.assign({ id: orderId }, doc.data());
    }
    const order = await idbGet("orders", orderId);
    if (!order) throw new Error("Order not found.");
    order.status = status;
    await idbPut("orders", order);
    broadcastUpdate("orders_changed", order);
    return order;
  }

  window.AgroDB = {
    init,
    getCurrentUser,
    registerUser,
    loginUser,
    quickLoginDemo,
    logoutUser,
    updateUserProfile,
    uploadImageFile,
    getProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
    subscribeProducts,
    getCart,
    saveCart,
    addToCart,
    getOrders,
    createOrdersFromCheckout,
    updateOrderStatus
  };
})(window);
