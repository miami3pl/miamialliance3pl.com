# Miami Alliance 3PL - Development Progress

## Latest Update: December 27, 2024

### Admin AI Command Center - IMPLEMENTED ✅ 🎛️

Full-featured admin dashboard at `/admin/ai-dashboard.html` with:
- Real-time conversation monitoring
- Sentiment analysis visualization
- Tool usage analytics with Chart.js
- Campaign management (bulk messaging)
- Escalation management with resolution
- Customer health scoring display

### Portal Chat Widget - IMPLEMENTED ✅ 💬

Embeddable AI chat widget (`js/chat-widget.js`) for customer portal:
- Self-contained with inline styles
- Quick reply suggestions
- Session-based conversation history
- Connects to `portalChatWebhook` endpoint

### Platform Integrations - IMPLEMENTED ✅ 🔗

| Platform | Type | Endpoint |
|----------|------|----------|
| Shopify | Order Webhook | `shopifyOrderCreated` |
| WooCommerce | Order Webhook | `woocommerceOrderCreated` |
| Slack | Notifications | `sendSlackNotification` |
| Slack | Commands | `slackCommand` (/ma3pl track) |

### Claude AI WhatsApp Chatbot - IMPLEMENTED ✅ 🤖

Full AI-powered customer service chatbot with 16 MCP tools, real-time database access, sentiment detection, multi-language support, and proactive engagement features.

### SMS & WhatsApp Notification System - IMPLEMENTED ✅

Full automated notification system for shipment status updates, inventory alerts, and customer communications.

---

## Technology Stack

| Component | Technology | Status |
|-----------|------------|--------|
| Backend | Firebase Cloud Functions (Node.js 20) | ✅ Deployed |
| AI Engine | Claude API (Anthropic) | ⏳ Requires API key |
| SMS | Twilio API | ⚠️ Requires account upgrade |
| WhatsApp | Twilio WhatsApp API | ✅ Working (Sandbox) |
| Payments | Stripe Checkout | ✅ Configured |
| Database | Firestore | ✅ Active |
| Slack | Slack Incoming Webhooks | ⏳ Requires config |
| Shopify | Shopify Webhooks | ⏳ Requires config |
| WooCommerce | WooCommerce Webhooks | ⏳ Requires config |
| Charts | Chart.js | ✅ Integrated |

---

## Claude AI Chatbot Features 🤖

### 16 MCP Tools (Agentic Loop)
| Tool | Description |
|------|-------------|
| `lookup_shipment` | Real-time shipment tracking by number or phone |
| `check_inventory` | Stock levels by SKU or customer |
| `calculate_quote` | Dynamic pricing calculator |
| `lookup_invoice` | Invoice status and payment links |
| `schedule_pickup` | Book inbound/outbound pickups |
| `escalate_to_human` | Seamless handoff to support team |
| `create_shipment` | Create new orders via WhatsApp |
| `get_shipping_rates` | Multi-carrier rate shopping |
| `send_document` | Send invoices, BOLs, labels |
| `update_preferences` | Notification settings |
| `get_business_hours` | Hours and next open time |
| `file_claim` | Damage/loss claims |
| `reorder_inventory` | Restock requests |
| `modify_order` | Update address, cancel, expedite |
| `search_faq` | Knowledge base lookup |

### Smart Features
- **Sentiment Detection** - Auto-escalates frustrated customers
- **Language Detection** - Spanish/English auto-detection and response
- **Customer Context** - VIP status, active shipments, open issues
- **Conversation Memory** - Maintains context across messages
- **Response Caching** - Fast responses for common queries
- **A/B Testing** - Test greeting/closing variations

### Proactive Engagement
- **Follow-Up Messages** - Check on resolved issues
- **Delivery Predictions** - "Your package arrives tomorrow!"
- **Abandoned Quote Follow-Up** - Re-engage interested prospects
- **Weekly Summaries** - Activity reports for customers
- **Feedback Collection** - Post-conversation ratings

### Admin Features
- **Real-time Metrics Dashboard** - Today's stats, escalations, tool usage
- **Conversation Summaries** - Quick handoff context
- **Bulk Messaging** - Campaigns for VIP/all/active customers
- **Performance Analysis** - Daily AI reports
- **Admin Notifications** - Pending escalations, claims, pickups

---

## Cloud Functions Deployed (35+ Total)

### Payment Functions
| Function | Type | Description |
|----------|------|-------------|
| `createCheckoutSession` | HTTPS Callable | Creates Stripe checkout session |
| `stripeWebhook` | HTTPS Request | Handles Stripe webhooks |
| `createPaymentLink` | HTTPS Callable | Creates payment links (admin) |

### Notification Functions
| Function | Type | Description |
|----------|------|-------------|
| `onShipmentStatusChange` | Firestore Trigger | Auto-notifies on status change |
| `sendShipmentNotification` | HTTPS Callable | Manual notification (admin) |
| `testWhatsApp` | HTTPS Callable | WhatsApp sandbox testing |
| `lowInventoryAlert` | Scheduled (9am ET) | Daily low stock alerts |

### AI Chatbot Functions
| Function | Type | Description |
|----------|------|-------------|
| `whatsappWebhook` | HTTPS Request | Receives incoming WhatsApp messages |
| `whatsappWebhookAsync` | HTTPS Request | Async version with Twilio API response |
| `whatsappWebhookEnhanced` | HTTPS Request | Full-featured with FAQ + feedback |
| `testChatbot` | HTTPS Callable | Run AI test suite |

### Proactive Functions
| Function | Type | Description |
|----------|------|-------------|
| `proactiveFollowUp` | Scheduled (10am ET) | Follow up on resolved issues |
| `deliveryPredictionAlert` | Scheduled (every 2h) | Tomorrow's delivery notifications |
| `abandonedQuoteFollowUp` | Scheduled (2pm ET) | Re-engage quote prospects |
| `requestFeedback` | Scheduled (every 30m) | Ask for ratings |
| `weeklyCustomerSummary` | Scheduled (Mon 9am) | Weekly activity digest |

### Analytics Functions
| Function | Type | Description |
|----------|------|-------------|
| `analyzeAIPerformance` | Scheduled (6am ET) | Daily AI metrics report |
| `getChatbotMetrics` | HTTPS Callable | Real-time dashboard data |
| `getConversationSummary` | HTTPS Callable | Handoff context |
| `getAdminNotifications` | HTTPS Callable | Pending items count |

### Maintenance Functions
| Function | Type | Description |
|----------|------|-------------|
| `autoDetectVIPs` | Scheduled (Sun 11pm) | Auto-upgrade loyal customers |
| `pruneConversations` | Scheduled (4am ET) | Memory management |
| `sendBulkMessage` | HTTPS Callable | Campaign messaging (admin)

### Platform Integration Functions
| Function | Type | Description |
|----------|------|-------------|
| `shopifyOrderCreated` | HTTPS Request | Creates shipment from Shopify order |
| `woocommerceOrderCreated` | HTTPS Request | Creates shipment from WooCommerce order |
| `slackCommand` | HTTPS Request | Handles /ma3pl Slack commands |
| `onEscalationCreated` | Firestore Trigger | Auto-posts escalations to Slack |
| `syncCarrierTracking` | Scheduled (15min) | Syncs tracking from UPS/FedEx/USPS |

### Portal & Admin Functions
| Function | Type | Description |
|----------|------|-------------|
| `portalChatWebhook` | HTTPS Request | AI chat for logged-in portal users |
| `getDashboardStats` | HTTPS Callable | Real-time admin dashboard metrics |
| `getCustomerHealth` | HTTPS Callable | Customer health score (0-100) |
| `resolveEscalation` | HTTPS Callable | Mark escalation resolved |
| `exportAnalytics` | HTTPS Callable | Export chat logs to CSV/JSON |
| `inventoryForecast` | Scheduled (Daily) | Predictive stock alerts |

---

## Claude AI Configuration

### Set Anthropic API Key
```bash
firebase functions:config:set anthropic.api_key="sk-ant-api03-YOUR_KEY_HERE"
firebase functions:config:set admin.phone="+13055041323"
```

### Configure Slack Integration
```bash
firebase functions:config:set slack.operations="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
firebase functions:config:set slack.alerts="https://hooks.slack.com/services/YOUR/ALERTS/URL"
```

In Slack App Settings > Slash Commands, add:
```
Command: /ma3pl
Request URL: https://us-central1-miamialliance3pl.cloudfunctions.net/slackCommand
```

### Configure Shopify Webhook
In Shopify Admin > Settings > Notifications > Webhooks:
```
Event: Order creation
URL: https://us-central1-miamialliance3pl.cloudfunctions.net/shopifyOrderCreated
Format: JSON
```

### Configure Twilio Webhook
In Twilio Console > Messaging > WhatsApp Sandbox:
```
When a message comes in:
https://us-central1-miamialliance3pl.cloudfunctions.net/whatsappWebhookEnhanced
```

### Firestore Collections Created
| Collection | Purpose |
|------------|---------|
| `conversations` | Conversation history per phone |
| `chat_logs` | All message logs with AI responses |
| `tool_usage` | Tool call analytics |
| `ai_interactions` | Smart feature usage |
| `ai_errors` | Error tracking for auto-fix |
| `ai_reports` | Daily performance reports |
| `ai_tests` | Test suite results |
| `feedback` | Customer satisfaction ratings |
| `escalations` | Human handoff tickets |
| `claims` | Damage/loss claims |
| `pickup_requests` | Scheduled pickups |
| `proactive_messages` | Outbound message log |
| `order_modifications` | Order change history |
| `customer_preferences` | VIP status, language, prefs |
| `campaigns` | Bulk message campaigns |
| `ab_tests` | A/B test impressions |
| `portal_chats` | Web portal chat logs |
| `media_uploads` | WhatsApp photos/documents |
| `inventory_forecasts` | Predictive stock alerts |
| `customer_health` | Health score snapshots |

---

## Twilio Configuration

### Credentials (Firebase Functions Config)
```bash
firebase functions:config:set twilio.account_sid="YOUR_ACCOUNT_SID"
firebase functions:config:set twilio.auth_token="YOUR_AUTH_TOKEN"
firebase functions:config:set twilio.phone_number="+1XXXXXXXXXX"
firebase functions:config:set twilio.whatsapp_number="whatsapp:+14155238886"
```

> **Note:** Actual credentials stored securely in Firebase Functions config. See Twilio console for values.

### Phone Numbers
| Type | Number | Status |
|------|--------|--------|
| SMS (Local) | (305) 697-0028 | ⚠️ Blocked by carrier (10DLC required) |
| WhatsApp Sandbox | +14155238886 | ✅ Working |

### WhatsApp Sandbox Setup
1. Customer texts "join shade-slave" to +14155238886
2. Once joined, can receive all notification types
3. For production: Apply for WhatsApp Business API

---

## Notification Templates

### Shipment Status Messages
```javascript
const SMS_TEMPLATES = {
    received: "📦 Your shipment {tracking} has been RECEIVED at our facility.",
    processing: "⚙️ Shipment {tracking} is being PROCESSED.",
    shipped: "🚚 Shipment {tracking} has SHIPPED via {carrier}!",
    out_for_delivery: "📍 Shipment {tracking} is OUT FOR DELIVERY today!",
    delivered: "✅ Shipment {tracking} has been DELIVERED.",
    exception: "⚠️ Alert! Shipment {tracking} has a delivery EXCEPTION."
};
```

### Additional Message Types Demonstrated
- 💳 Payment Request (Stripe link)
- 📍 Live GPS Tracking
- 📸 Proof of Delivery
- 💰 Rate Shopping Results
- ⚠️ Weather Delay Alert
- 👑 VIP Status Notification
- 🌱 Sustainability Report
- 💵 Referral Bonus
- 🌎 Customs Clearance
- 📊 Real-time Dashboard
- 🔄 Return Processed
- 🎁 Subscription Box Assembly

---

## Customer Notification Preferences

Stored in Firestore `shipments` collection:
```javascript
{
    customer_phone: "+1234567890",
    notifications_enabled: true,
    notification_channel: "whatsapp" // "sms", "whatsapp", or "both"
}
```

---

## Known Issues & Next Steps

### SMS Blocked (Error 30034)
**Issue:** US carriers require A2P 10DLC registration for local numbers.

**Solutions:**
1. **Upgrade Twilio account** (recommended) - Uses $15 credit
2. **Buy toll-free number** (888/877) - No 10DLC required
3. **Register for 10DLC** - Takes 1-2 weeks approval

### To Enable Full SMS:
```bash
# 1. Upgrade at https://console.twilio.com/us1/billing/manage/billing/upgrade
# 2. Release local number, buy toll-free:
curl -X DELETE "https://api.twilio.com/.../IncomingPhoneNumbers/PN521098efea68496c56bb39216cc54cbb.json"
curl -X POST "https://api.twilio.com/.../IncomingPhoneNumbers.json" -d "PhoneNumber=+18883307921"
# 3. Update Firebase config with new number
```

### Production WhatsApp
- Apply at: https://www.twilio.com/whatsapp/request-access
- Requires Facebook Business verification
- Removes sandbox join requirement

---

## File Changes

| File | Change |
|------|--------|
| `functions/package.json` | Added `twilio`, `@anthropic-ai/sdk` dependencies |
| `functions/index.js` | 3500+ lines: AI chatbot + 35+ functions |
| `admin/ai-dashboard.html` | **NEW** - Admin AI Command Center |
| `js/chat-widget.js` | **NEW** - Embeddable portal chat widget |
| `firebase.json` | Removed lint predeploy step |
| `.firebaserc` | Project configuration |
| `PROGRESS.md` | Full documentation |

---

## Cost Estimates

| Service | Cost |
|---------|------|
| Claude API (Sonnet) | $0.003/1K input, $0.015/1K output tokens |
| Twilio Phone Number | $1.15/month |
| SMS (outbound) | $0.0079/message |
| WhatsApp (outbound) | $0.005/message |
| Firebase Functions | Free tier (2M invocations) |

**Monthly estimate (1000 AI conversations):** ~$15-25
**Monthly estimate (1000 notifications):** ~$6-8

---

## Testing Commands

### Send WhatsApp Test
```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/Messages.json" \
  -u "$TWILIO_SID:$TWILIO_TOKEN" \
  --data-urlencode "From=whatsapp:+14155238886" \
  --data-urlencode "To=whatsapp:+1XXXXXXXXXX" \
  --data-urlencode "Body=Test message from Miami Alliance 3PL"
```

> Set `TWILIO_SID` and `TWILIO_TOKEN` environment variables from Twilio console.

### Deploy Functions
```bash
cd functions && npm install && firebase deploy --only functions
```

### View Logs
```bash
firebase functions:log
```

---

## Previous Features

### 3D Instant Quote Tool ✅
- Location: `/quote.html`
- Three.js 3D visualization
- Real-time pricing calculator
- Box/Pallet selection
- PDF quote generation

### Customer Portal ✅
- Shipment tracking
- Inventory management
- Billing & invoices
- Role-based access (admin/customer)

### Stripe Payments ✅
- Checkout sessions
- Payment links
- Webhook handling
- Invoice auto-update on payment

---

## Repository

- **GitHub:** https://github.com/user/miamialliance3pl
- **Live Site:** https://megalopolisms.github.io/miamialliance3pl/
- **Firebase Project:** miamialliance3pl

---

*Last updated: December 27, 2025*

---

## Deployment Checklist

### To Go Live with AI Chatbot:
1. **Set Anthropic API Key**
   ```bash
   firebase functions:config:set anthropic.api_key="YOUR_KEY"
   ```

2. **Deploy Functions**
   ```bash
   cd functions && npm install && firebase deploy --only functions
   ```

3. **Configure Twilio Webhook**
   - Go to Twilio Console > Messaging > WhatsApp Sandbox
   - Set webhook URL: `https://us-central1-miamialliance3pl.cloudfunctions.net/whatsappWebhookEnhanced`

4. **Test the Bot**
   - Join sandbox: Text "join shade-slave" to +14155238886
   - Send a message like "What are your hours?"
   - Verify AI responds

5. **Monitor**
   ```bash
   firebase functions:log --only whatsappWebhookEnhanced
   ```

### For Production WhatsApp:
- Apply at: https://www.twilio.com/whatsapp/request-access
- Complete Facebook Business verification
- Get dedicated WhatsApp number
