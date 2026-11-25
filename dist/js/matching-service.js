(function (window) {
  "use strict";

  /**
   * Smart Supplier Matching:
   * Ranks suppliers based on category, distance, landed cost vs budget, stock sufficiency, and seller rating.
   */
  function matchSuppliers(products, criteria) {
    const {
      category = "",
      requiredKg = 500,
      maxPricePerKg = Infinity,
      quality = "",
      buyerLat = 11.0168,
      buyerLng = 76.9558
    } = criteria || {};

    return products
      .filter((p) => p.status !== "archived" && p.quantityKg > 0)
      .filter((p) => !category || p.category === category)
      .filter((p) => !quality || p.quality === quality)
      .map((p) => {
        const distanceKm = window.AgroGeo.haversineKm(buyerLat, buyerLng, p.lat, p.lng);
        const quote = window.AgroGeo.calculateTransportQuote(
          distanceKm,
          Math.min(requiredKg, p.quantityKg)
        );
        const landedPricePerKg = Number((p.pricePerKg + quote.perKgLogistics).toFixed(2));

        // Scoring breakdown (0 - 100)
        const priceScore =
          p.pricePerKg <= maxPricePerKg
            ? Math.max(10, 35 - (p.pricePerKg / (maxPricePerKg === Infinity ? 65 : maxPricePerKg)) * 20)
            : 5;
        const distanceScore = Math.max(5, 30 - (distanceKm / 800) * 25);
        const stockCoverage = Math.min(1, p.quantityKg / Math.max(1, requiredKg));
        const stockScore = stockCoverage * 25;
        const ratingScore = ((p.sellerRating || 4.6) / 5) * 10;

        const matchScore = Math.min(99, Math.round(priceScore + distanceScore + stockScore + ratingScore));

        return Object.assign({}, p, {
          distanceKm,
          transportQuote: quote,
          landedPricePerKg,
          stockCoveragePct: Math.round(stockCoverage * 100),
          matchScore
        });
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Multi-Seller Procurement Optimizer:
   * Automatically splits a large buyer requirement across multiple nearby / lowest-landed-cost suppliers.
   */
  function planMultiSellerProcurement(products, category, targetKg, buyerLat, buyerLng, prioritize) {
    const candidates = matchSuppliers(products, {
      category,
      requiredKg: targetKg,
      buyerLat,
      buyerLng
    });

    if (prioritize === "distance") {
      candidates.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (prioritize === "price") {
      candidates.sort((a, b) => a.landedPricePerKg - b.landedPricePerKg);
    }

    let remaining = Number(targetKg) || 0;
    const allocations = [];
    let totalMaterialCost = 0;
    let totalTransportCost = 0;

    for (let i = 0; i < candidates.length && remaining > 0; i++) {
      const p = candidates[i];
      const takeKg = Math.min(remaining, p.quantityKg);
      if (takeKg <= 0) continue;

      const quote = window.AgroGeo.calculateTransportQuote(p.distanceKm, takeKg);
      const materialCost = Math.round(takeKg * p.pricePerKg);
      totalMaterialCost += materialCost;
      totalTransportCost += quote.cost;
      remaining -= takeKg;

      allocations.push({
        product: p,
        allocatedKg: takeKg,
        materialCost,
        transportCost: quote.cost,
        distanceKm: p.distanceKm,
        vehicleName: quote.vehicle.name,
        etaText: quote.etaText
      });
    }

    const fulfilledKg = (Number(targetKg) || 0) - remaining;
    return {
      category,
      requestedKg: Number(targetKg) || 0,
      fulfilledKg,
      unfulfilledKg: remaining,
      isFullyFulfilled: remaining === 0 && fulfilledKg > 0,
      allocations,
      totalMaterialCost,
      totalTransportCost,
      grandTotal: totalMaterialCost + totalTransportCost,
      avgLandedPerKg: fulfilledKg > 0 ? Number(((totalMaterialCost + totalTransportCost) / fulfilledKg).toFixed(2)) : 0
    };
  }

  /**
   * Price Comparison between sellers for a given waste category
   */
  function compareSellersByCategory(products, category, qtyKg, buyerLat, buyerLng) {
    return matchSuppliers(products, {
      category,
      requiredKg: qtyKg || 1000,
      buyerLat,
      buyerLng
    }).sort((a, b) => a.landedPricePerKg - b.landedPricePerKg);
  }

  /**
   * Waste Availability Prediction (3-Month Forecast):
   * Models current available stock, monthly seller replenishment capacity, and seasonal harvest curve.
   */
  function predictAvailability(products, category) {
    const relevant = products.filter((p) => !category || p.category === category);
    const currentStockKg = relevant.reduce((sum, p) => sum + (Number(p.quantityKg) || 0), 0);
    const monthlyBaseKg = relevant.reduce(
      (sum, p) => sum + (Number(p.monthlyCapacityKg) || Number(p.quantityKg) * 1.2 || 0),
      0
    );

    const catMeta = window.AgroConfig.CATEGORIES[category];
    const now = new Date();
    const months = [];

    for (let offset = 0; offset < 4; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const mIdx = d.getMonth();
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const isPeak = catMeta ? catMeta.peakMonths.includes(mIdx) : true;
      const seasonalFactor = isPeak ? 1.18 : 0.78;
      const projectedKg =
        offset === 0
          ? currentStockKg
          : Math.round(monthlyBaseKg * seasonalFactor * (1 + offset * 0.04));

      months.push({
        label,
        projectedKg,
        isPeak,
        confidence: offset === 0 ? "99% (Live Inventory)" : offset === 1 ? "91% (Harvest Model)" : "84% (Seasonal Est.)"
      });
    }

    return {
      category: category || "All Categories",
      currentStockKg,
      seasonNote: catMeta ? catMeta.seasonNote : "Combined regional agricultural waste availability.",
      months
    };
  }

  window.AgroMatching = {
    matchSuppliers,
    planMultiSellerProcurement,
    compareSellersByCategory,
    predictAvailability
  };
})(window);
