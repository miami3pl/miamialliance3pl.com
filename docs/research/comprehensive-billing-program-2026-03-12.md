# Comprehensive Billing Program

Date: 2026-03-12

## Goal

Create one reliable billing workflow that:

- Uses the shipment quote as the pricing baseline.
- Lets admins override billing per shipment and per customer.
- Prevents double billing between shipments, activity logs, storage snapshots, and legacy billable events.
- Produces invoice drafts from all relevant unbilled sources.

## Canonical Billing Flow

1. Customer creates a shipment in `portal/shipments.html`.
2. The shipment stores its `quote_estimate` and starts with `billing_status = pending`.
3. Admin reviews shipment charges in `portal/admin-billing.html`.
4. Admin can override line rates or exact line amounts per shipment.
5. Shipment billing is synced into `activity_log` without duplicates.
6. Invoice drafts are generated from:
   - Unbilled `activity_log` entries
   - Unbilled `storage_snapshots`
   - Unbilled legacy `billable_events` without shipment linkage
   - Pending shipments that have not already been synced
7. When an invoice is created, related shipment/activity/event records are marked invoiced.

## Pricing Rules

- Shipment quote totals are the default baseline.
- Customer-specific rates from `settings/pricing.customerRates` are used when the shipment has no stored quote amount for a line or when admin chooses to override via rate.
- Admin overrides are stored on the shipment as:
  - `billing_override`: legacy per-line rate map
  - `billing_override_detail`: structured per-line overrides with `rate`, `amount`, and future note support

## Sync Rules

- Syncing a shipment deletes only existing unbilled `activity_log` rows for that shipment and recreates them from the latest override state.
- Invoiced shipment rows are locked from resync.
- Shipment-linked `billable_events` are marked invoiced when the shipment is invoiced through the comprehensive invoice flow.

## Pages Updated

- `portal/admin-billing.html`
  - Shipment review now supports exact amount overrides.
  - Synced shipments can be resynced after override changes.
  - Invoice generation now pulls all billing sources.

- `portal/invoices.html`
  - Create Invoice now uses the same multi-source draft logic as admin billing.

- `portal/shipments.html`
  - New shipments now start with explicit billing metadata.

- `js/billing-engine.js`
  - Shared billing math, rate resolution, shipment charge derivation, and invoice grouping.
