/**
 * @fileoverview Miami Alliance 3PL - Firebase Cloud Functions
 *
 * Complete backend for the Miami Alliance 3PL logistics platform including:
 * - Stripe payment processing (checkout, webhooks, payment links)
 * - Twilio SMS/WhatsApp notifications
 * - Claude AI chatbot with 16+ MCP tools
 * - Platform integrations (Shopify, WooCommerce, Slack)
 * - Customer analytics and health scoring
 * - Inventory forecasting and alerts
 *
 * @version 2.0.0
 * @author Miami Alliance 3PL
 * @license MIT
 *
 * @requires firebase-functions
 * @requires firebase-admin
 * @requires stripe
 * @requires twilio
 * @requires @anthropic-ai/sdk
 *
 * @example
 * // Deploy all functions
 * firebase deploy --only functions
 *
 * @example
 * // Deploy specific function
 * firebase deploy --only functions:whatsappWebhookEnhanced
 *
 * @example
 * // View logs
 * firebase functions:log --only whatsappWebhookEnhanced
 *
 * @see {@link https://github.com/megalopolisms/miamialliance3pl} GitHub Repository
 *
 * ============================================================================
 * CONFIGURATION REQUIRED
 * ============================================================================
 *
 * Set these Firebase config values before deploying:
 *
 * # Stripe (Payments)
 * firebase functions:config:set stripe.secret="sk_live_xxx"
 * firebase functions:config:set stripe.webhook_secret="whsec_xxx"
 *
 * # Twilio (SMS/WhatsApp)
 * firebase functions:config:set twilio.account_sid="ACxxx"
 * firebase functions:config:set twilio.auth_token="xxx"
 * firebase functions:config:set twilio.phone_number="+13056970028"
 * firebase functions:config:set twilio.whatsapp_number="whatsapp:+14155238886"
 *
 * # Anthropic (AI Chatbot)
 * firebase functions:config:set anthropic.api_key="sk-ant-api03-xxx"
 *
 * # Admin
 * firebase functions:config:set admin.phone="+17868738819"
 *
 * # Slack (Integrations)
 * firebase functions:config:set slack.operations="https://hooks.slack.com/xxx"
 * firebase functions:config:set slack.alerts="https://hooks.slack.com/xxx"
 *
 * ============================================================================
 * FUNCTION CATEGORIES
 * ============================================================================
 *
 * 1. PAYMENT FUNCTIONS (Stripe)
 *    - createCheckoutSession: Create Stripe checkout for invoice
 *    - stripeWebhook: Handle Stripe payment webhooks
 *    - createPaymentLink: Generate shareable payment links
 *
 * 2. NOTIFICATION FUNCTIONS (Twilio)
 *    - onShipmentStatusChange: Auto-notify on status updates
 *    - sendShipmentNotification: Manual notification trigger
 *    - testWhatsApp: Sandbox testing utility
 *    - lowInventoryAlert: Daily stock level alerts
 *
 * 3. AI CHATBOT FUNCTIONS (Claude)
 *    - whatsappWebhook: Basic WhatsApp message handler
 *    - whatsappWebhookAsync: Async version with queuing
 *    - whatsappWebhookEnhanced: Full-featured with all tools
 *    - portalChatWebhook: Web portal AI chat
 *    - testChatbot: AI test suite runner
 *
 * 4. PROACTIVE ENGAGEMENT FUNCTIONS
 *    - proactiveFollowUp: Check on resolved issues
 *    - deliveryPredictionAlert: Tomorrow's delivery notices
 *    - abandonedQuoteFollowUp: Re-engage prospects
 *    - requestFeedback: Collect satisfaction ratings
 *    - weeklyCustomerSummary: Activity digests
 *
 * 5. ANALYTICS FUNCTIONS
 *    - analyzeAIPerformance: Daily AI metrics
 *    - getChatbotMetrics: Real-time dashboard data
 *    - getConversationSummary: Handoff context
 *    - getAdminNotifications: Pending items count
 *    - getDashboardStats: Admin dashboard metrics
 *    - getCustomerHealth: Customer health scoring
 *    - exportAnalytics: Export logs to CSV/JSON
 *
 * 6. PLATFORM INTEGRATION FUNCTIONS
 *    - shopifyOrderCreated: Shopify order webhook
 *    - woocommerceOrderCreated: WooCommerce order webhook
 *    - slackCommand: Slack slash command handler
 *    - onEscalationCreated: Auto-post to Slack
 *    - syncCarrierTracking: Carrier API sync
 *
 * 7. MAINTENANCE FUNCTIONS
 *    - autoDetectVIPs: Upgrade loyal customers
 *    - pruneConversations: Memory cleanup
 *    - sendBulkMessage: Campaign messaging
 *    - inventoryForecast: Predictive alerts
 *    - resolveEscalation: Close escalation tickets
 *
 * ============================================================================
 */

"use strict";

// =============================================================================
// DEPENDENCIES
// =============================================================================

const crypto = require("crypto");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

/** @type {import('stripe').Stripe} Stripe API client */
const stripe = require("stripe")(
  functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY,
);

// =============================================================================
// TWILIO CONFIGURATION
// =============================================================================

/**
 * Twilio Account SID for SMS/WhatsApp
 * @type {string}
 */
const twilioAccountSid =
  functions.config().twilio?.account_sid || process.env.TWILIO_ACCOUNT_SID;

/**
 * Twilio Auth Token
 * @type {string}
 */
const twilioAuthToken =
  functions.config().twilio?.auth_token || process.env.TWILIO_AUTH_TOKEN;

/**
 * Twilio phone number for SMS
 * @type {string}
 */
const twilioPhoneNumber =
  functions.config().twilio?.phone_number || process.env.TWILIO_PHONE_NUMBER;

/**
 * Twilio WhatsApp number (sandbox default: +14155238886)
 * @type {string}
 */
const twilioWhatsAppNumber =
  functions.config().twilio?.whatsapp_number ||
  process.env.TWILIO_WHATSAPP_NUMBER ||
  "whatsapp:+14155238886";

/**
 * Twilio client instance (null if not configured)
 * @type {import('twilio').Twilio|null}
 */
let twilioClient = null;
if (twilioAccountSid && twilioAuthToken) {
  const twilio = require("twilio");
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

const firebaseWebApiKey =
  functions.config().firebase?.web_api_key ||
  process.env.FIREBASE_WEB_API_KEY ||
  "AIzaSyA4wMm8-QmZGt3lJcZgTpbBa1W_TklrmRg";

const defaultPasswordResetContinueUrl =
  functions.config().app?.password_reset_continue_url ||
  process.env.PASSWORD_RESET_CONTINUE_URL ||
  "https://miamialliance3pl.com/login.html";

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Error codes for consistent error handling across all functions
 * @constant {Object.<string, {code: string, message: string, httpStatus: number}>}
 */
const ERROR_CODES = {
  UNAUTHENTICATED: {
    code: "unauthenticated",
    message: "Authentication required",
    httpStatus: 401,
  },
  PERMISSION_DENIED: {
    code: "permission-denied",
    message: "Insufficient permissions",
    httpStatus: 403,
  },
  NOT_FOUND: {
    code: "not-found",
    message: "Resource not found",
    httpStatus: 404,
  },
  INVALID_ARGUMENT: {
    code: "invalid-argument",
    message: "Invalid or missing argument",
    httpStatus: 400,
  },
  FAILED_PRECONDITION: {
    code: "failed-precondition",
    message: "Operation not allowed in current state",
    httpStatus: 400,
  },
  INTERNAL: {
    code: "internal",
    message: "Internal server error",
    httpStatus: 500,
  },
  UNAVAILABLE: {
    code: "unavailable",
    message: "Service temporarily unavailable",
    httpStatus: 503,
  },
  RESOURCE_EXHAUSTED: {
    code: "resource-exhausted",
    message: "Rate limit exceeded",
    httpStatus: 429,
  },
};

/**
 * Log error to Firestore for monitoring and debugging
 *
 * @async
 * @function logError
 * @param {string} functionName - Name of the function where error occurred
 * @param {Error} error - The error object
 * @param {Object} [context={}] - Additional context (userId, requestData, etc.)
 * @returns {Promise<void>}
 *
 * @example
 * try {
 *   // ... code that might fail
 * } catch (error) {
 *   await logError('myFunction', error, { userId: context.auth?.uid });
 *   throw error;
 * }
 */
async function logError(functionName, error, context = {}) {
  try {
    await admin
      .firestore()
      .collection("error_logs")
      .add({
        function: functionName,
        message: error.message,
        stack: error.stack,
        code: error.code || "unknown",
        context: context,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        resolved: false,
      });
    console.error(`[${functionName}] Error logged:`, error.message);
  } catch (logError) {
    // Don't let logging errors break the app
    console.error(`Failed to log error for ${functionName}:`, logError.message);
  }
}

/**
 * Wrap an async function with error handling and logging
 *
 * @function withErrorHandling
 * @param {string} functionName - Name for logging
 * @param {Function} fn - The async function to wrap
 * @returns {Function} Wrapped function with error handling
 *
 * @example
 * exports.myFunction = functions.https.onCall(
 *   withErrorHandling('myFunction', async (data, context) => {
 *     // ... function logic
 *   })
 * );
 */
function withErrorHandling(functionName, fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      // Log to Firestore
      const context = args[1]?.auth ? { userId: args[1].auth.uid } : {};
      await logError(functionName, error, context);

      // Re-throw with proper Firebase error format
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        ERROR_CODES.INTERNAL.code,
        error.message || ERROR_CODES.INTERNAL.message,
      );
    }
  };
}

/**
 * Validate required fields in request data
 *
 * @function validateRequired
 * @param {Object} data - Request data object
 * @param {string[]} fields - Array of required field names
 * @throws {functions.https.HttpsError} If any required field is missing
 *
 * @example
 * validateRequired(data, ['invoiceId', 'amount']);
 */
function validateRequired(data, fields) {
  const missing = fields.filter(
    (field) => !data || data[field] === undefined || data[field] === null,
  );
  if (missing.length > 0) {
    throw new functions.https.HttpsError(
      ERROR_CODES.INVALID_ARGUMENT.code,
      `Missing required fields: ${missing.join(", ")}`,
    );
  }
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isAllowedPasswordResetContinueUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    ) {
      return false;
    }

    return [
      "miamialliance3pl.com",
      "www.miamialliance3pl.com",
      "megalopolisms.github.io",
      "localhost",
      "127.0.0.1",
    ].includes(url.hostname);
  } catch (error) {
    return false;
  }
}

function hasPasswordProvider(userRecord) {
  const providerIds = new Set(
    (userRecord.providerData || [])
      .map((provider) => provider.providerId)
      .filter(Boolean),
  );

  // Password-only users in this Firebase project export with no federated
  // providers, so an empty provider set still means email/password login.
  return providerIds.size === 0 || providerIds.has("password");
}

async function sendFirebasePasswordResetEmail(email, continueUrl) {
  if (!firebaseWebApiKey) {
    throw new Error("Firebase web API key is not configured");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseWebApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
        continueUrl,
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to send reset email");
  }

  return payload;
}

/**
 * Check if user is authenticated
 *
 * @function requireAuth
 * @param {Object} context - Firebase callable context
 * @throws {functions.https.HttpsError} If user is not authenticated
 * @returns {string} User's Firebase UID
 *
 * @example
 * const userId = requireAuth(context);
 */
function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      ERROR_CODES.UNAUTHENTICATED.code,
      ERROR_CODES.UNAUTHENTICATED.message,
    );
  }
  return context.auth.uid;
}

exports.requestCustomerPasswordReset = functions.https.onCall(
  withErrorHandling("requestCustomerPasswordReset", async (data) => {
    validateRequired(data, ["email"]);

    const email = normalizeEmail(data.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new functions.https.HttpsError(
        ERROR_CODES.INVALID_ARGUMENT.code,
        "A valid email address is required",
      );
    }

    const continueUrl = isAllowedPasswordResetContinueUrl(data.continueUrl)
      ? data.continueUrl
      : defaultPasswordResetContinueUrl;

    try {
      const userRecord = await admin.auth().getUserByEmail(email);

      if (userRecord.disabled) {
        throw new functions.https.HttpsError(
          ERROR_CODES.FAILED_PRECONDITION.code,
          "This account is currently disabled. Contact support.",
        );
      }

      if (!hasPasswordProvider(userRecord)) {
        await admin.auth().updateUser(userRecord.uid, {
          password: crypto.randomBytes(24).toString("base64url"),
        });
      }

      await sendFirebasePasswordResetEmail(email, continueUrl);
      return { status: "email-sent" };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      if (error?.code === "auth/user-not-found") {
        // Preserve email enumeration protection for public callers.
        return { status: "submitted" };
      }

      if (error?.message?.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
        throw new functions.https.HttpsError(
          ERROR_CODES.RESOURCE_EXHAUSTED.code,
          "Too many reset requests. Please wait a few minutes and try again.",
        );
      }

      throw error;
    }
  }),
);

/**
 * Check if user has admin role
 *
 * @async
 * @function requireAdmin
 * @param {Object} context - Firebase callable context
 * @throws {functions.https.HttpsError} If user is not an admin
 * @returns {Promise<string>} User's Firebase UID
 *
 * @example
 * const adminId = await requireAdmin(context);
 */
async function requireAdmin(context) {
  const userId = requireAuth(context);
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  const userData = userDoc.data();

  if (userData?.role !== "admin") {
    throw new functions.https.HttpsError(
      ERROR_CODES.PERMISSION_DENIED.code,
      "Admin access required",
    );
  }
  return userId;
}

/**
 * Safe JSON parse with fallback
 *
 * @function safeJsonParse
 * @param {string} str - JSON string to parse
 * @param {*} [fallback=null] - Fallback value if parsing fails
 * @returns {*} Parsed JSON or fallback value
 *
 * @example
 * const data = safeJsonParse(req.body, {});
 */
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Sanitize user input to prevent injection attacks
 *
 * @function sanitizeInput
 * @param {string} input - User input string
 * @param {number} [maxLength=1000] - Maximum allowed length
 * @returns {string} Sanitized input string
 *
 * @example
 * const cleanMessage = sanitizeInput(data.message, 500);
 */
function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength).replace(/[<>]/g, ""); // Remove potential HTML tags
}

// =============================================================================
// PAYMENT FUNCTIONS (Stripe)
// =============================================================================

/**
 * Create Stripe Checkout Session for invoice payment
 *
 * Creates a Stripe Checkout session that redirects the user to Stripe's
 * hosted payment page. On successful payment, the stripeWebhook function
 * will update the invoice status to 'paid'.
 *
 * @function createCheckoutSession
 * @memberof module:PaymentFunctions
 *
 * @param {Object} data - The request data
 * @param {string} data.invoiceId - The Firestore document ID of the invoice
 * @param {string} [data.successUrl] - URL to redirect on successful payment
 * @param {string} [data.cancelUrl] - URL to redirect on cancelled payment
 *
 * @param {Object} context - Firebase callable context
 * @param {Object} context.auth - Authentication info (required)
 * @param {string} context.auth.uid - User's Firebase UID
 *
 * @returns {Promise<{sessionId: string, url: string}>} Stripe session details
 * @property {string} sessionId - Stripe Checkout Session ID
 * @property {string} url - URL to redirect user to Stripe Checkout
 *
 * @throws {functions.https.HttpsError} 'unauthenticated' - User not logged in
 * @throws {functions.https.HttpsError} 'invalid-argument' - Missing invoiceId
 * @throws {functions.https.HttpsError} 'not-found' - Invoice doesn't exist
 * @throws {functions.https.HttpsError} 'permission-denied' - Not user's invoice
 * @throws {functions.https.HttpsError} 'failed-precondition' - Invoice already paid
 *
 * @example
 * // Client-side usage
 * const createCheckout = firebase.functions().httpsCallable('createCheckoutSession');
 * const result = await createCheckout({ invoiceId: 'INV-001' });
 * window.location.href = result.data.url;
 */
exports.createCheckoutSession = functions.https.onCall(
  async (data, context) => {
    // Verify authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const { invoiceId, successUrl, cancelUrl } = data;

    if (!invoiceId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invoice ID required",
      );
    }

    // Get invoice from Firestore
    const invoiceDoc = await admin
      .firestore()
      .collection("invoices")
      .doc(invoiceId)
      .get();

    if (!invoiceDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Invoice not found");
    }

    const invoice = invoiceDoc.data();

    // Verify user owns this invoice
    if (invoice.customer_id !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not your invoice",
      );
    }

    // Calculate amount due
    const amountDue = Math.round(
      (invoice.total - (invoice.amount_paid || 0)) * 100,
    ); // cents

    if (amountDue <= 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Invoice already paid",
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: invoice.customer_email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Billing period: ${invoice.billing_period_start} to ${invoice.billing_period_end}`,
            },
            unit_amount: amountDue,
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoiceId,
        customer_id: invoice.customer_id,
      },
      success_url:
        successUrl ||
        `https://megalopolisms.github.io/miamialliance3pl/portal/admin-billing.html?payment=success&invoice=${invoiceId}`,
      cancel_url:
        cancelUrl ||
        `https://megalopolisms.github.io/miamialliance3pl/portal/admin-billing.html?payment=cancelled`,
    });

    return { sessionId: session.id, url: session.url };
  },
);

/**
 * Stripe Webhook to handle successful payments
 *
 * Receives webhook events from Stripe and processes payment completions.
 * When a checkout.session.completed event is received, updates the
 * corresponding invoice in Firestore to 'paid' status.
 *
 * @function stripeWebhook
 * @memberof module:PaymentFunctions
 *
 * @param {Object} req - Express request object
 * @param {string} req.headers['stripe-signature'] - Stripe signature header
 * @param {Buffer} req.rawBody - Raw request body for signature verification
 *
 * @param {Object} res - Express response object
 *
 * @returns {void} Responds with { received: true } on success
 *
 * @fires Firestore Update on invoices/{invoiceId} - Sets status to 'paid'
 *
 * @example
 * // Configure webhook in Stripe Dashboard:
 * // Endpoint: https://us-central1-miamialliance3pl.cloudfunctions.net/stripeWebhook
 * // Events: checkout.session.completed
 *
 * @see {@link https://stripe.com/docs/webhooks} Stripe Webhooks Documentation
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = functions.config().stripe?.webhook_secret;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payment
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoice_id;

    if (invoiceId) {
      // Update invoice to paid
      await admin
        .firestore()
        .collection("invoices")
        .doc(invoiceId)
        .update({
          status: "paid",
          amount_paid: session.amount_total / 100,
          paid_at: new Date().toISOString(),
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        });

      console.log(`Invoice ${invoiceId} marked as paid`);
    }
  }

  res.json({ received: true });
});

/**
 * Create Stripe Payment Link for an invoice
 *
 * Creates a reusable payment link that can be shared with customers.
 * Unlike Checkout Sessions, Payment Links don't expire and can be
 * used multiple times (though for invoices, typically once).
 *
 * @function createPaymentLink
 * @memberof module:PaymentFunctions
 * @access admin
 *
 * @param {Object} data - The request data
 * @param {string} data.invoiceId - The Firestore document ID of the invoice
 *
 * @param {Object} context - Firebase callable context
 * @param {Object} context.auth - Authentication info (required, must be admin)
 *
 * @returns {Promise<{url: string}>} The payment link URL
 *
 * @throws {functions.https.HttpsError} 'unauthenticated' - User not logged in
 * @throws {functions.https.HttpsError} 'permission-denied' - Not an admin user
 *
 * @example
 * // Admin creates payment link and sends to customer
 * const createLink = firebase.functions().httpsCallable('createPaymentLink');
 * const result = await createLink({ invoiceId: 'INV-001' });
 * console.log('Send this to customer:', result.data.url);
 *
 * @see {@link https://stripe.com/docs/payment-links} Stripe Payment Links
 */
exports.createPaymentLink = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in",
    );
  }

  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();
  const userData = userDoc.data();

  if (userData?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const { invoiceId } = data;
  const invoiceDoc = await admin
    .firestore()
    .collection("invoices")
    .doc(invoiceId)
    .get();
  const invoice = invoiceDoc.data();

  const amountDue = Math.round(
    (invoice.total - (invoice.amount_paid || 0)) * 100,
  );

  // Create a product and price
  const product = await stripe.products.create({
    name: `Invoice ${invoice.invoice_number}`,
    description: `Miami Alliance 3PL - ${invoice.billing_period_start} to ${invoice.billing_period_end}`,
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountDue,
    currency: "usd",
  });

  // Create payment link
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { invoice_id: invoiceId },
    after_completion: {
      type: "redirect",
      redirect: {
        url: `https://megalopolisms.github.io/miamialliance3pl/portal/admin-billing.html?payment=success&invoice=${invoiceId}`,
      },
    },
  });

  // Save payment link to invoice
  await admin.firestore().collection("invoices").doc(invoiceId).update({
    stripe_payment_link: paymentLink.url,
  });

  return { url: paymentLink.url };
});

// =============================================================================
// SMS NOTIFICATION FUNCTIONS (Twilio)
// =============================================================================

/**
 * SMS message templates for shipment status notifications
 *
 * Each template is a function that takes shipment details and returns
 * a formatted message string with emoji indicators.
 *
 * @constant {Object.<string, Function>} SMS_TEMPLATES
 * @property {Function} received - Shipment received at facility
 * @property {Function} processing - Order being picked and packed
 * @property {Function} shipped - Shipment dispatched with tracking
 * @property {Function} out_for_delivery - Out for delivery today
 * @property {Function} delivered - Successfully delivered
 * @property {Function} exception - Delivery exception alert
 *
 * @example
 * const message = SMS_TEMPLATES.shipped('MA3PL-ABC123', 'FedEx');
 * // "🚚 Miami Alliance 3PL: Shipment MA3PL-ABC123 has SHIPPED via FedEx!"
 */
const SMS_TEMPLATES = {
  received: (tracking) =>
    `📦 Miami Alliance 3PL: Your shipment ${tracking} has been RECEIVED at our facility. We'll notify you when it ships.`,
  processing: (tracking) =>
    `⚙️ Miami Alliance 3PL: Shipment ${tracking} is being PROCESSED. Your order is being picked and packed.`,
  shipped: (tracking, carrier) =>
    `🚚 Miami Alliance 3PL: Shipment ${tracking} has SHIPPED via ${carrier || "carrier"}! Track: https://miamialliance3pl.com/track/${tracking}`,
  out_for_delivery: (tracking) =>
    `📍 Miami Alliance 3PL: Shipment ${tracking} is OUT FOR DELIVERY today!`,
  delivered: (tracking) =>
    `✅ Miami Alliance 3PL: Shipment ${tracking} has been DELIVERED. Thank you for your business!`,
  exception: (tracking) =>
    `⚠️ Miami Alliance 3PL: Alert! Shipment ${tracking} has a delivery EXCEPTION. Please contact us.`,
};

/**
 * Send SMS message via Twilio
 *
 * Sends a text message to the specified phone number using the
 * configured Twilio account. Validates US phone number format.
 *
 * @async
 * @function sendSMS
 * @param {string} to - Recipient phone number in E.164 format (+1XXXXXXXXXX)
 * @param {string} message - The message body (max 1600 characters)
 *
 * @returns {Promise<{success: boolean, sid?: string, error?: string, channel: string}>}
 * @property {boolean} success - Whether the message was sent
 * @property {string} [sid] - Twilio message SID if successful
 * @property {string} [error] - Error message if failed
 * @property {string} channel - Always 'sms'
 *
 * @example
 * const result = await sendSMS('+13055551234', 'Your package shipped!');
 * if (result.success) {
 *   console.log('Sent with SID:', result.sid);
 * }
 */
async function sendSMS(to, message) {
  if (!twilioClient) {
    console.log("Twilio not configured. SMS not sent:", message);
    return { success: false, error: "Twilio not configured", channel: "sms" };
  }

  // Validate phone number format
  const phoneRegex = /^\+1[2-9]\d{9}$/;
  if (!phoneRegex.test(to)) {
    console.log("Invalid phone number format:", to);
    return { success: false, error: "Invalid phone format", channel: "sms" };
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to,
    });
    console.log("SMS sent:", result.sid);
    return { success: true, sid: result.sid, channel: "sms" };
  } catch (error) {
    console.error("SMS failed:", error.message);
    return { success: false, error: error.message, channel: "sms" };
  }
}

/**
 * Send WhatsApp message via Twilio
 *
 * Sends a WhatsApp message using Twilio's WhatsApp Business API.
 * Automatically formats phone numbers and handles the WhatsApp prefix.
 *
 * @async
 * @function sendWhatsApp
 * @param {string} to - Recipient phone number (any format, will be normalized)
 * @param {string} message - The message body
 *
 * @returns {Promise<{success: boolean, sid?: string, error?: string, channel: string}>}
 * @property {boolean} success - Whether the message was sent
 * @property {string} [sid] - Twilio message SID if successful
 * @property {string} [error] - Error message if failed
 * @property {string} channel - Always 'whatsapp'
 *
 * @example
 * const result = await sendWhatsApp('+13055551234', 'Hello via WhatsApp!');
 * if (result.success) {
 *   console.log('WhatsApp sent with SID:', result.sid);
 * }
 *
 * @note For sandbox: Customer must first text "join shade-slave" to +14155238886
 */
async function sendWhatsApp(to, message) {
  if (!twilioClient) {
    console.log("Twilio not configured. WhatsApp not sent:", message);
    return {
      success: false,
      error: "Twilio not configured",
      channel: "whatsapp",
    };
  }

  // Format phone number for WhatsApp
  let formattedTo = to.replace(/\D/g, ""); // Remove non-digits
  if (!formattedTo.startsWith("1") && formattedTo.length === 10) {
    formattedTo = "1" + formattedTo; // Add US country code
  }
  formattedTo = "whatsapp:+" + formattedTo;

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioWhatsAppNumber,
      to: formattedTo,
    });
    console.log("WhatsApp sent:", result.sid);
    return { success: true, sid: result.sid, channel: "whatsapp" };
  } catch (error) {
    console.error("WhatsApp failed:", error.message);
    return { success: false, error: error.message, channel: "whatsapp" };
  }
}

/**
 * Send notification via customer's preferred channel (SMS, WhatsApp, or both)
 */
async function sendNotification(phone, message, preferredChannel = "sms") {
  const results = [];

  if (preferredChannel === "whatsapp" || preferredChannel === "both") {
    results.push(await sendWhatsApp(phone, message));
  }

  if (preferredChannel === "sms" || preferredChannel === "both") {
    results.push(await sendSMS(phone, message));
  }

  // Return combined result
  const successCount = results.filter((r) => r.success).length;
  return {
    success: successCount > 0,
    results: results,
    channels: results.map((r) => r.channel),
  };
}

/**
 * Firestore Trigger: Send notification when shipment status changes
 * Supports SMS, WhatsApp, or both based on customer preference
 */
exports.onShipmentStatusChange = functions.firestore
  .document("shipments/{shipmentId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger if status changed
    if (before.status === after.status) {
      return null;
    }

    const newStatus = after.status?.toLowerCase().replace(/\s+/g, "_");
    const tracking = after.tracking_number || context.params.shipmentId;

    // Check if customer wants notifications
    if (!after.customer_phone || after.notifications_enabled === false) {
      console.log("Notifications disabled or no phone number");
      return null;
    }

    // Get customer's preferred channel: 'sms', 'whatsapp', or 'both'
    const preferredChannel = after.notification_channel || "sms";

    // Get message template
    const templateFn = SMS_TEMPLATES[newStatus];
    if (!templateFn) {
      console.log("No template for status:", newStatus);
      return null;
    }

    const message =
      typeof templateFn === "function"
        ? templateFn(tracking, after.carrier)
        : templateFn;

    // Send notification via preferred channel
    const result = await sendNotification(
      after.customer_phone,
      message,
      preferredChannel,
    );

    // Log notification
    await admin
      .firestore()
      .collection("notifications")
      .add({
        type: preferredChannel,
        channels: result.channels,
        shipment_id: context.params.shipmentId,
        customer_id: after.customer_id,
        phone: after.customer_phone,
        message: message,
        status: result.success ? "sent" : "failed",
        results: result.results,
        sent_at: admin.firestore.FieldValue.serverTimestamp(),
      });

    return result;
  });

/**
 * HTTP Endpoint: Manually send notification (SMS, WhatsApp, or both)
 */
exports.sendShipmentNotification = functions.https.onCall(
  async (data, context) => {
    // Verify admin
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(context.auth.uid)
      .get();
    if (userDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Admin only");
    }

    const { shipmentId, customMessage, channel = "sms" } = data;

    // Get shipment
    const shipmentDoc = await admin
      .firestore()
      .collection("shipments")
      .doc(shipmentId)
      .get();
    if (!shipmentDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Shipment not found");
    }

    const shipment = shipmentDoc.data();
    if (!shipment.customer_phone) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No phone number on file",
      );
    }

    const message =
      customMessage ||
      `📦 Miami Alliance 3PL: Update on shipment ${shipment.tracking_number || shipmentId}. Status: ${shipment.status}`;

    const result = await sendNotification(
      shipment.customer_phone,
      message,
      channel,
    );

    if (!result.success) {
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send notification",
      );
    }

    return {
      success: true,
      message: `Notification sent via ${result.channels.join(", ")}`,
      results: result.results,
    };
  },
);

/**
 * HTTP Endpoint: Test WhatsApp Sandbox
 * Customer must first send "join <sandbox-code>" to +14155238886
 */
exports.testWhatsApp = functions.https.onCall(async (data, context) => {
  // Verify authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in",
    );
  }

  const { phoneNumber, testMessage } = data;

  if (!phoneNumber) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Phone number required",
    );
  }

  const message =
    testMessage ||
    "🎉 Miami Alliance 3PL: WhatsApp notifications are working! You will now receive shipment updates here.";

  const result = await sendWhatsApp(phoneNumber, message);

  if (!result.success) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `WhatsApp failed: ${result.error}. Make sure you've joined the sandbox first by texting "join <code>" to +14155238886`,
    );
  }

  return { success: true, message: "WhatsApp test sent!", sid: result.sid };
});

/**
 * Scheduled: Send low inventory alerts
 */
exports.lowInventoryAlert = functions.pubsub
  .schedule("every day 09:00")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    // Get all inventory items below threshold
    const snapshot = await admin
      .firestore()
      .collection("inventory")
      .where("quantity", "<", 10)
      .get();

    if (snapshot.empty) {
      console.log("No low inventory items");
      return null;
    }

    // Group by customer
    const customerAlerts = {};
    snapshot.forEach((doc) => {
      const item = doc.data();
      if (item.customer_id && item.alert_phone) {
        if (!customerAlerts[item.customer_id]) {
          customerAlerts[item.customer_id] = {
            phone: item.alert_phone,
            items: [],
          };
        }
        customerAlerts[item.customer_id].items.push({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
        });
      }
    });

    // Send alerts
    for (const [customerId, data] of Object.entries(customerAlerts)) {
      const itemList = data.items
        .map((i) => `${i.sku}: ${i.quantity} left`)
        .join(", ");
      const message = `⚠️ Miami Alliance 3PL: Low inventory alert! ${itemList}. Reorder soon.`;

      await sendSMS(data.phone, message);
    }

    return null;
  });

// =============================================================================
// CLAUDE AI WHATSAPP CHATBOT WITH MCP TOOLS
// =============================================================================

const Anthropic = require("@anthropic-ai/sdk");
const anthropicApiKey =
  functions.config().anthropic?.api_key || process.env.ANTHROPIC_API_KEY;

let anthropicClient = null;
if (anthropicApiKey) {
  anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
}

// Miami Alliance 3PL system context for Claude
const SYSTEM_PROMPT = `You are the AI assistant for Miami Alliance 3PL, a third-party logistics company in Miami, Florida.

COMPANY INFO:
- Address: 8780 NW 100th ST, Medley, FL 33178
- Services: Warehousing, fulfillment, pick & pack, shipping, inventory management
- Hours: Mon-Fri 8am-6pm, Sat 9am-2pm

YOU HAVE TOOLS - Use them to look up REAL data:
- lookup_shipment: Get real shipment status by tracking number
- check_inventory: Check stock levels for a customer or SKU
- calculate_quote: Generate pricing quote for storage/fulfillment
- lookup_invoice: Get invoice details and payment status
- schedule_pickup: Schedule a pickup or delivery
- escalate_to_human: Connect customer with human agent

ALWAYS use tools when customer asks about their specific shipments, inventory, or invoices.
Don't guess - look it up!

PRICING (for quotes):
- Storage: $0.75 per pallet per day ($22.50/month)
- Handling fee: $3.50 per unit
- Pick & pack: $1.25 per item
- Shipping: Varies by weight/zone

TONE: Professional but friendly. Be concise - this is WhatsApp.
Keep responses under 300 characters when possible.`;

// =============================================================================
// MCP TOOLS DEFINITIONS
// =============================================================================

const TOOLS = [
  {
    name: "lookup_shipment",
    description:
      "Look up shipment status by tracking number or customer phone. Returns real-time status, location, carrier, and ETA.",
    input_schema: {
      type: "object",
      properties: {
        tracking_number: {
          type: "string",
          description: "The shipment tracking number (e.g., MA3PL-8847)",
        },
        customer_phone: {
          type: "string",
          description: "Customer phone number to find their shipments",
        },
      },
    },
  },
  {
    name: "check_inventory",
    description:
      "Check inventory levels for a customer or specific SKU. Returns quantity, location, and reorder status.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "Customer ID to check all their inventory",
        },
        sku: {
          type: "string",
          description: "Specific SKU to check",
        },
        customer_phone: {
          type: "string",
          description: "Customer phone to look up their inventory",
        },
      },
    },
  },
  {
    name: "calculate_quote",
    description:
      "Calculate a pricing quote for storage and fulfillment services.",
    input_schema: {
      type: "object",
      properties: {
        num_pallets: {
          type: "number",
          description: "Number of pallets to store",
        },
        num_units: {
          type: "number",
          description: "Number of units for handling",
        },
        picks_per_month: {
          type: "number",
          description: "Estimated picks per month",
        },
        storage_days: {
          type: "number",
          description: "Number of days for storage (default 30)",
        },
      },
      required: ["num_pallets"],
    },
  },
  {
    name: "lookup_invoice",
    description: "Look up invoice details by invoice number or customer phone.",
    input_schema: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "Invoice number (e.g., INV-2024-0847)",
        },
        customer_phone: {
          type: "string",
          description: "Customer phone to find their invoices",
        },
      },
    },
  },
  {
    name: "schedule_pickup",
    description: "Schedule a pickup or delivery appointment.",
    input_schema: {
      type: "object",
      properties: {
        customer_phone: {
          type: "string",
          description: "Customer phone number",
        },
        pickup_type: {
          type: "string",
          enum: ["inbound", "outbound"],
          description: "Type of pickup",
        },
        preferred_date: {
          type: "string",
          description:
            "Preferred date (e.g., 'tomorrow', 'Monday', '2024-12-30')",
        },
        notes: {
          type: "string",
          description: "Special instructions",
        },
      },
      required: ["customer_phone", "pickup_type"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate the conversation to a human agent when AI cannot help.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for escalation",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgency level",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "create_shipment",
    description: "Create a new shipment/order for the customer.",
    input_schema: {
      type: "object",
      properties: {
        destination_address: {
          type: "string",
          description: "Full delivery address",
        },
        items: {
          type: "array",
          description: "Array of items with SKU and quantity",
          items: {
            type: "object",
            properties: {
              sku: { type: "string" },
              quantity: { type: "number" },
            },
          },
        },
        service_level: {
          type: "string",
          enum: ["ground", "express", "overnight"],
          description: "Shipping speed",
        },
        special_instructions: {
          type: "string",
          description: "Delivery notes",
        },
      },
      required: ["destination_address"],
    },
  },
  {
    name: "get_shipping_rates",
    description:
      "Get real-time shipping rates from multiple carriers for a shipment.",
    input_schema: {
      type: "object",
      properties: {
        weight_lbs: {
          type: "number",
          description: "Package weight in pounds",
        },
        dimensions: {
          type: "object",
          properties: {
            length: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
          },
          description: "Package dimensions in inches",
        },
        destination_zip: {
          type: "string",
          description: "Destination ZIP code",
        },
        service_level: {
          type: "string",
          enum: ["ground", "express", "overnight"],
        },
      },
      required: ["weight_lbs", "destination_zip"],
    },
  },
  {
    name: "send_document",
    description: "Send a document (invoice, BOL, label) to the customer.",
    input_schema: {
      type: "object",
      properties: {
        document_type: {
          type: "string",
          enum: ["invoice", "bol", "label", "pod", "quote"],
          description: "Type of document to send",
        },
        reference_id: {
          type: "string",
          description: "Invoice number, tracking number, or shipment ID",
        },
      },
      required: ["document_type", "reference_id"],
    },
  },
  {
    name: "update_preferences",
    description: "Update customer notification preferences and settings.",
    input_schema: {
      type: "object",
      properties: {
        notification_channel: {
          type: "string",
          enum: ["sms", "whatsapp", "both", "none"],
          description: "Preferred notification channel",
        },
        language: {
          type: "string",
          enum: ["en", "es"],
          description: "Preferred language",
        },
        notify_on_shipped: { type: "boolean" },
        notify_on_delivered: { type: "boolean" },
        notify_low_inventory: { type: "boolean" },
        daily_digest: { type: "boolean" },
      },
    },
  },
  {
    name: "get_business_hours",
    description:
      "Check if warehouse is currently open and get next available time.",
    input_schema: {
      type: "object",
      properties: {
        check_date: {
          type: "string",
          description: "Date to check (optional, defaults to today)",
        },
      },
    },
  },
  {
    name: "file_claim",
    description: "File a damage or loss claim for a shipment.",
    input_schema: {
      type: "object",
      properties: {
        tracking_number: {
          type: "string",
          description: "Shipment tracking number",
        },
        claim_type: {
          type: "string",
          enum: ["damage", "loss", "shortage", "delay"],
          description: "Type of claim",
        },
        description: {
          type: "string",
          description: "Detailed description of the issue",
        },
        claimed_amount: {
          type: "number",
          description: "Dollar amount being claimed",
        },
      },
      required: ["tracking_number", "claim_type", "description"],
    },
  },
  {
    name: "reorder_inventory",
    description: "Submit a reorder request for inventory items.",
    input_schema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "SKU to reorder",
        },
        quantity: {
          type: "number",
          description: "Quantity to order",
        },
        rush: {
          type: "boolean",
          description: "Rush order flag",
        },
      },
      required: ["sku", "quantity"],
    },
  },
  {
    name: "modify_order",
    description:
      "Modify or cancel an existing shipment order. Actions: update_address, add_item, remove_item, hold, cancel, expedite.",
    input_schema: {
      type: "object",
      properties: {
        tracking_number: {
          type: "string",
          description: "Tracking number of the order to modify",
        },
        action: {
          type: "string",
          enum: [
            "update_address",
            "add_item",
            "remove_item",
            "hold",
            "cancel",
            "expedite",
          ],
          description: "Type of modification",
        },
        new_address: {
          type: "string",
          description: "New delivery address (for update_address)",
        },
        item_sku: {
          type: "string",
          description: "SKU to add or remove",
        },
        item_quantity: {
          type: "number",
          description: "Quantity to add",
        },
        reason: {
          type: "string",
          description: "Reason for modification",
        },
      },
      required: ["tracking_number", "action"],
    },
  },
  {
    name: "search_faq",
    description:
      "Search the FAQ/knowledge base for common questions about pricing, hours, services, etc.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The question or topic to search for",
        },
      },
      required: ["query"],
    },
  },
];

// =============================================================================
// TOOL EXECUTION FUNCTIONS
// =============================================================================

async function executeTool(toolName, toolInput, customerPhone) {
  console.log(`Executing tool: ${toolName}`, toolInput);

  switch (toolName) {
    case "lookup_shipment":
      return await toolLookupShipment(toolInput, customerPhone);
    case "check_inventory":
      return await toolCheckInventory(toolInput, customerPhone);
    case "calculate_quote":
      return await toolCalculateQuote(toolInput);
    case "lookup_invoice":
      return await toolLookupInvoice(toolInput, customerPhone);
    case "schedule_pickup":
      return await toolSchedulePickup(toolInput, customerPhone);
    case "escalate_to_human":
      return await toolEscalateToHuman(toolInput, customerPhone);
    case "create_shipment":
      return await toolCreateShipment(toolInput, customerPhone);
    case "get_shipping_rates":
      return await toolGetShippingRates(toolInput);
    case "send_document":
      return await toolSendDocument(toolInput, customerPhone);
    case "update_preferences":
      return await toolUpdatePreferences(toolInput, customerPhone);
    case "get_business_hours":
      return await toolGetBusinessHours(toolInput);
    case "file_claim":
      return await toolFileClaim(toolInput, customerPhone);
    case "reorder_inventory":
      return await toolReorderInventory(toolInput, customerPhone);
    case "modify_order":
      return await toolModifyOrder(toolInput, customerPhone);
    case "search_faq":
      return searchKnowledgeBase(toolInput.query);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function toolLookupShipment(input, customerPhone) {
  const db = admin.firestore();
  let query = db.collection("shipments");

  if (input.tracking_number) {
    // Search by tracking number
    const snapshot = await query
      .where("tracking_number", "==", input.tracking_number)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return {
        found: false,
        message: `No shipment found with tracking ${input.tracking_number}`,
      };
    }
    const shipment = snapshot.docs[0].data();
    return {
      found: true,
      tracking_number: shipment.tracking_number,
      status: shipment.status,
      carrier: shipment.carrier || "Not assigned",
      origin: shipment.origin || "Miami warehouse",
      destination: shipment.destination,
      created_at: shipment.created_at,
      estimated_delivery: shipment.estimated_delivery || "TBD",
      last_update: shipment.updated_at,
    };
  }

  // Search by customer phone
  const phone = input.customer_phone || customerPhone;
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, "");
    const snapshot = await query
      .where("customer_phone", "==", `+${cleanPhone}`)
      .orderBy("created_at", "desc")
      .limit(5)
      .get();
    if (snapshot.empty) {
      return { found: false, message: "No shipments found for your account" };
    }
    const shipments = snapshot.docs.map((doc) => ({
      tracking: doc.data().tracking_number,
      status: doc.data().status,
      carrier: doc.data().carrier,
    }));
    return { found: true, shipments: shipments, count: shipments.length };
  }

  return {
    found: false,
    message: "Please provide tracking number or phone number",
  };
}

async function toolCheckInventory(input, customerPhone) {
  const db = admin.firestore();
  let query = db.collection("inventory");

  if (input.sku) {
    const snapshot = await query.where("sku", "==", input.sku).limit(1).get();
    if (snapshot.empty) {
      return { found: false, message: `SKU ${input.sku} not found` };
    }
    const item = snapshot.docs[0].data();
    return {
      found: true,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      location: item.location || "Warehouse A",
      low_stock: item.quantity < 10,
      reorder_point: item.reorder_point || 10,
    };
  }

  // Get all inventory for customer
  const phone = input.customer_phone || customerPhone;
  if (phone || input.customer_id) {
    let snapshot;
    if (input.customer_id) {
      snapshot = await query
        .where("customer_id", "==", input.customer_id)
        .get();
    } else {
      // Find customer by phone first
      const userSnapshot = await db
        .collection("users")
        .where("phone", "==", phone)
        .limit(1)
        .get();
      if (userSnapshot.empty) {
        return { found: false, message: "Customer not found" };
      }
      const customerId = userSnapshot.docs[0].id;
      snapshot = await query.where("customer_id", "==", customerId).get();
    }

    if (snapshot.empty) {
      return { found: false, message: "No inventory on file" };
    }

    const items = snapshot.docs.map((doc) => ({
      sku: doc.data().sku,
      name: doc.data().name,
      qty: doc.data().quantity,
      low: doc.data().quantity < 10,
    }));

    const lowStockItems = items.filter((i) => i.low);
    return {
      found: true,
      total_skus: items.length,
      items: items.slice(0, 10), // Top 10
      low_stock_count: lowStockItems.length,
      low_stock_items: lowStockItems.slice(0, 5),
    };
  }

  return { found: false, message: "Please provide SKU or customer info" };
}

async function toolCalculateQuote(input) {
  const pallets = input.num_pallets || 0;
  const units = input.num_units || 0;
  const picks = input.picks_per_month || 0;
  const days = input.storage_days || 30;

  const storageRate = 0.75; // per pallet per day
  const handlingRate = 3.5; // per unit
  const pickPackRate = 1.25; // per pick

  const storageCost = pallets * storageRate * days;
  const handlingCost = units * handlingRate;
  const pickPackCost = picks * pickPackRate;
  const total = storageCost + handlingCost + pickPackCost;

  return {
    quote: {
      storage: {
        pallets,
        days,
        rate: storageRate,
        total: storageCost.toFixed(2),
      },
      handling: { units, rate: handlingRate, total: handlingCost.toFixed(2) },
      pick_pack: { picks, rate: pickPackRate, total: pickPackCost.toFixed(2) },
      monthly_total: total.toFixed(2),
    },
    summary: `${pallets} pallets × ${days} days = $${storageCost.toFixed(2)} storage + $${handlingCost.toFixed(2)} handling + $${pickPackCost.toFixed(2)} pick/pack = $${total.toFixed(2)}/month`,
  };
}

async function toolLookupInvoice(input, customerPhone) {
  const db = admin.firestore();
  let query = db.collection("invoices");

  if (input.invoice_number) {
    const snapshot = await query
      .where("invoice_number", "==", input.invoice_number)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return {
        found: false,
        message: `Invoice ${input.invoice_number} not found`,
      };
    }
    const invoice = snapshot.docs[0].data();
    return {
      found: true,
      invoice_number: invoice.invoice_number,
      amount: invoice.total,
      status: invoice.status,
      due_date: invoice.due_date,
      amount_paid: invoice.amount_paid || 0,
      balance_due: (invoice.total - (invoice.amount_paid || 0)).toFixed(2),
      payment_link:
        invoice.stripe_payment_link || "Contact us for payment link",
    };
  }

  // Find by customer phone
  const phone = input.customer_phone || customerPhone;
  if (phone) {
    // Find customer first
    const cleanPhone = phone.replace(/\D/g, "");
    const userSnapshot = await db
      .collection("users")
      .where("phone", "==", `+${cleanPhone}`)
      .limit(1)
      .get();
    if (userSnapshot.empty) {
      return { found: false, message: "Customer not found" };
    }

    const customerId = userSnapshot.docs[0].id;
    const snapshot = await query
      .where("customer_id", "==", customerId)
      .orderBy("created_at", "desc")
      .limit(5)
      .get();

    if (snapshot.empty) {
      return { found: false, message: "No invoices found" };
    }

    const invoices = snapshot.docs.map((doc) => ({
      number: doc.data().invoice_number,
      amount: doc.data().total,
      status: doc.data().status,
      due: doc.data().due_date,
    }));

    return { found: true, invoices: invoices };
  }

  return { found: false, message: "Please provide invoice number or phone" };
}

async function toolSchedulePickup(input, customerPhone) {
  const db = admin.firestore();

  // Create pickup request
  const pickup = {
    customer_phone: input.customer_phone || customerPhone,
    type: input.pickup_type,
    preferred_date: input.preferred_date || "Next available",
    notes: input.notes || "",
    status: "pending",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("pickup_requests").add(pickup);

  // Notify admin (could send SMS/email here)
  console.log("New pickup request:", docRef.id);

  return {
    success: true,
    request_id: docRef.id,
    message: `Pickup scheduled for ${input.preferred_date || "next available slot"}. We'll confirm within 2 hours.`,
    type: input.pickup_type,
    confirmation: `Request #${docRef.id.slice(-6).toUpperCase()}`,
  };
}

async function toolEscalateToHuman(input, customerPhone) {
  const db = admin.firestore();

  // Create escalation ticket
  const ticket = {
    customer_phone: customerPhone,
    reason: input.reason,
    urgency: input.urgency || "medium",
    status: "open",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("escalations").add(ticket);

  // Send alert to admin (WhatsApp/SMS)
  const adminPhone = functions.config().admin?.phone || "+17868738819";
  if (twilioClient && input.urgency === "high") {
    await sendWhatsApp(
      adminPhone,
      `🚨 URGENT: Customer ${customerPhone} needs help. Reason: ${input.reason}. Ticket: ${docRef.id}`,
    );
  }

  return {
    success: true,
    ticket_id: docRef.id,
    message: `I've connected you with our team. A human agent will reach out within ${input.urgency === "high" ? "15 minutes" : "2 hours"}.`,
    urgency: input.urgency,
  };
}

async function toolCreateShipment(input, customerPhone) {
  const db = admin.firestore();

  // Generate tracking number
  const trackingNumber = `MA3PL-${Date.now().toString(36).toUpperCase()}`;

  // Find customer by phone
  const cleanPhone = customerPhone.replace(/\D/g, "");
  const userSnapshot = await db
    .collection("users")
    .where("phone", "==", `+${cleanPhone}`)
    .limit(1)
    .get();
  const customerId = userSnapshot.empty ? null : userSnapshot.docs[0].id;

  // Create shipment
  const shipment = {
    tracking_number: trackingNumber,
    customer_id: customerId,
    customer_phone: customerPhone,
    destination: input.destination_address,
    items: input.items || [],
    service_level: input.service_level || "ground",
    special_instructions: input.special_instructions || "",
    status: "pending",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    created_via: "whatsapp_ai",
  };

  const docRef = await db.collection("shipments").add(shipment);

  return {
    success: true,
    tracking_number: trackingNumber,
    shipment_id: docRef.id,
    status: "pending",
    message: `Shipment created! Tracking: ${trackingNumber}. We'll process it within 2 hours.`,
    estimated_ship_date: "Tomorrow",
  };
}

async function toolGetShippingRates(input) {
  // Simulated carrier rates (in production, call FedEx/UPS/USPS APIs)
  const weight = input.weight_lbs || 1;
  const zone = getZoneFromZip(input.destination_zip);

  // Rate calculations (simplified)
  const rates = {
    ground: {
      fedex: { price: (3.5 + weight * 0.45 * zone).toFixed(2), days: 5 },
      ups: { price: (3.75 + weight * 0.48 * zone).toFixed(2), days: 5 },
      usps: { price: (2.8 + weight * 0.52 * zone).toFixed(2), days: 7 },
    },
    express: {
      fedex: { price: (12.5 + weight * 0.85 * zone).toFixed(2), days: 2 },
      ups: { price: (13.0 + weight * 0.88 * zone).toFixed(2), days: 2 },
    },
    overnight: {
      fedex: { price: (25.0 + weight * 1.5 * zone).toFixed(2), days: 1 },
      ups: { price: (26.5 + weight * 1.55 * zone).toFixed(2), days: 1 },
    },
  };

  const serviceLevel = input.service_level || "ground";
  const options = rates[serviceLevel] || rates.ground;

  // Find cheapest
  const sorted = Object.entries(options).sort(
    (a, b) => parseFloat(a[1].price) - parseFloat(b[1].price),
  );
  const cheapest = sorted[0];

  return {
    weight_lbs: weight,
    destination_zip: input.destination_zip,
    zone: zone,
    service_level: serviceLevel,
    options: options,
    recommended: {
      carrier: cheapest[0].toUpperCase(),
      price: cheapest[1].price,
      days: cheapest[1].days,
    },
    summary: `Best rate: ${cheapest[0].toUpperCase()} $${cheapest[1].price} (${cheapest[1].days} days)`,
  };
}

function getZoneFromZip(zip) {
  // Simplified zone calculation from Miami (33178)
  if (!zip) return 4;
  const prefix = parseInt(zip.substring(0, 3));
  if (prefix >= 330 && prefix <= 349) return 1; // Florida
  if (prefix >= 300 && prefix <= 399) return 2; // Southeast
  if (prefix >= 100 && prefix <= 199) return 4; // Northeast
  if (prefix >= 900 && prefix <= 999) return 5; // West Coast
  return 3; // Default
}

async function toolSendDocument(input, customerPhone) {
  const db = admin.firestore();
  let documentUrl = null;
  let documentName = "";

  switch (input.document_type) {
    case "invoice":
      const invoiceSnap = await db
        .collection("invoices")
        .where("invoice_number", "==", input.reference_id)
        .limit(1)
        .get();
      if (!invoiceSnap.empty) {
        const invoice = invoiceSnap.docs[0].data();
        documentUrl =
          invoice.pdf_url ||
          `https://megalopolisms.github.io/miamialliance3pl/portal/admin-billing.html?invoice=${input.reference_id}`;
        documentName = `Invoice ${input.reference_id}`;
      }
      break;
    case "pod":
      documentUrl = `https://megalopolisms.github.io/miamialliance3pl/pod/${input.reference_id}`;
      documentName = "Proof of Delivery";
      break;
    case "label":
      documentUrl = `https://megalopolisms.github.io/miamialliance3pl/label/${input.reference_id}`;
      documentName = "Shipping Label";
      break;
    case "quote":
      documentUrl =
        "https://megalopolisms.github.io/miamialliance3pl/quote.html";
      documentName = "Interactive Quote Tool";
      break;
    default:
      documentUrl = `https://megalopolisms.github.io/miamialliance3pl/portal/`;
      documentName = "Customer Portal";
  }

  // Log document request
  await db.collection("document_requests").add({
    customer_phone: customerPhone,
    document_type: input.document_type,
    reference_id: input.reference_id,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    document_type: input.document_type,
    document_name: documentName,
    url: documentUrl,
    message: `Here's your ${documentName}: ${documentUrl}`,
  };
}

async function toolUpdatePreferences(input, customerPhone) {
  const db = admin.firestore();
  const cleanPhone = customerPhone.replace(/\D/g, "");

  // Find or create customer preferences
  const prefRef = db.collection("customer_preferences").doc(cleanPhone);

  const updates = {};
  if (input.notification_channel)
    updates.notification_channel = input.notification_channel;
  if (input.language) updates.language = input.language;
  if (input.notify_on_shipped !== undefined)
    updates.notify_on_shipped = input.notify_on_shipped;
  if (input.notify_on_delivered !== undefined)
    updates.notify_on_delivered = input.notify_on_delivered;
  if (input.notify_low_inventory !== undefined)
    updates.notify_low_inventory = input.notify_low_inventory;
  if (input.daily_digest !== undefined)
    updates.daily_digest = input.daily_digest;
  updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

  await prefRef.set(updates, { merge: true });

  return {
    success: true,
    updated: Object.keys(updates).filter((k) => k !== "updated_at"),
    message: "Preferences updated successfully!",
  };
}

async function toolGetBusinessHours(input) {
  const now = new Date();
  const checkDate = input.check_date ? new Date(input.check_date) : now;
  const day = checkDate.getDay();
  const hour = now.getHours();

  const hours = {
    0: null, // Sunday closed
    1: { open: 8, close: 18 }, // Monday
    2: { open: 8, close: 18 },
    3: { open: 8, close: 18 },
    4: { open: 8, close: 18 },
    5: { open: 8, close: 18 },
    6: { open: 9, close: 14 }, // Saturday
  };

  const todayHours = hours[day];
  const isOpen =
    todayHours && hour >= todayHours.open && hour < todayHours.close;

  // Find next open time
  let nextOpen = null;
  if (!isOpen) {
    for (let i = 0; i <= 7; i++) {
      const checkDay = (day + i) % 7;
      if (hours[checkDay]) {
        if (i === 0 && hour < hours[checkDay].open) {
          nextOpen = `Today at ${hours[checkDay].open}:00 AM`;
        } else if (i > 0) {
          const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ];
          nextOpen = `${dayNames[checkDay]} at ${hours[checkDay].open}:00 AM`;
        }
        if (nextOpen) break;
      }
    }
  }

  return {
    is_open: isOpen,
    current_time: now.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
    }),
    today_hours: todayHours
      ? `${todayHours.open}:00 AM - ${todayHours.close > 12 ? todayHours.close - 12 : todayHours.close}:00 ${todayHours.close >= 12 ? "PM" : "AM"}`
      : "Closed",
    next_open: isOpen ? "Now!" : nextOpen,
    timezone: "Eastern Time",
    address: "8780 NW 100th ST, Medley, FL 33178",
  };
}

async function toolFileClaim(input, customerPhone) {
  const db = admin.firestore();

  // Create claim
  const claim = {
    tracking_number: input.tracking_number,
    customer_phone: customerPhone,
    claim_type: input.claim_type,
    description: input.description,
    claimed_amount: input.claimed_amount || 0,
    status: "submitted",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("claims").add(claim);
  const claimNumber = `CLM-${docRef.id.slice(-8).toUpperCase()}`;

  // Update claim with number
  await docRef.update({ claim_number: claimNumber });

  // Alert admin for high-value claims
  if (input.claimed_amount > 500) {
    const adminPhone = functions.config().admin?.phone || "+17868738819";
    if (twilioClient) {
      await sendWhatsApp(
        adminPhone,
        `💰 High-value claim filed: ${claimNumber} - $${input.claimed_amount} - ${input.claim_type} - Tracking: ${input.tracking_number}`,
      );
    }
  }

  return {
    success: true,
    claim_number: claimNumber,
    status: "submitted",
    message: `Claim ${claimNumber} submitted. We'll investigate within 48 hours.`,
    next_steps: "Keep any damaged items and packaging for inspection.",
  };
}

async function toolReorderInventory(input, customerPhone) {
  const db = admin.firestore();

  // Find the inventory item
  const invSnapshot = await db
    .collection("inventory")
    .where("sku", "==", input.sku)
    .limit(1)
    .get();
  if (invSnapshot.empty) {
    return {
      success: false,
      message: `SKU ${input.sku} not found in your inventory`,
    };
  }

  const item = invSnapshot.docs[0].data();

  // Create reorder request
  const reorder = {
    sku: input.sku,
    item_name: item.name,
    quantity: input.quantity,
    customer_phone: customerPhone,
    customer_id: item.customer_id,
    rush: input.rush || false,
    status: "pending",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("reorder_requests").add(reorder);
  const orderNumber = `RO-${docRef.id.slice(-6).toUpperCase()}`;

  await docRef.update({ order_number: orderNumber });

  return {
    success: true,
    order_number: orderNumber,
    sku: input.sku,
    quantity: input.quantity,
    rush: input.rush || false,
    message: `Reorder ${orderNumber} submitted for ${input.quantity}x ${item.name}${input.rush ? " (RUSH)" : ""}. We'll confirm availability shortly.`,
  };
}

// =============================================================================
// SMART FEATURES: SENTIMENT, LANGUAGE, CONTEXT
// =============================================================================

function detectLanguage(text) {
  // Simple Spanish detection
  const spanishIndicators = [
    "hola",
    "gracias",
    "donde",
    "cuando",
    "como",
    "envio",
    "paquete",
    "ayuda",
    "precio",
    "cuanto",
  ];
  const lowerText = text.toLowerCase();
  const spanishCount = spanishIndicators.filter((word) =>
    lowerText.includes(word),
  ).length;
  return spanishCount >= 2 ? "es" : "en";
}

function detectSentiment(text) {
  const lowerText = text.toLowerCase();

  // Negative indicators
  const negative = [
    "angry",
    "frustrated",
    "terrible",
    "worst",
    "hate",
    "awful",
    "unacceptable",
    "ridiculous",
    "furioso",
    "terrible",
    "malo",
    "peor",
    "odio",
    "inaceptable",
    "damn",
    "wtf",
    "never again",
  ];
  // Urgent indicators
  const urgent = [
    "urgent",
    "asap",
    "emergency",
    "immediately",
    "right now",
    "critical",
    "urgente",
    "emergencia",
    "ahora",
  ];

  const isNegative = negative.some((word) => lowerText.includes(word));
  const isUrgent = urgent.some((word) => lowerText.includes(word));

  if (isNegative) return "negative";
  if (isUrgent) return "urgent";
  return "neutral";
}

async function getCustomerContext(customerPhone) {
  const db = admin.firestore();
  const cleanPhone = customerPhone.replace(/\D/g, "");

  // Get customer preferences
  const prefDoc = await db
    .collection("customer_preferences")
    .doc(cleanPhone)
    .get();
  const prefs = prefDoc.exists ? prefDoc.data() : {};

  // Get recent interactions
  const recentChats = await db
    .collection("chat_logs")
    .where("phone", "==", customerPhone)
    .orderBy("timestamp", "desc")
    .limit(5)
    .get();

  // Get active shipments
  const activeShipments = await db
    .collection("shipments")
    .where("customer_phone", "==", customerPhone)
    .where("status", "in", [
      "pending",
      "processing",
      "shipped",
      "out_for_delivery",
    ])
    .limit(3)
    .get();

  // Get open issues
  const openIssues = await db
    .collection("escalations")
    .where("customer_phone", "==", customerPhone)
    .where("status", "==", "open")
    .get();

  return {
    language: prefs.language || "en",
    notification_channel: prefs.notification_channel || "whatsapp",
    total_chats: recentChats.size,
    active_shipments: activeShipments.docs.map((d) => ({
      tracking: d.data().tracking_number,
      status: d.data().status,
    })),
    has_open_issues: openIssues.size > 0,
    is_vip: prefs.vip || false,
  };
}

// =============================================================================
// CLAUDE WITH TOOLS - AGENTIC LOOP
// =============================================================================

async function generateClaudeResponseWithTools(
  userMessage,
  conversationHistory,
  customerPhone,
) {
  if (!anthropicClient) {
    return "Sorry, AI assistant is not configured. Please contact us at (305) 555-3PL1.";
  }

  try {
    // Detect language and sentiment
    const language = detectLanguage(userMessage);
    const sentiment = detectSentiment(userMessage);

    // Get customer context
    const context = await getCustomerContext(customerPhone);

    // Auto-escalate negative/urgent customers
    if (sentiment === "negative" || sentiment === "urgent") {
      const adminPhone = functions.config().admin?.phone || "+17868738819";
      if (twilioClient) {
        await sendWhatsApp(
          adminPhone,
          `⚠️ ${sentiment.toUpperCase()} customer ${customerPhone}: "${userMessage.slice(0, 100)}..."`,
        );
      }
    }

    // Build enhanced system prompt with context
    let enhancedPrompt = SYSTEM_PROMPT;

    if (language === "es") {
      enhancedPrompt +=
        "\n\nIMPORTANT: Customer is writing in Spanish. Respond in Spanish.";
    }

    if (context.active_shipments.length > 0) {
      enhancedPrompt += `\n\nCUSTOMER CONTEXT: They have ${context.active_shipments.length} active shipment(s): ${context.active_shipments.map((s) => `${s.tracking} (${s.status})`).join(", ")}`;
    }

    if (context.has_open_issues) {
      enhancedPrompt +=
        "\n\nNOTE: This customer has open support tickets. Be extra helpful and empathetic.";
    }

    if (context.is_vip) {
      enhancedPrompt +=
        "\n\nVIP CUSTOMER: Provide premium service. Offer priority handling.";
    }

    if (sentiment === "negative") {
      enhancedPrompt +=
        "\n\nSENTIMENT ALERT: Customer seems frustrated. Acknowledge their frustration, apologize if appropriate, and focus on resolution.";
    }

    // Build messages array with history
    const messages = conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    messages.push({ role: "user", content: userMessage });

    let response = await anthropicClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: enhancedPrompt,
      tools: TOOLS,
      messages: messages,
    });

    // Agentic loop - keep going until we get a text response
    let iterations = 0;
    const maxIterations = 5;

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;
      console.log(`Tool use iteration ${iterations}`);

      // Find tool use blocks
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use",
      );

      // Execute each tool
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(
          toolUse.name,
          toolUse.input,
          customerPhone,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });

        // Log tool usage for analysis
        await admin.firestore().collection("tool_usage").add({
          tool: toolUse.name,
          input: toolUse.input,
          result: result,
          customer_phone: customerPhone,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Continue conversation with tool results
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropicClient.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: enhancedPrompt,
        tools: TOOLS,
        messages: messages,
      });
    }

    // Log interaction with smart features
    await admin.firestore().collection("ai_interactions").add({
      customer_phone: customerPhone,
      language_detected: language,
      sentiment_detected: sentiment,
      is_vip: context.is_vip,
      tools_used: iterations,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Extract text response
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock
      ? textBlock.text
      : "I processed your request but couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Claude API error:", error.message);

    // Log error for auto-fix analysis
    await admin.firestore().collection("ai_errors").add({
      error: error.message,
      stack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return "Sorry, I'm having trouble right now. Please try again or call (305) 555-3PL1.";
  }
}

// =============================================================================
// CONVERSATION MANAGEMENT
// =============================================================================

async function getConversationHistory(phoneNumber) {
  const conversationRef = admin
    .firestore()
    .collection("conversations")
    .doc(phoneNumber);
  const doc = await conversationRef.get();

  if (doc.exists) {
    const data = doc.data();
    return data.messages?.slice(-10) || [];
  }
  return [];
}

async function saveMessage(phoneNumber, role, content) {
  const conversationRef = admin
    .firestore()
    .collection("conversations")
    .doc(phoneNumber);

  await conversationRef.set(
    {
      phone: phoneNumber,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      messages: admin.firestore.FieldValue.arrayUnion({
        role: role,
        content: content,
        timestamp: new Date().toISOString(),
      }),
    },
    { merge: true },
  );
}

// =============================================================================
// TESTING & AUTO-IMPROVEMENT
// =============================================================================

/**
 * Test the AI chatbot with sample queries
 */
exports.testChatbot = functions.https.onCall(async (data, context) => {
  // Admin only
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in",
    );
  }

  const testCases = [
    { input: "What are your hours?", expected_contains: ["Mon", "Fri", "8"] },
    {
      input: "How much does storage cost?",
      expected_contains: ["$0.75", "pallet"],
    },
    { input: "Track my shipment MA3PL-1234", expected_tool: "lookup_shipment" },
    { input: "What's my inventory?", expected_tool: "check_inventory" },
    {
      input: "I need a quote for 10 pallets",
      expected_tool: "calculate_quote",
    },
    { input: "I need to talk to someone", expected_tool: "escalate_to_human" },
  ];

  const results = [];
  for (const test of testCases) {
    const startTime = Date.now();
    const response = await generateClaudeResponseWithTools(
      test.input,
      [],
      "+1TEST000000",
    );
    const duration = Date.now() - startTime;

    const passed = test.expected_contains
      ? test.expected_contains.some((term) =>
          response.toLowerCase().includes(term.toLowerCase()),
        )
      : true;

    results.push({
      input: test.input,
      response: response.slice(0, 200),
      duration_ms: duration,
      passed: passed,
    });
  }

  // Log test results
  await admin
    .firestore()
    .collection("ai_tests")
    .add({
      results: results,
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

  return {
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    results: results,
  };
});

/**
 * Analyze AI performance and suggest improvements
 */
exports.analyzeAIPerformance = functions.pubsub
  .schedule("every day 06:00")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const db = admin.firestore();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Get yesterday's chat logs
    const chatLogs = await db
      .collection("chat_logs")
      .where("timestamp", ">=", yesterday)
      .get();

    // Get tool usage stats
    const toolUsage = await db
      .collection("tool_usage")
      .where("timestamp", ">=", yesterday)
      .get();

    // Get errors
    const errors = await db
      .collection("ai_errors")
      .where("timestamp", ">=", yesterday)
      .get();

    // Get escalations (potential AI failures)
    const escalations = await db
      .collection("escalations")
      .where("created_at", ">=", yesterday)
      .get();

    // Compile report
    const report = {
      date: yesterday.toISOString().split("T")[0],
      total_conversations: chatLogs.size,
      tool_calls: toolUsage.size,
      errors: errors.size,
      escalations: escalations.size,
      escalation_rate:
        chatLogs.size > 0
          ? ((escalations.size / chatLogs.size) * 100).toFixed(2) + "%"
          : "0%",
      tool_breakdown: {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Count tool usage by type
    toolUsage.forEach((doc) => {
      const tool = doc.data().tool;
      report.tool_breakdown[tool] = (report.tool_breakdown[tool] || 0) + 1;
    });

    // Save report
    await db.collection("ai_reports").add(report);

    // Alert if escalation rate is high
    if (escalations.size > 5 && chatLogs.size > 0) {
      const rate = (escalations.size / chatLogs.size) * 100;
      if (rate > 20) {
        const adminPhone = functions.config().admin?.phone;
        if (adminPhone && twilioClient) {
          await sendWhatsApp(
            adminPhone,
            `⚠️ AI Performance Alert: ${rate.toFixed(1)}% escalation rate yesterday (${escalations.size}/${chatLogs.size} conversations). Review needed.`,
          );
        }
      }
    }

    console.log("AI Performance Report:", report);
    return report;
  });

/**
 * Twilio WhatsApp Webhook - Receives incoming messages
 * Configure in Twilio: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-sandbox
 * Set webhook URL to: https://us-central1-miamialliance3pl.cloudfunctions.net/whatsappWebhook
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  // Twilio sends POST requests
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From; // Format: whatsapp:+1234567890
  const toNumber = req.body.To;

  console.log(`Incoming WhatsApp from ${fromNumber}: ${incomingMessage}`);

  // Extract phone number without whatsapp: prefix
  const cleanPhone = fromNumber.replace("whatsapp:", "");

  // Get conversation history
  const history = await getConversationHistory(cleanPhone);

  // Save user message
  await saveMessage(cleanPhone, "user", incomingMessage);

  // Generate Claude response WITH TOOLS
  const aiResponse = await generateClaudeResponseWithTools(
    incomingMessage,
    history,
    cleanPhone,
  );

  // Save AI response
  await saveMessage(cleanPhone, "assistant", aiResponse);

  // Log the conversation
  await admin.firestore().collection("chat_logs").add({
    phone: cleanPhone,
    user_message: incomingMessage,
    ai_response: aiResponse,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Send response back via Twilio
  // Using TwiML response format
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${aiResponse.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message>
</Response>`;

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

/**
 * Alternative: Send Claude response via Twilio API (for more control)
 */
exports.whatsappWebhookAsync = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From;

  console.log(`Incoming WhatsApp from ${fromNumber}: ${incomingMessage}`);

  // Respond immediately to Twilio (required within 15 seconds)
  res.status(200).send("OK");

  // Process asynchronously
  const cleanPhone = fromNumber.replace("whatsapp:", "");
  const history = await getConversationHistory(cleanPhone);

  await saveMessage(cleanPhone, "user", incomingMessage);

  const aiResponse = await generateClaudeResponseWithTools(
    incomingMessage,
    history,
    cleanPhone,
  );

  await saveMessage(cleanPhone, "assistant", aiResponse);

  // Send via Twilio API
  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body: aiResponse,
        from: twilioWhatsAppNumber,
        to: fromNumber,
      });
      console.log("Claude response sent via WhatsApp");
    } catch (error) {
      console.error("Failed to send WhatsApp response:", error.message);
    }
  }

  // Log
  await admin.firestore().collection("chat_logs").add({
    phone: cleanPhone,
    user_message: incomingMessage,
    ai_response: aiResponse,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// =============================================================================
// PROACTIVE MESSAGING & SMART NOTIFICATIONS
// =============================================================================

/**
 * Proactive Follow-Up: Check on customers who had issues
 * Runs daily at 10 AM to follow up on yesterday's escalations
 */
exports.proactiveFollowUp = functions.pubsub
  .schedule("every day 10:00")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const db = admin.firestore();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Find resolved escalations from yesterday
    const resolved = await db
      .collection("escalations")
      .where("status", "==", "resolved")
      .where("resolved_at", ">=", yesterday)
      .get();

    for (const doc of resolved.docs) {
      const escalation = doc.data();
      if (escalation.customer_phone && twilioClient) {
        const message = `👋 Hi! This is Miami Alliance 3PL. We wanted to follow up on your recent support request. Is everything resolved to your satisfaction? Reply YES if all good, or let us know if you need anything else!`;
        await sendWhatsApp(escalation.customer_phone, message);

        // Log proactive message
        await db.collection("proactive_messages").add({
          type: "follow_up",
          phone: escalation.customer_phone,
          escalation_id: doc.id,
          sent_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return { followed_up: resolved.size };
  });

/**
 * Smart Delivery Prediction Alert
 * Notify customers when their shipment is expected to arrive
 */
exports.deliveryPredictionAlert = functions.pubsub
  .schedule("every 2 hours")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59);

    // Find shipments expected to deliver tomorrow that haven't been notified
    const shipments = await db
      .collection("shipments")
      .where("status", "==", "shipped")
      .where("estimated_delivery", "<=", tomorrow.toISOString())
      .where("delivery_prediction_sent", "==", false)
      .limit(50)
      .get();

    let notified = 0;
    for (const doc of shipments.docs) {
      const shipment = doc.data();
      if (
        shipment.customer_phone &&
        twilioClient &&
        shipment.notifications_enabled !== false
      ) {
        const message = `🎯 Miami Alliance 3PL: Your shipment ${shipment.tracking_number} is on track for delivery tomorrow! We'll send you another update when it's out for delivery.`;
        await sendWhatsApp(shipment.customer_phone, message);
        await doc.ref.update({ delivery_prediction_sent: true });
        notified++;
      }
    }

    return { prediction_alerts_sent: notified };
  });

/**
 * Abandoned Quote Follow-Up
 * Follow up with customers who started but didn't complete quotes
 */
exports.abandonedQuoteFollowUp = functions.pubsub
  .schedule("every day 14:00")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const db = admin.firestore();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Find quote requests without corresponding shipments
    const quotes = await db
      .collection("tool_usage")
      .where("tool", "==", "calculate_quote")
      .where("timestamp", ">=", yesterday)
      .get();

    const phonesWithQuotes = new Set();
    quotes.forEach((doc) => {
      if (doc.data().customer_phone) {
        phonesWithQuotes.add(doc.data().customer_phone);
      }
    });

    // Check if they created a shipment
    for (const phone of phonesWithQuotes) {
      const shipments = await db
        .collection("shipments")
        .where("customer_phone", "==", phone)
        .where("created_at", ">=", yesterday)
        .limit(1)
        .get();

      if (shipments.empty && twilioClient) {
        const message = `💼 Hi! We noticed you were looking at our services yesterday. Any questions about the quote? I'm here to help! - Miami Alliance 3PL`;
        await sendWhatsApp(phone, message);
      }
    }

    return { follow_ups_sent: phonesWithQuotes.size };
  });

// =============================================================================
// ADVANCED CONVERSATION FEATURES
// =============================================================================

/**
 * Generate conversation summary for human handoff
 */
async function generateConversationSummary(phoneNumber) {
  const history = await getConversationHistory(phoneNumber);
  if (history.length === 0) return null;

  const db = admin.firestore();

  // Get customer context
  const context = await getCustomerContext(phoneNumber);

  // Get recent tool usage
  const toolUsage = await db
    .collection("tool_usage")
    .where("customer_phone", "==", phoneNumber)
    .orderBy("timestamp", "desc")
    .limit(10)
    .get();

  const toolsUsed = toolUsage.docs.map((d) => d.data().tool);

  // Build summary
  const summary = {
    phone: phoneNumber,
    message_count: history.length,
    first_contact: history[0]?.timestamp,
    last_contact: history[history.length - 1]?.timestamp,
    language: context.language,
    is_vip: context.is_vip,
    active_shipments: context.active_shipments,
    has_open_issues: context.has_open_issues,
    tools_requested: [...new Set(toolsUsed)],
    key_topics: extractKeyTopics(history),
    sentiment_trend: analyzeSentimentTrend(history),
  };

  return summary;
}

function extractKeyTopics(history) {
  const topics = [];
  const keywords = {
    shipment: ["tracking", "shipment", "delivery", "package", "envio"],
    billing: ["invoice", "bill", "payment", "charge", "pago"],
    inventory: ["inventory", "stock", "sku", "product", "inventario"],
    quote: ["quote", "price", "cost", "rate", "precio"],
    complaint: ["problem", "issue", "wrong", "error", "complaint", "problema"],
    pickup: ["pickup", "schedule", "appointment", "recoger"],
  };

  const allText = history
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some((word) => allText.includes(word))) {
      topics.push(topic);
    }
  }

  return topics;
}

function analyzeSentimentTrend(history) {
  const userMessages = history
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  if (userMessages.length < 2) return "neutral";

  const firstHalf = userMessages.slice(0, Math.floor(userMessages.length / 2));
  const secondHalf = userMessages.slice(Math.floor(userMessages.length / 2));

  const firstSentiment = firstHalf
    .map(detectSentiment)
    .filter((s) => s === "negative").length;
  const secondSentiment = secondHalf
    .map(detectSentiment)
    .filter((s) => s === "negative").length;

  if (secondSentiment < firstSentiment) return "improving";
  if (secondSentiment > firstSentiment) return "worsening";
  return "stable";
}

/**
 * HTTP Endpoint: Get conversation summary (for admin dashboard)
 */
exports.getConversationSummary = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(context.auth.uid)
      .get();
    if (userDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Admin only");
    }

    const { phoneNumber } = data;
    if (!phoneNumber) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Phone number required",
      );
    }

    const summary = await generateConversationSummary(phoneNumber);
    return summary;
  },
);

// =============================================================================
// FEEDBACK COLLECTION & RATINGS
// =============================================================================

/**
 * Request feedback after conversation ends (2 hours of inactivity)
 */
exports.requestFeedback = functions.pubsub
  .schedule("every 30 minutes")
  .onRun(async (context) => {
    const db = admin.firestore();
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

    const fourHoursAgo = new Date();
    fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

    // Find conversations that ended 2-4 hours ago (not too recent, not too old)
    const conversations = await db
      .collection("conversations")
      .where("updated_at", "<=", twoHoursAgo)
      .where("updated_at", ">=", fourHoursAgo)
      .where("feedback_requested", "!=", true)
      .limit(20)
      .get();

    let requested = 0;
    for (const doc of conversations.docs) {
      const conv = doc.data();
      if (conv.phone && conv.messages?.length >= 2 && twilioClient) {
        const message = `⭐ How was your experience with Miami Alliance 3PL today?\n\nReply with a number:\n1️⃣ Excellent\n2️⃣ Good\n3️⃣ Okay\n4️⃣ Poor\n5️⃣ Bad\n\nYour feedback helps us improve!`;
        await sendWhatsApp(conv.phone, message);
        await doc.ref.update({ feedback_requested: true });
        requested++;
      }
    }

    return { feedback_requests_sent: requested };
  });

/**
 * Process feedback ratings from customer replies
 * Called from webhook when message matches rating pattern
 */
async function processFeedbackRating(phoneNumber, rating) {
  const db = admin.firestore();

  const ratingMap = {
    1: { score: 5, label: "excellent" },
    2: { score: 4, label: "good" },
    3: { score: 3, label: "okay" },
    4: { score: 2, label: "poor" },
    5: { score: 1, label: "bad" },
    excellent: { score: 5, label: "excellent" },
    good: { score: 4, label: "good" },
    okay: { score: 3, label: "okay" },
    poor: { score: 2, label: "poor" },
    bad: { score: 1, label: "bad" },
  };

  const normalizedRating = ratingMap[rating.toLowerCase().trim()];
  if (!normalizedRating) return null;

  // Save feedback
  await db.collection("feedback").add({
    phone: phoneNumber,
    score: normalizedRating.score,
    label: normalizedRating.label,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update conversation
  const convRef = db.collection("conversations").doc(phoneNumber);
  await convRef.update({
    feedback_score: normalizedRating.score,
    feedback_label: normalizedRating.label,
    feedback_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Alert admin on bad ratings
  if (normalizedRating.score <= 2) {
    const adminPhone = functions.config().admin?.phone;
    if (adminPhone && twilioClient) {
      await sendWhatsApp(
        adminPhone,
        `⚠️ Low feedback score (${normalizedRating.label}) from ${phoneNumber}. Review conversation.`,
      );
    }
  }

  return normalizedRating;
}

// =============================================================================
// KNOWLEDGE BASE SEARCH TOOL
// =============================================================================

const FAQ_KNOWLEDGE_BASE = {
  hours: {
    keywords: ["hours", "open", "close", "when", "horario"],
    answer:
      "We're open Mon-Fri 8am-6pm, Sat 9am-2pm (Eastern). Closed Sundays.",
  },
  location: {
    keywords: ["address", "location", "where", "located", "direccion"],
    answer:
      "We're at 8780 NW 100th ST, Medley, FL 33178 (near Miami International Airport).",
  },
  pricing_storage: {
    keywords: ["storage", "pallet", "warehouse", "almacen", "guardar"],
    answer:
      "Storage: $0.75/pallet/day ($22.50/month). Volume discounts available for 50+ pallets.",
  },
  pricing_handling: {
    keywords: ["handling", "receiving", "unloading"],
    answer: "Handling fee: $3.50 per unit for receiving/putaway.",
  },
  pricing_fulfillment: {
    keywords: ["pick", "pack", "fulfillment", "ship", "order"],
    answer:
      "Pick & pack: $1.25 per item. Includes packaging materials for standard boxes.",
  },
  returns: {
    keywords: ["return", "rma", "refund", "devolucion"],
    answer:
      "We handle returns! $2.50 processing fee per RMA. Items inspected within 24 hours.",
  },
  international: {
    keywords: ["international", "customs", "import", "export", "container"],
    answer:
      "Yes, we handle international shipments! Container unloading, customs brokerage referrals, and FTZ capabilities.",
  },
  integration: {
    keywords: ["api", "integration", "shopify", "amazon", "woocommerce"],
    answer:
      "We integrate with Shopify, WooCommerce, Amazon FBA/FBM, and offer a REST API for custom integrations.",
  },
  minimum: {
    keywords: ["minimum", "small", "startup", "minimo"],
    answer:
      "$1,000/month minimum spend — no minimum order count, no long-term contracts. Perfect for growing businesses. We scale with you.",
  },
  tracking: {
    keywords: ["track", "status", "where", "package", "rastrear"],
    answer:
      'Track your shipment by sending me the tracking number (format: MA3PL-XXXX) or just ask "where is my package?"',
  },
  contact: {
    keywords: ["phone", "email", "contact", "call", "speak", "human", "person"],
    answer:
      'Need to speak with someone? I can connect you with our team! Just say "talk to human" or call (305) 555-3PL1.',
  },
};

function searchKnowledgeBase(query) {
  const lowerQuery = query.toLowerCase();

  for (const [topic, data] of Object.entries(FAQ_KNOWLEDGE_BASE)) {
    if (data.keywords.some((kw) => lowerQuery.includes(kw))) {
      return { found: true, topic: topic, answer: data.answer };
    }
  }

  return { found: false, message: "No FAQ match found" };
}

// =============================================================================
// REAL-TIME ANALYTICS ENDPOINT
// =============================================================================

/**
 * Get real-time AI chatbot metrics (for admin dashboard)
 */
exports.getChatbotMetrics = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in",
    );
  }

  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();
  if (userDoc.data()?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const db = admin.firestore();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - 7);

  // Today's stats
  const todayChats = await db
    .collection("chat_logs")
    .where("timestamp", ">=", today)
    .get();

  const todayEscalations = await db
    .collection("escalations")
    .where("created_at", ">=", today)
    .get();

  const todayToolUsage = await db
    .collection("tool_usage")
    .where("timestamp", ">=", today)
    .get();

  // Week stats for trends
  const weekChats = await db
    .collection("chat_logs")
    .where("timestamp", ">=", thisWeek)
    .get();

  const weekFeedback = await db
    .collection("feedback")
    .where("timestamp", ">=", thisWeek)
    .get();

  // Calculate average satisfaction
  let avgSatisfaction = 0;
  if (weekFeedback.size > 0) {
    const totalScore = weekFeedback.docs.reduce(
      (sum, doc) => sum + (doc.data().score || 0),
      0,
    );
    avgSatisfaction = (totalScore / weekFeedback.size).toFixed(1);
  }

  // Tool breakdown
  const toolCounts = {};
  todayToolUsage.forEach((doc) => {
    const tool = doc.data().tool;
    toolCounts[tool] = (toolCounts[tool] || 0) + 1;
  });

  // Unique customers today
  const uniqueCustomers = new Set();
  todayChats.forEach((doc) => uniqueCustomers.add(doc.data().phone));

  return {
    today: {
      total_messages: todayChats.size,
      unique_customers: uniqueCustomers.size,
      escalations: todayEscalations.size,
      escalation_rate:
        todayChats.size > 0
          ? ((todayEscalations.size / todayChats.size) * 100).toFixed(1) + "%"
          : "0%",
      tool_usage: toolCounts,
    },
    week: {
      total_messages: weekChats.size,
      avg_daily_messages: (weekChats.size / 7).toFixed(0),
      avg_satisfaction: avgSatisfaction,
      total_feedback: weekFeedback.size,
    },
    top_tools: Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count })),
    generated_at: now.toISOString(),
  };
});

// =============================================================================
// QUICK REPLIES & SUGGESTED ACTIONS
// =============================================================================

/**
 * Generate quick reply suggestions based on context
 */
function generateQuickReplies(lastMessage, customerContext) {
  const suggestions = [];
  const lowerMessage = lastMessage.toLowerCase();

  // Context-aware suggestions
  if (customerContext.active_shipments.length > 0) {
    suggestions.push({
      text: "Track my shipment",
      payload: `Track ${customerContext.active_shipments[0].tracking}`,
    });
  }

  if (
    lowerMessage.includes("hello") ||
    lowerMessage.includes("hi") ||
    lowerMessage.includes("hola")
  ) {
    suggestions.push({
      text: "Check inventory",
      payload: "What's my inventory status?",
    });
    suggestions.push({
      text: "Get a quote",
      payload: "I need a quote for storage",
    });
    suggestions.push({
      text: "Track package",
      payload: "Where is my shipment?",
    });
  }

  if (lowerMessage.includes("price") || lowerMessage.includes("cost")) {
    suggestions.push({
      text: "Storage rates",
      payload: "How much is storage?",
    });
    suggestions.push({
      text: "Full quote",
      payload: "I need a complete quote",
    });
  }

  if (
    lowerMessage.includes("problem") ||
    lowerMessage.includes("issue") ||
    lowerMessage.includes("help")
  ) {
    suggestions.push({
      text: "Talk to human",
      payload: "Connect me with support",
    });
    suggestions.push({ text: "File claim", payload: "I need to file a claim" });
  }

  return suggestions.slice(0, 3); // Max 3 suggestions
}

// =============================================================================
// ENHANCED WEBHOOK WITH ALL FEATURES
// =============================================================================

/**
 * Enhanced WhatsApp Webhook with feedback detection and quick replies
 */
exports.whatsappWebhookEnhanced = functions.https.onRequest(
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    const incomingMessage = req.body.Body;
    const fromNumber = req.body.From;
    const cleanPhone = fromNumber.replace("whatsapp:", "");

    console.log(`Enhanced Webhook - From ${fromNumber}: ${incomingMessage}`);

    // Check if this is a feedback rating response
    const feedbackMatch = incomingMessage.match(
      /^[1-5]$|^(excellent|good|okay|poor|bad)$/i,
    );
    if (feedbackMatch) {
      const rating = await processFeedbackRating(cleanPhone, feedbackMatch[0]);
      if (rating) {
        const thankYouMessage =
          rating.score >= 4
            ? `🙏 Thank you for the ${rating.label} rating! We appreciate your business.`
            : `🙏 Thank you for your feedback. We're sorry we didn't meet expectations. A team member will reach out to make things right.`;

        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${thankYouMessage}</Message></Response>`;
        res.set("Content-Type", "text/xml");
        return res.send(twiml);
      }
    }

    // Check FAQ/Knowledge Base first (fast response for common questions)
    const faqResult = searchKnowledgeBase(incomingMessage);
    if (faqResult.found && incomingMessage.length < 50) {
      // For simple FAQ questions, respond directly
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${faqResult.answer}</Message></Response>`;
      res.set("Content-Type", "text/xml");

      // Still log the interaction
      await admin.firestore().collection("chat_logs").add({
        phone: cleanPhone,
        user_message: incomingMessage,
        ai_response: faqResult.answer,
        source: "faq",
        faq_topic: faqResult.topic,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.send(twiml);
    }

    // Full Claude AI processing for complex queries
    const history = await getConversationHistory(cleanPhone);
    await saveMessage(cleanPhone, "user", incomingMessage);

    const aiResponse = await generateClaudeResponseWithTools(
      incomingMessage,
      history,
      cleanPhone,
    );
    await saveMessage(cleanPhone, "assistant", aiResponse);

    // Log the conversation
    await admin.firestore().collection("chat_logs").add({
      phone: cleanPhone,
      user_message: incomingMessage,
      ai_response: aiResponse,
      source: "claude_ai",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send response
    const escapedResponse = aiResponse
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapedResponse}</Message></Response>`;
    res.set("Content-Type", "text/xml");
    res.send(twiml);
  },
);

// =============================================================================
// WEEKLY SUMMARY FOR CUSTOMERS
// =============================================================================

/**
 * Send weekly activity summary to active customers
 */
exports.weeklyCustomerSummary = functions.pubsub
  .schedule("every monday 09:00")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const db = admin.firestore();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Find customers with activity this week
    const activeConversations = await db
      .collection("conversations")
      .where("updated_at", ">=", oneWeekAgo)
      .get();

    let summariesSent = 0;

    for (const doc of activeConversations.docs) {
      const conv = doc.data();
      if (!conv.phone || !twilioClient) continue;

      // Get their week's stats
      const shipments = await db
        .collection("shipments")
        .where("customer_phone", "==", conv.phone)
        .where("created_at", ">=", oneWeekAgo)
        .get();

      const delivered = shipments.docs.filter(
        (d) => d.data().status === "delivered",
      ).length;
      const inTransit = shipments.docs.filter((d) =>
        ["shipped", "out_for_delivery"].includes(d.data().status),
      ).length;

      if (shipments.size > 0) {
        const message =
          `📊 Miami Alliance 3PL Weekly Summary:\n\n` +
          `📦 Shipments: ${shipments.size}\n` +
          `✅ Delivered: ${delivered}\n` +
          `🚚 In Transit: ${inTransit}\n\n` +
          `Questions? Just reply to this message!`;

        await sendWhatsApp(conv.phone, message);
        summariesSent++;
      }
    }

    return { weekly_summaries_sent: summariesSent };
  });

// =============================================================================
// VIP DETECTION & AUTO-UPGRADE
// =============================================================================

/**
 * Auto-detect VIP customers based on activity
 * Runs weekly to upgrade loyal customers
 */
exports.autoDetectVIPs = functions.pubsub
  .schedule("every sunday 23:00")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const db = admin.firestore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all customers with significant activity
    const shipments = await db
      .collection("shipments")
      .where("created_at", ">=", thirtyDaysAgo)
      .get();

    // Count shipments per customer
    const customerShipments = {};
    shipments.forEach((doc) => {
      const phone = doc.data().customer_phone;
      if (phone) {
        customerShipments[phone] = (customerShipments[phone] || 0) + 1;
      }
    });

    // VIP threshold: 10+ shipments in 30 days
    let upgradedCount = 0;
    for (const [phone, count] of Object.entries(customerShipments)) {
      if (count >= 10) {
        const cleanPhone = phone.replace(/\D/g, "");
        const prefRef = db.collection("customer_preferences").doc(cleanPhone);
        const prefDoc = await prefRef.get();

        if (!prefDoc.exists || !prefDoc.data().vip) {
          await prefRef.set(
            {
              vip: true,
              vip_since: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          // Notify customer of VIP status
          if (twilioClient) {
            await sendWhatsApp(
              phone,
              `👑 Congratulations! You've been upgraded to VIP status at Miami Alliance 3PL!\n\nYour benefits:\n✨ Priority handling\n📞 Direct line access\n💰 Preferred rates\n🚀 Same-day processing\n\nThank you for your loyalty!`,
            );
          }
          upgradedCount++;
        }
      }
    }

    return { new_vips: upgradedCount };
  });

// =============================================================================
// ORDER MODIFICATION TOOL
// =============================================================================

// Add to TOOLS array
const ORDER_MODIFICATION_TOOL = {
  name: "modify_order",
  description: "Modify or cancel an existing shipment order.",
  input_schema: {
    type: "object",
    properties: {
      tracking_number: {
        type: "string",
        description: "Tracking number of the order to modify",
      },
      action: {
        type: "string",
        enum: [
          "update_address",
          "add_item",
          "remove_item",
          "hold",
          "cancel",
          "expedite",
        ],
        description: "Type of modification",
      },
      new_address: {
        type: "string",
        description: "New delivery address (for update_address)",
      },
      item_sku: {
        type: "string",
        description: "SKU to add or remove",
      },
      item_quantity: {
        type: "number",
        description: "Quantity to add",
      },
      reason: {
        type: "string",
        description: "Reason for modification",
      },
    },
    required: ["tracking_number", "action"],
  },
};

async function toolModifyOrder(input, customerPhone) {
  const db = admin.firestore();

  // Find the shipment
  const snapshot = await db
    .collection("shipments")
    .where("tracking_number", "==", input.tracking_number)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      success: false,
      message: `Order ${input.tracking_number} not found`,
    };
  }

  const shipmentDoc = snapshot.docs[0];
  const shipment = shipmentDoc.data();

  // Verify ownership
  if (shipment.customer_phone !== customerPhone) {
    return { success: false, message: "Order does not belong to your account" };
  }

  // Check if modifiable (not shipped yet)
  const nonModifiableStatuses = ["shipped", "out_for_delivery", "delivered"];
  if (
    nonModifiableStatuses.includes(shipment.status) &&
    input.action !== "hold"
  ) {
    return {
      success: false,
      message: `Cannot modify order - status is "${shipment.status}". Contact support for assistance.`,
    };
  }

  // Process modification
  const updates = { updated_at: admin.firestore.FieldValue.serverTimestamp() };
  let resultMessage = "";

  switch (input.action) {
    case "update_address":
      if (!input.new_address) {
        return { success: false, message: "New address required" };
      }
      updates.destination = input.new_address;
      updates.address_updated = true;
      resultMessage = `Address updated to: ${input.new_address}`;
      break;

    case "add_item":
      if (!input.item_sku) {
        return { success: false, message: "Item SKU required" };
      }
      const currentItems = shipment.items || [];
      currentItems.push({
        sku: input.item_sku,
        quantity: input.item_quantity || 1,
      });
      updates.items = currentItems;
      resultMessage = `Added ${input.item_quantity || 1}x ${input.item_sku} to order`;
      break;

    case "remove_item":
      if (!input.item_sku) {
        return { success: false, message: "Item SKU required" };
      }
      const filteredItems = (shipment.items || []).filter(
        (i) => i.sku !== input.item_sku,
      );
      updates.items = filteredItems;
      resultMessage = `Removed ${input.item_sku} from order`;
      break;

    case "hold":
      updates.status = "on_hold";
      updates.hold_reason = input.reason || "Customer request";
      resultMessage = "Order placed on hold. Contact us to release.";
      break;

    case "cancel":
      if (shipment.status !== "pending" && shipment.status !== "processing") {
        return {
          success: false,
          message: `Cannot cancel - order is already ${shipment.status}`,
        };
      }
      updates.status = "cancelled";
      updates.cancelled_reason = input.reason || "Customer request";
      updates.cancelled_at = admin.firestore.FieldValue.serverTimestamp();
      resultMessage = "Order cancelled successfully";
      break;

    case "expedite":
      updates.service_level = "express";
      updates.expedited = true;
      updates.expedite_reason = input.reason;
      resultMessage = "Order upgraded to express shipping!";
      // Alert warehouse
      const adminPhone = functions.config().admin?.phone;
      if (adminPhone && twilioClient) {
        await sendWhatsApp(
          adminPhone,
          `🚀 EXPEDITE REQUEST: ${input.tracking_number} - Customer: ${customerPhone}`,
        );
      }
      break;

    default:
      return { success: false, message: "Invalid action" };
  }

  // Apply updates
  await shipmentDoc.ref.update(updates);

  // Log modification
  await db.collection("order_modifications").add({
    tracking_number: input.tracking_number,
    action: input.action,
    details: input,
    customer_phone: customerPhone,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    tracking_number: input.tracking_number,
    action: input.action,
    message: resultMessage,
  };
}

// =============================================================================
// CONVERSATION CONTEXT PRUNING
// =============================================================================

/**
 * Prune old conversation history to manage memory
 * Keeps last 20 messages but summarizes older ones
 */
async function pruneConversationHistory(phoneNumber) {
  const db = admin.firestore();
  const convRef = db.collection("conversations").doc(phoneNumber);
  const doc = await convRef.get();

  if (!doc.exists) return;

  const data = doc.data();
  const messages = data.messages || [];

  if (messages.length <= 20) return; // No pruning needed

  // Keep last 20 messages
  const recentMessages = messages.slice(-20);

  // Create summary of older messages
  const olderMessages = messages.slice(0, -20);
  const summary = {
    type: "conversation_summary",
    message_count: olderMessages.length,
    first_date: olderMessages[0]?.timestamp,
    last_date: olderMessages[olderMessages.length - 1]?.timestamp,
    topics: extractKeyTopics(olderMessages),
  };

  // Update with pruned history
  await convRef.update({
    messages: recentMessages,
    history_summary: admin.firestore.FieldValue.arrayUnion(summary),
    pruned_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Scheduled pruning of all conversations
 */
exports.pruneConversations = functions.pubsub
  .schedule("every day 04:00")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const db = admin.firestore();

    // Find conversations with more than 20 messages
    const conversations = await db.collection("conversations").get();

    let prunedCount = 0;
    for (const doc of conversations.docs) {
      const messages = doc.data().messages || [];
      if (messages.length > 20) {
        await pruneConversationHistory(doc.id);
        prunedCount++;
      }
    }

    return { conversations_pruned: prunedCount };
  });

// =============================================================================
// A/B TESTING SYSTEM
// =============================================================================

const AB_TEST_VARIANTS = {
  greeting: {
    A: "Hi! I'm the Miami Alliance 3PL AI assistant. How can I help you today?",
    B: "Hey there! 👋 Miami Alliance 3PL here. What can I do for you?",
    C: "Welcome to Miami Alliance 3PL! I'm your AI logistics assistant. What brings you here today?",
  },
  closing: {
    A: "Is there anything else I can help you with?",
    B: "Need anything else? I'm here!",
    C: "Happy to help with anything else - just ask!",
  },
};

function getABVariant(phoneNumber, testName) {
  // Deterministic variant based on phone number hash
  const hash = phoneNumber.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  const variants = Object.keys(AB_TEST_VARIANTS[testName] || {});
  if (variants.length === 0) return null;

  const index = Math.abs(hash) % variants.length;
  return {
    variant: variants[index],
    text: AB_TEST_VARIANTS[testName][variants[index]],
  };
}

async function logABTestImpression(phoneNumber, testName, variant) {
  await admin.firestore().collection("ab_tests").add({
    phone: phoneNumber,
    test: testName,
    variant: variant,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// =============================================================================
// MULTI-LANGUAGE SUPPORT
// =============================================================================

const TRANSLATIONS = {
  es: {
    welcome:
      "¡Hola! Soy el asistente de IA de Miami Alliance 3PL. ¿Cómo puedo ayudarte hoy?",
    not_found:
      "No encontré información sobre eso. ¿Puedo ayudarte con algo más?",
    error:
      "Lo siento, tengo problemas ahora. Por favor intenta de nuevo o llama al (305) 555-3PL1.",
    escalation:
      "Te he conectado con nuestro equipo. Un agente te contactará pronto.",
    feedback_request:
      "⭐ ¿Cómo fue tu experiencia con Miami Alliance 3PL hoy?\n\nResponde con un número:\n1️⃣ Excelente\n2️⃣ Bueno\n3️⃣ Regular\n4️⃣ Malo\n5️⃣ Muy malo",
    thank_you: "¡Gracias por tu comentario!",
  },
};

function translate(key, language) {
  if (language === "en") return null; // Use default English
  return TRANSLATIONS[language]?.[key] || null;
}

// =============================================================================
// SMART RESPONSE CACHING
// =============================================================================

const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedResponse(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const cached = responseCache.get(normalizedQuery);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.response;
  }

  return null;
}

function cacheResponse(query, response) {
  const normalizedQuery = query.toLowerCase().trim();
  responseCache.set(normalizedQuery, {
    response: response,
    timestamp: Date.now(),
  });

  // Cleanup old entries (keep max 100)
  if (responseCache.size > 100) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
}

// =============================================================================
// ADMIN NOTIFICATIONS DASHBOARD DATA
// =============================================================================

/**
 * Get pending items for admin dashboard notifications
 */
exports.getAdminNotifications = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(context.auth.uid)
      .get();
    if (userDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Admin only");
    }

    const db = admin.firestore();

    // Get pending items
    const [escalations, pickups, claims, lowFeedback] = await Promise.all([
      db.collection("escalations").where("status", "==", "open").get(),
      db.collection("pickup_requests").where("status", "==", "pending").get(),
      db.collection("claims").where("status", "==", "submitted").get(),
      db
        .collection("feedback")
        .where("score", "<=", 2)
        .orderBy("score")
        .orderBy("timestamp", "desc")
        .limit(5)
        .get(),
    ]);

    return {
      escalations: {
        count: escalations.size,
        items: escalations.docs.slice(0, 5).map((d) => ({
          id: d.id,
          phone: d.data().customer_phone,
          reason: d.data().reason,
          urgency: d.data().urgency,
          created: d.data().created_at,
        })),
      },
      pickup_requests: {
        count: pickups.size,
        items: pickups.docs.slice(0, 5).map((d) => ({
          id: d.id,
          phone: d.data().customer_phone,
          type: d.data().type,
          date: d.data().preferred_date,
        })),
      },
      claims: {
        count: claims.size,
        items: claims.docs.slice(0, 5).map((d) => ({
          id: d.id,
          tracking: d.data().tracking_number,
          type: d.data().claim_type,
          amount: d.data().claimed_amount,
        })),
      },
      low_feedback: {
        count: lowFeedback.size,
        items: lowFeedback.docs.map((d) => ({
          phone: d.data().phone,
          score: d.data().score,
          label: d.data().label,
        })),
      },
      generated_at: new Date().toISOString(),
    };
  },
);

// =============================================================================
// BULK MESSAGE SENDER (CAMPAIGNS)
// =============================================================================

/**
 * Send bulk messages to customers (for announcements, promotions)
 */
exports.sendBulkMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in",
    );
  }

  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();
  if (userDoc.data()?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const { message, filter, testMode } = data;

  if (!message) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Message required",
    );
  }

  const db = admin.firestore();
  let recipients = [];

  // Build recipient list based on filter
  if (filter === "all") {
    const convs = await db.collection("conversations").get();
    recipients = convs.docs.map((d) => d.data().phone).filter(Boolean);
  } else if (filter === "vip") {
    const vips = await db
      .collection("customer_preferences")
      .where("vip", "==", true)
      .get();
    recipients = vips.docs.map((d) => "+" + d.id);
  } else if (filter === "active") {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const active = await db
      .collection("conversations")
      .where("updated_at", ">=", oneWeekAgo)
      .get();
    recipients = active.docs.map((d) => d.data().phone).filter(Boolean);
  }

  // Remove duplicates
  recipients = [...new Set(recipients)];

  // Test mode - only send to admin
  if (testMode) {
    recipients = [functions.config().admin?.phone || "+17868738819"];
  }

  // Send messages (with rate limiting)
  let sent = 0;
  let failed = 0;

  for (const phone of recipients) {
    try {
      if (twilioClient) {
        await sendWhatsApp(phone, message);
        sent++;
        // Rate limit: 1 message per second
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to send to ${phone}:`, error.message);
      failed++;
    }
  }

  // Log campaign
  await db.collection("campaigns").add({
    message: message,
    filter: filter,
    test_mode: testMode,
    recipients_count: recipients.length,
    sent: sent,
    failed: failed,
    sent_by: context.auth.uid,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    recipients: recipients.length,
    sent: sent,
    failed: failed,
    test_mode: testMode,
  };
});

// =============================================================================
// PHOTO & MEDIA HANDLING
// =============================================================================

/**
 * Handle incoming WhatsApp media (photos, documents)
 */
async function handleIncomingMedia(req, customerPhone) {
  const db = admin.firestore();
  const numMedia = parseInt(req.body.NumMedia) || 0;

  if (numMedia === 0) return null;

  const mediaItems = [];
  for (let i = 0; i < numMedia; i++) {
    const url = req.body[`MediaUrl${i}`];
    const type = req.body[`MediaContentType${i}`];

    if (url) {
      const mediaDoc = await db.collection("media_uploads").add({
        customer_phone: customerPhone,
        url: url,
        content_type: type,
        processed: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      mediaItems.push({
        id: mediaDoc.id,
        url: url,
        type: type.startsWith("image/") ? "photo" : "document",
      });
    }
  }

  return mediaItems;
}

// =============================================================================
// SHOPIFY INTEGRATION
// =============================================================================

exports.shopifyOrderCreated = functions.https.onRequest(async (req, res) => {
  const order = req.body;
  const db = admin.firestore();

  try {
    const trackingNumber = `MA3PL-${Date.now().toString(36).toUpperCase()}`;

    const shipment = {
      tracking_number: trackingNumber,
      source: "shopify",
      shopify_order_id: order.id,
      shopify_order_number: order.order_number,
      customer_email: order.email,
      customer_phone: order.phone || order.billing_address?.phone,
      destination: order.shipping_address
        ? `${order.shipping_address.address1}, ${order.shipping_address.city}, ${order.shipping_address.province_code} ${order.shipping_address.zip}`
        : "Unknown",
      items: (order.line_items || []).map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
      })),
      status: "pending",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("shipments").add(shipment);

    if (shipment.customer_phone && twilioClient) {
      await sendWhatsApp(
        shipment.customer_phone,
        `🛍️ Order received! Your Shopify order #${order.order_number} is being processed.\nTracking: ${trackingNumber}`,
      );
    }

    res.status(200).json({ success: true, tracking_number: trackingNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// SLACK INTEGRATION
// =============================================================================

async function sendSlackNotification(message, channel = "operations") {
  const slackWebhook = functions.config().slack?.[channel];
  if (!slackWebhook) return { success: false };

  try {
    const https = require("https");
    const url = new URL(slackWebhook);
    const payload = JSON.stringify({
      text: message,
      username: "Miami 3PL Bot",
      icon_emoji: ":package:",
    });

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => resolve({ success: res.statusCode === 200 }),
      );
      req.write(payload);
      req.end();
    });
  } catch (error) {
    return { success: false };
  }
}

exports.slackCommand = functions.https.onRequest(async (req, res) => {
  const command = req.body.text || "";
  const parts = command.split(" ");
  const action = parts[0];
  const param = parts[1];
  let response = "";

  if (action === "track" && param) {
    const db = admin.firestore();
    const snapshot = await db
      .collection("shipments")
      .where("tracking_number", "==", param)
      .limit(1)
      .get();
    if (snapshot.empty) {
      response = `Shipment ${param} not found`;
    } else {
      const s = snapshot.docs[0].data();
      response = `📦 *${param}*\nStatus: ${s.status}\nDestination: ${s.destination || "N/A"}`;
    }
  } else {
    response = "*Commands:*\n• `/ma3pl track MA3PL-XXXX`\n• `/ma3pl stats`";
  }

  res.json({ response_type: "in_channel", text: response });
});

exports.onEscalationCreated = functions.firestore
  .document("escalations/{escalationId}")
  .onCreate(async (snap) => {
    const e = snap.data();
    await sendSlackNotification(
      `🚨 *New Escalation*\nCustomer: ${e.customer_phone}\nReason: ${e.reason}\nUrgency: ${e.urgency || "medium"}`,
      "escalations",
    );
  });

// =============================================================================
// WOOCOMMERCE INTEGRATION
// =============================================================================

exports.woocommerceOrderCreated = functions.https.onRequest(
  async (req, res) => {
    const order = req.body;
    const db = admin.firestore();

    try {
      const trackingNumber = `MA3PL-${Date.now().toString(36).toUpperCase()}`;

      const shipment = {
        tracking_number: trackingNumber,
        source: "woocommerce",
        woo_order_id: order.id,
        customer_email: order.billing?.email,
        customer_phone: order.billing?.phone,
        destination: order.shipping
          ? `${order.shipping.address_1}, ${order.shipping.city}, ${order.shipping.state} ${order.shipping.postcode}`
          : "Unknown",
        items: (order.line_items || []).map((item) => ({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
        })),
        status: "pending",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("shipments").add(shipment);

      if (shipment.customer_phone && twilioClient) {
        await sendWhatsApp(
          shipment.customer_phone,
          `🛒 Order received! Tracking: ${trackingNumber}`,
        );
      }

      res.status(200).json({ success: true, tracking_number: trackingNumber });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// =============================================================================
// CARRIER TRACKING SYNC
// =============================================================================

exports.syncCarrierTracking = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    const db = admin.firestore();
    const shipments = await db
      .collection("shipments")
      .where("status", "in", ["shipped", "in_transit", "out_for_delivery"])
      .limit(100)
      .get();

    // In production, call FedEx/UPS/USPS APIs here
    return { synced: shipments.size };
  });

// =============================================================================
// INVENTORY FORECASTING
// =============================================================================

exports.inventoryForecast = functions.pubsub
  .schedule("every monday 07:00")
  .timeZone("America/New_York")
  .onRun(async () => {
    const db = admin.firestore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inventory = await db.collection("inventory").get();
    const forecasts = [];

    for (const doc of inventory.docs) {
      const item = doc.data();
      const dailyConsumption = (item.monthly_orders || 0) / 30;
      const daysOfStock =
        dailyConsumption > 0
          ? Math.floor(item.quantity / dailyConsumption)
          : 999;

      if (daysOfStock < 14 && item.quantity > 0) {
        forecasts.push({
          sku: item.sku,
          name: item.name,
          current_qty: item.quantity,
          days_remaining: daysOfStock,
          reorder_qty: Math.ceil(dailyConsumption * 30),
        });
      }
    }

    await db.collection("inventory_forecasts").add({
      forecasts: forecasts,
      generated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { forecasts_generated: forecasts.length };
  });

// =============================================================================
// CUSTOMER HEALTH SCORING
// =============================================================================

exports.getCustomerHealth = functions.https.onCall(async (data, context) => {
  if (!context.auth)
    throw new functions.https.HttpsError("unauthenticated", "Login required");

  const db = admin.firestore();
  const { customerId } = data;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [shipmentsSnap, feedbackSnap, escalationsSnap] = await Promise.all([
    db
      .collection("shipments")
      .where("customer_id", "==", customerId)
      .where("created_at", ">=", thirtyDaysAgo)
      .get(),
    db
      .collection("feedback")
      .where("customer_id", "==", customerId)
      .limit(5)
      .get(),
    db
      .collection("escalations")
      .where("customer_id", "==", customerId)
      .where("status", "==", "open")
      .get(),
  ]);

  let score = 50;
  score += Math.min(shipmentsSnap.size * 2, 20);
  if (feedbackSnap.size > 0) {
    const avg =
      feedbackSnap.docs.reduce((sum, d) => sum + (d.data().score || 3), 0) /
      feedbackSnap.size;
    score += (avg - 3) * 5;
  }
  score -= escalationsSnap.size * 5;
  score = Math.max(0, Math.min(100, score));

  return {
    score: score,
    label:
      score >= 80
        ? "excellent"
        : score >= 60
          ? "good"
          : score >= 40
            ? "fair"
            : "at_risk",
    shipments_30d: shipmentsSnap.size,
    open_escalations: escalationsSnap.size,
  };
});

// =============================================================================
// ANALYTICS EXPORT
// =============================================================================

exports.exportAnalytics = functions.https.onCall(async (data, context) => {
  if (!context.auth)
    throw new functions.https.HttpsError("unauthenticated", "Login required");

  const db = admin.firestore();
  const { startDate, endDate, type } = data;
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (type === "conversations") {
    const chats = await db
      .collection("chat_logs")
      .where("timestamp", ">=", start)
      .where("timestamp", "<=", end)
      .get();

    return {
      total_messages: chats.size,
      unique_customers: new Set(chats.docs.map((d) => d.data().phone)).size,
      generated_at: new Date().toISOString(),
    };
  }

  if (type === "feedback") {
    const feedback = await db
      .collection("feedback")
      .where("timestamp", ">=", start)
      .where("timestamp", "<=", end)
      .get();

    const scores = feedback.docs.map((d) => d.data().score);
    return {
      total_responses: feedback.size,
      average_score: scores.length
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        : 0,
      generated_at: new Date().toISOString(),
    };
  }

  return { error: "Invalid report type" };
});

// =============================================================================
// PORTAL CHAT WIDGET WEBHOOK
// =============================================================================

exports.portalChatWebhook = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, sessionId, userId, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  const db = admin.firestore();

  // Get user context if logged in
  let userContext = "";
  if (userId) {
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const user = userDoc.data();
        userContext = `\n\nLOGGED IN USER: ${user.company || user.email}`;

        // Get their recent shipments
        const shipments = await db
          .collection("shipments")
          .where("customer_id", "==", userId)
          .orderBy("created_at", "desc")
          .limit(3)
          .get();

        if (!shipments.empty) {
          userContext += `\nRecent shipments: ${shipments.docs.map((d) => `${d.data().tracking_number} (${d.data().status})`).join(", ")}`;
        }
      }
    } catch (e) {
      console.error("Error getting user context:", e);
    }
  }

  // Generate AI response
  if (!anthropicClient) {
    return res.json({
      response: "AI assistant is offline. Please contact us at (305) 555-3PL1.",
    });
  }

  try {
    const messages = (history || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    messages.push({ role: "user", content: message });

    const response = await anthropicClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPT + userContext,
      tools: TOOLS,
      messages: messages,
    });

    // Handle tool use
    let finalResponse = "";
    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((b) => b.type === "tool_use");
      if (toolUse) {
        const result = await executeTool(toolUse.name, toolUse.input, userId);

        // Continue conversation with tool result
        const followUp = await anthropicClient.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: SYSTEM_PROMPT + userContext,
          messages: [
            ...messages,
            { role: "assistant", content: response.content },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(result),
                },
              ],
            },
          ],
        });

        finalResponse =
          followUp.content.find((b) => b.type === "text")?.text || "";
      }
    } else {
      finalResponse =
        response.content.find((b) => b.type === "text")?.text || "";
    }

    // Log chat
    await db.collection("portal_chats").add({
      session_id: sessionId,
      user_id: userId,
      user_message: message,
      ai_response: finalResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ response: finalResponse });
  } catch (error) {
    console.error("Portal chat error:", error);
    res.json({
      response:
        "Sorry, I'm having trouble. Please try again or contact support.",
    });
  }
});

// =============================================================================
// ADMIN: RESOLVE ESCALATION
// =============================================================================

exports.resolveEscalation = functions.https.onCall(async (data, context) => {
  if (!context.auth)
    throw new functions.https.HttpsError("unauthenticated", "Login required");

  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();
  if (userDoc.data()?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const { escalationId, resolution, notifyCustomer } = data;
  const db = admin.firestore();

  // Update escalation
  const escRef = db.collection("escalations").doc(escalationId);
  await escRef.update({
    status: "resolved",
    resolution: resolution,
    resolved_by: context.auth.uid,
    resolved_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Notify customer if requested
  if (notifyCustomer) {
    const esc = await escRef.get();
    const phone = esc.data().customer_phone;
    if (phone && twilioClient) {
      await sendWhatsApp(
        phone,
        `✅ Your support request has been resolved: ${resolution}\n\nThank you for your patience!`,
      );
    }
  }

  return { success: true };
});

// =============================================================================
// ADMIN: DASHBOARD STATS REALTIME
// =============================================================================

exports.getDashboardStats = functions.https.onCall(async (data, context) => {
  if (!context.auth)
    throw new functions.https.HttpsError("unauthenticated", "Login required");

  const db = admin.firestore();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [chats, escalations, shipments, feedback] = await Promise.all([
    db.collection("chat_logs").where("timestamp", ">=", today).get(),
    db.collection("escalations").where("status", "==", "open").get(),
    db.collection("shipments").where("created_at", ">=", today).get(),
    db.collection("feedback").where("timestamp", ">=", today).get(),
  ]);

  const avgScore =
    feedback.size > 0
      ? (
          feedback.docs.reduce((sum, d) => sum + (d.data().score || 0), 0) /
          feedback.size
        ).toFixed(1)
      : "N/A";

  return {
    conversations_today: chats.size,
    unique_customers: new Set(chats.docs.map((d) => d.data().phone)).size,
    open_escalations: escalations.size,
    shipments_today: shipments.size,
    avg_satisfaction: avgScore,
    generated_at: now.toISOString(),
  };
});
