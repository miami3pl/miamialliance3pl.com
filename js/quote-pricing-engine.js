/**
 * Shared quote pricing engine.
 * Keeps shipment wizard and free quote calculator aligned on structure/rates.
 */
(function (global) {
  "use strict";

  var WAREHOUSES = Object.freeze({
    miami: {
      id: "miami",
      name: "Miami Warehouse",
      shortName: "Miami, FL",
      address: "8780 NW 100th ST",
      city: "Medley, FL 33178",
      phone: "(786) 873-8819",
      email: "contact@miamialliance3pl.com",
      highlights: [
        "Minutes from Port Miami & MIA",
        "Gateway to Latin America",
        "I-95, I-75, FL Turnpike access",
      ],
      localZoneLabel: "Local (Florida)",
      regionalZoneLabel: "Regional (Southeast)",
    },
    biloxi: {
      id: "biloxi",
      name: "Biloxi Warehouse",
      shortName: "Biloxi, MS",
      address: "1606 Beach Blvd",
      city: "Biloxi, MS 39531",
      phone: "(786) 873-8819",
      email: "contact@miamialliance3pl.com",
      highlights: [
        "Gulf Coast strategic location",
        "Near Port of Gulfport",
        "I-10, I-110 access",
      ],
      localZoneLabel: "Local (Gulf Coast)",
      regionalZoneLabel: "Regional (Southeast)",
    },
  });

  var PRICING = Object.freeze({
    dimensionalFactor: 139,
    storagePerCubicFtDay: 0.025,
    handlingFee: 3.5,
    pickAndPack: 1.25,
    palletStoragePerDay: 0.75,
    palletHandling: 15.0,
    palletPickPack: 5.0,
    blackWrapping: 7.0,
    storageDays: 30,
    minStorage: 5.0,
    shippingZones: {
      local: 0.45,
      regional: 0.65,
      national: 0.85,
      none: 0,
      dropship: 0,
      localDelivery: 0,
      pickup: 0,
    },
    /* Base + per-pallet fees for local delivery and warehouse pickup (our truck) */
    localDeliveryBase: 120.0,
    localDeliveryPerUnit: 25.0,
    pickupBase: 120.0,
    pickupPerUnit: 25.0,
    dropShipRates: {
      envelope: 1.5,
      small: 3.0,
      medium: 5.0,
      large: 20.0,
    },
    fbaPrep: {
      fnskuLabeling: { rate: 0.3, label: "FNSKU Labeling", unit: "unit" },
      polyBagging: { rate: 0.5, label: "Poly Bagging", unit: "unit" },
      bubbleWrapping: { rate: 1.0, label: "Bubble Wrapping", unit: "unit" },
      bundling: { rate: 2.0, label: "Bundling / Kitting", unit: "bundle" },
      boxLabels: { rate: 3.0, label: "Box Content Labels", unit: "box" },
      inspectionQC: { rate: 0.15, label: "Inspection & QC", unit: "unit" },
    },
  });

  function clampNumber(value, fallback, min, max) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      parsed = fallback;
    }
    if (Number.isFinite(min) && parsed < min) {
      parsed = min;
    }
    if (Number.isFinite(max) && parsed > max) {
      parsed = max;
    }
    return parsed;
  }

  function normalizeZone(zone) {
    return Object.prototype.hasOwnProperty.call(PRICING.shippingZones, zone)
      ? zone
      : "regional";
  }

  function normalizeDropShipQty(dropShipQty) {
    var input = dropShipQty || {};
    return {
      envelope: clampNumber(input.envelope, 0, 0, 9999),
      small: clampNumber(input.small, 0, 0, 9999),
      medium: clampNumber(input.medium, 0, 0, 9999),
      large: clampNumber(input.large, 0, 0, 9999),
    };
  }

  function normalizeEstimateInput(input) {
    var source = input || {};
    var dimensions = source.dimensions || {};
    return {
      packageType: source.packageType === "pallet" ? "pallet" : "box",
      dimensions: {
        length: clampNumber(dimensions.length, 12, 1, 120),
        width: clampNumber(dimensions.width, 12, 1, 120),
        height: clampNumber(dimensions.height, 12, 1, 120),
      },
      weight: clampNumber(source.weight, 25, 1, 2000),
      quantity: clampNumber(source.quantity, 1, 1, 1000),
      shippingZone: normalizeZone(source.shippingZone || "none"),
      storageDays: clampNumber(source.storageDays, PRICING.storageDays, 1, 365),
      blackWrapping: Boolean(source.blackWrapping),
      dropShipQty: normalizeDropShipQty(source.dropShipQty),
      fbaPrep: normalizeFbaPrepInput(source.fbaPrep),
    };
  }

  function normalizeFbaPrepInput(fbaPrep) {
    var input = fbaPrep || {};
    var result = { enabled: Boolean(input.enabled), services: {} };
    var services = PRICING.fbaPrep;
    for (var key in services) {
      if (Object.prototype.hasOwnProperty.call(services, key)) {
        var svc =
          input.services && input.services[key] ? input.services[key] : {};
        result.services[key] = {
          selected: Boolean(svc.selected),
          qty: clampNumber(svc.qty, 0, 0, 99999),
        };
      }
    }
    return result;
  }

  function getFbaPrepTotal(fbaPrep) {
    if (!fbaPrep || !fbaPrep.enabled) return 0;
    var total = 0;
    var services = PRICING.fbaPrep;
    for (var key in services) {
      if (Object.prototype.hasOwnProperty.call(services, key)) {
        var svc = fbaPrep.services[key];
        if (svc && svc.selected && svc.qty > 0) {
          total += svc.qty * services[key].rate;
        }
      }
    }
    return total;
  }

  function getCubicFeet(dimensions) {
    return (dimensions.length * dimensions.width * dimensions.height) / 1728;
  }

  function getDimensionalWeight(dimensions) {
    return (
      (dimensions.length * dimensions.width * dimensions.height) /
      PRICING.dimensionalFactor
    );
  }

  function getBillableWeight(weight, dimensions) {
    return Math.max(weight, getDimensionalWeight(dimensions));
  }

  function getDropShipTotal(dropShipQty) {
    var total = 0;
    var rates = PRICING.dropShipRates;
    for (var size in rates) {
      if (Object.prototype.hasOwnProperty.call(rates, size)) {
        total += (dropShipQty[size] || 0) * rates[size];
      }
    }
    return total;
  }

  function getZoneLabel(zone) {
    var labels = {
      local: "Local (Florida)",
      regional: "Regional (Southeast)",
      national: "National",
      none: "No Shipping",
      dropship: "Drop Ship",
      localDelivery: "Local Delivery (Our Truck)",
      pickup: "Warehouse Pick Up (Our Truck)",
    };
    return labels[zone] || zone;
  }

  function calculateEstimate(input) {
    var config = normalizeEstimateInput(input);
    var applyMinimumStorage = !input || input.applyMinimumStorage !== false;
    var cubicFt = getCubicFeet(config.dimensions);
    var dimWeight = getDimensionalWeight(config.dimensions);
    var billableWeight = getBillableWeight(config.weight, config.dimensions);

    var storage = 0;
    var handling = 0;
    var pickPack = 0;
    var shipping = 0;
    var wrapping = 0;
    var dropship = 0;

    if (config.packageType === "pallet") {
      storage =
        PRICING.palletStoragePerDay * config.storageDays * config.quantity;
      handling = PRICING.palletHandling * config.quantity;
      pickPack = PRICING.palletPickPack * config.quantity;
      if (config.shippingZone === "dropship") {
        dropship = getDropShipTotal(config.dropShipQty);
      } else if (config.shippingZone === "localDelivery") {
        shipping = PRICING.localDeliveryBase + Math.max(0, config.quantity - 1) * PRICING.localDeliveryPerUnit;
      } else if (config.shippingZone === "pickup") {
        shipping = PRICING.pickupBase + Math.max(0, config.quantity - 1) * PRICING.pickupPerUnit;
      } else if (config.shippingZone !== "none") {
        shipping =
          billableWeight *
          PRICING.shippingZones[config.shippingZone] *
          config.quantity;
      }
      if (config.blackWrapping) {
        wrapping = PRICING.blackWrapping * config.quantity;
      }
    } else {
      storage =
        cubicFt *
        PRICING.storagePerCubicFtDay *
        config.storageDays *
        config.quantity;
      handling = PRICING.handlingFee * config.quantity;
      pickPack = PRICING.pickAndPack * config.quantity;
      if (config.shippingZone === "dropship") {
        dropship = getDropShipTotal(config.dropShipQty);
      } else if (config.shippingZone === "localDelivery") {
        shipping = PRICING.localDeliveryBase + Math.max(0, config.quantity - 1) * PRICING.localDeliveryPerUnit;
      } else if (config.shippingZone === "pickup") {
        shipping = PRICING.pickupBase + Math.max(0, config.quantity - 1) * PRICING.pickupPerUnit;
      } else if (config.shippingZone !== "none") {
        shipping =
          billableWeight *
          PRICING.shippingZones[config.shippingZone] *
          config.quantity;
      }
    }

    var rawStorage = storage;
    if (applyMinimumStorage) {
      storage = Math.max(storage, PRICING.minStorage);
    }
    var fbaPrepTotal = getFbaPrepTotal(config.fbaPrep);
    var total =
      storage +
      handling +
      pickPack +
      shipping +
      wrapping +
      dropship +
      fbaPrepTotal;

    return {
      packageType: config.packageType,
      dimensions: config.dimensions,
      weight: config.weight,
      quantity: config.quantity,
      shippingZone: config.shippingZone,
      storageDays: config.storageDays,
      blackWrapping: config.blackWrapping,
      dropShipQty: config.dropShipQty,
      fbaPrep: config.fbaPrep,
      cubicFt: cubicFt,
      dimWeight: dimWeight,
      billableWeight: billableWeight,
      rawStorage: rawStorage,
      storageMinimumApplied: storage - rawStorage,
      storage: storage,
      handling: handling,
      pickPack: pickPack,
      shipping: shipping,
      wrapping: wrapping,
      dropship: dropship,
      fbaPrepTotal: fbaPrepTotal,
      total: total,
    };
  }

  /**
   * Calculate estimate for multiple cargo items with shared options.
   * @param {Array} items - Array of { packageType, dimensions: {length, width, height}, weight, quantity, blackWrapping }
   * @param {Object} sharedOptions - { shippingZone, storageDays, dropShipQty, fbaPrep }
   * @returns {Object} { items: [per-item results], totals: { storage, handling, pickPack, shipping, wrapping, dropship, fbaPrepTotal, total } }
   */
  function calculateMultiEstimate(items, sharedOptions) {
    var shared = sharedOptions || {};
    var itemResults = [];
    var totals = {
      storage: 0,
      handling: 0,
      pickPack: 0,
      shipping: 0,
      wrapping: 0,
      dropship: 0,
      fbaPrepTotal: 0,
      total: 0,
    };

    // Calculate each item individually
    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {};
      var itemInput = {
        packageType: item.packageType,
        dimensions: item.dimensions,
        weight: item.weight,
        quantity: item.quantity,
        shippingZone: shared.shippingZone,
        storageDays: shared.storageDays,
        blackWrapping: Boolean(item.blackWrapping),
        dropShipQty: shared.dropShipQty,
        fbaPrep: i === 0 ? shared.fbaPrep : { enabled: false, services: {} },
        applyMinimumStorage: false,
      };
      var result = calculateEstimate(itemInput);
      // Only count dropship and fbaPrep once (on first item)
      if (i > 0) {
        result.dropship = 0;
        result.fbaPrepTotal = 0;
      }
      // Recalculate item total without duplicated shared costs
      if (i > 0) {
        result.total =
          result.storage +
          result.handling +
          result.pickPack +
          result.shipping +
          result.wrapping;
      }
      itemResults.push(result);
      totals.storage += result.storage;
      totals.handling += result.handling;
      totals.pickPack += result.pickPack;
      totals.shipping += result.shipping;
      totals.wrapping += result.wrapping;
      totals.dropship += result.dropship;
      totals.fbaPrepTotal += result.fbaPrepTotal;
    }

    if (itemResults.length > 0 && totals.storage < PRICING.minStorage) {
      var storageAdjustment = PRICING.minStorage - totals.storage;
      itemResults[0].storage += storageAdjustment;
      itemResults[0].storageMinimumApplied += storageAdjustment;
      itemResults[0].total += storageAdjustment;
      totals.storage = PRICING.minStorage;
    }

    totals.total =
      totals.storage +
      totals.handling +
      totals.pickPack +
      totals.shipping +
      totals.wrapping +
      totals.dropship +
      totals.fbaPrepTotal;

    return { items: itemResults, totals: totals };
  }

  function getWarehouse(warehouseId) {
    return Object.prototype.hasOwnProperty.call(WAREHOUSES, warehouseId)
      ? WAREHOUSES[warehouseId]
      : WAREHOUSES.miami;
  }

  function getWarehouseList() {
    var list = [];
    for (var key in WAREHOUSES) {
      if (Object.prototype.hasOwnProperty.call(WAREHOUSES, key)) {
        list.push(WAREHOUSES[key]);
      }
    }
    return list;
  }

  global.MA3PLQuoteEngine = {
    PRICING: PRICING,
    WAREHOUSES: WAREHOUSES,
    getWarehouse: getWarehouse,
    getWarehouseList: getWarehouseList,
    getCubicFeet: getCubicFeet,
    getDimensionalWeight: getDimensionalWeight,
    getBillableWeight: getBillableWeight,
    getDropShipTotal: getDropShipTotal,
    getFbaPrepTotal: getFbaPrepTotal,
    getZoneLabel: getZoneLabel,
    calculateEstimate: calculateEstimate,
    calculateMultiEstimate: calculateMultiEstimate,
  };
})(window);
