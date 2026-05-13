# Miami Alliance 3PL - Developer Setup Guide

Complete guide for setting up the development environment and deploying the Miami Alliance 3PL platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Firebase Setup](#firebase-setup)
4. [Local Development](#local-development)
5. [Third-Party Integrations](#third-party-integrations)
6. [Deployment](#deployment)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

```bash
# Node.js 20+ (required for Cloud Functions)
node --version  # Should be 20.x or higher

# Firebase CLI
npm install -g firebase-tools
firebase --version  # Should be 13.x or higher

# Git
git --version
```

### Accounts Required

- [Firebase Console](https://console.firebase.google.com) - Backend services
- [Stripe Dashboard](https://dashboard.stripe.com) - Payment processing
- [Twilio Console](https://console.twilio.com) - SMS/WhatsApp
- [Anthropic Console](https://console.anthropic.com) - Claude AI API
- [Slack API](https://api.slack.com) - Team integrations (optional)
- [Shopify Partners](https://partners.shopify.com) - E-commerce integration (optional)

---

## Project Structure

```
miamialliance3pl/
├── index.html              # Landing page
├── services.html           # Services page
├── about.html              # About page
├── contact.html            # Contact form
├── login.html              # Customer login
├── quote.html              # 3D instant quote tool
├── portal/                 # Customer portal
│   ├── dashboard.html
│   ├── shipments.html
│   ├── tracking.html
│   ├── inventory.html
│   └── billing.html
├── admin/                  # Admin pages
│   ├── ai-dashboard.html   # AI Command Center
│   └── ...
├── css/
│   └── style.css           # Main stylesheet
├── js/
│   ├── main.js             # Navigation & utilities
│   ├── chat-widget.js      # Embeddable AI chat
│   ├── quote-3d.js         # Three.js quote tool
│   └── quote-calculator.js # Pricing logic
├── functions/              # Firebase Cloud Functions
│   ├── index.js            # All cloud functions
│   └── package.json        # Dependencies
├── docs/                   # Documentation
│   ├── API.md              # API reference
│   └── SETUP.md            # This file
├── firebase.json           # Firebase configuration
├── .firebaserc             # Firebase project config
├── PROGRESS.md             # Development progress
└── README.md               # Project readme
```

---

## Firebase Setup

### 1. Create Firebase Project

```bash
# Login to Firebase
firebase login

# Create new project (or use existing)
firebase projects:create miamialliance3pl

# Initialize Firebase in project directory
firebase init

# Select:
# - Firestore
# - Functions
# - Hosting
```

### 2. Configure Firestore

Create the following collections in Firebase Console > Firestore:

| Collection | Description |
|------------|-------------|
| users | Customer profiles |
| shipments | Shipment records |
| invoices | Billing records |
| inventory | Stock items |
| conversations | Chat history |
| chat_logs | AI conversation logs |
| escalations | Support tickets |
| feedback | Customer ratings |

### 3. Set Firestore Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Shipments - customers see their own, admins see all
    match /shipments/{shipmentId} {
      allow read: if request.auth != null &&
        (resource.data.customer_id == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow write: if request.auth != null &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Invoices - same pattern
    match /invoices/{invoiceId} {
      allow read: if request.auth != null &&
        (resource.data.customer_id == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    // Admin-only collections
    match /chat_logs/{logId} {
      allow read, write: if request.auth != null &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 4. Enable Authentication

1. Go to Firebase Console > Authentication
2. Click "Sign-in method"
3. Enable "Email/Password"

### 5. Set Firebase Config in Frontend

Update all HTML files with your Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "miamialliance3pl.firebaseapp.com",
    projectId: "miamialliance3pl",
    storageBucket: "miamialliance3pl.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

---

## Third-Party Integrations

### Stripe (Payments)

```bash
# Set Stripe API keys
firebase functions:config:set stripe.secret="sk_live_YOUR_KEY"
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_SECRET"

# Configure webhook in Stripe Dashboard:
# Endpoint: https://us-central1-miamialliance3pl.cloudfunctions.net/stripeWebhook
# Events: checkout.session.completed
```

### Twilio (SMS/WhatsApp)

```bash
# Set Twilio credentials
firebase functions:config:set twilio.account_sid="ACxxx"
firebase functions:config:set twilio.auth_token="xxx"
firebase functions:config:set twilio.phone_number="+13056970028"
firebase functions:config:set twilio.whatsapp_number="whatsapp:+14155238886"

# For WhatsApp Sandbox testing:
# 1. Go to Twilio Console > Messaging > Try it Out > WhatsApp Sandbox
# 2. Set webhook URL: https://us-central1-miamialliance3pl.cloudfunctions.net/whatsappWebhookEnhanced
# 3. Have users text "join shade-slave" to +14155238886
```

### Anthropic (Claude AI)

```bash
# Set Claude API key
firebase functions:config:set anthropic.api_key="sk-ant-api03-xxx"

# Admin phone for escalation notifications
firebase functions:config:set admin.phone="+13055041323"
```

### Slack (Optional)

```bash
# Set Slack webhook URLs
firebase functions:config:set slack.operations="https://hooks.slack.com/services/xxx"
firebase functions:config:set slack.alerts="https://hooks.slack.com/services/xxx"

# Configure Slack App:
# 1. Create app at api.slack.com
# 2. Add Slash Command: /ma3pl
# 3. Request URL: https://us-central1-miamialliance3pl.cloudfunctions.net/slackCommand
```

### Shopify (Optional)

Configure webhook in Shopify Admin:
- Event: Order creation
- URL: `https://us-central1-miamialliance3pl.cloudfunctions.net/shopifyOrderCreated`
- Format: JSON

---

## Local Development

### Install Dependencies

```bash
# Install function dependencies
cd functions
npm install

# Return to root
cd ..
```

### Run Firebase Emulators

```bash
# Start emulators for local testing
firebase emulators:start

# Emulator UI: http://localhost:4000
# Functions: http://localhost:5001
# Firestore: http://localhost:8080
```

### Test Functions Locally

```bash
# In functions directory
npm run shell

# Test a callable function
createCheckoutSession({ invoiceId: 'test-invoice' })
```

### View Logs

```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only whatsappWebhookEnhanced
```

---

## Deployment

### Deploy Everything

```bash
# Deploy all services
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting
```

### Deploy Specific Function

```bash
firebase deploy --only functions:whatsappWebhookEnhanced
```

### Verify Deployment

```bash
# List deployed functions
firebase functions:list

# Check function URL
# Format: https://us-central1-PROJECT_ID.cloudfunctions.net/FUNCTION_NAME
```

---

## Testing

### AI Chatbot Test Suite

```javascript
// Call from admin panel or Firebase console
const testChatbot = firebase.functions().httpsCallable('testChatbot');
const results = await testChatbot();
console.log(`Passed: ${results.data.passed}/${results.data.total}`);
```

### Manual WhatsApp Test

```bash
# Send test message via Twilio CLI
twilio api:core:messages:create \
  --from whatsapp:+14155238886 \
  --to whatsapp:+1XXXXXXXXXX \
  --body "Test message"
```

### API Endpoint Test

```bash
# Test portal chat webhook
curl -X POST https://us-central1-miamialliance3pl.cloudfunctions.net/portalChatWebhook \
  -H "Content-Type: application/json" \
  -d '{"message": "What are your hours?", "sessionId": "test-123"}'
```

---

## Troubleshooting

### Common Issues

#### Functions Not Deploying

```bash
# Check Node.js version in functions/package.json
"engines": {
  "node": "20"
}

# Clear node_modules and reinstall
cd functions
rm -rf node_modules package-lock.json
npm install
```

#### WhatsApp Messages Not Received

1. Verify Twilio webhook URL is correct
2. Check function logs: `firebase functions:log --only whatsappWebhookEnhanced`
3. Verify user has joined sandbox: "join shade-slave" to +14155238886

#### Claude AI Not Responding

1. Verify API key is set: `firebase functions:config:get anthropic`
2. Check for API errors in logs
3. Verify API key has sufficient quota

#### Payment Webhook Not Working

1. Verify Stripe webhook secret is correct
2. Check Stripe Dashboard > Developers > Webhooks for failed events
3. Verify webhook endpoint URL in Stripe

### View All Config

```bash
# View all Firebase function config
firebase functions:config:get

# Output as JSON
firebase functions:config:get > config.json
```

### Reset Config

```bash
# Unset a config value
firebase functions:config:unset stripe.secret

# Set new value
firebase functions:config:set stripe.secret="new_key"

# Redeploy functions to apply
firebase deploy --only functions
```

---

## Environment Variables

For local development, create `.runtimeconfig.json` in functions directory:

```json
{
  "stripe": {
    "secret": "sk_test_xxx",
    "webhook_secret": "whsec_xxx"
  },
  "twilio": {
    "account_sid": "ACxxx",
    "auth_token": "xxx",
    "phone_number": "+13056970028",
    "whatsapp_number": "whatsapp:+14155238886"
  },
  "anthropic": {
    "api_key": "sk-ant-api03-xxx"
  },
  "admin": {
    "phone": "+13055041323"
  }
}
```

**Note:** Never commit this file to version control!

---

## Support

- **GitHub Issues:** Report bugs and request features
- **Documentation:** See `docs/API.md` for API reference
- **Progress:** See `PROGRESS.md` for development status

---

*Last Updated: December 27, 2024*
