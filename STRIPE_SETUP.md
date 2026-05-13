# Stripe Payment Integration Setup Guide

Complete guide for setting up Stripe payments for Miami Alliance 3PL.

## Prerequisites

- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Stripe account (https://stripe.com)
- Access to Firebase project `miamialliance3pl`

---

## Step 1: Get Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers > API Keys**
3. Copy these keys (use TEST keys first, then LIVE when ready):

| Key Type | Format | Where to Use |
|----------|--------|--------------|
| Publishable Key | `pk_live_...` or `pk_test_...` | Portal Settings page |
| Secret Key | `sk_live_...` or `sk_test_...` | Firebase Functions config |

**IMPORTANT:** Never expose the Secret Key in client-side code!

---

## Step 2: Deploy Firebase Functions

### 2.1 Install Dependencies

```bash
cd /Users/yuripetrinim5/miamialliance3pl/functions
npm install
```

### 2.2 Login to Firebase

```bash
firebase login
```

### 2.3 Select the Project

```bash
firebase use miamialliance3pl
```

If project not found, add it:
```bash
firebase use --add
# Select: miamialliance3pl
```

### 2.4 Set Stripe Secret Key

```bash
# For LIVE payments:
firebase functions:config:set stripe.secret="sk_live_YOUR_SECRET_KEY"

# For TEST payments:
firebase functions:config:set stripe.secret="sk_test_YOUR_SECRET_KEY"
```

### 2.5 Deploy Functions

```bash
firebase deploy --only functions
```

After deployment, note the webhook URL:
```
https://us-central1-miamialliance3pl.cloudfunctions.net/stripeWebhook
```

---

## Step 3: Configure Stripe Webhook

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter endpoint URL:
   ```
   https://us-central1-miamialliance3pl.cloudfunctions.net/stripeWebhook
   ```
4. Select events to listen to:
   - `checkout.session.completed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

### 3.1 Set Webhook Secret in Firebase

```bash
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

### 3.2 Redeploy Functions

```bash
firebase deploy --only functions
```

---

## Step 4: Configure Portal Settings

1. Login to portal as admin: https://megalopolisms.github.io/miamialliance3pl/portal/dashboard.html
2. Go to **Settings** (Admin section)
3. Scroll to **Payment Settings (Stripe)**
4. Enter:
   - **Stripe Publishable Key:** `pk_live_...` or `pk_test_...`
   - **Payment Terms:** 30 (days)
   - Toggle **Enable Online Payments:** ON
   - Toggle **Auto-send Payment Reminders:** ON (optional)
5. Click **Save Payment Settings**

---

## Step 5: Test the Integration

### 5.1 Create a Test Invoice

1. Go to **Invoices** (Admin section)
2. Click **Create Invoice**
3. Select a customer
4. Add line items
5. Click **Create Invoice**
6. Click **Send** to mark as sent

### 5.2 Test Customer Payment

1. Login as the customer
2. Go to **Billing**
3. Click **Pay** on the invoice
4. Select **Credit Card**
5. Click **Pay $XX.XX**
6. Complete Stripe Checkout

### 5.3 Stripe Test Cards

Use these test card numbers:

| Card | Number | Result |
|------|--------|--------|
| Visa | `4242 4242 4242 4242` | Success |
| Visa (decline) | `4000 0000 0000 0002` | Declined |
| 3D Secure | `4000 0025 0000 3155` | Requires authentication |

- Use any future expiry date (e.g., 12/34)
- Use any 3-digit CVC
- Use any billing ZIP

---

## Troubleshooting

### "Functions not deployed"

```bash
# Check login status
firebase login

# Check current project
firebase use

# View deployment logs
firebase functions:log
```

### "Payment not updating invoice"

1. Check webhook is configured in Stripe Dashboard
2. Verify webhook secret is set correctly:
   ```bash
   firebase functions:config:get stripe
   ```
3. Check Functions logs:
   ```bash
   firebase functions:log --only stripeWebhook
   ```

### "CORS Error" or "Permission Denied"

- User must be authenticated
- Check Firestore security rules allow invoice access

### Test Webhook Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local emulator
stripe listen --forward-to localhost:5001/miamialliance3pl/us-central1/stripeWebhook

# In another terminal, start emulator
cd functions
npm run serve
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Customer Browser                         │
│  billing.html                                                │
│  ┌─────────────────┐                                        │
│  │ Click "Pay"     │                                        │
│  └────────┬────────┘                                        │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Firebase Functions                          │
│  createCheckoutSession                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. Verify user authenticated                         │    │
│  │ 2. Get invoice from Firestore                        │    │
│  │ 3. Verify user owns invoice                          │    │
│  │ 4. Create Stripe Checkout Session                    │    │
│  │ 5. Return checkout URL                               │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Stripe Checkout                           │
│  ┌─────────────────┐                                        │
│  │ Customer enters │                                        │
│  │ card details    │                                        │
│  └────────┬────────┘                                        │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Stripe Webhook                            │
│  stripeWebhook                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. Verify signature                                  │    │
│  │ 2. Handle checkout.session.completed                 │    │
│  │ 3. Update invoice in Firestore:                      │    │
│  │    - status: 'paid'                                  │    │
│  │    - amount_paid: session.amount_total               │    │
│  │    - paid_at: timestamp                              │    │
│  │    - stripe_session_id: session.id                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `/functions/index.js` | Firebase Functions (Stripe logic) |
| `/functions/package.json` | Node.js dependencies |
| `/functions/README.md` | Quick setup reference |
| `/portal/settings.html` | Admin Stripe configuration UI |
| `/portal/billing.html` | Customer payment UI |

---

## Firestore Collections

### `settings/stripe` (Admin Config)
```javascript
{
  publishableKey: "pk_live_...",
  paymentTerms: 30,
  enabled: true,
  paymentReminders: true,
  updatedAt: "2024-01-15T..."
}
```

### `invoices/{invoiceId}` (After Payment)
```javascript
{
  // ... existing invoice fields ...
  status: "paid",
  amount_paid: 150.00,
  paid_at: "2024-01-15T...",
  stripe_session_id: "cs_live_...",
  stripe_payment_intent: "pi_..."
}
```

---

## Going Live Checklist

- [ ] Replace TEST keys with LIVE keys in Stripe Dashboard
- [ ] Update Firebase config with LIVE secret key
- [ ] Create new webhook endpoint for LIVE mode
- [ ] Update Firebase config with LIVE webhook secret
- [ ] Redeploy Firebase Functions
- [ ] Update portal settings with LIVE publishable key
- [ ] Test with a real $1.00 invoice
- [ ] Verify payment appears in Stripe Dashboard
- [ ] Verify invoice marked as paid in Firestore

---

## Support

- Stripe Documentation: https://stripe.com/docs
- Firebase Functions: https://firebase.google.com/docs/functions
- Stripe Webhooks: https://stripe.com/docs/webhooks

---

## Claude Code Notes

When making changes to this integration:

1. **Never expose secret keys** - Always use Firebase Functions config
2. **Test webhook locally first** - Use Stripe CLI + Firebase emulator
3. **Check both TEST and LIVE modes** - They have separate webhook endpoints
4. **Verify signature on webhooks** - Prevents spoofed payment notifications
5. **Handle errors gracefully** - Show user-friendly messages in billing.html
6. **Log everything** - Use `console.log` in functions for debugging

### Quick Commands

```bash
# View current config
firebase functions:config:get

# View logs
firebase functions:log

# Redeploy single function
firebase deploy --only functions:createCheckoutSession

# Test locally
cd functions && npm run serve
```
