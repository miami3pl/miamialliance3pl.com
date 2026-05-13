# Miami Alliance 3PL - Implementation Plan

## Overview

This plan covers 4 major features for the 3PL portal:
1. **Invoicing System** (Priority 1 - Revenue generating)
2. **Email Notifications** (Priority 2 - Customer experience)
3. **Document Upload** (Priority 3 - Operations)
4. **Quote Request Form** (Priority 4 - Sales)

---

# FEATURE 1: INVOICING SYSTEM

## How 3PL Invoicing Works

### Billing Categories

| Category | How It's Calculated | Example |
|----------|---------------------|---------|
| **Storage** | Pallets × Days × Rate | 10 pallets × 30 days × $2.50 = $750 |
| **Receiving** | Per pallet received | 20 pallets × $15 = $300 |
| **Outbound** | Per order shipped | 50 orders × $8 = $400 |
| **Handling** | Per hour or per unit | 5 hours × $45 = $225 |
| **Value-Added** | Per service performed | 200 labels × $0.15 = $30 |
| **Surcharges** | Percentage or flat | Fuel 8% on freight |

### Storage Calculation Methods

**Method 1: Daily Snapshot (Recommended)**
- Count pallets in warehouse at end of each day
- Sum all daily counts at month end
- Multiply by daily rate

```
Example:
Day 1-10: 50 pallets = 500 pallet-days
Day 11-20: 75 pallets = 750 pallet-days
Day 21-30: 60 pallets = 600 pallet-days
Total: 1,850 pallet-days × $0.50/day = $925
```

**Method 2: Anniversary Billing**
- Bill from date pallet received until shipped
- Track in/out dates per pallet

**Method 3: Monthly Fixed**
- Bill for peak or average occupancy
- Simpler but less accurate

### Data Model

```
COLLECTIONS:

invoices/
  - id: auto
  - invoice_number: "INV-2024-001"
  - customer_id: uid
  - customer_name: string
  - billing_period_start: date
  - billing_period_end: date
  - status: "draft" | "sent" | "paid" | "overdue"
  - line_items: [
      {
        category: "storage",
        description: "Pallet Storage (30 days)",
        quantity: 1850,
        unit: "pallet-days",
        rate: 0.50,
        amount: 925.00
      },
      {
        category: "handling",
        description: "Receiving - Inbound Pallets",
        quantity: 20,
        unit: "pallets",
        rate: 15.00,
        amount: 300.00
      }
    ]
  - subtotal: number
  - tax_rate: number (0 for B2B usually)
  - tax_amount: number
  - total: number
  - notes: string
  - created_at: timestamp
  - sent_at: timestamp
  - paid_at: timestamp
  - due_date: date

storage_snapshots/
  - id: auto
  - customer_id: uid
  - date: "2024-01-15"
  - pallet_count: 50
  - container_count: 0
  - box_count: 200
  - cubic_feet: 0
  - recorded_by: "system" | uid
  - created_at: timestamp

billable_events/
  - id: auto
  - customer_id: uid
  - event_type: "receiving" | "shipping" | "handling" | "service"
  - description: string
  - quantity: number
  - unit: string
  - rate: number (from pricing or custom)
  - shipment_id: reference (optional)
  - invoiced: boolean
  - invoice_id: reference (when invoiced)
  - created_at: timestamp
  - created_by: uid
```

### UI Pages Needed

#### 1. `portal/invoices.html` (Admin)
- List all invoices with filters (status, customer, date range)
- Quick stats: Outstanding balance, overdue, paid this month
- Actions: Create, View, Send, Mark Paid

#### 2. `portal/invoice-create.html` (Admin)
- Select customer
- Select billing period
- Auto-populate from:
  - Storage snapshots (sum pallet-days)
  - Billable events (receiving, handling, services)
- Manual line item add/edit
- Preview total
- Save as draft or send

#### 3. `portal/invoice-view.html` (Admin + Customer)
- Professional invoice layout
- Print/PDF export
- Payment status
- Customer can view their invoices

#### 4. `portal/billing.html` (Customer view)
- Customer sees their invoices
- Current balance
- Payment history

#### 5. `portal/storage-log.html` (Admin)
- Daily storage snapshot entry
- View historical snapshots
- Auto-count from inventory (if tracked by pallet)

### Workflow

```
DAILY:
1. System or staff records storage snapshot
2. Staff logs billable events (receiving, shipping, services)

MONTHLY (or billing cycle):
1. Admin clicks "Generate Invoice" for customer
2. System pulls:
   - Storage snapshots → calculates pallet-days
   - Unbilled events → adds line items
   - Customer rates (custom or default)
3. Admin reviews, adjusts if needed
4. Admin sends invoice (email + in-portal)
5. Mark as paid when payment received
```

### Implementation Steps

```
Phase 1: Data Foundation
├── Create Firestore collections (invoices, storage_snapshots, billable_events)
├── Update shipment creation to auto-create billable events
├── Create storage snapshot recording UI

Phase 2: Invoice Generation
├── Create invoice list page
├── Create invoice generation wizard
├── Pull storage data + billable events
├── Apply pricing rules (default + customer-specific)
├── Calculate totals

Phase 3: Invoice Viewing
├── Create invoice detail view
├── PDF generation (html2pdf.js or similar)
├── Customer billing portal

Phase 4: Automation
├── Auto-generate draft invoices monthly
├── Email sending
├── Payment reminders
```

---

# FEATURE 2: EMAIL NOTIFICATIONS

## Notification Types

| Event | Recipient | Content |
|-------|-----------|---------|
| Shipment Created | Customer | Tracking #, details |
| Status Change | Customer | New status, location |
| Delivered | Customer | Confirmation, POD |
| Invoice Sent | Customer | Invoice #, amount, due date |
| Payment Reminder | Customer | Outstanding balance |
| New Customer Signup | Admin | Customer details |

## Implementation Options

### Option A: Firebase Extensions (Easiest)
- Install "Trigger Email" extension
- Uses SendGrid/Mailgun
- Write to `mail` collection → auto-sends

```javascript
// To send email, just write to Firestore:
await addDoc(collection(db, 'mail'), {
  to: 'customer@example.com',
  template: {
    name: 'shipment-status',
    data: {
      tracking: 'MA3PL-123456',
      status: 'In Transit',
      customerName: 'John'
    }
  }
});
```

### Option B: Firebase Functions (More Control)
- Cloud Functions trigger on Firestore changes
- Custom logic for when/what to send
- More setup but more flexible

### Email Templates Needed
1. Welcome / Account Created
2. Shipment Created
3. Shipment Status Update
4. Shipment Delivered
5. Invoice Sent
6. Payment Reminder
7. Password Reset (Firebase handles)

### Data Model Addition

```
notification_preferences/ (per user)
  - user_id: uid
  - email_shipment_created: true
  - email_status_updates: true
  - email_delivered: true
  - email_invoices: true
  - email_marketing: false

email_log/
  - id: auto
  - to: email
  - template: string
  - sent_at: timestamp
  - status: "sent" | "failed"
  - related_id: shipment/invoice id
```

---

# FEATURE 3: DOCUMENT UPLOAD

## Document Types for 3PL

| Document | Attached To | Who Uploads |
|----------|-------------|-------------|
| Bill of Lading (BOL) | Shipment | Staff on receiving |
| Proof of Delivery (POD) | Shipment | Staff/Carrier |
| Packing List | Shipment | Customer/Staff |
| Commercial Invoice | Shipment | Customer |
| Customs Forms | Shipment | Customer/Broker |
| Photos | Shipment/Inventory | Staff |
| Contracts | Customer | Admin |

## Implementation

### Storage: Firebase Storage
```
/documents
  /shipments
    /{shipment_id}
      /bol_20240115.pdf
      /pod_20240118.pdf
      /photos
        /damage_01.jpg
  /customers
    /{customer_id}
      /contract_2024.pdf
  /inventory
    /{item_id}
      /photo.jpg
```

### Data Model Addition

```
documents/
  - id: auto
  - type: "bol" | "pod" | "packing_list" | "photo" | "contract" | "other"
  - filename: string
  - storage_path: string (Firebase Storage path)
  - download_url: string
  - file_size: number
  - mime_type: string
  - related_to: "shipment" | "inventory" | "customer"
  - related_id: string
  - uploaded_by: uid
  - uploaded_at: timestamp
  - notes: string
```

### UI Components
1. Upload button on shipment detail page
2. Document list with preview/download
3. Photo gallery for inventory items
4. Drag-drop upload zone

---

# FEATURE 4: QUOTE REQUEST FORM

## Purpose
- Public form (no login required)
- Prospects request pricing
- Leads go to admin dashboard
- Convert to customer when they sign up

## Form Fields

```
Contact Info:
- Company Name *
- Contact Name *
- Email *
- Phone *

Service Needs:
- Services Needed: [ ] Storage [ ] Fulfillment [ ] Distribution [ ] Cross-dock
- Estimated Monthly Volume:
  - Pallets per month: ___
  - Orders per month: ___
  - SKU count: ___
- Product Type: [ ] General [ ] Food/Bev [ ] Hazmat [ ] Temperature-controlled
- Current Warehouse Location (if any): ___

Additional:
- How did you hear about us?
- Additional notes / special requirements
```

## Data Model

```
quote_requests/
  - id: auto
  - company_name: string
  - contact_name: string
  - email: string
  - phone: string
  - services: ["storage", "fulfillment"]
  - estimated_pallets: number
  - estimated_orders: number
  - sku_count: number
  - product_type: string
  - current_location: string
  - referral_source: string
  - notes: string
  - status: "new" | "contacted" | "quoted" | "won" | "lost"
  - assigned_to: uid (sales rep)
  - created_at: timestamp
  - updated_at: timestamp
  - follow_up_notes: string
```

## Pages Needed

1. `quote.html` (Public - no auth)
   - Clean form with company branding
   - Success message after submission

2. `portal/leads.html` (Admin only)
   - List all quote requests
   - Filter by status
   - Assign to team member
   - Add notes, update status
   - Convert to customer (create invite)

---

# IMPLEMENTATION PRIORITY

## Phase 1: Invoicing Foundation (Week 1)
- [ ] Create storage_snapshots collection + UI
- [ ] Create billable_events collection
- [ ] Auto-log events on shipment create/update
- [ ] Basic invoice list page

## Phase 2: Invoice Generation (Week 2)
- [ ] Invoice creation wizard
- [ ] Pull data + calculate totals
- [ ] Invoice detail view
- [ ] PDF export

## Phase 3: Documents (Week 3)
- [ ] Firebase Storage setup
- [ ] Upload component
- [ ] Document list on shipment page
- [ ] Photo gallery

## Phase 4: Notifications (Week 4)
- [ ] Firebase Extension setup
- [ ] Email templates
- [ ] Notification preferences
- [ ] Trigger on status changes

## Phase 5: Quote Form (Week 5)
- [ ] Public quote form page
- [ ] Admin leads dashboard
- [ ] Lead management workflow

---

# TECHNICAL NOTES

## Firebase Storage Setup
1. Enable Storage in Firebase Console
2. Set security rules for authenticated uploads
3. Use signed URLs for downloads

## PDF Generation Options
1. **html2pdf.js** - Client-side, simple
2. **jsPDF** - More control, client-side
3. **Firebase Functions + Puppeteer** - Server-side, best quality

## Email Service Options
1. **SendGrid** - Best deliverability, free tier 100/day
2. **Mailgun** - Good API, free tier
3. **Firebase Extension** - Easiest integration

---

# QUESTIONS TO RESOLVE

1. **Billing Cycle**: Monthly? Bi-weekly? Per customer setting?
2. **Payment Methods**: Invoice only? Or integrate Stripe?
3. **Tax Handling**: Collect sales tax? Which states?
4. **Storage Counting**: Daily snapshot or real-time from inventory?
5. **Document Retention**: How long to keep documents?
