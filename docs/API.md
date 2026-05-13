# Miami Alliance 3PL - API Reference

Complete API documentation for all Cloud Functions and integrations.

---

## Table of Contents

1. [Payment Functions](#payment-functions)
2. [Notification Functions](#notification-functions)
3. [AI Chatbot Functions](#ai-chatbot-functions)
4. [Proactive Engagement Functions](#proactive-engagement-functions)
5. [Analytics Functions](#analytics-functions)
6. [Platform Integration Functions](#platform-integration-functions)
7. [Maintenance Functions](#maintenance-functions)

---

## Payment Functions

### createCheckoutSession

Creates a Stripe Checkout session for invoice payment.

**Type:** HTTPS Callable

**Authentication:** Required (customer must own invoice)

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| invoiceId | string | Yes | Firestore document ID of the invoice |
| successUrl | string | No | Redirect URL on payment success |
| cancelUrl | string | No | Redirect URL on payment cancel |

**Returns:**
```javascript
{
  sessionId: "cs_xxx",  // Stripe Checkout Session ID
  url: "https://checkout.stripe.com/..."  // Redirect URL
}
```

**Example:**
```javascript
const createCheckout = firebase.functions().httpsCallable('createCheckoutSession');
const result = await createCheckout({ invoiceId: 'INV-001' });
window.location.href = result.data.url;
```

**Errors:**
- `unauthenticated` - User not logged in
- `invalid-argument` - Missing invoiceId
- `not-found` - Invoice doesn't exist
- `permission-denied` - Not user's invoice
- `failed-precondition` - Invoice already paid

---

### stripeWebhook

Handles Stripe webhook events for payment processing.

**Type:** HTTPS Request

**Endpoint:** `https://us-central1-miamialliance3pl.cloudfunctions.net/stripeWebhook`

**Events Handled:**
- `checkout.session.completed` - Updates invoice to 'paid'

**Configuration:**
```bash
firebase functions:config:set stripe.webhook_secret="whsec_xxx"
```

---

### createPaymentLink

Creates a reusable Stripe Payment Link for an invoice.

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| invoiceId | string | Yes | Firestore document ID of the invoice |

**Returns:**
```javascript
{
  url: "https://buy.stripe.com/xxx"  // Shareable payment link
}
```

---

## Notification Functions

### onShipmentStatusChange

Firestore trigger that auto-notifies customers when shipment status changes.

**Type:** Firestore Trigger

**Trigger:** `shipments/{shipmentId}` - on update

**Notification Channels:**
- SMS (if `notification_channel` is 'sms' or 'both')
- WhatsApp (if `notification_channel` is 'whatsapp' or 'both')

**Status Templates:**
| Status | Message |
|--------|---------|
| received | "📦 Your shipment has been RECEIVED at our facility" |
| processing | "⚙️ Shipment is being PROCESSED" |
| shipped | "🚚 Shipment has SHIPPED via {carrier}" |
| out_for_delivery | "📍 Shipment is OUT FOR DELIVERY today" |
| delivered | "✅ Shipment has been DELIVERED" |
| exception | "⚠️ Delivery EXCEPTION - please contact us" |

---

### sendShipmentNotification

Manually trigger a notification for a shipment.

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| shipmentId | string | Yes | Firestore document ID |
| channel | string | No | 'sms', 'whatsapp', or 'both' |

---

### testWhatsApp

Send a test WhatsApp message (sandbox testing).

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| to | string | Yes | Phone number (+1XXXXXXXXXX) |
| message | string | No | Custom message (default: test message) |

---

### lowInventoryAlert

Scheduled function that sends daily low stock alerts.

**Type:** Scheduled (PubSub)

**Schedule:** Every day at 9:00 AM Eastern

**Configuration:**
Alerts sent when `quantity < reorder_point` in inventory collection.

---

## AI Chatbot Functions

### whatsappWebhookEnhanced

Full-featured WhatsApp chatbot with Claude AI.

**Type:** HTTPS Request

**Endpoint:** `https://us-central1-miamialliance3pl.cloudfunctions.net/whatsappWebhookEnhanced`

**Twilio Configuration:**
Set this as the webhook URL in Twilio Console > Messaging > WhatsApp Sandbox.

**Features:**
- 16+ MCP tools for agentic responses
- Sentiment detection and auto-escalation
- Multi-language support (English/Spanish)
- Conversation memory and context
- VIP customer recognition
- FAQ search integration

**MCP Tools Available:**
| Tool | Description |
|------|-------------|
| lookup_shipment | Track shipment by number or phone |
| check_inventory | Check stock levels by SKU |
| calculate_quote | Dynamic pricing calculator |
| lookup_invoice | Invoice status and payment links |
| schedule_pickup | Book pickups |
| escalate_to_human | Handoff to support team |
| create_shipment | Create new orders |
| get_shipping_rates | Multi-carrier rate shopping |
| send_document | Send invoices, BOLs, labels |
| update_preferences | Notification settings |
| get_business_hours | Hours and next open time |
| file_claim | Damage/loss claims |
| reorder_inventory | Restock requests |
| modify_order | Update address, cancel, expedite |
| search_faq | Knowledge base lookup |

---

### portalChatWebhook

AI chat endpoint for the web portal widget.

**Type:** HTTPS Request (POST)

**Endpoint:** `https://us-central1-miamialliance3pl.cloudfunctions.net/portalChatWebhook`

**CORS:** Enabled for all origins

**Request Body:**
```javascript
{
  message: "string",      // User's message
  sessionId: "string",    // Unique session identifier
  userId: "string|null",  // Firebase UID if logged in
  history: [              // Last 10 messages for context
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ]
}
```

**Response:**
```javascript
{
  response: "string",     // AI's response
  sessionId: "string"     // Session ID for continuity
}
```

---

### testChatbot

Run the AI chatbot test suite.

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Returns:**
```javascript
{
  passed: 12,
  failed: 0,
  total: 12,
  results: [...]
}
```

---

## Proactive Engagement Functions

### proactiveFollowUp

Follow up on recently resolved issues.

**Type:** Scheduled (PubSub)

**Schedule:** Every day at 10:00 AM Eastern

**Behavior:**
Sends follow-up message to customers with resolved escalations from the past 24 hours.

---

### deliveryPredictionAlert

Notify customers about upcoming deliveries.

**Type:** Scheduled (PubSub)

**Schedule:** Every 2 hours

**Behavior:**
Sends "Your package arrives tomorrow!" for shipments with estimated delivery next day.

---

### abandonedQuoteFollowUp

Re-engage prospects who requested quotes but didn't proceed.

**Type:** Scheduled (PubSub)

**Schedule:** Every day at 2:00 PM Eastern

---

### requestFeedback

Ask for customer satisfaction ratings after conversations.

**Type:** Scheduled (PubSub)

**Schedule:** Every 30 minutes

---

### weeklyCustomerSummary

Send weekly activity digest to active customers.

**Type:** Scheduled (PubSub)

**Schedule:** Every Monday at 9:00 AM Eastern

---

## Analytics Functions

### getDashboardStats

Get real-time metrics for admin dashboard.

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Returns:**
```javascript
{
  conversations_today: 45,
  unique_customers: 32,
  open_escalations: 3,
  shipments_today: 18,
  avg_satisfaction: 4.7
}
```

---

### getChatbotMetrics

Get detailed AI chatbot analytics.

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Returns:**
```javascript
{
  total_conversations: 1250,
  avg_response_time_ms: 850,
  tool_usage: {
    lookup_shipment: 423,
    check_inventory: 198,
    ...
  },
  sentiment_breakdown: {
    positive: 720,
    neutral: 480,
    negative: 50
  }
}
```

---

### getCustomerHealth

Calculate customer health score.

**Type:** HTTPS Callable

**Authentication:** Required

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| customerId | string | Yes | Customer's Firebase UID |

**Returns:**
```javascript
{
  score: 85,              // 0-100
  label: "Healthy",       // Healthy, At Risk, Critical
  shipments_30d: 12,
  open_escalations: 0,
  avg_feedback: 4.8
}
```

---

### exportAnalytics

Export chat logs and analytics data.

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| format | string | No | 'csv' or 'json' (default: 'json') |
| startDate | string | No | ISO date string |
| endDate | string | No | ISO date string |

---

## Platform Integration Functions

### shopifyOrderCreated

Webhook handler for Shopify order creation.

**Type:** HTTPS Request (POST)

**Endpoint:** `https://us-central1-miamialliance3pl.cloudfunctions.net/shopifyOrderCreated`

**Shopify Configuration:**
1. Go to Shopify Admin > Settings > Notifications > Webhooks
2. Add webhook for "Order creation"
3. Set URL to the endpoint above
4. Format: JSON

**Behavior:**
- Creates shipment in Firestore
- Generates tracking number (MA3PL-XXXXX)
- Sends WhatsApp notification to customer

---

### woocommerceOrderCreated

Webhook handler for WooCommerce order creation.

**Type:** HTTPS Request (POST)

**Endpoint:** `https://us-central1-miamialliance3pl.cloudfunctions.net/woocommerceOrderCreated`

**WooCommerce Configuration:**
1. Go to WooCommerce > Settings > Advanced > Webhooks
2. Add webhook for "Order created"
3. Set Delivery URL to the endpoint above
4. Secret: Store in Firebase config

---

### slackCommand

Handle Slack slash commands.

**Type:** HTTPS Request (POST)

**Endpoint:** `https://us-central1-miamialliance3pl.cloudfunctions.net/slackCommand`

**Commands:**
| Command | Description |
|---------|-------------|
| `/ma3pl track MA3PL-XXX` | Get shipment status |
| `/ma3pl help` | Show available commands |

**Slack Configuration:**
1. Create Slack App at api.slack.com
2. Add Slash Command: `/ma3pl`
3. Request URL: endpoint above

---

### onEscalationCreated

Auto-post new escalations to Slack.

**Type:** Firestore Trigger

**Trigger:** `escalations/{escalationId}` - on create

**Configuration:**
```bash
firebase functions:config:set slack.operations="https://hooks.slack.com/..."
```

---

### syncCarrierTracking

Sync tracking status from UPS/FedEx/USPS APIs.

**Type:** Scheduled (PubSub)

**Schedule:** Every 15 minutes

---

## Maintenance Functions

### resolveEscalation

Mark an escalation as resolved.

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| escalationId | string | Yes | Firestore document ID |
| resolution | string | No | Resolution notes |

---

### sendBulkMessage

Send campaign messages to multiple customers.

**Type:** HTTPS Callable

**Authentication:** Required (admin only)

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| audience | string | Yes | 'all', 'vip', or 'active' |
| message | string | Yes | Message content |
| channel | string | No | 'whatsapp' or 'sms' |

---

### autoDetectVIPs

Auto-upgrade loyal customers to VIP status.

**Type:** Scheduled (PubSub)

**Schedule:** Every Sunday at 11:00 PM Eastern

**Criteria:**
- 10+ shipments in last 90 days
- Average feedback score >= 4.5
- No open escalations

---

### pruneConversations

Clean up old conversation data.

**Type:** Scheduled (PubSub)

**Schedule:** Every day at 4:00 AM Eastern

**Behavior:**
Removes conversation history older than 30 days (configurable).

---

### inventoryForecast

Generate predictive inventory alerts.

**Type:** Scheduled (PubSub)

**Schedule:** Daily

**Behavior:**
Analyzes order velocity and predicts stockouts. Sends alerts for items predicted to run out within 7 days.

---

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | Customer profiles and roles |
| `shipments` | Shipment records and tracking |
| `invoices` | Billing and payment records |
| `inventory` | Stock levels and SKUs |
| `conversations` | Chat history per phone number |
| `chat_logs` | All AI conversation logs |
| `tool_usage` | MCP tool call analytics |
| `escalations` | Human handoff tickets |
| `feedback` | Customer satisfaction ratings |
| `campaigns` | Bulk message campaigns |
| `portal_chats` | Web portal chat logs |
| `media_uploads` | WhatsApp photos/documents |

---

## Error Codes

| Code | Description |
|------|-------------|
| `unauthenticated` | User not logged in |
| `permission-denied` | Insufficient permissions |
| `not-found` | Resource doesn't exist |
| `invalid-argument` | Missing or invalid parameter |
| `failed-precondition` | Operation not allowed in current state |
| `internal` | Server error |

---

## Rate Limits

| Service | Limit |
|---------|-------|
| Cloud Functions | 1000 req/sec |
| Twilio SMS | Varies by account |
| Claude API | Varies by plan |
| Stripe | 100 req/sec |

---

*Last Updated: December 27, 2024*
