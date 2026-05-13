(function (global) {
  "use strict";

  const QuoteEngine = global.MA3PLQuoteEngine || null;
  const BASE_PRICING = QuoteEngine
    ? QuoteEngine.PRICING
    : {
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
          bubbleWrapping: {
            rate: 1.0,
            label: "Bubble Wrapping",
            unit: "unit",
          },
          bundling: { rate: 2.0, label: "Bundling / Kitting", unit: "bundle" },
          boxLabels: { rate: 3.0, label: "Box Content Labels", unit: "box" },
          inspectionQC: { rate: 0.15, label: "Inspection & QC", unit: "unit" },
        },
      };

  const BILLING_ITEMS = Object.freeze({
    storage: {
      label: "Storage",
      defaultUnit: "pallet-days",
      icon: "🏭",
      ratePath: "storage.palletDaily",
      fallbackRate: 0.75,
      quoteKey: "storage",
      calculatorItem: true,
    },
    handling: {
      label: "Handling",
      defaultUnit: "orders",
      icon: "📥",
      ratePath: "handling.receiving",
      fallbackRate: 15.0,
      quoteKey: "handling",
      calculatorItem: true,
    },
    pick_pack: {
      label: "Pick & Pack",
      defaultUnit: "orders",
      icon: "📋",
      ratePath: "handling.pickpack",
      fallbackRate: 8.0,
      quoteKey: "pick_pack",
      calculatorItem: true,
    },
    shipping: {
      label: "Shipping / Outbound",
      defaultUnit: "shipments",
      icon: "🚚",
      ratePath: null,
      fallbackRate: 45.0,
      quoteKey: "shipping",
      calculatorItem: true,
    },
    wrapping: {
      label: "Black Wrapping",
      defaultUnit: "pallets",
      icon: "⬛",
      ratePath: "handling.wrapping",
      fallbackRate: 7.0,
      quoteKey: "wrapping",
      calculatorItem: true,
    },
    dropship: {
      label: "Drop Ship (Units)",
      defaultUnit: "units",
      icon: "📬",
      ratePath: null,
      fallbackRate: 0,
      quoteKey: "dropship",
      calculatorItem: true,
    },
    receiving: {
      label: "Receiving / Intake",
      defaultUnit: "pallets",
      icon: "📥",
      ratePath: "handling.receiving",
      fallbackRate: 15.0,
      quoteKey: "handling",
      calculatorItem: false,
    },
    labeling: {
      label: "Labeling",
      defaultUnit: "items",
      icon: "🏷️",
      ratePath: "handling.labeling",
      fallbackRate: 0.15,
      quoteKey: "handling",
      calculatorItem: false,
    },
    palletizing: {
      label: "Palletizing",
      defaultUnit: "pallets",
      icon: "📦",
      ratePath: "handling.palletizing",
      fallbackRate: 10.0,
      quoteKey: "handling",
      calculatorItem: false,
    },
    unloading: {
      label: "Unloading",
      defaultUnit: "hours",
      icon: "⬇️",
      ratePath: "handling.unloading",
      fallbackRate: 45.0,
      quoteKey: "handling",
      calculatorItem: false,
    },
    loading: {
      label: "Loading",
      defaultUnit: "hours",
      icon: "⬆️",
      ratePath: "handling.loading",
      fallbackRate: 45.0,
      quoteKey: "handling",
      calculatorItem: false,
    },
    kitting: {
      label: "Kitting / Assembly",
      defaultUnit: "kits",
      icon: "🔧",
      ratePath: "additional.kitting",
      fallbackRate: 5.0,
      quoteKey: "extra",
      calculatorItem: false,
    },
    returns: {
      label: "Returns Processing",
      defaultUnit: "items",
      icon: "🔄",
      ratePath: "additional.returns",
      fallbackRate: 2.0,
      quoteKey: "extra",
      calculatorItem: false,
    },
    rush: {
      label: "Rush Handling",
      defaultUnit: "orders",
      icon: "⚡",
      ratePath: "additional.rush",
      fallbackRate: 25.0,
      quoteKey: "extra",
      calculatorItem: false,
    },
    pickup_delivery: {
      label: "Pickup / Delivery",
      defaultUnit: "trips",
      icon: "🚛",
      ratePath: null,
      fallbackRate: 120.0,
      quoteKey: "extra",
      calculatorItem: false,
    },
    container_drayage: {
      label: "Container Drayage",
      defaultUnit: "containers",
      icon: "🚢",
      ratePath: null,
      fallbackRate: 250.0,
      quoteKey: "extra",
      calculatorItem: false,
    },
    custom: {
      label: "Custom Service",
      defaultUnit: "units",
      icon: "✏️",
      ratePath: null,
      fallbackRate: 0,
      quoteKey: "extra",
      calculatorItem: false,
    },
  });

  const QUOTE_KEYS = Object.freeze([
    "storage",
    "handling",
    "pick_pack",
    "shipping",
    "wrapping",
    "dropship",
  ]);

  function parseFiniteNumber(value) {
    let parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toNumber(value, fallback) {
    let parsed = parseFiniteNumber(value);
    return parsed === null ? fallback : parsed;
  }

  function roundCurrency(value) {
    return Math.round(toNumber(value, 0) * 100) / 100;
  }

  function roundQuantity(value) {
    return Math.round(toNumber(value, 0) * 10000) / 10000;
  }

  function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    return path.split(".").reduce(function (acc, key) {
      return acc && acc[key] !== undefined ? acc[key] : undefined;
    }, obj);
  }

  function normalizeServiceKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function mapServiceToItem(serviceValue) {
    let key = normalizeServiceKey(serviceValue);
    const directMap = {
      storage: "storage",
      pallet_storage_daily: "storage",
      pallet_storage: "storage",
      receiving: "receiving",
      handling: "handling",
      pick_and_pack: "pick_pack",
      pick_pack: "pick_pack",
      shipping: "shipping",
      outbound_shipping: "shipping",
      wrapping: "wrapping",
      black_wrapping: "wrapping",
      drop_ship: "dropship",
      dropship: "dropship",
      labeling: "labeling",
      palletizing: "palletizing",
      unloading: "unloading",
      loading: "loading",
      kitting: "kitting",
      returns_processing: "returns",
      returns: "returns",
      rush_handling: "rush",
      pickup_delivery: "pickup_delivery",
      container_drayage: "container_drayage",
      custom_service: "custom",
    };

    if (directMap[key]) return directMap[key];
    if (key.indexOf("pick") !== -1 && key.indexOf("pack") !== -1) {
      return "pick_pack";
    }
    if (key.indexOf("drop") !== -1 && key.indexOf("ship") !== -1) {
      return "dropship";
    }
    if (key.indexOf("wrap") !== -1) return "wrapping";
    if (key.indexOf("receiv") !== -1) return "receiving";
    if (key.indexOf("storag") !== -1) return "storage";
    return null;
  }

  function buildCustomerRateIndex(pricingData) {
    const index = new Map();
    const rates = Array.isArray(pricingData && pricingData.customerRates)
      ? pricingData.customerRates
      : [];

    rates.forEach(function (row) {
      const customerId = row && row.customerId;
      const itemKey = mapServiceToItem(row && row.service);
      let rate = parseFiniteNumber(row && row.rate);

      if (!customerId || !itemKey || rate === null) return;

      if (!index.has(customerId)) {
        index.set(customerId, new Map());
      }

      const customerMap = index.get(customerId);
      const entry = {
        rate: rate,
        unit: String((row && row.unit) || "").trim(),
        sourceService: (row && row.service) || itemKey,
      };

      customerMap.set(itemKey, entry);

      const quoteKey = BILLING_ITEMS[itemKey] && BILLING_ITEMS[itemKey].quoteKey;
      if (quoteKey && quoteKey !== "extra" && !customerMap.has(quoteKey)) {
        customerMap.set(quoteKey, entry);
      }
    });

    return index;
  }

  function resolveCustomerRate(customerRateIndex, customerId, activityType) {
    if (!customerRateIndex || !customerId || !activityType) return null;
    const customerMap = customerRateIndex.get(customerId);
    if (!customerMap) return null;

    if (customerMap.has(activityType)) {
      return customerMap.get(activityType);
    }

    const quoteKey = getQuoteCategory(activityType);
    if (quoteKey && quoteKey !== "extra" && customerMap.has(quoteKey)) {
      return customerMap.get(quoteKey);
    }

    return null;
  }

  function getRateMeta(pricingData, customerRateIndex, activityType, customerId) {
    const item = BILLING_ITEMS[activityType];
    if (!item) {
      return { rate: 0, source: "unknown", path: null, customerRate: null };
    }

    const customerRate = resolveCustomerRate(
      customerRateIndex,
      customerId,
      activityType,
    );
    if (customerRate) {
      return {
        rate: toNumber(customerRate.rate, 0),
        source: "customer",
        path: null,
        customerRate: customerRate,
      };
    }

    if (item.ratePath) {
      const value = getNestedValue(pricingData, item.ratePath);
      if (parseFiniteNumber(value) !== null) {
        return {
          rate: toNumber(value, 0),
          source: "pricing",
          path: item.ratePath,
          customerRate: null,
        };
      }
    }

    return {
      rate: toNumber(item.fallbackRate, 0),
      source: "fallback",
      path: item.ratePath || null,
      customerRate: null,
    };
  }

  function getQuoteCategory(activityType) {
    return (BILLING_ITEMS[activityType] && BILLING_ITEMS[activityType].quoteKey) || "extra";
  }

  function getActivityLabel(activityType) {
    return (BILLING_ITEMS[activityType] && BILLING_ITEMS[activityType].label) || activityType;
  }

  function getActivityIcon(activityType) {
    return (BILLING_ITEMS[activityType] && BILLING_ITEMS[activityType].icon) || "📝";
  }

  function getQuoteCategoryLabel(quoteKey) {
    const labels = {
      storage: "Storage",
      handling: "Handling",
      pick_pack: "Pick & Pack",
      shipping: "Shipping",
      wrapping: "Black Wrapping",
      dropship: "Drop Ship",
      extra: "Extra / Unquoted",
    };
    return labels[quoteKey] || quoteKey;
  }

  function getCubicFeetFromPackage(pkg) {
    if (!pkg) return 0;
    if (parseFiniteNumber(pkg.cubic_ft) !== null) {
      return toNumber(pkg.cubic_ft, 0);
    }
    const length = toNumber(pkg.length, 0);
    const width = toNumber(pkg.width, 0);
    const height = toNumber(pkg.height, 0);
    if (length > 0 && width > 0 && height > 0) {
      return (length * width * height) / 1728;
    }
    return 0;
  }

  function getBillableWeightFromPackage(pkg) {
    if (!pkg) return 0;
    if (parseFiniteNumber(pkg.billable_weight) !== null) {
      return toNumber(pkg.billable_weight, 0);
    }

    const weight = toNumber(pkg.weight, 0);
    const length = toNumber(pkg.length, 0);
    const width = toNumber(pkg.width, 0);
    const height = toNumber(pkg.height, 0);
    const dimWeight =
      length > 0 && width > 0 && height > 0
        ? (length * width * height) / BASE_PRICING.dimensionalFactor
        : 0;

    return Math.max(weight, dimWeight);
  }

  function getQuoteAmount(shipment, key) {
    const quote = (shipment && shipment.quote_estimate) || {};
    if (key === "pick_pack") {
      return toNumber(quote.pick_pack, toNumber(quote.pickPack, 0));
    }
    return toNumber(quote[key], 0);
  }

  function normalizeLineOverride(rawOverride, legacyRate) {
    const overrideObject =
      rawOverride && typeof rawOverride === "object" && !Array.isArray(rawOverride)
        ? rawOverride
        : {};
    const overrideRate =
      parseFiniteNumber(overrideObject.rate) !== null
        ? toNumber(overrideObject.rate, 0)
        : parseFiniteNumber(rawOverride) !== null
          ? toNumber(rawOverride, 0)
          : parseFiniteNumber(legacyRate) !== null
            ? toNumber(legacyRate, 0)
            : null;
    const overrideAmount =
      parseFiniteNumber(overrideObject.amount) !== null
        ? toNumber(overrideObject.amount, 0)
        : null;

    return {
      rate: overrideRate,
      amount: overrideAmount,
      note: String(overrideObject.note || "").trim(),
    };
  }

  function getShipmentOverrides(shipment) {
    const detailOverrides =
      shipment && shipment.billing_override_detail
        ? shipment.billing_override_detail
        : {};
    const legacyOverrides =
      shipment && shipment.billing_override ? shipment.billing_override : {};
    const keys = {};
    Object.keys(detailOverrides).forEach(function (key) {
      keys[key] = true;
    });
    Object.keys(legacyOverrides).forEach(function (key) {
      keys[key] = true;
    });

    const overrides = {};
    Object.keys(keys).forEach(function (key) {
      overrides[key] = normalizeLineOverride(detailOverrides[key], legacyOverrides[key]);
    });
    return overrides;
  }

  function getStorageFallbackRate(pkgType, pricingData, rateMeta) {
    if (pkgType === "pallet") {
      return toNumber(rateMeta && rateMeta.rate, BASE_PRICING.palletStoragePerDay);
    }

    const monthlyRate = getNestedValue(pricingData, "storage.cubicFoot");
    if (parseFiniteNumber(monthlyRate) !== null && toNumber(monthlyRate, 0) > 0) {
      return toNumber(monthlyRate, 0) / 30;
    }

    return BASE_PRICING.storagePerCubicFtDay;
  }

  function getBoxStorageMinimum(pricingData) {
    const minMonthly = getNestedValue(pricingData, "storage.minMonthly");
    if (parseFiniteNumber(minMonthly) !== null) {
      return toNumber(minMonthly, BASE_PRICING.minStorage);
    }
    return BASE_PRICING.minStorage;
  }

  function getShippingRate(zone) {
    const safeZone = zone || "regional";
    if (BASE_PRICING.shippingZones[safeZone] !== undefined) {
      return BASE_PRICING.shippingZones[safeZone];
    }
    return BASE_PRICING.shippingZones.regional;
  }

  function isFlatRateZone(zone) {
    return zone === "localDelivery" || zone === "pickup";
  }

  function getFlatRateShipping(zone, packageType, quantity) {
    const qty = Math.max(quantity || 1, 1);
    if (zone === "localDelivery") {
      return roundCurrency(BASE_PRICING.localDeliveryBase + Math.max(0, qty - 1) * BASE_PRICING.localDeliveryPerUnit);
    }
    if (zone === "pickup") {
      return roundCurrency(BASE_PRICING.pickupBase + Math.max(0, qty - 1) * BASE_PRICING.pickupPerUnit);
    }
    return 0;
  }

  function getDropshipUnits(dropShipQty) {
    const sizes = dropShipQty || {};
    return (
      toNumber(sizes.envelope, 0) +
      toNumber(sizes.small, 0) +
      toNumber(sizes.medium, 0) +
      toNumber(sizes.large, 0)
    );
  }

  function getPackageTypeLabel(packageType) {
    return packageType === "pallet" ? "Pallet" : "Box";
  }

  function getPricingCargoItems(shipment) {
    const sourceItems = Array.isArray(shipment && shipment.pricing_cargo_items)
      ? shipment.pricing_cargo_items
      : Array.isArray(shipment && shipment.quote_estimate && shipment.quote_estimate.itemized)
        ? shipment.quote_estimate.itemized
        : [];

    return sourceItems
      .map(function (item, index) {
        const pkg = item || {};
        const dimensions = pkg.dimensions || {};
        const quoteEstimate = pkg.quote_estimate || pkg.estimate || {};
        const packageType =
          pkg.packageType === "pallet" || pkg.package_type === "pallet"
            ? "pallet"
            : "box";
        const quantity = Math.max(toNumber(pkg.quantity, 1), 1);
        const weight = Math.max(toNumber(pkg.weight, 0), 0);
        const length = Math.max(toNumber(dimensions.length || pkg.length, 0), 0);
        const width = Math.max(toNumber(dimensions.width || pkg.width, 0), 0);
        const height = Math.max(toNumber(dimensions.height || pkg.height, 0), 0);
        const cubicFt =
          parseFiniteNumber(pkg.cubic_ft) !== null
            ? toNumber(pkg.cubic_ft, 0)
            : length > 0 && width > 0 && height > 0
              ? (length * width * height) / 1728
              : 0;
        const billableWeight =
          parseFiniteNumber(pkg.billable_weight) !== null
            ? toNumber(pkg.billable_weight, 0)
            : Math.max(
                weight,
                length > 0 && width > 0 && height > 0
                  ? (length * width * height) / BASE_PRICING.dimensionalFactor
                  : 0,
              );

        return {
          index: index,
          packageType: packageType,
          quantity: quantity,
          weight: weight,
          dimensions: {
            length: length,
            width: width,
            height: height,
          },
          cubicFt: cubicFt,
          billableWeight: billableWeight,
          blackWrapping: Boolean(pkg.blackWrapping || pkg.black_wrapping),
          quoteEstimate: {
            storage: toNumber(quoteEstimate.storage, 0),
            handling: toNumber(quoteEstimate.handling, 0),
            pick_pack: toNumber(
              quoteEstimate.pick_pack,
              toNumber(quoteEstimate.pickPack, 0),
            ),
            shipping: toNumber(quoteEstimate.shipping, 0),
            wrapping: toNumber(quoteEstimate.wrapping, 0),
            total: toNumber(quoteEstimate.total, 0),
          },
        };
      })
      .filter(function (item) {
        return item.quantity > 0;
      });
  }

  function buildPricingCargoChargeGroups(shipment, storageDays) {
    const items = getPricingCargoItems(shipment);
    if (!items.length) return [];

    const groups = {};

    items.forEach(function (item) {
      const groupKey = item.packageType;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          packageType: item.packageType,
          packageTypeLabel: getPackageTypeLabel(item.packageType),
          lineCount: 0,
          totalUnits: 0,
          storageQuantity: 0,
          handlingQuantity: 0,
          pickPackQuantity: 0,
          shippingQuantity: 0,
          wrappingQuantity: 0,
          storageAmount: 0,
          handlingAmount: 0,
          pickPackAmount: 0,
          shippingAmount: 0,
          wrappingAmount: 0,
        };
      }

      const group = groups[groupKey];
      group.lineCount += 1;
      group.totalUnits += item.quantity;
      group.storageQuantity +=
        item.packageType === "pallet"
          ? item.quantity * storageDays
          : item.cubicFt * item.quantity * storageDays;
      group.handlingQuantity += item.quantity;
      group.pickPackQuantity += item.quantity;
      group.shippingQuantity += item.billableWeight * item.quantity;
      group.wrappingQuantity += item.blackWrapping ? item.quantity : 0;
      group.storageAmount += toNumber(item.quoteEstimate.storage, 0);
      group.handlingAmount += toNumber(item.quoteEstimate.handling, 0);
      group.pickPackAmount += toNumber(item.quoteEstimate.pick_pack, 0);
      group.shippingAmount += toNumber(item.quoteEstimate.shipping, 0);
      group.wrappingAmount += toNumber(item.quoteEstimate.wrapping, 0);
    });

    return Object.keys(groups).map(function (key) {
      return groups[key];
    });
  }

  function resolveChargeOverride(overrides, chargeKey, genericKey, allowGenericFallback) {
    if (overrides[chargeKey]) {
      return overrides[chargeKey];
    }
    if (allowGenericFallback && overrides[genericKey]) {
      return overrides[genericKey];
    }
    return normalizeLineOverride();
  }

  function buildFbaPrepDetail(shipment) {
    const fbaPrep = shipment && shipment.fba_prep;
    const services = (fbaPrep && fbaPrep.services) || {};
    const parts = [];
    let totalQty = 0;

    Object.keys(services).forEach(function (key) {
      const service = services[key] || {};
      const qty = toNumber(service.qty, 0);
      if (qty <= 0) return;

      totalQty += qty;
      const catalog = BASE_PRICING.fbaPrep[key] || {};
      parts.push((catalog.label || key) + ": " + qty);
    });

    return {
      detail: parts.length ? parts.join(" • ") : "Amazon FBA preparation",
      quantity: totalQty || 1,
      unit: totalQty ? "service units" : "service bundle",
    };
  }

  function buildShipmentCharges(shipment, options) {
    const pricingData = (options && options.pricingData) || {};
    const customerRateIndex =
      (options && options.customerRateIndex) || buildCustomerRateIndex(pricingData);
    const customerId =
      (options && options.customerId) || shipment.user_id || shipment.customer_id || null;
    const pkg = shipment.package || {};
    const quote = shipment.quote_estimate || {};
    let pkgType = pkg.type === "pallet" ? "pallet" : "box";
    const qty = Math.max(toNumber(pkg.quantity, 1), 1);
    const storageDays = Math.max(
      toNumber(quote.storage_days, BASE_PRICING.storageDays),
      1,
    );
    const cubicFt = getCubicFeetFromPackage(pkg);
    const billableWeight = getBillableWeightFromPackage(pkg);
    let zone = shipment.shipping_zone || "none";
    const dropShipQty = shipment.dropship_qty || {};
    const overrides = (options && options.overrides) || getShipmentOverrides(shipment);
    const pricingChargeGroups = buildPricingCargoChargeGroups(shipment, storageDays);
    const allowGenericGroupOverrides = pricingChargeGroups.length <= 1;
    const charges = [];

    function addCharge(config) {
      if (!config) return;
      config.quantity = roundQuantity(config.quantity);
      config.rate = roundQuantity(config.rate);
      config.amount = roundCurrency(config.amount);
      config.quoteAmount = roundCurrency(config.quoteAmount);
      charges.push(config);
    }
    if (pricingChargeGroups.length) {
      pricingChargeGroups.forEach(function (group) {
        const suffix = pricingChargeGroups.length > 1 ? "_" + group.packageType : "";
        const groupName =
          group.packageTypeLabel +
          " mix (" +
          group.totalUnits +
          " unit" +
          (group.totalUnits === 1 ? "" : "s") +
          " across " +
          group.lineCount +
          " line" +
          (group.lineCount === 1 ? "" : "s") +
          ")";

        (function addGroupedStorageCharge() {
          let quoteAmount = roundCurrency(group.storageAmount);
          const rateMeta = getRateMeta(pricingData, customerRateIndex, "storage", customerId);
          let quantity = Math.max(roundQuantity(group.storageQuantity), quoteAmount > 0 ? 1 : 0);
          const unit = group.packageType === "pallet" ? "pallet-days" : "cubic-ft-days";
          const override = resolveChargeOverride(
            overrides,
            "storage" + suffix,
            "storage",
            allowGenericGroupOverrides,
          );
          let baseRate =
            quantity > 0 && quoteAmount > 0
              ? quoteAmount / quantity
              : getStorageFallbackRate(group.packageType, pricingData, rateMeta);
          let rate = override.rate !== null ? override.rate : baseRate;
          let amount;

          if (override.amount !== null) {
            amount = override.amount;
          } else if (override.rate !== null || quoteAmount <= 0) {
            amount = quantity * rate;
            if (group.packageType !== "pallet") {
              amount = Math.max(amount, getBoxStorageMinimum(pricingData));
            }
          } else {
            amount = quoteAmount;
          }

          if (override.amount !== null && quantity > 0 && override.rate === null) {
            rate = amount / quantity;
          }

          addCharge({
            key: "storage" + suffix,
            billingItemKey: "storage",
            label: "Storage",
            description: "Storage (" + groupName + ")",
            quantity: quantity,
            unit: unit,
            rate: rate,
            amount: amount,
            quoteAmount: quoteAmount,
            rateMeta: rateMeta,
            override: override,
            detail:
              group.packageType === "pallet"
                ? groupName +
                  " x " +
                  storageDays +
                  " days x $" +
                  roundQuantity(rate).toFixed(2) +
                  "/day"
                : groupName +
                  ", " +
                  roundQuantity(group.storageQuantity / storageDays).toFixed(2) +
                  " cf/day x " +
                  storageDays +
                  " days x $" +
                  roundQuantity(rate).toFixed(3) +
                  "/cf/day",
          });
        })();

        (function addGroupedHandlingCharge() {
          let quoteAmount = roundCurrency(group.handlingAmount);
          const rateMeta = getRateMeta(pricingData, customerRateIndex, "handling", customerId);
          const override = resolveChargeOverride(
            overrides,
            "handling" + suffix,
            "handling",
            allowGenericGroupOverrides,
          );
          let quantity = Math.max(roundQuantity(group.handlingQuantity), quoteAmount > 0 ? 1 : 0);
          const unit = group.packageType === "pallet" ? "pallets" : "units";
          let baseRate =
            quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : rateMeta.rate;
          let rate = override.rate !== null ? override.rate : baseRate;
          let amount =
            override.amount !== null
              ? override.amount
              : override.rate !== null || quoteAmount <= 0
                ? quantity * rate
                : quoteAmount;

          if (override.amount !== null && quantity > 0 && override.rate === null) {
            rate = amount / quantity;
          }

          addCharge({
            key: "handling" + suffix,
            billingItemKey: "handling",
            label: "Handling / Receiving",
            description: "Handling / Receiving (" + groupName + ")",
            quantity: quantity,
            unit: unit,
            rate: rate,
            amount: amount,
            quoteAmount: quoteAmount,
            rateMeta: rateMeta,
            override: override,
            detail: groupName + " x $" + roundQuantity(rate).toFixed(2),
          });
        })();

        (function addGroupedPickPackCharge() {
          let quoteAmount = roundCurrency(group.pickPackAmount);
          const rateMeta = getRateMeta(pricingData, customerRateIndex, "pick_pack", customerId);
          const override = resolveChargeOverride(
            overrides,
            "pick_pack" + suffix,
            "pick_pack",
            allowGenericGroupOverrides,
          );
          let quantity = Math.max(roundQuantity(group.pickPackQuantity), quoteAmount > 0 ? 1 : 0);
          const unit = group.packageType === "pallet" ? "pallets" : "items";
          let baseRate =
            quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : rateMeta.rate;
          let rate = override.rate !== null ? override.rate : baseRate;
          let amount =
            override.amount !== null
              ? override.amount
              : override.rate !== null || quoteAmount <= 0
                ? quantity * rate
                : quoteAmount;

          if (override.amount !== null && quantity > 0 && override.rate === null) {
            rate = amount / quantity;
          }

          addCharge({
            key: "pick_pack" + suffix,
            billingItemKey: "pick_pack",
            label: "Pick & Pack",
            description: "Pick & Pack (" + groupName + ")",
            quantity: quantity,
            unit: unit,
            rate: rate,
            amount: amount,
            quoteAmount: quoteAmount,
            rateMeta: rateMeta,
            override: override,
            detail: groupName + " x $" + roundQuantity(rate).toFixed(2),
          });
        })();

        if (zone !== "none" && zone !== "dropship") {
          (function addGroupedShippingCharge() {
            let quoteAmount = roundCurrency(group.shippingAmount);
            const rateMeta = getRateMeta(pricingData, customerRateIndex, "shipping", customerId);
            const override = resolveChargeOverride(
              overrides,
              "shipping" + suffix,
              "shipping",
              allowGenericGroupOverrides,
            );
            let quantity, unit, baseRate, rate, amount, detail;

            if (isFlatRateZone(zone)) {
              quantity = Math.max(roundQuantity(group.quantity || qty), 1);
              unit = "ea";
              const flatAmount = getFlatRateShipping(zone, group.packageType || pkgType, quantity);
              baseRate = quantity > 0 ? flatAmount / quantity : 0;
              rate = override.rate !== null ? override.rate : baseRate;
              amount = override.amount !== null ? override.amount : flatAmount;
              if (override.amount !== null && quantity > 0 && override.rate === null) {
                rate = amount / quantity;
              }
              detail = groupName + ", " + zone + " (flat rate), " + quantity + " unit(s)";
            } else {
              quantity = Math.max(roundQuantity(group.shippingQuantity), quoteAmount > 0 ? 1 : 0);
              unit = "lb";
              baseRate = quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : getShippingRate(zone);
              rate = override.rate !== null ? override.rate : baseRate;
              amount = override.amount !== null
                ? override.amount
                : override.rate !== null || quoteAmount <= 0
                  ? quantity * rate
                  : quoteAmount;
              if (override.amount !== null && quantity > 0 && override.rate === null) {
                rate = amount / quantity;
              }
              detail = groupName + ", " + zone + " zone, " + roundQuantity(group.shippingQuantity).toFixed(1) + " billable lbs";
            }

            addCharge({
              key: "shipping" + suffix,
              billingItemKey: "shipping",
              label: "Shipping",
              description: "Shipping (" + groupName + ")",
              quantity: quantity,
              unit: unit,
              rate: rate,
              amount: amount,
              quoteAmount: quoteAmount,
              rateMeta: rateMeta,
              override: override,
              detail: detail,
            });
          })();
        }

        if (group.wrappingQuantity > 0 || group.wrappingAmount > 0) {
          (function addGroupedWrappingCharge() {
            let quoteAmount = roundCurrency(group.wrappingAmount);
            const rateMeta = getRateMeta(pricingData, customerRateIndex, "wrapping", customerId);
            const override = resolveChargeOverride(
              overrides,
              "wrapping" + suffix,
              "wrapping",
              allowGenericGroupOverrides,
            );
            let quantity = Math.max(roundQuantity(group.wrappingQuantity), quoteAmount > 0 ? 1 : 0);
            const unit = "pallets";
            let baseRate =
              quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : rateMeta.rate;
            let rate = override.rate !== null ? override.rate : baseRate;
            let amount =
              override.amount !== null
                ? override.amount
                : override.rate !== null || quoteAmount <= 0
                  ? quantity * rate
                  : quoteAmount;

            if (override.amount !== null && quantity > 0 && override.rate === null) {
              rate = amount / quantity;
            }

            addCharge({
              key: "wrapping" + suffix,
              billingItemKey: "wrapping",
              label: "Black Wrapping",
              description: "Black Wrapping (" + groupName + ")",
              quantity: quantity,
              unit: unit,
              rate: rate,
              amount: amount,
              quoteAmount: quoteAmount,
              rateMeta: rateMeta,
              override: override,
              detail: groupName + " x $" + roundQuantity(rate).toFixed(2),
            });
          })();
        }
      });
    } else {
      (function addStorageCharge() {
        let quoteAmount = getQuoteAmount(shipment, "storage");
        const rateMeta = getRateMeta(pricingData, customerRateIndex, "storage", customerId);
        let quantity = pkgType === "pallet" ? qty * storageDays : cubicFt * qty * storageDays;
        const unit = pkgType === "pallet" ? "pallet-days" : "cubic-ft-days";
        const override = overrides.storage || normalizeLineOverride();
        let baseRate =
          quantity > 0 && quoteAmount > 0
            ? quoteAmount / quantity
            : getStorageFallbackRate(pkgType, pricingData, rateMeta);
        let rate = override.rate !== null ? override.rate : baseRate;
        let amount;

        if (override.amount !== null) {
          amount = override.amount;
        } else if (override.rate !== null || quoteAmount <= 0) {
          amount = quantity * rate;
          if (pkgType !== "pallet") {
            amount = Math.max(amount, getBoxStorageMinimum(pricingData));
          }
        } else {
          amount = quoteAmount;
        }

        if (override.amount !== null && quantity > 0 && override.rate === null) {
          rate = amount / quantity;
        }

        addCharge({
          key: "storage",
          billingItemKey: "storage",
          label: "Storage",
          quantity: quantity,
          unit: unit,
          rate: rate,
          amount: amount,
          quoteAmount: quoteAmount,
          rateMeta: rateMeta,
          override: override,
          detail:
            pkgType === "pallet"
              ? qty +
                " pallet(s) x " +
                storageDays +
                " days x $" +
                roundQuantity(rate).toFixed(2) +
                "/day"
              : cubicFt.toFixed(2) +
                " cf x " +
                storageDays +
                " days x $" +
                roundQuantity(rate).toFixed(3) +
                "/cf/day x " +
                qty,
        });
      })();

      (function addHandlingCharge() {
        let quoteAmount = getQuoteAmount(shipment, "handling");
        const rateMeta = getRateMeta(pricingData, customerRateIndex, "handling", customerId);
        const override = overrides.handling || normalizeLineOverride();
        let quantity = qty;
        const unit = pkgType === "pallet" ? "pallets" : "units";
        let baseRate =
          quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : rateMeta.rate;
        let rate = override.rate !== null ? override.rate : baseRate;
        let amount =
          override.amount !== null
            ? override.amount
            : override.rate !== null || quoteAmount <= 0
              ? quantity * rate
              : quoteAmount;

        if (override.amount !== null && quantity > 0 && override.rate === null) {
          rate = amount / quantity;
        }

        addCharge({
          key: "handling",
          billingItemKey: "handling",
          label: "Handling / Receiving",
          quantity: quantity,
          unit: unit,
          rate: rate,
          amount: amount,
          quoteAmount: quoteAmount,
          rateMeta: rateMeta,
          override: override,
          detail: quantity + " " + unit + " x $" + roundQuantity(rate).toFixed(2),
        });
      })();

      (function addPickPackCharge() {
        let quoteAmount = getQuoteAmount(shipment, "pick_pack");
        const rateMeta = getRateMeta(pricingData, customerRateIndex, "pick_pack", customerId);
        const override = overrides.pick_pack || normalizeLineOverride();
        let quantity = qty;
        const unit = pkgType === "pallet" ? "pallets" : "items";
        let baseRate =
          quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : rateMeta.rate;
        let rate = override.rate !== null ? override.rate : baseRate;
        let amount =
          override.amount !== null
            ? override.amount
            : override.rate !== null || quoteAmount <= 0
              ? quantity * rate
              : quoteAmount;

        if (override.amount !== null && quantity > 0 && override.rate === null) {
          rate = amount / quantity;
        }

        addCharge({
          key: "pick_pack",
          billingItemKey: "pick_pack",
          label: "Pick & Pack",
          quantity: quantity,
          unit: unit,
          rate: rate,
          amount: amount,
          quoteAmount: quoteAmount,
          rateMeta: rateMeta,
          override: override,
          detail: quantity + " " + unit + " x $" + roundQuantity(rate).toFixed(2),
        });
      })();

      if (zone !== "none" && zone !== "dropship") {
        (function addShippingCharge() {
          let quoteAmount = getQuoteAmount(shipment, "shipping");
          const rateMeta = getRateMeta(pricingData, customerRateIndex, "shipping", customerId);
          const override = overrides.shipping || normalizeLineOverride();
          let quantity, unit, baseRate, rate, amount, detail;

          if (isFlatRateZone(zone)) {
            quantity = Math.max(qty, 1);
            unit = "ea";
            const flatAmount = getFlatRateShipping(zone, pkgType, quantity);
            baseRate = quantity > 0 ? flatAmount / quantity : 0;
            rate = override.rate !== null ? override.rate : baseRate;
            amount = override.amount !== null ? override.amount : flatAmount;
            if (override.amount !== null && quantity > 0 && override.rate === null) {
              rate = amount / quantity;
            }
            detail = zone + " (flat rate), " + quantity + " unit(s)";
          } else {
            quantity = Math.max(roundQuantity(billableWeight * qty), 1);
            unit = "lb";
            baseRate = quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : getShippingRate(zone);
            rate = override.rate !== null ? override.rate : baseRate;
            amount = override.amount !== null
              ? override.amount
              : override.rate !== null || quoteAmount <= 0
                ? quantity * rate
                : quoteAmount;
            if (override.amount !== null && quantity > 0 && override.rate === null) {
              rate = amount / quantity;
            }
            detail = zone + " zone, " + billableWeight.toFixed(1) + " billable lbs x " + qty;
          }

          addCharge({
            key: "shipping",
            billingItemKey: "shipping",
            label: "Shipping",
            quantity: quantity,
            unit: unit,
            rate: rate,
            amount: amount,
            quoteAmount: quoteAmount,
            rateMeta: rateMeta,
            override: override,
            detail: detail,
          });
        })();
      }
    }

    if (zone === "dropship") {
      (function addDropshipCharge() {
        let quoteAmount = getQuoteAmount(shipment, "dropship");
        const rateMeta = getRateMeta(pricingData, customerRateIndex, "dropship", customerId);
        const override = overrides.dropship || normalizeLineOverride();
        let quantity = Math.max(getDropshipUnits(dropShipQty), 1);
        const unit = "units";
        let baseRate;
        let amount;

        if (quoteAmount > 0) {
          baseRate = quoteAmount / quantity;
          amount = quoteAmount;
        } else {
          baseRate = 0;
          amount =
            toNumber(dropShipQty.envelope, 0) * BASE_PRICING.dropShipRates.envelope +
            toNumber(dropShipQty.small, 0) * BASE_PRICING.dropShipRates.small +
            toNumber(dropShipQty.medium, 0) * BASE_PRICING.dropShipRates.medium +
            toNumber(dropShipQty.large, 0) * BASE_PRICING.dropShipRates.large;
          if (amount > 0 && quantity > 0) {
            baseRate = amount / quantity;
          }
        }

        let rate = override.rate !== null ? override.rate : baseRate;
        if (override.amount !== null) {
          amount = override.amount;
        } else if (override.rate !== null || quoteAmount <= 0) {
          amount = quantity * rate;
        }

        if (override.amount !== null && quantity > 0 && override.rate === null) {
          rate = amount / quantity;
        }

        addCharge({
          key: "dropship",
          billingItemKey: "dropship",
          label: "Drop Ship",
          quantity: quantity,
          unit: unit,
          rate: rate,
          amount: amount,
          quoteAmount: quoteAmount,
          rateMeta: rateMeta,
          override: override,
          detail:
            "Env:" +
            toNumber(dropShipQty.envelope, 0) +
            " Sm:" +
            toNumber(dropShipQty.small, 0) +
            " Md:" +
            toNumber(dropShipQty.medium, 0) +
            " Lg:" +
            toNumber(dropShipQty.large, 0),
        });
      })();
    }

    if (!pricingChargeGroups.length && shipment.black_wrapping) {
      (function addWrappingCharge() {
        let quoteAmount = getQuoteAmount(shipment, "wrapping");
        const rateMeta = getRateMeta(pricingData, customerRateIndex, "wrapping", customerId);
        const override = overrides.wrapping || normalizeLineOverride();
        let quantity = qty;
        const unit = "pallets";
        let baseRate =
          quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : rateMeta.rate;
        let rate = override.rate !== null ? override.rate : baseRate;
        let amount =
          override.amount !== null
            ? override.amount
            : override.rate !== null || quoteAmount <= 0
              ? quantity * rate
              : quoteAmount;

        if (override.amount !== null && quantity > 0 && override.rate === null) {
          rate = amount / quantity;
        }

        addCharge({
          key: "wrapping",
          billingItemKey: "wrapping",
          label: "Black Wrapping",
          quantity: quantity,
          unit: unit,
          rate: rate,
          amount: amount,
          quoteAmount: quoteAmount,
          rateMeta: rateMeta,
          override: override,
          detail: quantity + " " + unit + " x $" + roundQuantity(rate).toFixed(2),
        });
      })();
    }

    if (shipment.fba_prep || getQuoteAmount(shipment, "fba_prep") > 0) {
      (function addFbaPrepCharge() {
        let quoteAmount = getQuoteAmount(shipment, "fba_prep");
        const rateMeta = getRateMeta(pricingData, customerRateIndex, "custom", customerId);
        const override = overrides.fba_prep || normalizeLineOverride();
        const fbaDetail = buildFbaPrepDetail(shipment);
        let quantity = fbaDetail.quantity;
        const unit = fbaDetail.unit;
        let baseRate =
          quantity > 0 && quoteAmount > 0 ? quoteAmount / quantity : quoteAmount || 0;
        let rate = override.rate !== null ? override.rate : baseRate;
        let amount =
          override.amount !== null
            ? override.amount
            : override.rate !== null || quoteAmount <= 0
              ? quantity * rate
              : quoteAmount;

        if (override.amount !== null && quantity > 0 && override.rate === null) {
          rate = amount / quantity;
        }

        if (amount > 0 || override.amount !== null || override.rate !== null) {
          addCharge({
            key: "fba_prep",
            billingItemKey: "custom",
            label: "FBA Prep Services",
            quantity: quantity,
            unit: unit,
            rate: rate,
            amount: amount,
            quoteAmount: quoteAmount,
            rateMeta: rateMeta,
            override: override,
            detail: fbaDetail.detail,
          });
        }
      })();
    }

    return charges.filter(function (charge) {
      return charge.amount > 0 || charge.override.amount !== null || charge.override.rate !== null;
    });
  }

  function getOriginalShipmentTotal(shipment) {
    const quote = (shipment && shipment.quote_estimate) || {};
    return roundCurrency(
      toNumber(quote.total, 0) ||
        (toNumber(quote.storage, 0) +
          toNumber(quote.handling, 0) +
          toNumber(quote.pick_pack, toNumber(quote.pickPack, 0)) +
          toNumber(quote.shipping, 0) +
          toNumber(quote.wrapping, 0) +
          toNumber(quote.dropship, 0) +
          toNumber(quote.fba_prep, 0)),
    );
  }

  function buildShipmentActivityEntries(shipment, options) {
    const charges = buildShipmentCharges(shipment, options);
    const tracking = shipment.tracking_number || shipment.id || "shipment";
    const customerName =
      (options && options.customerName) ||
      shipment.customer_name ||
      shipment.user_name ||
      "Unknown";
    const createdAt =
      (shipment.created_at && String(shipment.created_at)) || new Date().toISOString();
    const baseDate = createdAt.split("T")[0];

    return charges.map(function (charge) {
      const itemKey = charge.billingItemKey || charge.key;
      const sourceChargeKey = charge.sourceKey || charge.key;
      let rateSource = "quote";
      if (charge.override.amount !== null) {
        rateSource = "manual_amount_override";
      } else if (charge.override.rate !== null) {
        rateSource = "manual_rate_override";
      } else if (charge.quoteAmount > 0) {
        rateSource = "shipment_quote";
      } else if (charge.rateMeta && charge.rateMeta.source) {
        rateSource = charge.rateMeta.source;
      }

      return {
        customer_id: shipment.user_id || shipment.customer_id || null,
        customer_name: customerName,
        warehouse: shipment.warehouse || "miami",
        date: baseDate,
        activity_type: itemKey,
        billing_item_id: itemKey,
        billing_item_label: charge.label,
        quote_category: getQuoteCategory(itemKey),
        calculator_item: Boolean(BILLING_ITEMS[itemKey] && BILLING_ITEMS[itemKey].calculatorItem),
        description: (charge.description || charge.label) + " - Shipment " + tracking,
        quantity: charge.quantity,
        unit: charge.unit,
        rate: charge.rate,
        amount: charge.amount,
        rate_source: rateSource,
        pricing_rate_path: charge.rateMeta ? charge.rateMeta.path || null : null,
        pricing_rate_default: charge.rateMeta ? toNumber(charge.rateMeta.rate, 0) : 0,
        customer_rate_applied: Boolean(
          charge.rateMeta && charge.rateMeta.source === "customer",
        ),
        reference: tracking,
        notes: charge.override.note
          ? "Shipment " + tracking + " - " + charge.override.note
          : "Shipment-derived billing entry",
        source_shipment_id: shipment.id || null,
        source_shipment_tracking: tracking,
        source_charge_key: sourceChargeKey,
        quote_amount: charge.quoteAmount,
        override_note: charge.override.note || "",
        billed: false,
        invoice_id: null,
        created_at: new Date().toISOString(),
      };
    });
  }

  function buildStorageSnapshotEntries(snapshots, options) {
    const pricingData = (options && options.pricingData) || {};
    const customerRateIndex =
      (options && options.customerRateIndex) || buildCustomerRateIndex(pricingData);
    const customerId = options && options.customerId;
    const rateMeta = getRateMeta(pricingData, customerRateIndex, "storage", customerId);
    let rate = toNumber(rateMeta.rate, BASE_PRICING.palletStoragePerDay);

    return (snapshots || [])
      .filter(function (snapshot) {
        return !snapshot.billed && !snapshot.invoiced && toNumber(snapshot.pallet_count, 0) > 0;
      })
      .map(function (snapshot) {
        let quantity = toNumber(snapshot.pallet_count, 0);
        return {
          source_type: "storage_snapshot",
          source_id: snapshot.id,
          customer_id: snapshot.customer_id || customerId,
          date: snapshot.date,
          activity_type: "storage",
          billing_item_id: "storage",
          billing_item_label: getActivityLabel("storage"),
          quote_category: "storage",
          description: "Storage Snapshot - " + snapshot.date,
          quantity: quantity,
          unit: "pallet-days",
          rate: rate,
          amount: roundCurrency(quantity * rate),
          rate_source: rateMeta.source,
          pricing_rate_path: rateMeta.path || null,
          pricing_rate_default: rate,
          customer_rate_applied: rateMeta.source === "customer",
          reference: snapshot.date,
          notes: snapshot.notes || "",
          billed: false,
        };
      });
  }

  function buildBillableEventEntries(events) {
    return (events || [])
      .filter(function (event) {
        return !event.invoiced;
      })
      .map(function (event) {
        let amount =
          parseFiniteNumber(event.amount) !== null
            ? toNumber(event.amount, 0)
            : toNumber(event.quantity, 0) * toNumber(event.rate, 0);
        const itemKey = event.billing_item_id || event.event_type || "custom";
        return {
          source_type: "billable_event",
          source_id: event.id,
          customer_id: event.customer_id,
          date:
            (event.created_at && String(event.created_at).split("T")[0]) ||
            event.date ||
            null,
          activity_type: itemKey,
          billing_item_id: itemKey,
          billing_item_label: getActivityLabel(itemKey),
          quote_category: getQuoteCategory(itemKey),
          description: event.description || getActivityLabel(itemKey),
          quantity: toNumber(event.quantity, 0),
          unit: event.unit || (BILLING_ITEMS[itemKey] && BILLING_ITEMS[itemKey].defaultUnit) || "units",
          rate: toNumber(event.rate, 0),
          amount: roundCurrency(amount),
          reference: event.shipment_id || "",
          notes: event.notes || "",
          billed: false,
        };
      });
  }

  function groupInvoiceEntries(entries) {
    const grouped = {};

    (entries || []).forEach(function (entry) {
      const itemKey = entry.billing_item_id || entry.activity_type || "custom";
      let key = [
        itemKey,
        entry.description || getActivityLabel(itemKey),
        entry.unit || "",
        roundQuantity(entry.rate).toFixed(6),
      ].join("|");

      if (!grouped[key]) {
        grouped[key] = {
          category: entry.quote_category || getQuoteCategory(itemKey),
          billing_item_id: itemKey,
          description: entry.description || getActivityLabel(itemKey),
          unit: entry.unit || "units",
          rate: roundQuantity(entry.rate),
          quantity: 0,
          amount: 0,
          entry_count: 0,
          source_refs: [],
        };
      }

      grouped[key].quantity += toNumber(entry.quantity, 0);
      grouped[key].amount += toNumber(entry.amount, 0);
      grouped[key].entry_count += 1;
      grouped[key].source_refs.push({
        type: entry.source_type || "activity_log",
        id: entry.source_id || entry.id || null,
      });
    });

    return Object.keys(grouped)
      .map(function (key) {
        const row = grouped[key];
        row.quantity = roundQuantity(row.quantity);
        row.amount = roundCurrency(row.amount);
        return row;
      })
      .sort(function (a, b) {
        return b.amount - a.amount;
      });
  }

  global.MA3PLBillingEngine = {
    BASE_PRICING: BASE_PRICING,
    BILLING_ITEMS: BILLING_ITEMS,
    QUOTE_KEYS: QUOTE_KEYS,
    normalizeServiceKey: normalizeServiceKey,
    mapServiceToItem: mapServiceToItem,
    buildCustomerRateIndex: buildCustomerRateIndex,
    resolveCustomerRate: resolveCustomerRate,
    getRateMeta: getRateMeta,
    getQuoteCategory: getQuoteCategory,
    getActivityLabel: getActivityLabel,
    getActivityIcon: getActivityIcon,
    getQuoteCategoryLabel: getQuoteCategoryLabel,
    getShipmentOverrides: getShipmentOverrides,
    buildShipmentCharges: buildShipmentCharges,
    getOriginalShipmentTotal: getOriginalShipmentTotal,
    buildShipmentActivityEntries: buildShipmentActivityEntries,
    buildStorageSnapshotEntries: buildStorageSnapshotEntries,
    buildBillableEventEntries: buildBillableEventEntries,
    groupInvoiceEntries: groupInvoiceEntries,
    roundCurrency: roundCurrency,
    roundQuantity: roundQuantity,
  };
})(window);
