# Miami Alliance 3PL - Firebase Functions

Cloud Functions for Stripe payment processing.

## Setup

### Prerequisites
- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Stripe account with API keys

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Firebase

```bash
# Login to Firebase
firebase login

# Link to your project
firebase use miamialliance3pl
```

### 3. Set Stripe Keys

```bash
# Set your Stripe secret key (from Stripe Dashboard > API Keys)
firebase functions:config:set stripe.secret="sk_live_your_secret_key"

# Set webhook secret (from Stripe Dashboard > Webhooks)
firebase functions:config:set stripe.webhook_secret="whsec_your_webhook_secret"
```

### 4. Deploy Functions

```bash
firebase deploy --only functions
```

### 5. Configure Stripe Webhook

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://us-central1-miamialliance3pl.cloudfunctions.net/stripeWebhook`
3. Select events: `checkout.session.completed`
4. Copy the signing secret and set it (step 3 above)

## Available Functions

### `createCheckoutSession`
Creates a Stripe Checkout session for invoice payment.

**Callable from client:**
```javascript
const functions = firebase.functions();
const createCheckout = functions.httpsCallable('createCheckoutSession');
const result = await createCheckout({ invoiceId: 'invoice_id_here' });
window.location.href = result.data.url;
```

### `stripeWebhook`
HTTP endpoint that receives Stripe webhook events. Automatically marks invoices as paid when payment succeeds.

### `createPaymentLink`
Creates a reusable Stripe Payment Link for an invoice (admin only).

## Local Testing

```bash
# Start emulator
npm run serve

# In another terminal, test with Stripe CLI
stripe listen --forward-to localhost:5001/miamialliance3pl/us-central1/stripeWebhook
```

## Environment Variables

For local development, create `.env` file:

```
STRIPE_SECRET_KEY=sk_test_xxx
```

## Troubleshooting

**"Functions not deployed"**
- Make sure you're logged in: `firebase login`
- Check project: `firebase use`

**"Payment not updating invoice"**
- Check webhook is configured in Stripe Dashboard
- Verify webhook secret is set correctly
- Check Functions logs: `firebase functions:log`

**"Permission denied"**
- User must be authenticated
- For payment links, user must have admin role
