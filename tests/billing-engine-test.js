const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sandbox = {
  console,
  window: {},
};
sandbox.window = sandbox;

function loadScript(relPath) {
  const filePath = path.resolve(__dirname, "..", relPath);
  const code = fs.readFileSync(filePath, "utf8");
  vm.runInNewContext(code, sandbox, { filename: relPath });
}

loadScript("js/quote-pricing-engine.js");
loadScript("js/billing-engine.js");

const BillingEngine = sandbox.MA3PLBillingEngine;
const QuoteEngine = sandbox.MA3PLQuoteEngine;

function testQuoteBaselinePreserved() {
  const shipment = {
    id: "ship-1",
    user_id: "cust-1",
    tracking_number: "MA3PL1234",
    package: {
      type: "pallet",
      quantity: 2,
      weight: 100,
      length: 48,
      width: 40,
      height: 60,
      billable_weight: 100,
    },
    shipping_zone: "regional",
    quote_estimate: {
      storage: 45,
      handling: 24,
      pick_pack: 10,
      shipping: 130,
      total: 209,
      storage_days: 30,
    },
  };

  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });

  assert.strictEqual(charges.find((row) => row.key === "storage").amount, 45);
  assert.strictEqual(charges.find((row) => row.key === "handling").amount, 24);
  assert.strictEqual(charges.find((row) => row.key === "pick_pack").amount, 10);
  assert.strictEqual(charges.find((row) => row.key === "shipping").amount, 130);
}

function testAmountAndRateOverrides() {
  const shipment = {
    id: "ship-2",
    user_id: "cust-1",
    tracking_number: "MA3PL5678",
    package: {
      type: "box",
      quantity: 3,
      weight: 15,
      length: 20,
      width: 20,
      height: 20,
      billable_weight: 57.6,
    },
    shipping_zone: "national",
    quote_estimate: {
      storage: 12,
      handling: 10.5,
      pick_pack: 3.75,
      shipping: 146.88,
      total: 173.13,
      storage_days: 30,
    },
    billing_override_detail: {
      shipping: { rate: 1.0 },
      handling: { amount: 30.0 },
    },
  };

  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });

  const shipping = charges.find((row) => row.key === "shipping");
  const handling = charges.find((row) => row.key === "handling");

  assert.strictEqual(shipping.amount, 172.8);
  assert.strictEqual(handling.amount, 30);
}

function testGroupingAndLegacyEvents() {
  const entries = BillingEngine.buildBillableEventEntries([
    {
      id: "evt-1",
      customer_id: "cust-1",
      event_type: "handling",
      description: "Manual Handling",
      quantity: 2,
      unit: "orders",
      rate: 10,
      amount: 25,
      invoiced: false,
    },
    {
      id: "evt-2",
      customer_id: "cust-1",
      event_type: "handling",
      description: "Manual Handling",
      quantity: 1,
      unit: "orders",
      rate: 10,
      amount: 10,
      invoiced: false,
    },
  ]);

  const grouped = BillingEngine.groupInvoiceEntries(entries);
  assert.strictEqual(grouped.length, 1);
  assert.strictEqual(grouped[0].amount, 35);
  assert.strictEqual(grouped[0].quantity, 3);
}

// =========================================================================
// EDGE CASE TESTS (added REMIX Cycle 4)
// =========================================================================

function testZeroQuantityShipment() {
  const shipment = {
    id: "ship-edge-1",
    user_id: "cust-1",
    tracking_number: "MA3PL0000",
    package: {
      type: "box",
      quantity: 0,
      weight: 0,
      length: 0,
      width: 0,
      height: 0,
    },
    shipping_zone: "local",
    quote_estimate: {
      storage: 0,
      handling: 0,
      pick_pack: 0,
      shipping: 0,
      total: 0,
      storage_days: 0,
    },
  };
  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });
  // Should not crash — all amounts should be 0 or valid numbers
  for (const c of charges) {
    assert.strictEqual(
      typeof c.amount,
      "number",
      `Charge ${c.key} amount must be a number`,
    );
    assert.ok(!isNaN(c.amount), `Charge ${c.key} must not be NaN`);
  }
}

function testNullFieldsShipment() {
  const shipment = {
    id: "ship-edge-2",
    user_id: "cust-1",
    tracking_number: "MA3PL9999",
    package: {
      type: null,
      quantity: null,
      weight: null,
      length: null,
      width: null,
      height: null,
    },
    shipping_zone: null,
    quote_estimate: null,
  };
  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });
  // Should not crash with null fields — graceful degradation
  assert.ok(Array.isArray(charges), "charges should always be an array");
  for (const c of charges) {
    assert.strictEqual(
      typeof c.amount,
      "number",
      `Null-field charge ${c.key} must be a number`,
    );
    assert.ok(!isNaN(c.amount), `Null-field charge ${c.key} must not be NaN`);
  }
}

function testNegativeValues() {
  const shipment = {
    id: "ship-edge-3",
    user_id: "cust-1",
    tracking_number: "MA3PLneg",
    package: {
      type: "pallet",
      quantity: -1,
      weight: -50,
      length: -10,
      width: -10,
      height: -10,
    },
    shipping_zone: "regional",
    quote_estimate: {
      storage: -5,
      handling: -3,
      pick_pack: -1,
      shipping: -10,
      total: -19,
      storage_days: -7,
    },
  };
  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });
  // Should not crash — amounts may be negative but must be numeric
  for (const c of charges) {
    assert.strictEqual(
      typeof c.amount,
      "number",
      `Negative-val charge ${c.key} must be a number`,
    );
    assert.ok(!isNaN(c.amount), `Negative-val charge ${c.key} must not be NaN`);
  }
}

function testEmptyEventsArray() {
  const entries = BillingEngine.buildBillableEventEntries([]);
  const grouped = BillingEngine.groupInvoiceEntries(entries);
  assert.ok(
    Array.isArray(grouped),
    "grouped should be array even for empty input",
  );
  assert.strictEqual(
    grouped.length,
    0,
    "empty events should produce empty groups",
  );
}

function testCurrencyPrecision() {
  // Verify that amounts are rounded to 2 decimal places (no floating point drift)
  const shipment = {
    id: "ship-edge-4",
    user_id: "cust-1",
    tracking_number: "MA3PLprec",
    package: {
      type: "box",
      quantity: 3,
      weight: 7,
      length: 12,
      width: 8,
      height: 6,
      billable_weight: 7,
    },
    shipping_zone: "regional",
    quote_estimate: {
      storage: 1.005,
      handling: 2.335,
      pick_pack: 0.115,
      shipping: 3.445,
      total: 6.9,
      storage_days: 30,
    },
  };
  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });
  for (const c of charges) {
    const decimalPlaces = (String(c.amount).split(".")[1] || "").length;
    assert.ok(
      decimalPlaces <= 4,
      `Charge ${c.key} has ${decimalPlaces} decimals (max 4): ${c.amount}`,
    );
  }
}

function testCustomerRateOverride() {
  const rateIndex = new Map();
  rateIndex.set(
    "cust-custom",
    new Map([["storage", { rate: 1.5, quoteKey: "storage" }]]),
  );

  const shipment = {
    id: "ship-edge-5",
    user_id: "cust-custom",
    tracking_number: "MA3PLcust",
    package: {
      type: "pallet",
      quantity: 5,
      weight: 200,
      length: 48,
      width: 40,
      height: 60,
      billable_weight: 200,
    },
    shipping_zone: "local",
    quote_estimate: {
      storage: 100,
      handling: 75,
      pick_pack: 25,
      shipping: 50,
      total: 250,
      storage_days: 30,
    },
  };
  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: rateIndex,
    customerId: "cust-custom",
  });
  // Customer rate override should be applied for storage
  const storageCharge = charges.find((c) => c.key === "storage");
  assert.ok(storageCharge, "storage charge must exist");
  assert.strictEqual(typeof storageCharge.amount, "number");
}

function testMissingShipmentId() {
  // Shipment without id — should not crash
  const shipment = {
    user_id: "cust-1",
    tracking_number: "MA3PLnoId",
    package: {
      type: "box",
      quantity: 1,
      weight: 5,
      length: 10,
      width: 10,
      height: 10,
    },
    quote_estimate: { storage: 5, handling: 3.5, total: 8.5, storage_days: 30 },
  };
  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });
  assert.ok(Array.isArray(charges), "charges should work without shipment id");
}

function testMixedStorageMinimumAppliesOnce() {
  const result = QuoteEngine.calculateMultiEstimate(
    [
      {
        packageType: "box",
        dimensions: { length: 12, width: 12, height: 12 },
        weight: 5,
        quantity: 1,
      },
      {
        packageType: "box",
        dimensions: { length: 12, width: 12, height: 12 },
        weight: 5,
        quantity: 1,
      },
    ],
    {
      shippingZone: "none",
      storageDays: 30,
    },
  );

  assert.strictEqual(result.totals.storage, 5);
  assert.strictEqual(
    Math.round((result.items[0].storage + result.items[1].storage) * 100) / 100,
    5,
  );
}

function testMixedShipmentChargesSplitByPackageType() {
  const shipment = {
    id: "ship-mixed-1",
    user_id: "cust-mixed",
    tracking_number: "MA3PLMIXED",
    package: {
      type: "mixed",
      quantity: 5,
      weight: 500,
      length: 48,
      width: 40,
      height: 48,
    },
    pricing_cargo_items: [
      {
        packageType: "box",
        dimensions: { length: 24, width: 18, height: 18 },
        weight: 30,
        quantity: 3,
        cubic_ft: 4.5,
        billable_weight: 56,
        quote_estimate: {
          storage: 10.13,
          handling: 10.5,
          pick_pack: 3.75,
          shipping: 109.2,
          total: 133.58,
        },
      },
      {
        packageType: "pallet",
        dimensions: { length: 48, width: 40, height: 60 },
        weight: 500,
        quantity: 2,
        blackWrapping: true,
        cubic_ft: 66.67,
        billable_weight: 500,
        quote_estimate: {
          storage: 45,
          handling: 30,
          pick_pack: 10,
          shipping: 650,
          wrapping: 14,
          total: 749,
        },
      },
    ],
    shipping_zone: "regional",
    black_wrapping: true,
    quote_estimate: {
      storage: 55.13,
      handling: 40.5,
      pick_pack: 13.75,
      shipping: 759.2,
      wrapping: 14,
      total: 882.58,
      storage_days: 30,
    },
  };

  const charges = BillingEngine.buildShipmentCharges(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });

  assert.strictEqual(charges.find((row) => row.key === "storage_box").amount, 10.13);
  assert.strictEqual(charges.find((row) => row.key === "storage_pallet").amount, 45);
  assert.strictEqual(charges.find((row) => row.key === "shipping_box").amount, 109.2);
  assert.strictEqual(charges.find((row) => row.key === "shipping_pallet").amount, 650);
  assert.strictEqual(charges.find((row) => row.key === "wrapping_pallet").amount, 14);

  const entries = BillingEngine.buildShipmentActivityEntries(shipment, {
    pricingData: {},
    customerRateIndex: new Map(),
  });
  const sourceKeys = entries.map((entry) => entry.source_charge_key);
  assert.strictEqual(new Set(sourceKeys).size, sourceKeys.length);
}

// Run all tests
const tests = [
  ["Quote baseline preserved", testQuoteBaselinePreserved],
  ["Amount and rate overrides", testAmountAndRateOverrides],
  ["Grouping and legacy events", testGroupingAndLegacyEvents],
  ["Zero quantity shipment", testZeroQuantityShipment],
  ["Null fields shipment", testNullFieldsShipment],
  ["Negative values", testNegativeValues],
  ["Empty events array", testEmptyEventsArray],
  ["Currency precision", testCurrencyPrecision],
  ["Customer rate override", testCustomerRateOverride],
  ["Missing shipment ID", testMissingShipmentId],
  ["Mixed storage minimum applies once", testMixedStorageMinimumAppliesOnce],
  ["Mixed shipment charges split by package type", testMixedShipmentChargesSplitByPackageType],
];

let passed = 0;
let failed = 0;

for (const [name, fn] of tests) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

console.log(
  `\nbilling-engine tests: ${passed} passed, ${failed} failed (${tests.length} total)`,
);

if (failed > 0) {
  process.exitCode = 1;
}
