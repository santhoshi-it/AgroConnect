# AGROCONNECT — Agricultural Waste Marketplace

A responsive, 9-page location-based marketplace connecting rural agricultural waste sellers (farmers and co-ops) with industrial buyers across four primary categories: **Banana Stem**, **Lotus Stem**, **Sugarcane Bagasse**, and **Coconut Husk**.

## Included Pages
1. `index.html` — Home (welcome banner, categories, live featured supply, How It Works)
2. `auth.html` — Login & Signup (separate Buyer and Seller portals + 1-click demo accounts)
3. `seller-dashboard.html` — Seller Dashboard (listings, stock/price editor, order fulfillment, earnings)
4. `upload-waste.html` — Upload Waste (image upload, specs, GPS detection, live preview)
5. `marketplace.html` — Buyer Marketplace (search, filters, Smart Match scoring, Seller Price Comparison, Multi-Seller Bulk Procurement Planner)
6. `product-details.html` — Product Details (gallery, seller info, logistics preview, 3-month availability prediction, peer comparison)
7. `logistics.html` — Location & Logistics (Google Maps API + interactive Geo-Grid fallback, distance, freight & ETA calculator)
8. `cart.html` — Cart & Orders (quantity management, per-supplier freight calculation, checkout)
9. `profile.html` — Profile & History (profile editor, purchase/sales history, 4-stage live order tracking)

## Database & Google Maps Setup
AgroConnect works immediately out-of-the-box using persistent **IndexedDB** (`AgroConnectDB`) with real-time cross-tab synchronization (`BroadcastChannel`) and an interactive logistics geo-grid.

To connect your live **Firebase** project (Auth + Firestore + Storage) and **Google Maps API**:
1. Click **Live DB + Setup** in the top navigation bar on any page (or edit `js/config.js` directly).
2. Enter your Firebase credentials (`apiKey`, `authDomain`, `projectId`, `storageBucket`) and your Google Maps JavaScript API key (with **Maps JavaScript API** & **Distance Matrix API** enabled).
3. Click **Save & Reload** (and serve over `http://localhost` or HTTPS for Firebase Auth).
