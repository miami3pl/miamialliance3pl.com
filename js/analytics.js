/**
 * Miami Alliance 3PL Analytics Module
 * GA4 Event Tracking with Safety Checks
 *
 * Usage: MA3PLAnalytics.trackQuoteCalculation('standard', {l:10,w:10,h:10}, 5, 250.00)
 */
(function() {
  'use strict';

  var AI_DISCOVERY_STORAGE_KEY = 'ma3pl_ai_discovery_context';
  var AI_SOURCE_RULES = [
    { pattern: /(^|\.)chatgpt\.com$/i, source: 'chatgpt' },
    { pattern: /(^|\.)chat\.openai\.com$/i, source: 'chatgpt' },
    { pattern: /(^|\.)claude\.ai$/i, source: 'claude' },
    { pattern: /(^|\.)gemini\.google\.com$/i, source: 'gemini' },
    { pattern: /(^|\.)copilot\.com$/i, source: 'copilot' },
    { pattern: /(^|\.)copilot\.microsoft\.com$/i, source: 'copilot' },
    { pattern: /(^|\.)perplexity\.ai$/i, source: 'perplexity' },
    { pattern: /(^|\.)poe\.com$/i, source: 'poe' },
    { pattern: /(^|\.)you\.com$/i, source: 'you' }
  ];

  var MA3PLAnalytics = {
    debug: false,

    /**
     * Core tracking helper - wraps gtag with safety check
     * @param {string} eventName - GA4 event name
     * @param {Object} params - Event parameters
     */
    track: function(eventName, params) {
      var eventParams = this.withAIDiscoveryContext(params || {});

      if (this.debug) {
        console.log('[MA3PL Analytics] Event:', eventName, eventParams);
      }

      if (typeof gtag === 'function') {
        gtag('event', eventName, eventParams);
      } else if (this.debug) {
        console.warn('[MA3PL Analytics] gtag not available');
      }
    },

    getStorage: function() {
      try {
        return window.sessionStorage;
      } catch (error) {
        if (this.debug) {
          console.warn('[MA3PL Analytics] sessionStorage unavailable', error);
        }
        return null;
      }
    },

    getCurrentPath: function() {
      return window.location.pathname + window.location.search;
    },

    extractHostname: function(url) {
      if (!url) {
        return '';
      }

      try {
        return new URL(url).hostname.toLowerCase();
      } catch (error) {
        return '';
      }
    },

    isInternalHost: function(hostname) {
      return hostname === window.location.hostname.toLowerCase();
    },

    normalizeAISource: function(value) {
      var normalized = (value || '').toString().trim().toLowerCase();
      var index;

      if (!normalized) {
        return null;
      }

      for (index = 0; index < AI_SOURCE_RULES.length; index += 1) {
        if (normalized === AI_SOURCE_RULES[index].source || AI_SOURCE_RULES[index].pattern.test(normalized)) {
          return AI_SOURCE_RULES[index].source;
        }
      }

      return null;
    },

    detectAIReferrer: function(hostname) {
      var index;

      for (index = 0; index < AI_SOURCE_RULES.length; index += 1) {
        if (AI_SOURCE_RULES[index].pattern.test(hostname)) {
          return AI_SOURCE_RULES[index].source;
        }
      }

      return null;
    },

    readAIDiscoveryContext: function() {
      var storage = this.getStorage();
      var storedValue;

      if (!storage) {
        return null;
      }

      storedValue = storage.getItem(AI_DISCOVERY_STORAGE_KEY);
      if (!storedValue) {
        return null;
      }

      try {
        return JSON.parse(storedValue);
      } catch (error) {
        storage.removeItem(AI_DISCOVERY_STORAGE_KEY);
        return null;
      }
    },

    writeAIDiscoveryContext: function(context) {
      var storage = this.getStorage();

      if (storage) {
        storage.setItem(AI_DISCOVERY_STORAGE_KEY, JSON.stringify(context));
      }

      return context;
    },

    clearAIDiscoveryContext: function() {
      var storage = this.getStorage();

      if (storage) {
        storage.removeItem(AI_DISCOVERY_STORAGE_KEY);
      }
    },

    detectAIDiscoveryContext: function() {
      var params = new URLSearchParams(window.location.search);
      var referrerHost = this.extractHostname(document.referrer);
      var querySource = params.get('utm_source') || params.get('source') || params.get('ref');
      var normalizedSource = this.normalizeAISource(querySource);

      if (normalizedSource) {
        return {
          ai_discovery: 'true',
          ai_source: normalizedSource,
          ai_medium: (params.get('utm_medium') || 'utm').toLowerCase(),
          ai_referrer_host: referrerHost || querySource.toLowerCase(),
          ai_entry_page: this.getCurrentPath(),
          ai_detection: 'query'
        };
      }

      normalizedSource = this.detectAIReferrer(referrerHost);
      if (normalizedSource) {
        return {
          ai_discovery: 'true',
          ai_source: normalizedSource,
          ai_medium: 'referral',
          ai_referrer_host: referrerHost,
          ai_entry_page: this.getCurrentPath(),
          ai_detection: 'referrer'
        };
      }

      return null;
    },

    withAIDiscoveryContext: function(params) {
      var context = this.readAIDiscoveryContext();
      var enrichedParams = {};
      var key;

      for (key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          enrichedParams[key] = params[key];
        }
      }

      if (!context) {
        return enrichedParams;
      }

      for (key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key) && typeof enrichedParams[key] === 'undefined') {
          enrichedParams[key] = context[key];
        }
      }

      return enrichedParams;
    },

    refreshAIDiscoveryContext: function() {
      var detectedContext = this.detectAIDiscoveryContext();
      var existingContext = this.readAIDiscoveryContext();
      var referrerHost = this.extractHostname(document.referrer);

      if (detectedContext) {
        this.writeAIDiscoveryContext(detectedContext);

        if (
          !existingContext ||
          existingContext.ai_source !== detectedContext.ai_source ||
          existingContext.ai_entry_page !== detectedContext.ai_entry_page ||
          existingContext.ai_referrer_host !== detectedContext.ai_referrer_host
        ) {
          this.track('ai_discovery_visit', detectedContext);
        }

        return detectedContext;
      }

      if (referrerHost && !this.isInternalHost(referrerHost)) {
        this.clearAIDiscoveryContext();
        return null;
      }

      return existingContext;
    },

    /**
     * Track quote calculation completion
     * @param {string} packageType - e.g., 'standard', 'fragile', 'oversized'
     * @param {Object} dimensions - {length, width, height}
     * @param {number} quantity - Number of units
     * @param {number} total - Total quote amount
     */
    trackQuoteCalculation: function(packageType, dimensions, quantity, total) {
      this.track('generate_lead', {
        currency: 'USD',
        value: total,
        lead_source: 'quote_calculator',
        package_type: packageType,
        item_dimensions: dimensions.length + 'x' + dimensions.width + 'x' + dimensions.height,
        quantity: quantity
      });
    },

    /**
     * Track PDF quote download
     * @param {string} quoteNumber - Unique quote identifier
     * @param {number} total - Quote total amount
     */
    trackPDFDownload: function(quoteNumber, total) {
      this.track('file_download', {
        file_name: 'quote_' + quoteNumber + '.pdf',
        file_extension: 'pdf',
        content_type: 'quote',
        currency: 'USD',
        value: total
      });
    },

    /**
     * Track form submission
     * @param {string} formName - Name/identifier of the form
     * @param {boolean} success - Whether submission was successful
     */
    trackFormSubmit: function(formName, success) {
      if (success) {
        this.track('form_submit', {
          form_name: formName,
          form_destination: window.location.pathname,
          form_submit_text: 'Submit'
        });
      } else {
        this.track('form_error', {
          form_name: formName,
          error_type: 'submission_failed'
        });
      }
    },

    /**
     * Track user login
     * @param {string} method - Login method (e.g., 'email', 'google', 'phone')
     */
    trackLogin: function(method) {
      this.track('login', {
        method: method
      });
    },

    /**
     * Track user signup/registration
     * @param {string} method - Signup method (e.g., 'email', 'google', 'phone')
     */
    trackSignup: function(method) {
      this.track('sign_up', {
        method: method
      });
    },

    /**
     * Track CTA button clicks
     * @param {string} buttonText - Text displayed on the button
     * @param {string} location - Where on the page (e.g., 'hero', 'footer', 'sidebar')
     */
    trackCTAClick: function(buttonText, location) {
      this.track('select_content', {
        content_type: 'cta_button',
        content_id: buttonText.toLowerCase().replace(/\s+/g, '_'),
        button_text: buttonText,
        button_location: location
      });
    },

    /**
     * Track chat widget opened
     */
    trackChatOpen: function() {
      this.track('chat_open', {
        chat_type: 'support',
        page_location: window.location.pathname
      });
    },

    /**
     * Track chat message sent
     * @param {boolean} isFirstMessage - Whether this is the first message in the session
     */
    trackChatMessage: function(isFirstMessage) {
      this.track('chat_message', {
        chat_type: 'support',
        is_first_message: isFirstMessage,
        page_location: window.location.pathname
      });
    }
  };

  // Expose to global scope
  window.MA3PLAnalytics = MA3PLAnalytics;
  MA3PLAnalytics.refreshAIDiscoveryContext();

})();
