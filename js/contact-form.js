/**
 * Miami Alliance 3PL - Contact Form
 * @description Saves the contact.html quote request to Firestore and says where the visitor came from.
 *
 * Until 2026-10-04 the form showed "Thank you" and kept nothing: every submission
 * since launch was lost (TN-1057). It now writes to `quote_requests` (public create
 * is allowed in firestore.rules; staff read it in portal/admin-panel.html) and only
 * thanks the visitor once Firestore confirms the save. On failure the text stays in
 * the form and the visitor is pointed to e-mail and WhatsApp.
 *
 * Attribution saved with each lead:
 * - how_found: the visitor's own answer to "How did you find us?"
 * - attribution.first_touch / session_touch: referrer, landing page and UTM tags,
 *   recorded by js/analytics.js (captureTouch)
 * - attribution.ai_context: the AI-assistant referral detected by js/analytics.js
 * - attribution.ga_client_id: ties the lead to its GA4 sessions
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Same project config as js/firebase.js
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA4wMm8-QmZGt3lJcZgTpbBa1W_TklrmRg",
    authDomain: "miamialliance3pl.firebaseapp.com",
    projectId: "miamialliance3pl",
    storageBucket: "miamialliance3pl.firebasestorage.app",
    messagingSenderId: "657614666588",
    appId: "1:657614666588:web:20e50484fe5d90b5aa5f99",
    measurementId: "G-KTW0F25ZM1"
};

const COLLECTION = 'quote_requests';
const SAVE_TIMEOUT_MS = 15000;
const MAX_LEN = { name: 120, company: 160, email: 200, phone: 40, message: 4000 };

const form = document.getElementById('contact-form');
const params = new URLSearchParams(window.location.search);

function getDb() {
    const app = getApps()[0] || initializeApp(FIREBASE_CONFIG);
    return getFirestore(app);
}

function readJSON(storageName, key) {
    try {
        const raw = window[storageName].getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function gaClientId() {
    const match = document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
    return match ? match[1] : '';
}

function field(name, max) {
    const value = (new FormData(form).get(name) || '').toString().trim();
    return max ? value.slice(0, max) : value;
}

function selectedText(id) {
    const select = document.getElementById(id);
    if (!select || !select.value) return '';
    return select.options[select.selectedIndex].text.trim();
}

// The homepage funnel card links here with ?service=&volume=&email= - keep what the visitor already chose
function ensureOption(select, value, label) {
    if (!select || !value) return;
    const exists = Array.from(select.options).some(o => o.value === value);
    if (!exists) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    }
    select.value = value;
}

function prefill() {
    const email = params.get('email');
    if (email && form.email && !form.email.value) form.email.value = email.slice(0, MAX_LEN.email);
    const service = (params.get('service') || '').slice(0, 80);
    ensureOption(document.getElementById('service'), service, service);
    const volume = (params.get('volume') || '').slice(0, 40);
    ensureOption(document.getElementById('volume'), volume, volume + ' orders');
}

function toast(message, ok) {
    const el = document.createElement('div');
    el.setAttribute('role', ok ? 'status' : 'alert');
    el.setAttribute('aria-live', ok ? 'polite' : 'assertive');
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:' + (ok ? '#10b981' : '#dc2626') + ';color:white;padding:16px 24px;border-radius:12px;font-weight:500;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.15);opacity:0;transform:translateY(12px);transition:opacity 0.3s,transform 0.3s;max-width:360px;';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function() {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    });
    setTimeout(function() {
        el.style.opacity = '0';
        el.style.transform = 'translateY(12px)';
        setTimeout(function() { el.remove(); }, 300);
    }, ok ? 4000 : 10000);
}

function track(success) {
    if (window.MA3PLAnalytics) {
        MA3PLAnalytics.trackFormSubmit('contact_form', success);
    }
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timed out after ' + ms + ' ms')), ms))
    ]);
}

function buildRequest() {
    return {
        name: field('name', MAX_LEN.name),
        company_name: field('company', MAX_LEN.company),
        email: field('email', MAX_LEN.email),
        phone: field('phone', MAX_LEN.phone),
        service: field('service', 80),
        service_type: selectedText('service'),
        volume: selectedText('volume'),
        message: field('message', MAX_LEN.message),
        how_found: field('how_found', 40),
        how_found_label: selectedText('how_found'),
        status: 'new',
        source: 'contact_form',
        form_source: (params.get('source') || '').slice(0, 100),
        page: (window.location.pathname + window.location.search).slice(0, 300),
        lang: (document.documentElement.lang || '').slice(0, 10),
        attribution: {
            first_touch: readJSON('localStorage', 'ma3pl_first_touch'),
            session_touch: readJSON('sessionStorage', 'ma3pl_session_touch'),
            ai_context: readJSON('sessionStorage', 'ma3pl_ai_discovery_context'),
            ga_client_id: gaClientId()
        },
        user_agent: navigator.userAgent.slice(0, 300),
        created_at: new Date().toISOString(),
        submitted_at: serverTimestamp()
    };
}

if (form) {
    prefill();

    const button = form.querySelector('button[type="submit"]');
    let busy = false;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (busy) return;

        // Honeypot: people never see the "website" field; a bot that fills it gets a thank-you and no record
        if (field('website')) {
            toast('Thank you for your message! We will get back to you within 24 hours.', true);
            form.reset();
            return;
        }

        busy = true;
        const buttonHTML = button ? button.innerHTML : '';
        if (button) {
            button.disabled = true;
            button.textContent = 'Sending...';
        }

        try {
            await withTimeout(addDoc(collection(getDb(), COLLECTION), buildRequest()), SAVE_TIMEOUT_MS);
            track(true);
            toast('Thank you for your message! We will get back to you within 24 hours.', true);
            form.reset();
        } catch (error) {
            console.error('[contact-form] save failed:', error);
            track(false);
            toast('Sorry, your message did not go through. Your text is still in the form: please try again, e-mail contact@miamialliance3pl.com or WhatsApp +1 (786) 873-8819.', false);
        } finally {
            busy = false;
            if (button) {
                button.disabled = false;
                button.innerHTML = buttonHTML;
            }
        }
    });
}
