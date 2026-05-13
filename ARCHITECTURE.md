# Miami Alliance 3PL - System Architecture & Documentation

## Table of Contents

- [Overview](#overview)
- [Section ID Reference](#section-id-reference)
- [Module Documentation](#module-documentation)
- [MCP Server](#mcp-server)
- [Self-Diagnostics](#self-diagnostics)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Overview

Miami Alliance 3PL is a comprehensive logistics management portal built with:

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Backend:** Firebase (Auth, Firestore, Functions)
- **Payments:** Stripe Checkout
- **Hosting:** GitHub Pages
- **Maintenance:** MCP Server with self-diagnostics

---

## Section ID Reference

All code sections are tagged with unique IDs for traceability and maintenance.

### Firebase Module (`js/firebase.js`)

| ID     | Section                 | Description                           |
| ------ | ----------------------- | ------------------------------------- |
| FB-001 | Firebase Configuration  | Firebase project config and constants |
| FB-002 | Firebase Initialization | App, Auth, Firestore, Functions init  |
| FB-003 | Auth Utilities          | User authentication helpers           |
| FB-004 | Firestore Utilities     | Database read/write helpers           |
| FB-005 | Role Management         | User role determination               |
| FB-006 | Error Handling          | Custom error classes and messages     |

### Portal UI Components (`js/portal.js`)

| ID     | Section                 | Description                    |
| ------ | ----------------------- | ------------------------------ |
| UI-001 | Toast Notifications     | Success/error/warning toasts   |
| UI-002 | Loading States          | Spinners and loading overlays  |
| UI-003 | Modal System            | Dialog boxes and confirmations |
| UI-004 | Navigation & Sidebar    | Portal navigation management   |
| UI-005 | Role-Based UI           | Show/hide based on user role   |
| UI-006 | Form Utilities          | Validation, serialization      |
| UI-007 | Table Utilities         | Data table generation          |
| UI-008 | Date & Format Utilities | Formatting helpers             |
| UI-009 | Error Handling UI       | Error display components       |
| UI-010 | Keyboard Shortcuts      | Ctrl+D diagnostics, etc.       |

### Diagnostics System (`js/diagnostics.js`)

| ID       | Section                 | Description                    |
| -------- | ----------------------- | ------------------------------ |
| DIAG-001 | Core Diagnostics Engine | Test orchestration             |
| DIAG-002 | Firebase Tests          | SDK loading, config validation |
| DIAG-003 | Authentication Tests    | Auth state verification        |
| DIAG-004 | Firestore Tests         | Database connectivity          |
| DIAG-005 | UI Component Tests      | DOM structure validation       |
| DIAG-006 | Performance Tests       | Page load, memory usage        |
| DIAG-007 | Network Tests           | Online status, CDN access      |
| DIAG-008 | Security Tests          | HTTPS, XSS prevention          |
| DIAG-009 | Reporting Engine        | Report formatting              |
| DIAG-010 | Auto-Healing            | Self-repair capabilities       |

### MCP Server (`mcp/server.js`)

| ID      | Section              | Description           |
| ------- | -------------------- | --------------------- |
| MCP-001 | Server Configuration | Port, paths, logging  |
| MCP-002 | Tool Definitions     | Available MCP tools   |
| MCP-003 | Diagnostic Tools     | System diagnostics    |
| MCP-004 | Database Tools       | Schema validation     |
| MCP-005 | Code Integrity Tools | Checksum verification |
| MCP-006 | Context Management   | Focus area tracking   |
| MCP-007 | Health Monitoring    | System health checks  |
| MCP-008 | Knowledge Management | Persistent memory     |

### Firebase Functions (`functions/index.js`)

| ID     | Section         | Description           |
| ------ | --------------- | --------------------- |
| FN-001 | Stripe Checkout | createCheckoutSession |
| FN-002 | Stripe Webhook  | Payment confirmation  |
| FN-003 | Payment Links   | createPaymentLink     |

---

## Module Documentation

### js/firebase.js - Firebase Module

**Purpose:** Centralized Firebase configuration and utilities

**Exports:**

```javascript
import {
  FIREBASE_CONFIG, // Firebase project config
  FALLBACK_ADMIN_EMAILS, // Hardcoded admin emails
  initFirebase, // Initialize Firebase services
  getCurrentUser, // Get current auth user
  signOutUser, // Sign out
  onAuthChange, // Auth state listener
  getUserData, // Get user from Firestore
  getSettings, // Get settings document
  saveSettings, // Save settings document
  queryCollection, // Query Firestore
  getUserRole, // Determine user role
  isStaff, // Check if admin/employee
  isAdmin, // Check if admin
  FirebaseError, // Custom error class
  getErrorMessage, // User-friendly error messages
} from "./firebase.js";
```

**Usage:**

```javascript
const { auth, db } = await initFirebase();

onAuthChange((user, userData, role) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  console.log(`Logged in as ${role}: ${user.email}`);
});
```

---

### js/portal.js - Portal UI Components

**Purpose:** Shared UI components and utilities

**Global Object:** `window.MA3PL`

**Usage:**

```javascript
// Toast notifications
MA3PL.toast.success("Saved successfully!");
MA3PL.toast.error("Something went wrong");
MA3PL.toast.warning("Please check your input");

// Loading states
MA3PL.loading.showFullScreen("Loading data...");
MA3PL.loading.hideFullScreen();
MA3PL.loading.setButtonLoading(button, true);

// Modals
const confirmed = await MA3PL.modal.confirm("Delete this item?");
if (confirmed) {
  /* delete */
}

// Role-based UI
MA3PL.roleUI.setRole("admin");
MA3PL.nav.showRoleNavigation("admin");

// Formatting
MA3PL.FormatUtils.currency(150.0); // "$150.00"
MA3PL.FormatUtils.date("2024-01-15"); // "Jan 15, 2024"
MA3PL.FormatUtils.relativeTime(date); // "2h ago"

// Forms
const { isValid, errors } = MA3PL.FormUtils.validate(form);
const data = MA3PL.FormUtils.serialize(form);
```

---

### js/diagnostics.js - Self-Diagnostics

**Purpose:** Comprehensive self-testing and monitoring

**Usage:**

```javascript
// Run full diagnostics (also available via Ctrl+D)
const report = await window.runDiagnostics();
console.log(report.summary.status); // "HEALTHY" or "ISSUES_FOUND"

// Programmatic access
import { diagnostics, ReportingEngine } from "./diagnostics.js";

diagnostics.addListener((event, data) => {
  console.log(`Diagnostic event: ${event}`, data);
});

const report = await diagnostics.runFullDiagnostics();
console.log(ReportingEngine.formatReport(report));
```

**Test Suites:**

- Firebase (SDK loading, config)
- Authentication (service, state, persistence)
- Firestore (connection, read access, schema)
- UI (DOM structure, CSS, accessibility, responsive)
- Performance (page load, memory, resources)
- Network (online status, CDN, connection type)
- Security (HTTPS, mixed content, XSS)

---

## MCP Server

**Purpose:** Model Context Protocol server for maintaining system state, running diagnostics, and managing context across sessions.

### Starting the Server

```bash
cd mcp
node server.js
# Server starts on port 3847
```

### Endpoints

| Method | Path      | Description          |
| ------ | --------- | -------------------- |
| GET    | `/tools`  | List available tools |
| POST   | `/run`    | Execute a tool       |
| GET    | `/health` | Quick health check   |
| GET    | `/state`  | Get system state     |

### Available Tools

**Diagnostic Tools:**

```bash
# Full diagnostics
curl -X POST http://localhost:3847/run -d '{"tool":"diagnose.full"}'

# Firebase check
curl -X POST http://localhost:3847/run -d '{"tool":"diagnose.firebase"}'

# File structure check
curl -X POST http://localhost:3847/run -d '{"tool":"diagnose.files"}'

# Code quality check
curl -X POST http://localhost:3847/run -d '{"tool":"diagnose.code"}'
```

**Integrity Tools:**

```bash
# Create integrity snapshot
curl -X POST http://localhost:3847/run -d '{"tool":"integrity.snapshot"}'

# Check for changes
curl -X POST http://localhost:3847/run -d '{"tool":"integrity.check"}'

# Show diff
curl -X POST http://localhost:3847/run -d '{"tool":"integrity.diff"}'
```

**Context Management:**

```bash
# Save current context
curl -X POST http://localhost:3847/run -d '{"tool":"context.save","params":{"name":"Feature work"}}'

# Restore context
curl -X POST http://localhost:3847/run -d '{"tool":"context.restore"}'

# Set focus area
curl -X POST http://localhost:3847/run -d '{"tool":"focus.set","params":{"area":"invoicing","priority":"high"}}'

# Get current focus
curl -X POST http://localhost:3847/run -d '{"tool":"focus.get"}'
```

**Knowledge Management:**

```bash
# Add knowledge
curl -X POST http://localhost:3847/run -d '{"tool":"knowledge.add","params":{"category":"bugs","key":"issue-123","value":"Fixed by updating X"}}'

# Query knowledge
curl -X POST http://localhost:3847/run -d '{"tool":"knowledge.query","params":{"search":"bug"}}'
```

### Persistent State

The MCP server maintains state across sessions in `mcp/state.json`:

- Diagnostic history
- Focus areas
- Saved contexts
- Knowledge base
- Session count

---

## Database Schema

### Firestore Collections

**users**

```javascript
{
  email: "user@example.com",      // Required
  role: "admin|employee|customer", // Required
  name: "John Doe",
  company_name: "Acme Inc",
  phone: "+1-555-1234",
  address: { street, city, state, zip },
  billing_cycle: "monthly|biweekly|weekly",
  created_at: "2024-01-15T..."
}
```

**shipments**

```javascript
{
  user_id: "uid123",              // Required
  tracking_number: "MA3PL12345",  // Required
  status: "pending|in_transit|delivered|cancelled",
  origin: { street, city, state, zip },
  destination: { name, street, city, state, zip },
  package: { weight, length, width, height, quantity },
  service_type: "standard|express|overnight",
  notes: "Special instructions",
  created_at: "2024-01-15T...",
  updated_at: "2024-01-15T..."
}
```

**inventory**

```javascript
{
  user_id: "uid123",              // Required
  sku: "SKU-001",                 // Required
  name: "Product Name",
  quantity: 100,
  location: "A-1-1",
  category: "Electronics",
  created_at: "2024-01-15T...",
  updated_at: "2024-01-15T..."
}
```

**invoices**

```javascript
{
  invoice_number: "INV-2024-001",  // Required
  customer_id: "uid123",           // Required
  customer_name: "Acme Inc",
  customer_email: "billing@acme.com",
  status: "draft|sent|paid|overdue",
  billing_period_start: "2024-01-01",
  billing_period_end: "2024-01-31",
  due_date: "2024-02-15",
  line_items: [{ description, quantity, unit, rate, amount }],
  subtotal: 1000.00,
  tax_rate: 0,
  tax_amount: 0,
  total: 1000.00,
  amount_paid: 0,
  paid_at: null,
  stripe_session_id: null,
  created_at: "2024-01-15T..."
}
```

**storage_snapshots**

```javascript
{
  customer_id: "uid123",
  customer_name: "Acme Inc",
  date: "2024-01-15",
  pallet_count: 25,
  container_count: 2,
  box_count: 100,
  sqft: 500,
  notes: "Monthly count",
  recorded_by: "uid456",
  created_at: "2024-01-15T..."
}
```

**billable_events**

```javascript
{
  customer_id: "uid123",
  event_type: "receiving|shipping|handling|storage",
  description: "Inbound shipment - 10 pallets",
  quantity: 10,
  unit: "pallets",
  rate: 25.00,
  total: 250.00,
  shipment_id: "shipmentId123",
  invoiced: false,
  invoice_id: null,
  created_at: "2024-01-15T...",
  created_by: "uid456"
}
```

**settings/company**

```javascript
{
  name: "Miami Alliance 3PL",
  phone: "+1-305-555-1234",
  email: "info@miamialliance3pl.com",
  website: "https://miamialliance3pl.com",
  address: "8780 NW 100th ST, Medley, FL 33178",
  updatedAt: "2024-01-15T..."
}
```

**settings/pricing**

```javascript
{
  storage: { palletDaily, palletWeekly, palletMonthly, container20ft, container40ft, ... },
  handling: { receiving, unloading, pickpack, labeling, palletizing, ... },
  additional: { kitting, returns, photo, qc, ... },
  freight: { fuelSurcharge, residentialSurcharge, ... },
  customerRates: [{ customerId, customerName, rates: {...} }],
  updatedAt: "2024-01-15T..."
}
```

**settings/stripe**

```javascript
{
  publishableKey: "pk_live_...",
  paymentTerms: 30,
  enabled: true,
  paymentReminders: true,
  updatedAt: "2024-01-15T..."
}
```

---

## Troubleshooting

### Quick Diagnostics

```javascript
// In browser console
await runDiagnostics();
```

### Common Issues

**1. Firebase not loading**

- Check internet connection
- Verify Firebase CDN is accessible
- Check browser console for errors

**2. Auth not working**

- Verify user exists in Firebase Auth
- Check Firestore rules
- Verify FALLBACK_ADMIN_EMAILS for testing

**3. Firestore permission denied**

- User must be authenticated
- Check security rules in Firebase Console
- Verify collection paths

**4. Stripe payments failing**

- Verify Stripe keys in settings
- Check Firebase Functions deployment
- Verify webhook configuration

### MCP Diagnostics

```bash
# Start MCP server
cd mcp && node server.js

# Run full diagnostics
curl -X POST http://localhost:3847/run -d '{"tool":"diagnose.full"}' | jq

# Check health
curl http://localhost:3847/health | jq

# Check integrity
curl -X POST http://localhost:3847/run -d '{"tool":"integrity.check"}' | jq
```

---

## File Structure

```
miamialliance3pl/
├── index.html              # Landing page
├── login.html              # Authentication
├── ARCHITECTURE.md         # This file
├── STRIPE_SETUP.md         # Stripe integration guide
├── CLAUDE.md               # Project instructions
│
├── portal/                    # Customer/admin portal (19 files)
│   ├── dashboard.html         # Main dashboard
│   ├── shipments.html         # Shipment creation & management
│   ├── tracking.html          # Package tracking (XSS-hardened)
│   ├── inventory.html         # Inventory management (lock re-check guard)
│   ├── billing.html           # Customer billing view
│   ├── invoices.html          # Admin invoice creation & management
│   ├── storage-log.html       # Storage snapshots (daily pallet counts)
│   ├── pricing.html           # Pricing management
│   ├── settings.html          # System settings (admin only)
│   ├── team.html              # Team invitations & management
│   ├── customers.html         # Customer list
│   ├── contracts.html         # Customer contracts
│   ├── changelog.html         # Platform changelog
│   ├── pickups.html           # Pickup scheduling
│   ├── invoice-template.html  # Invoice PDF template
│   ├── admin-panel.html       # Admin dashboard (Promise.allSettled)
│   ├── admin-shipments.html   # All shipments (admin view)
│   ├── admin-billing.html     # Billing management (admin)
│   └── admin-pickups.html     # Pickup management (admin)
│
├── js/                        # Shared JavaScript (16 modules)
│   ├── main.js                # Unified rAF scroll handler, nav, animations
│   ├── firebase.js            # Firebase config, auth, Firestore utilities
│   ├── portal.js              # UI components (toast, modal, tables)
│   ├── i18n.js                # Internationalization (EN/ES/PT-BR)
│   ├── analytics.js           # GA4 event tracking
│   ├── billing-engine.js      # Billing calculations (const/let modernized)
│   ├── quote-calculator.js    # Dynamic pricing & 3D visualization
│   ├── form-validation.js     # Client-side form validation
│   ├── chat-widget.js         # AI chat widget
│   ├── lead-capture.js        # Lead generation tracking
│   ├── column-prefs.js        # Table column preferences
│   ├── diagnostics.js         # Self-diagnostics & auto-healing
│   └── lang/                  # Translation files
│       ├── es.js              # Spanish translations
│       └── pt-br.js           # Brazilian Portuguese translations
│
├── css/
│   └── style.css           # Main stylesheet
│
├── functions/              # Firebase Functions
│   ├── index.js            # Stripe handlers
│   ├── package.json        # Dependencies
│   └── README.md           # Setup guide
│
├── mcp/                    # MCP Server
│   ├── server.js           # MCP server
│   ├── package.json        # Dependencies
│   ├── state.json          # Persistent state
│   ├── checksums.json      # Integrity hashes
│   └── mcp.log             # Server logs
│
└── admin/                  # CLI tools
    ├── manage_users.py
    ├── export_data.py
    ├── update_pricing.py
    └── README.md
```

---

## Version History

| Version | Date    | Changes                                                |
| ------- | ------- | ------------------------------------------------------ |
| 3.3.0   | 2026-03 | REMIX cycles: XSS hardening, rAF scroll, var→const/let |
| 3.2.0   | 2026-03 | Brazilian Portuguese (PT-BR) full translation          |
| 3.1.0   | 2026-03 | Blog system (76 articles), SEO optimization            |
| 3.0.0   | 2026-02 | Billing engine, admin panels, contracts, pickups       |
| 2.5.0   | 2026-01 | i18n system (EN/ES), quote calculator, lead capture    |
| 2.0.0   | 2025-12 | Added MCP server, diagnostics, shared modules          |
| 1.5.0   | 2025-12 | Added Stripe integration, invoicing                    |
| 1.0.0   | 2025-11 | Initial release                                        |

---

## Claude Code Notes

When working on this codebase:

1. **Use Section IDs** - Reference IDs in commit messages (e.g., "Fix FB-003 auth flow")
2. **Run diagnostics** - Use Ctrl+D in browser or MCP server
3. **Create integrity snapshots** - Before major changes
4. **Save context** - Use MCP context.save before switching tasks
5. **Check focus** - Use focus.get to remember current work area

### Quick Commands

```bash
# Start MCP server
cd mcp && node server.js

# Run diagnostics
curl -X POST localhost:3847/run -d '{"tool":"diagnose.full"}'

# Save context before switching
curl -X POST localhost:3847/run -d '{"tool":"context.save","params":{"name":"Current work"}}'

# Create integrity snapshot
curl -X POST localhost:3847/run -d '{"tool":"integrity.snapshot"}'
```
