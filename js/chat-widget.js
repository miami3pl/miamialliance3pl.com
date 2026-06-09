/**
 * @fileoverview Miami Alliance 3PL - AI Chat Widget
 *
 * A self-contained, embeddable chat widget that provides AI-powered
 * customer support via the Claude AI chatbot. The widget is fully
 * styled with inline CSS and requires no external dependencies.
 *
 * @version 2.0.0
 * @author Miami Alliance 3PL
 * @license MIT
 *
 * @example
 * // Basic embedding - add to any HTML page:
 * <script src="js/chat-widget.js"></script>
 *
 * @example
 * // The widget will automatically initialize on page load
 * // To programmatically control it:
 * window.MA3PLChat.toggle();  // Open/close the chat window
 * window.MA3PLChat.send('Hello');  // Send a message
 *
 * @example
 * // For logged-in users, include Firebase before the widget:
 * <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js"></script>
 * <script>
 *   firebase.initializeApp({ ... });
 * </script>
 * <script src="js/chat-widget.js"></script>
 * // The widget will automatically detect logged-in users and provide personalized responses
 *
 * ============================================================================
 * FEATURES
 * ============================================================================
 *
 * - Self-contained with inline styles (no external CSS needed)
 * - Responsive design (adapts to mobile screens)
 * - Quick reply suggestions for common queries
 * - Session-based conversation history
 * - Typing indicator animation
 * - Firebase Auth integration (optional - for personalized responses)
 * - Smooth animations and transitions
 * - Dark theme optimized for readability
 *
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 *
 * The CONFIG object can be modified to customize the widget:
 *
 * @property {string} webhookUrl - The Cloud Function endpoint for AI responses
 * @property {string} brandColor - Primary color for buttons and accents (hex)
 * @property {string} position - Widget position: 'bottom-right' or 'bottom-left'
 * @property {string} greeting - Initial greeting message from the AI
 *
 * ============================================================================
 * API REFERENCE
 * ============================================================================
 *
 * window.MA3PLChat.toggle()
 *   Opens or closes the chat window
 *
 * window.MA3PLChat.send(message)
 *   Sends a message to the AI. If message is omitted, uses input field value.
 *
 * window.MA3PLChat.addMessage(role, content)
 *   Adds a message to the chat. role: 'user' | 'assistant'
 *
 * window.MA3PLChat.isOpen
 *   Boolean indicating if chat window is open
 *
 * window.MA3PLChat.messages
 *   Array of all messages in current session
 *
 * window.MA3PLChat.sessionId
 *   Unique session identifier for conversation continuity
 *
 * ============================================================================
 * CLOUD FUNCTION INTEGRATION
 * ============================================================================
 *
 * The widget sends POST requests to portalChatWebhook with:
 * {
 *   message: string,      // User's message
 *   sessionId: string,    // Unique session ID
 *   userId: string|null,  // Firebase UID if logged in
 *   history: array        // Last 10 messages for context
 * }
 *
 * Expected response:
 * {
 *   response: string      // AI's response message
 * }
 *
 * ============================================================================
 */

(function () {
  "use strict";

  /**
   * Widget configuration
   * @constant {Object} CONFIG
   * @property {string} webhookUrl - Cloud Function endpoint for AI chat
   * @property {string} brandColor - Primary accent color (hex)
   * @property {string} position - Widget position on screen
   * @property {string} greeting - Initial AI greeting message
   */
  const CONFIG = {
    webhookUrl:
      "https://us-central1-miamialliance3pl.cloudfunctions.net/portalChatWebhook",
    brandColor: "#6366f1",
    position: "bottom-right",
    greeting:
      "Hi! I'm the Miami Alliance 3PL AI assistant. How can I help you today?",
  };

  // Create widget HTML
  function createWidget() {
    const widget = document.createElement("div");
    widget.id = "ma3pl-chat-widget";
    widget.innerHTML = `
            <style>
                #ma3pl-chat-widget {
                    --chat-primary: ${CONFIG.brandColor};
                    --chat-bg: #1e293b;
                    --chat-surface: #334155;
                    --chat-text: #e2e8f0;
                    --chat-muted: #94a3b8;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    position: fixed;
                    ${CONFIG.position === "bottom-right" ? "right: 20px; bottom: 20px;" : "left: 20px; bottom: 20px;"}
                    z-index: 99999;
                }

                .chat-toggle {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, var(--chat-primary) 0%, #8b5cf6 100%);
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.3s, box-shadow 0.3s;
                }

                .chat-toggle:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 30px rgba(99, 102, 241, 0.6);
                }

                .chat-toggle svg {
                    width: 28px;
                    height: 28px;
                    fill: white;
                }

                .chat-toggle .close-icon { display: none; }
                .chat-toggle.open .chat-icon { display: none; }
                .chat-toggle.open .close-icon { display: block; }

                .chat-window {
                    position: absolute;
                    bottom: 70px;
                    ${CONFIG.position === "bottom-right" ? "right: 0;" : "left: 0;"}
                    width: 380px;
                    height: 500px;
                    background: var(--chat-bg);
                    border-radius: 16px;
                    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.3);
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideUp 0.3s ease;
                }

                .chat-window.open {
                    display: flex;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .chat-header {
                    background: linear-gradient(135deg, var(--chat-primary) 0%, #8b5cf6 100%);
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .chat-header-avatar {
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                }

                .chat-header-info h3 {
                    margin: 0;
                    color: white;
                    font-size: 16px;
                    font-weight: 600;
                }

                .chat-header-info span {
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 12px;
                }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .chat-message {
                    max-width: 85%;
                    padding: 12px 16px;
                    border-radius: 16px;
                    font-size: 14px;
                    line-height: 1.5;
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .chat-message.assistant {
                    background: var(--chat-surface);
                    color: var(--chat-text);
                    align-self: flex-start;
                    border-bottom-left-radius: 4px;
                }

                .chat-message.user {
                    background: var(--chat-primary);
                    color: white;
                    align-self: flex-end;
                    border-bottom-right-radius: 4px;
                }

                .chat-message.typing {
                    background: var(--chat-surface);
                    color: var(--chat-muted);
                    align-self: flex-start;
                }

                .typing-dots {
                    display: flex;
                    gap: 4px;
                }

                .typing-dots span {
                    width: 8px;
                    height: 8px;
                    background: var(--chat-muted);
                    border-radius: 50%;
                    animation: typing 1.4s infinite ease-in-out;
                }

                .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

                @keyframes typing {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-5px); }
                }

                .chat-input-area {
                    padding: 12px 16px;
                    background: var(--chat-surface);
                    display: flex;
                    gap: 8px;
                }

                .chat-input {
                    flex: 1;
                    padding: 12px 16px;
                    background: var(--chat-bg);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    color: var(--chat-text);
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                }

                .chat-input:focus {
                    border-color: var(--chat-primary);
                }

                .chat-input::placeholder {
                    color: var(--chat-muted);
                }

                .chat-send {
                    width: 44px;
                    height: 44px;
                    background: var(--chat-primary);
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s, transform 0.2s;
                }

                .chat-send:hover {
                    background: #4f46e5;
                    transform: scale(1.05);
                }

                .chat-send:disabled {
                    background: var(--chat-muted);
                    cursor: not-allowed;
                    transform: none;
                }

                .chat-send svg {
                    width: 20px;
                    height: 20px;
                    fill: white;
                }

                .quick-replies {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    padding: 0 16px 12px;
                }

                .quick-reply {
                    padding: 8px 16px;
                    background: rgba(99, 102, 241, 0.2);
                    border: 1px solid var(--chat-primary);
                    border-radius: 20px;
                    color: var(--chat-primary);
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .quick-reply:hover {
                    background: var(--chat-primary);
                    color: white;
                }

                .powered-by {
                    text-align: center;
                    padding: 8px;
                    font-size: 11px;
                    color: var(--chat-muted);
                    background: var(--chat-bg);
                }

                .powered-by a {
                    color: var(--chat-primary);
                    text-decoration: none;
                }

                @media (max-width: 480px) {
                    .chat-window {
                        width: calc(100vw - 40px);
                        height: 70vh;
                        bottom: 70px;
                    }
                }
            </style>

            <button class="chat-toggle" onclick="window.MA3PLChat.toggle()" aria-label="Toggle chat assistant" aria-expanded="false">
                <svg class="chat-icon" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                <svg class="close-icon" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>

            <div class="chat-window">
                <div class="chat-header">
                    <div class="chat-header-avatar">🤖</div>
                    <div class="chat-header-info">
                        <h3>Miami Alliance 3PL</h3>
                        <span>AI Assistant</span>
                    </div>
                </div>
                <div class="chat-messages" id="ma3pl-messages"></div>
                <div class="quick-replies" id="ma3pl-quick-replies">
                    <button class="quick-reply" onclick="window.MA3PLChat.send('Track my shipment')">Track shipment</button>
                    <button class="quick-reply" onclick="window.MA3PLChat.send('Check inventory')">Check inventory</button>
                    <button class="quick-reply" onclick="window.MA3PLChat.send('Get a quote')">Get quote</button>
                </div>
                <div class="chat-input-area">
                    <input type="text" class="chat-input" id="ma3pl-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')window.MA3PLChat.send()">
                    <button class="chat-send" onclick="window.MA3PLChat.send()">
                        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
                <div class="powered-by">
                    Powered by <a href="https://claude.ai" target="_blank" rel="noopener">Claude AI</a>
                </div>
            </div>
        `;
    document.body.appendChild(widget);
  }

  // Chat functionality
  const MA3PLChat = {
    isOpen: false,
    messages: [],
    sessionId: null,

    init: function () {
      createWidget();
      this.sessionId = "session_" + Date.now();
      this.addMessage("assistant", CONFIG.greeting);
    },

    toggle: function () {
      this.isOpen = !this.isOpen;
      const toggle = document.querySelector(".chat-toggle");
      const window = document.querySelector(".chat-window");

      toggle.classList.toggle("open", this.isOpen);
      toggle.setAttribute("aria-expanded", String(this.isOpen));
      window.classList.toggle("open", this.isOpen);

      if (this.isOpen) {
        document.getElementById("ma3pl-input").focus();
        if (window.MA3PLAnalytics) {
          MA3PLAnalytics.trackChatOpen();
        }
      }
    },

    addMessage: function (role, content) {
      const container = document.getElementById("ma3pl-messages");
      const msg = document.createElement("div");
      msg.className = `chat-message ${role}`;
      msg.textContent = content;
      container.appendChild(msg);
      container.scrollTop = container.scrollHeight;

      this.messages.push({ role, content });

      // Hide quick replies after first message
      if (this.messages.length > 1) {
        document.getElementById("ma3pl-quick-replies").style.display = "none";
      }
    },

    showTyping: function () {
      const container = document.getElementById("ma3pl-messages");
      const typing = document.createElement("div");
      typing.className = "chat-message typing";
      typing.id = "typing-indicator";
      typing.innerHTML =
        '<div class="typing-dots"><span></span><span></span><span></span></div>';
      container.appendChild(typing);
      container.scrollTop = container.scrollHeight;
    },

    hideTyping: function () {
      const typing = document.getElementById("typing-indicator");
      if (typing) typing.remove();
    },

    send: async function (text) {
      const input = document.getElementById("ma3pl-input");
      const message = text || input.value.trim();

      if (!message) return;

      // Add user message
      this.addMessage("user", message);
      input.value = "";

      // Track chat message
      if (window.MA3PLAnalytics) {
        MA3PLAnalytics.trackChatMessage(this.messages.length <= 2);
      }

      // Show typing indicator
      this.showTyping();

      try {
        // Get user ID from Firebase if available
        let userId = null;
        if (window.firebase && firebase.auth) {
          const user = firebase.auth().currentUser;
          if (user) userId = user.uid;
        }

        // Send to backend
        const response = await fetch(CONFIG.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message,
            sessionId: this.sessionId,
            userId: userId,
            history: this.messages.slice(-10),
          }),
        });

        const data = await response.json();
        this.hideTyping();

        if (data.response) {
          this.addMessage("assistant", data.response);
        } else {
          this.addMessage(
            "assistant",
            "Sorry, I couldn't process that. Please try again.",
          );
        }
      } catch (error) {
        console.error("Chat error:", error);
        this.hideTyping();
        this.addMessage(
          "assistant",
          "Connection error. Please try again or call (305) 555-3PL1.",
        );
      }
    },
  };

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => MA3PLChat.init());
  } else {
    MA3PLChat.init();
  }

  // Expose globally
  window.MA3PLChat = MA3PLChat;
})();
