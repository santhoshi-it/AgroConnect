(function (window) {
  "use strict";

  // Users can paste their live Firebase & Google Maps credentials here
  // OR configure them in-app using the "DB / API Setup" modal in the header.
  const DEFAULT_CONFIG = {
    firebase: {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    },
    googleMapsApiKey: ""
  };

  function loadStoredConfig() {
    try {
      const raw = localStorage.getItem("agroconnect_runtime_config");
      if (!raw) return DEFAULT_CONFIG;
      const parsed = JSON.parse(raw);
      return {
        firebase: Object.assign({}, DEFAULT_CONFIG.firebase, parsed.firebase || {}),
        googleMapsApiKey: parsed.googleMapsApiKey || DEFAULT_CONFIG.googleMapsApiKey
      };
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }

  const CATEGORIES = {
    "Banana Stem": {
      id: "Banana Stem",
      short: "Banana Stem",
      image: "assets/images/banana-stem.jpg",
      uses: "Natural textiles, biodegradable packaging, sanitary pads, eco-paper",
      avgPriceRange: "₹14 – ₹24 / kg",
      peakMonths: [8, 9, 10, 11, 0, 1], // Sep - Feb
      seasonNote: "Peak post-harvest pseudostem availability in Southern & Western belts"
    },
    "Lotus Stem": {
      id: "Lotus Stem",
      short: "Lotus Stem",
      image: "assets/images/lotus-stem.jpg",
      uses: "Luxury lotus silk yarn, sustainable fashion, specialty handicraft fiber",
      avgPriceRange: "₹45 – ₹78 / kg",
      peakMonths: [6, 7, 8, 9, 10], // Jul - Nov
      seasonNote: "Monsoon & post-monsoon pond harvesting yields high-grade micro-fibers"
    },
    "Sugarcane Bagasse": {
      id: "Sugarcane Bagasse",
      short: "Sugarcane Bagasse",
      image: "assets/images/sugarcane-bagasse.jpg",
      uses: "Molded tableware, bio-ethanol, paper pulp, industrial boiler pellets",
      avgPriceRange: "₹6 – ₹12 / kg",
      peakMonths: [10, 11, 0, 1, 2, 3], // Nov - Apr
      seasonNote: "Crushing season across Maharashtra, UP & Tamil Nadu boosts bulk supply"
    },
    "Coconut Husk": {
      id: "Coconut Husk",
      short: "Coconut Husk",
      image: "assets/images/coconut-husk.jpg",
      uses: "Coir geotextiles, mattresses, cocopeat substrate, acoustic panels",
      avgPriceRange: "₹10 – ₹19 / kg",
      peakMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Year-round
      seasonNote: "Steady year-round supply across coastal & delta coconut clusters"
    }
  };

  const HUB_CITIES = [
    { name: "Coimbatore, TN", lat: 11.0168, lng: 76.9558 },
    { name: "Pollachi, TN", lat: 10.6588, lng: 77.0087 },
    { name: "Erode, TN", lat: 11.3410, lng: 77.7172 },
    { name: "Madurai, TN", lat: 9.9252, lng: 78.1198 },
    { name: "Thanjavur, TN", lat: 10.7870, lng: 79.1378 },
    { name: "Kochi, KL", lat: 9.9312, lng: 76.2673 },
    { name: "Alappuzha, KL", lat: 9.4981, lng: 76.3388 },
    { name: "Bengaluru, KA", lat: 12.9716, lng: 77.5946 },
    { name: "Mysuru, KA", lat: 12.2958, lng: 76.6394 },
    { name: "Kolhapur, MH", lat: 16.7050, lng: 74.2433 },
    { name: "Pune, MH", lat: 18.5204, lng: 73.8567 },
    { name: "Bhopal, MP", lat: 23.2599, lng: 77.4126 }
  ];

  const VEHICLE_TIERS = [
    { id: "mini", name: "Mini Pickup (Up to 1,500 kg)", maxKg: 1500, baseFee: 450, perKm: 18, speedKmh: 45 },
    { id: "medium", name: "5-Ton Eicher Truck (Up to 5,000 kg)", maxKg: 5000, baseFee: 950, perKm: 28, speedKmh: 42 },
    { id: "heavy", name: "12-Ton Industrial Carrier (Up to 12,000 kg)", maxKg: 12000, baseFee: 1800, perKm: 42, speedKmh: 38 }
  ];

  const SEED_USERS = [
    {
      id: "seller-1",
      name: "Karthik Velusamy",
      orgName: "Cauvery Banana Fiber Co-op",
      role: "seller",
      email: "karthik@cauveryagro.in",
      password: "demo123",
      phone: "+91 98422 11409",
      location: "Erode, TN",
      lat: 11.3410,
      lng: 77.7172,
      verified: true,
      rating: 4.9,
      createdAt: "2026-08-12T09:00:00Z"
    },
    {
      id: "seller-2",
      name: "Meenakshi Sundaram",
      orgName: "Pollachi Green Coir Works",
      role: "seller",
      email: "meenakshi@pollachicoir.in",
      password: "demo123",
      phone: "+91 94430 88721",
      location: "Pollachi, TN",
      lat: 10.6588,
      lng: 77.0087,
      verified: true,
      rating: 4.8,
      createdAt: "2026-08-15T10:30:00Z"
    },
    {
      id: "seller-3",
      name: "Rajesh Deshmukh",
      orgName: "Sahyadri Cane & Biomass",
      role: "seller",
      email: "rajesh@sahyadricrops.in",
      password: "demo123",
      phone: "+91 98220 44120",
      location: "Kolhapur, MH",
      lat: 16.7050,
      lng: 74.2433,
      verified: true,
      rating: 4.7,
      createdAt: "2026-09-01T11:15:00Z"
    },
    {
      id: "seller-4",
      name: "Ananya Nair",
      orgName: "Kuttanad Lotus Collective",
      role: "seller",
      email: "ananya@lotuscollective.in",
      password: "demo123",
      phone: "+91 98951 67320",
      location: "Alappuzha, KL",
      lat: 9.4981,
      lng: 76.3388,
      verified: true,
      rating: 4.9,
      createdAt: "2026-09-10T08:45:00Z"
    },
    {
      id: "buyer-1",
      name: "Vikramaditya Rao",
      orgName: "Veda EcoTextiles & Packaging Pvt Ltd",
      role: "buyer",
      email: "procurement@vedaeco.in",
      password: "demo123",
      phone: "+91 99001 55312",
      location: "Coimbatore, TN",
      lat: 11.0168,
      lng: 76.9558,
      verified: true,
      rating: 4.9,
      createdAt: "2026-08-20T14:00:00Z"
    }
  ];

  const SEED_PRODUCTS = [
    {
      id: "prod-101",
      sellerId: "seller-1",
      sellerName: "Cauvery Banana Fiber Co-op",
      sellerRating: 4.9,
      category: "Banana Stem",
      title: "Sun-Dried Banana Pseudostem Fiber Bundles",
      quantityKg: 4200,
      monthlyCapacityKg: 6500,
      pricePerKg: 18.5,
      quality: "Grade A",
      condition: "Sun-Dried & Decorticated",
      moisturePct: 11,
      location: "Erode, TN",
      lat: 11.3410,
      lng: 77.7172,
      availableDate: "2026-11-26",
      image: "assets/images/banana-stem.jpg",
      gallery: ["assets/images/banana-stem.jpg", "assets/images/eco-textile.jpg"],
      description: "High-tensile decorticated banana pseudostem bundles harvested from Cavendish plantations in the Cauvery basin. Ideal for spun yarn, eco-textiles, and molded fiber sheets.",
      status: "active",
      createdAt: "2026-11-18T08:30:00Z"
    },
    {
      id: "prod-102",
      sellerId: "seller-2",
      sellerName: "Pollachi Green Coir Works",
      sellerRating: 4.8,
      category: "Banana Stem",
      title: "Fresh Shredded Banana Stem Pulp & Outer Sheath",
      quantityKg: 3500,
      monthlyCapacityKg: 5000,
      pricePerKg: 14.0,
      quality: "Industrial",
      condition: "Fresh Shredded",
      moisturePct: 24,
      location: "Pollachi, TN",
      lat: 10.6588,
      lng: 77.0087,
      availableDate: "2026-11-25",
      image: "assets/images/banana-stem.jpg",
      gallery: ["assets/images/banana-stem.jpg", "assets/images/farmer-hero.jpg"],
      description: "Cleaned outer banana sheaths mechanically shredded for rapid pulping, bio-packaging boards, and organic composite fillers.",
      status: "active",
      createdAt: "2026-11-19T10:15:00Z"
    },
    {
      id: "prod-103",
      sellerId: "seller-4",
      sellerName: "Kuttanad Lotus Collective",
      sellerRating: 4.9,
      category: "Lotus Stem",
      title: "Grade-A Raw Lotus Stem Bundles for Micro-Silk",
      quantityKg: 950,
      monthlyCapacityKg: 1400,
      pricePerKg: 58.0,
      quality: "Grade A",
      condition: "Fresh Harvested",
      moisturePct: 18,
      location: "Alappuzha, KL",
      lat: 9.4981,
      lng: 76.3388,
      availableDate: "2026-11-27",
      image: "assets/images/lotus-stem.jpg",
      gallery: ["assets/images/lotus-stem.jpg", "assets/images/eco-textile.jpg"],
      description: "Hand-harvested wetland lotus stems sorted for maximum filament draw length. Tailored for luxury lotus silk weavers and sustainable textile mills.",
      status: "active",
      createdAt: "2026-11-20T07:45:00Z"
    },
    {
      id: "prod-104",
      sellerId: "seller-1",
      sellerName: "Cauvery Banana Fiber Co-op",
      sellerRating: 4.9,
      category: "Lotus Stem",
      title: "Pre-Treated Lotus Stem Fiber Strands",
      quantityKg: 600,
      monthlyCapacityKg: 900,
      pricePerKg: 52.0,
      quality: "Grade B",
      condition: "Air-Dried",
      moisturePct: 12,
      location: "Thanjavur, TN",
      lat: 10.7870,
      lng: 79.1378,
      availableDate: "2026-11-28",
      image: "assets/images/lotus-stem.jpg",
      gallery: ["assets/images/lotus-stem.jpg"],
      description: "Delta-sourced lotus stems washed and air-dried for artisan spinning, non-woven fabrics, and natural craft blending.",
      status: "active",
      createdAt: "2026-11-21T11:20:00Z"
    },
    {
      id: "prod-105",
      sellerId: "seller-3",
      sellerName: "Sahyadri Cane & Biomass",
      sellerRating: 4.7,
      category: "Sugarcane Bagasse",
      title: "Depithed Dry Sugarcane Bagasse Bales",
      quantityKg: 12000,
      monthlyCapacityKg: 25000,
      pricePerKg: 7.5,
      quality: "Grade A",
      condition: "Baled & Depithed",
      moisturePct: 10,
      location: "Kolhapur, MH",
      lat: 16.7050,
      lng: 74.2433,
      availableDate: "2026-11-25",
      image: "assets/images/sugarcane-bagasse.jpg",
      gallery: ["assets/images/sugarcane-bagasse.jpg", "assets/images/eco-textile.jpg"],
      description: "Low-moisture depithed bagasse compressed into 250 kg bales. Engineered for thermoformed biodegradable tableware, pulp mills, and bio-composites.",
      status: "active",
      createdAt: "2026-11-17T09:00:00Z"
    },
    {
      id: "prod-106",
      sellerId: "seller-2",
      sellerName: "Pollachi Green Coir Works",
      sellerRating: 4.8,
      category: "Sugarcane Bagasse",
      title: "Crushed Mill-Run Sugarcane Bagasse Bulk",
      quantityKg: 7500,
      monthlyCapacityKg: 11000,
      pricePerKg: 9.2,
      quality: "Industrial",
      condition: "Crushed Loose Bulk",
      moisturePct: 16,
      location: "Madurai, TN",
      lat: 9.9252,
      lng: 78.1198,
      availableDate: "2026-11-26",
      image: "assets/images/sugarcane-bagasse.jpg",
      gallery: ["assets/images/sugarcane-bagasse.jpg"],
      description: "Ready-to-ship regional bagasse from southern sugar cooperatives—lower freight distance for Tamil Nadu and Kerala buyers.",
      status: "active",
      createdAt: "2026-11-22T15:10:00Z"
    },
    {
      id: "prod-107",
      sellerId: "seller-2",
      sellerName: "Pollachi Green Coir Works",
      sellerRating: 4.8,
      category: "Coconut Husk",
      title: "Aged Brown Coconut Husks & Bristle Fiber",
      quantityKg: 8500,
      monthlyCapacityKg: 14000,
      pricePerKg: 12.5,
      quality: "Grade A",
      condition: "Retted & Sun-Dried",
      moisturePct: 13,
      location: "Pollachi, TN",
      lat: 10.6588,
      lng: 77.0087,
      availableDate: "2026-11-25",
      image: "assets/images/coconut-husk.jpg",
      gallery: ["assets/images/coconut-husk.jpg", "assets/images/eco-textile.jpg"],
      description: "Premium Pollachi coconut husks graded for long golden-brown coir fiber extraction, erosion-control geotextiles, and acoustic insulation boards.",
      status: "active",
      createdAt: "2026-11-18T12:00:00Z"
    },
    {
      id: "prod-108",
      sellerId: "seller-4",
      sellerName: "Kuttanad Lotus Collective",
      sellerRating: 4.9,
      category: "Coconut Husk",
      title: "Compressed Coconut Husk & Coir Pith Blocks",
      quantityKg: 5400,
      monthlyCapacityKg: 9000,
      pricePerKg: 15.0,
      quality: "Grade B",
      condition: "Shredded & Compressed",
      moisturePct: 14,
      location: "Kochi, KL",
      lat: 9.9312,
      lng: 76.2673,
      availableDate: "2026-11-26",
      image: "assets/images/coconut-husk.jpg",
      gallery: ["assets/images/coconut-husk.jpg"],
      description: "Low-EC washed coconut husk chips and fiber bundles ideal for horticultural substrates, upholstery pads, and bio-composites.",
      status: "active",
      createdAt: "2026-11-23T09:40:00Z"
    }
  ];

  const SEED_ORDERS = [
    {
      id: "ORD-8841",
      buyerId: "buyer-1",
      buyerName: "Veda EcoTextiles & Packaging Pvt Ltd",
      buyerLocation: "Coimbatore, TN",
      sellerId: "seller-1",
      sellerName: "Cauvery Banana Fiber Co-op",
      items: [
        {
          productId: "prod-101",
          title: "Sun-Dried Banana Pseudostem Fiber Bundles",
          category: "Banana Stem",
          quantityKg: 1200,
          pricePerKg: 18.5
        }
      ],
      distanceKm: 102,
      vehicleName: "Mini Pickup (Up to 1,500 kg)",
      subtotal: 22200,
      transportFee: 2286,
      platformFee: 444,
      total: 24930,
      status: "In Transit",
      etaHours: 3.1,
      createdAt: "2026-11-22T10:20:00Z"
    },
    {
      id: "ORD-8832",
      buyerId: "buyer-1",
      buyerName: "Veda EcoTextiles & Packaging Pvt Ltd",
      buyerLocation: "Coimbatore, TN",
      sellerId: "seller-2",
      sellerName: "Pollachi Green Coir Works",
      items: [
        {
          productId: "prod-107",
          title: "Aged Brown Coconut Husks & Bristle Fiber",
          category: "Coconut Husk",
          quantityKg: 2000,
          pricePerKg: 12.5
        }
      ],
      distanceKm: 46,
      vehicleName: "5-Ton Eicher Truck (Up to 5,000 kg)",
      subtotal: 25000,
      transportFee: 2238,
      platformFee: 500,
      total: 27738,
      status: "Delivered",
      etaHours: 1.5,
      createdAt: "2026-11-14T16:10:00Z"
    }
  ];

  window.AgroConfig = {
    get runtime() {
      return loadStoredConfig();
    },
    saveRuntime(newCfg) {
      localStorage.setItem("agroconnect_runtime_config", JSON.stringify(newCfg));
    },
    isFirebaseConfigured() {
      const fb = loadStoredConfig().firebase;
      return Boolean(fb && fb.apiKey && fb.projectId && fb.authDomain);
    },
    isGoogleMapsConfigured() {
      return Boolean(loadStoredConfig().googleMapsApiKey);
    },
    CATEGORIES,
    HUB_CITIES,
    VEHICLE_TIERS,
    SEED_USERS,
    SEED_PRODUCTS,
    SEED_ORDERS
  };
})(window);
