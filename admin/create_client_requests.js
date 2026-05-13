#!/usr/bin/env node
/**
 * Create Payment/Invoice Requests for ALL Registered Clients
 * Miami Alliance 3PL — Admin Script
 *
 * Queries all registered clients from Firestore and generates
 * a billing/payment request (invoice) for each one.
 *
 * Usage: node create_client_requests.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// ─── Firebase Init ───────────────────────────────────────────
const keyPath = path.resolve(__dirname, "../../firebase-key.json");
if (!fs.existsSync(keyPath)) {
  console.error("❌ Firebase key not found at:", keyPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "miamialliance3pl",
  });
}

const db = admin.firestore();

// ─── Configuration ───────────────────────────────────────────
const BILLING_PERIOD_START = new Date();
BILLING_PERIOD_START.setDate(1); // First day of current month
const BILLING_PERIOD_END = new Date();
const DUE_DAYS = 30;

function formatDate(d) {
  return d.toISOString().split("T")[0];
}

function generateInvoiceNumber() {
  const now = new Date();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${rand}`;
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  Miami Alliance 3PL — Client Request Generator      ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // 1. Query all registered clients (customers only, skip admin/employee)
  console.log("📡 Querying all registered clients...\n");

  const usersSnap = await db.collection("users").get();

  if (usersSnap.empty) {
    console.log("⚠️  No registered users found in Firestore.");
    process.exit(0);
  }

  const allUsers = [];
  usersSnap.forEach((doc) => {
    const data = doc.to_dict ? doc.to_dict() : doc.data();
    allUsers.push({ id: doc.id, ...data });
  });

  // Filter to customer accounts
  const customers = allUsers.filter((u) => {
    const role = (u.role || "customer").toLowerCase();
    return role === "customer";
  });

  const admins = allUsers.filter((u) => {
    const role = (u.role || "customer").toLowerCase();
    return role === "admin" || role === "employee";
  });

  console.log(`📊 Total registered users: ${allUsers.length}`);
  console.log(`   ├─ Customers: ${customers.length}`);
  console.log(`   └─ Admin/Staff: ${admins.length}`);
  console.log("");

  if (customers.length === 0) {
    console.log(
      "⚠️  No customer accounts found. Only admin/staff users exist.",
    );
    console.log("   Proceeding to create requests for ALL users instead.\n");
    // If no customers, include all users
    customers.push(...admins);
  }

  // 2. Check for unbilled activity/events per client
  console.log("─".repeat(55));
  console.log("📋 Generating payment requests for each client:\n");

  const results = [];
  const now = new Date();

  for (const customer of customers) {
    const custName =
      customer.company_name || customer.name || customer.email || "Unknown";
    const custEmail = customer.email || "N/A";

    console.log(`  🔹 ${custName} (${custEmail})`);

    // Check for unbilled events
    let unbilledEvents = [];
    try {
      const eventsSnap = await db
        .collection("billable_events")
        .where("customer_id", "==", customer.id)
        .where("invoiced", "==", false)
        .get();

      eventsSnap.forEach((doc) => {
        unbilledEvents.push({ id: doc.id, ...doc.data() });
      });
    } catch (e) {
      // Collection may not exist or no matching docs
    }

    // Check for unbilled activity log entries
    let unbilledActivities = [];
    try {
      const actSnap = await db
        .collection("activity_log")
        .where("customer_id", "==", customer.id)
        .where("billed", "==", false)
        .get();

      actSnap.forEach((doc) => {
        unbilledActivities.push({ id: doc.id, ...doc.data() });
      });
    } catch (e) {
      // May not exist
    }

    // Check for active shipments
    let activeShipments = [];
    try {
      const shipSnap = await db
        .collection("shipments")
        .where("user_id", "==", customer.id)
        .get();

      shipSnap.forEach((doc) => {
        activeShipments.push({ id: doc.id, ...doc.data() });
      });
    } catch (e) {
      // May not exist
    }

    // Build line items from unbilled events
    const lineItems = [];
    let subtotal = 0;

    if (unbilledEvents.length > 0) {
      // Group events by type
      const grouped = {};
      unbilledEvents.forEach((evt) => {
        const key = `${evt.event_type || "service"}|${evt.unit || "unit"}|${evt.rate || 0}`;
        if (!grouped[key]) {
          grouped[key] = {
            category: evt.event_type || "service",
            billing_item_id: evt.event_type || "service",
            description: evt.description || evt.event_type || "Service",
            unit: evt.unit || "unit",
            rate: Number(evt.rate) || 0,
            quantity: 0,
            amount: 0,
          };
        }
        grouped[key].quantity += Number(evt.quantity) || 1;
        grouped[key].amount += Number(evt.amount) || 0;
      });

      Object.values(grouped).forEach((li) => {
        lineItems.push(li);
        subtotal += li.amount;
      });
    }

    if (unbilledActivities.length > 0) {
      const grouped = {};
      unbilledActivities.forEach((act) => {
        const type = act.billing_item_id || act.activity_type || "custom";
        const key = `${type}|${act.unit || "unit"}|${Number(act.rate || 0).toFixed(4)}`;
        if (!grouped[key]) {
          grouped[key] = {
            category: act.quote_category || type,
            billing_item_id: type,
            description: act.description || type,
            unit: act.unit || "unit",
            rate: Number(act.rate) || 0,
            quantity: 0,
            amount: 0,
          };
        }
        grouped[key].quantity += Number(act.quantity) || 1;
        grouped[key].amount += Number(act.amount) || 0;
      });

      Object.values(grouped).forEach((li) => {
        lineItems.push(li);
        subtotal += li.amount;
      });
    }

    // If no billable items found, create a statement request (zero-balance or storage check)
    if (lineItems.length === 0) {
      lineItems.push({
        category: "statement",
        billing_item_id: "monthly_statement",
        description: "Monthly Account Statement — No outstanding charges",
        unit: "statement",
        rate: 0,
        quantity: 1,
        amount: 0,
      });
    }

    // Generate the invoice/request
    const invNumber = generateInvoiceNumber();
    const dueDate = new Date(now.getTime() + DUE_DAYS * 24 * 60 * 60 * 1000);

    const invoiceData = {
      invoice_number: invNumber,
      customer_id: customer.id,
      customer_name: custName,
      customer_email: custEmail,
      billing_period_start: formatDate(BILLING_PERIOD_START),
      billing_period_end: formatDate(BILLING_PERIOD_END),
      billing_cycle: "monthly",
      due_date: formatDate(dueDate),
      line_items: lineItems,
      subtotal: subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total: subtotal,
      amount_paid: 0,
      status: "draft",
      notes: `Auto-generated monthly billing request for ${custName}. ${unbilledEvents.length} billable events, ${unbilledActivities.length} activity entries, ${activeShipments.length} shipments on record.`,
      source: "batch_client_request",
      activity_count: unbilledEvents.length + unbilledActivities.length,
      shipment_count: activeShipments.length,
      created_at: now.toISOString(),
      created_by: "symbio-admin",
    };

    // Write to Firestore
    const invoiceRef = await db.collection("invoices").add(invoiceData);

    // Mark billable events as invoiced
    for (const evt of unbilledEvents) {
      await db.collection("billable_events").doc(evt.id).update({
        invoiced: true,
        invoice_id: invoiceRef.id,
      });
    }

    // Mark activities as billed
    for (const act of unbilledActivities) {
      await db.collection("activity_log").doc(act.id).update({
        billed: true,
        invoice_id: invoiceRef.id,
      });
    }

    const statusEmoji = subtotal > 0 ? "💰" : "📋";
    console.log(
      `    ${statusEmoji} ${invNumber} → $${subtotal.toFixed(2)} (${lineItems.length} items) [${invoiceRef.id}]`,
    );

    results.push({
      customer: custName,
      email: custEmail,
      invoice_number: invNumber,
      invoice_id: invoiceRef.id,
      total: subtotal,
      line_items: lineItems.length,
      unbilled_events: unbilledEvents.length,
      unbilled_activities: unbilledActivities.length,
      shipments: activeShipments.length,
    });
  }

  // 3. Summary
  console.log("\n" + "═".repeat(55));
  console.log("📊 BATCH REQUEST SUMMARY");
  console.log("═".repeat(55));
  console.log(`  Total clients processed: ${results.length}`);
  console.log(`  Requests created:        ${results.length}`);
  console.log(
    `  Total amount billed:     $${results.reduce((s, r) => s + r.total, 0).toFixed(2)}`,
  );
  console.log(`  Status:                  All DRAFT (review in admin panel)`);
  console.log(
    `  Billing period:          ${formatDate(BILLING_PERIOD_START)} → ${formatDate(BILLING_PERIOD_END)}`,
  );
  console.log(
    `  Due date:                ${formatDate(new Date(now.getTime() + DUE_DAYS * 24 * 60 * 60 * 1000))}`,
  );
  console.log("═".repeat(55));
  console.log("\n✅ All requests created as DRAFT. Review and send from:");
  console.log(
    "   https://megalopolisms.github.io/miamialliance3pl/portal/invoices.html",
  );
  console.log(
    "   https://megalopolisms.github.io/miamialliance3pl/portal/admin-billing.html\n",
  );

  // Output JSON summary
  const summaryPath = path.resolve(
    __dirname,
    `client_requests_${formatDate(now)}.json`,
  );
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        generated_at: now.toISOString(),
        billing_period: `${formatDate(BILLING_PERIOD_START)} to ${formatDate(BILLING_PERIOD_END)}`,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`📄 Summary saved to: ${summaryPath}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
