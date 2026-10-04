/* ==========================================================================
   Miami Alliance 3PL — Lead Capture Engine
   Exit-intent popup, newsletter signup, visitor-to-lead conversion
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY_EXIT = "ma3pl_exit_popup_shown";
  const STORAGE_KEY_NEWS = "ma3pl_newsletter_subscribed";
  const STORAGE_KEY_LEAD = "ma3pl_lead_captured";
  const EXIT_COOLDOWN_HOURS = 72; // Don't show exit popup again for 72 hours
  const SCROLL_TRIGGER_PERCENT = 60; // Show scroll popup after 60% scroll
  const TIME_TRIGGER_MS = 45000; // Show timed popup after 45 seconds

  // ─── Firestore (lazy) ───
  // This used to look for the old global `firebase` (compat SDK), which no page
  // loads, so every popup and newsletter lead stayed in the visitor's own
  // localStorage (2026-10-04, TN-1057). Load the v10 modular SDK on demand
  // instead, with the same project config as js/firebase.js.
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA4wMm8-QmZGt3lJcZgTpbBa1W_TklrmRg",
    authDomain: "miamialliance3pl.firebaseapp.com",
    projectId: "miamialliance3pl",
    storageBucket: "miamialliance3pl.firebasestorage.app",
    messagingSenderId: "657614666588",
    appId: "1:657614666588:web:20e50484fe5d90b5aa5f99",
    measurementId: "G-KTW0F25ZM1",
  };
  const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.7.1/";
  let dbPromise = null;
  function getDb() {
    if (!dbPromise) {
      dbPromise = Promise.all([
        import(FIREBASE_SDK + "firebase-app.js"),
        import(FIREBASE_SDK + "firebase-firestore.js"),
      ])
        .then(function (mods) {
          const app = mods[0].getApps()[0] || mods[0].initializeApp(FIREBASE_CONFIG);
          return { db: mods[1].getFirestore(app), fs: mods[1] };
        })
        .catch(function (err) {
          dbPromise = null;
          throw err;
        });
    }
    return dbPromise;
  }

  // Where the visitor came from (recorded by js/analytics.js captureTouch)
  function readStored(storage, key) {
    try {
      const raw = window[storage].getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function withAttribution(data) {
    if (data.attribution) return data;
    const ga = document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
    data.attribution = {
      first_touch: readStored("localStorage", "ma3pl_first_touch"),
      session_touch: readStored("sessionStorage", "ma3pl_session_touch"),
      ai_context: readStored("sessionStorage", "ma3pl_ai_discovery_context"),
      ga_client_id: ga ? ga[1] : "",
    };
    return data;
  }

  // ─── GA4 helper ───
  function trackEvent(eventName, params) {
    if (typeof gtag === "function") {
      gtag("event", eventName, params);
    }
    if (typeof MA3PLAnalytics !== "undefined" && MA3PLAnalytics.track) {
      MA3PLAnalytics.track(eventName, params);
    }
  }

  // ─── Check cooldown ───
  function isOnCooldown(key, hours) {
    try {
      const ts = localStorage.getItem(key);
      if (!ts) return false;
      const elapsed = Date.now() - parseInt(ts, 10);
      return elapsed < hours * 3600 * 1000;
    } catch (e) {
      return false;
    }
  }

  function setCooldown(key) {
    try {
      localStorage.setItem(key, Date.now().toString());
    } catch (e) {}
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  EXIT-INTENT POPUP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function createExitPopup() {
    if (document.getElementById("exit-popup-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "exit-popup-overlay";
    overlay.className = "lead-popup-overlay";
    overlay.innerHTML = `
      <div class="lead-popup" role="dialog" aria-modal="true" aria-label="Special offer before you go">
        <button class="lead-popup-close" aria-label="Close popup">&times;</button>
        <div class="lead-popup-icon">📦</div>
        <h2 class="lead-popup-title">Wait — Don't Leave Empty-Handed!</h2>
        <p class="lead-popup-subtitle">Get <strong>$100 in free storage credit</strong> applied to your first invoice + a free custom 3PL strategy session.</p>
        <form id="exit-popup-form" class="lead-popup-form">
          <input type="text" name="name" placeholder="Your name" required autocomplete="name" class="lead-popup-input">
          <input type="email" name="email" placeholder="Work email" required autocomplete="email" class="lead-popup-input">
          <input type="tel" name="phone" placeholder="Phone (optional)" autocomplete="tel" class="lead-popup-input">
          <select name="volume" class="lead-popup-input lead-popup-select">
            <option value="">Monthly order volume</option>
            <option value="1-50">1–50 orders/mo</option>
            <option value="51-200">51–200 orders/mo</option>
            <option value="201-500">201–500 orders/mo</option>
            <option value="501-1000">501–1,000 orders/mo</option>
            <option value="1000+">1,000+ orders/mo</option>
          </select>
          <button type="submit" class="lead-popup-btn">Claim My $100 Credit →</button>
        </form>
        <p class="lead-popup-trust">🔒 No spam. Unsubscribe anytime. We respect your privacy.</p>
        <p class="lead-popup-skip"><a href="#" id="exit-popup-skip">No thanks, I'll pay full price</a></p>
      </div>
    `;
    document.body.appendChild(overlay);

    // Close handlers
    overlay
      .querySelector(".lead-popup-close")
      .addEventListener("click", closeExitPopup);
    document
      .getElementById("exit-popup-skip")
      .addEventListener("click", function (e) {
        e.preventDefault();
        closeExitPopup();
      });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeExitPopup();
    });

    // Form submit
    document
      .getElementById("exit-popup-form")
      .addEventListener("submit", function (e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone") || "",
          volume: formData.get("volume") || "",
          source: "exit_intent_popup",
          offer: "$100_first_month",
          page: window.location.pathname,
          captured_at: new Date().toISOString(),
          status: "new",
        };
        saveLead(data);
        showPopupSuccess(overlay.querySelector(".lead-popup"));
        setCooldown(STORAGE_KEY_EXIT, EXIT_COOLDOWN_HOURS);
        setCooldown(STORAGE_KEY_LEAD);
        trackEvent("generate_lead", {
          event_category: "lead_capture",
          event_label: "exit_intent_popup",
          value: 100,
        });
      });

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add("active");
      trackEvent("popup_shown", { popup_type: "exit_intent" });
    });
  }

  function closeExitPopup() {
    const overlay = document.getElementById("exit-popup-overlay");
    if (overlay) {
      overlay.classList.remove("active");
      setCooldown(STORAGE_KEY_EXIT);
      setTimeout(() => overlay.remove(), 300);
      trackEvent("popup_closed", { popup_type: "exit_intent" });
    }
  }

  function showPopupSuccess(popup) {
    popup.innerHTML = `
      <div class="lead-popup-success">
        <div class="lead-popup-icon">✅</div>
        <h2 class="lead-popup-title">You're In!</h2>
        <p class="lead-popup-subtitle">Your $100 free storage credit is reserved! A 3PL strategist will reach out within 24 hours.</p>
        <button class="lead-popup-btn" onclick="document.getElementById('exit-popup-overlay').classList.remove('active'); setTimeout(function(){document.getElementById('exit-popup-overlay').remove()},300);">Got It!</button>
      </div>
    `;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  NEWSLETTER FOOTER SIGNUP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function injectNewsletterFooter() {
    const footerGrid = document.querySelector(".footer-grid");
    if (!footerGrid || document.getElementById("footer-newsletter")) return;

    const newsletterDiv = document.createElement("div");
    newsletterDiv.id = "footer-newsletter";
    newsletterDiv.className = "footer-newsletter";
    newsletterDiv.innerHTML = `
      <h4>📬 Stay in the Loop</h4>
      <p>Get 3PL tips, tariff updates, and exclusive deals — straight to your inbox.</p>
      <form id="newsletter-form" class="newsletter-form">
        <div class="newsletter-input-group">
          <input type="email" name="email" placeholder="Enter your email" required autocomplete="email" class="newsletter-input" aria-label="Email for newsletter">
          <button type="submit" class="newsletter-btn" aria-label="Subscribe">Subscribe</button>
        </div>
      </form>
      <p class="newsletter-note" id="newsletter-status">Join 200+ brands getting smarter about logistics.</p>
    `;

    // Insert before footer-contact (last column)
    const footerContact = footerGrid.querySelector(".footer-contact");
    if (footerContact) {
      footerGrid.insertBefore(newsletterDiv, footerContact);
    } else {
      footerGrid.appendChild(newsletterDiv);
    }

    // Newsletter form submit
    document
      .getElementById("newsletter-form")
      .addEventListener("submit", function (e) {
        e.preventDefault();
        const email = e.target
          .querySelector('input[name="email"]')
          .value.trim();
        if (!email) return;

        const data = {
          email: email,
          source: "footer_newsletter",
          page: window.location.pathname,
          captured_at: new Date().toISOString(),
          status: "subscribed",
        };
        saveLead(data);
        setCooldown(STORAGE_KEY_NEWS);

        const status = document.getElementById("newsletter-status");
        status.textContent = "✅ Subscribed! Check your inbox.";
        status.style.color = "#10b981";
        e.target.querySelector('input[name="email"]').value = "";
        e.target.querySelector("button").textContent = "Subscribed ✓";
        e.target.querySelector("button").disabled = true;

        trackEvent("newsletter_signup", {
          event_category: "lead_capture",
          event_label: "footer_newsletter",
        });
      });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SAVE LEAD TO FIRESTORE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function saveLead(data) {
    const lead = withAttribution(data);
    getDb()
      .then(function (h) {
        return h.fs.addDoc(h.fs.collection(h.db, "leads"), lead);
      })
      .then(function (doc) {
        console.log("[LeadCapture] Lead saved:", doc.id);
      })
      .catch(function (err) {
        console.warn(
          "[LeadCapture] Firestore save failed, using fallback:",
          err.message,
        );
        saveLeadFallback(lead);
      });
  }

  function saveLeadFallback(data) {
    // Store in localStorage as backup
    try {
      const leads = JSON.parse(
        localStorage.getItem("ma3pl_pending_leads") || "[]",
      );
      leads.push(data);
      localStorage.setItem("ma3pl_pending_leads", JSON.stringify(leads));
      console.log("[LeadCapture] Lead stored locally (offline backup)");
    } catch (e) {
      console.error("[LeadCapture] Could not save lead:", e);
    }
  }

  // Flush any pending offline leads when Firestore becomes available
  function flushPendingLeads() {
    let leads;
    try {
      leads = JSON.parse(localStorage.getItem("ma3pl_pending_leads") || "[]");
    } catch (e) {
      return;
    }
    if (!leads.length) return;
    getDb()
      .then(function (h) {
        const batch = h.fs.writeBatch(h.db);
        leads.forEach(function (lead) {
          lead.flushed_at = new Date().toISOString();
          batch.set(h.fs.doc(h.fs.collection(h.db, "leads")), lead);
        });
        return batch.commit();
      })
      .then(function () {
        localStorage.removeItem("ma3pl_pending_leads");
        console.log(
          "[LeadCapture] Flushed",
          leads.length,
          "pending leads to Firestore",
        );
      })
      .catch(function () {});
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TRIGGER LOGIC
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  let popupTriggered = false;

  function shouldShowPopup() {
    // Don't show if already triggered this session
    if (popupTriggered) return false;
    // Don't show on portal/login pages
    if (
      window.location.pathname.includes("portal") ||
      window.location.pathname.includes("login")
    )
      return false;
    // Don't show if on cooldown
    if (isOnCooldown(STORAGE_KEY_EXIT, EXIT_COOLDOWN_HOURS)) return false;
    // Don't show if lead already captured
    if (isOnCooldown(STORAGE_KEY_LEAD, 720)) return false; // 30 days
    return true;
  }

  function triggerPopup(reason) {
    if (!shouldShowPopup()) return;
    popupTriggered = true;
    console.log("[LeadCapture] Popup triggered:", reason);
    createExitPopup();
  }

  // Exit intent: mouse leaves viewport (desktop)
  function setupExitIntent() {
    document.addEventListener("mouseout", function (e) {
      if (e.clientY <= 0 && e.relatedTarget === null) {
        triggerPopup("exit_intent");
      }
    });
  }

  // Scroll trigger: user scrolls past threshold then scrolls back up
  let maxScroll = 0;
  function setupScrollTrigger() {
    window.addEventListener(
      "scroll",
      function () {
        const scrollPercent =
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) *
          100;
        if (scrollPercent > maxScroll) maxScroll = scrollPercent;
        // If user scrolled past threshold and is now scrolling back up (leaving)
        if (
          maxScroll > SCROLL_TRIGGER_PERCENT &&
          scrollPercent < maxScroll - 15
        ) {
          triggerPopup("scroll_retreat");
        }
      },
      { passive: true },
    );
  }

  // Timed trigger: user on page for X seconds without converting
  function setupTimedTrigger() {
    setTimeout(function () {
      triggerPopup("time_on_page");
    }, TIME_TRIGGER_MS);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  INIT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function init() {
    // Always inject newsletter in footer
    injectNewsletterFooter();

    // Set up popup triggers (only on public-facing pages)
    if (
      !window.location.pathname.includes("portal") &&
      !window.location.pathname.includes("login") &&
      !window.location.pathname.includes("admin")
    ) {
      setupExitIntent();
      setupScrollTrigger();
      setupTimedTrigger();
    }

    // Flush any pending offline leads
    setTimeout(flushPendingLeads, 3000);

    console.log("[LeadCapture] Engine initialized");
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
