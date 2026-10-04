/**
 * Container services (Jorge 2026-06-23): Container Offloading and Container
 * Loading, fixed fee per container: $275 palletized, $475 loose boxes.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sandbox = { console, window: {} };
sandbox.window = sandbox;
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, "..", "js/quote-pricing-engine.js"), "utf8"),
  sandbox,
  { filename: "js/quote-pricing-engine.js" },
);
const QuoteEngine = sandbox.MA3PLQuoteEngine;
const total = QuoteEngine.getContainerServicesTotal;

const rates = QuoteEngine.PRICING.containerServices;
assert.strictEqual(rates.offloading.pallet, 275);
assert.strictEqual(rates.offloading.box, 475);
assert.strictEqual(rates.loading.pallet, 275);
assert.strictEqual(rates.loading.box, 475);

assert.strictEqual(total(undefined), 0);
assert.strictEqual(total({}), 0);
assert.strictEqual(
  total({ offloading: { enabled: false, type: "box", qty: 3 } }),
  0,
  "a service that is not ticked costs nothing",
);
assert.strictEqual(total({ offloading: { enabled: true, type: "pallet", qty: 1 } }), 275);
assert.strictEqual(total({ offloading: { enabled: true, type: "box", qty: 1 } }), 475);
assert.strictEqual(total({ loading: { enabled: true, type: "pallet", qty: 2 } }), 550);
assert.strictEqual(total({ loading: { enabled: true, type: "box", qty: 2 } }), 950);
assert.strictEqual(
  total({
    offloading: { enabled: true, type: "box", qty: 1 },
    loading: { enabled: true, type: "pallet", qty: 1 },
  }),
  750,
);
assert.strictEqual(
  total({ offloading: { enabled: true, type: "nonsense", qty: 1 } }),
  275,
  "unknown type falls back to palletized",
);
assert.strictEqual(total({ offloading: { enabled: true, type: "box", qty: 0 } }), 475 * 1);
assert.strictEqual(total({ offloading: { enabled: true, type: "box", qty: 999 } }), 475 * 50);

console.log("container-services-test: all assertions passed");
