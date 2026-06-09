/**
 * Miami Alliance 3PL - Portal UI Components
 * @module portal
 * @version 2.0.0
 * @description Shared UI components, utilities, and portal functionality
 *
 * SECTION IDs:
 * - UI-001: Toast Notifications
 * - UI-002: Loading States
 * - UI-003: Modal System
 * - UI-004: Navigation & Sidebar
 * - UI-005: Role-Based UI
 * - UI-006: Form Utilities
 * - UI-007: Table Utilities
 * - UI-008: Date & Format Utilities
 * - UI-009: Error Handling UI
 * - UI-010: Keyboard Shortcuts
 */

// ============================================================
// UI-001: TOAST NOTIFICATIONS
// ============================================================

class ToastManager {
  constructor() {
    this.container = null;
    this.queue = [];
    this.maxVisible = 3;
    this.defaultDuration = 4000;
    this.init();
  }

  init() {
    this.container = document.createElement("div");
    this.container.id = "toast-container";
    this.container.className = "toast-container";
    this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column-reverse;
            gap: 10px;
            max-width: 400px;
        `;
    document.body.appendChild(this.container);
  }

  show(message, type = "info", duration = this.defaultDuration) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const colors = {
      success: { bg: "#10b981", icon: "✓" },
      error: { bg: "#ef4444", icon: "✗" },
      warning: { bg: "#f59e0b", icon: "⚠" },
      info: { bg: "#3b82f6", icon: "ℹ" },
    };

    const { bg, icon } = colors[type] || colors.info;

    toast.style.cssText = `
            background: ${bg};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 500;
            animation: slideIn 0.3s ease;
            cursor: pointer;
        `;

    const iconSpan = document.createElement("span");
    iconSpan.style.fontSize = "1.2em";
    iconSpan.textContent = icon;
    const textSpan = document.createElement("span");
    textSpan.textContent = message;
    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);

    toast.onclick = () => this.dismiss(toast);
    this.container.appendChild(toast);

    // Auto dismiss
    setTimeout(() => this.dismiss(toast), duration);

    // Manage queue
    const toasts = this.container.querySelectorAll(".toast");
    if (toasts.length > this.maxVisible) {
      this.dismiss(toasts[0]);
    }

    return toast;
  }

  dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }

  success(message, duration) {
    return this.show(message, "success", duration);
  }
  error(message, duration) {
    return this.show(message, "error", duration);
  }
  warning(message, duration) {
    return this.show(message, "warning", duration);
  }
  info(message, duration) {
    return this.show(message, "info", duration);
  }
}

// Add toast animations
const toastStyles = document.createElement("style");
toastStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyles);

// ============================================================
// UI-002: LOADING STATES
// ============================================================

class LoadingManager {
  constructor() {
    this.overlay = null;
    this.spinners = new Map();
  }

  createOverlay() {
    if (this.overlay) return this.overlay;

    this.overlay = document.createElement("div");
    this.overlay.id = "loading-overlay";
    this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            flex-direction: column;
            gap: 20px;
        `;

    this.overlay.innerHTML = `
            <div class="loading-spinner" style="
                width: 50px;
                height: 50px;
                border: 4px solid #e5e7eb;
                border-top-color: #1e3a5f;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <div class="loading-text" style="color: #1e3a5f; font-weight: 500;">Loading...</div>
        `;

    const spinStyle = document.createElement("style");
    spinStyle.textContent =
      "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(spinStyle);

    document.body.appendChild(this.overlay);
    return this.overlay;
  }

  showFullScreen(message = "Loading...") {
    const overlay = this.createOverlay();
    overlay.querySelector(".loading-text").textContent = message;
    overlay.style.display = "flex";
  }

  hideFullScreen() {
    if (this.overlay) {
      this.overlay.style.display = "none";
    }
  }

  showInline(element, size = "small") {
    const id = `spinner-${Date.now()}`;
    const spinner = document.createElement("span");
    spinner.className = "inline-spinner";
    spinner.id = id;

    const sizeMap = { small: "16px", medium: "24px", large: "32px" };
    const spinnerSize = sizeMap[size] || size;

    spinner.style.cssText = `
            display: inline-block;
            width: ${spinnerSize};
            height: ${spinnerSize};
            border: 2px solid #e5e7eb;
            border-top-color: #1e3a5f;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 8px;
        `;

    if (typeof element === "string") {
      element = document.querySelector(element);
    }

    if (element) {
      element.appendChild(spinner);
      this.spinners.set(id, spinner);
    }

    return id;
  }

  hideInline(id) {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.remove();
      this.spinners.delete(id);
    }
  }

  setButtonLoading(button, loading, originalText = null) {
    if (typeof button === "string") {
      button = document.querySelector(button);
    }
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.innerHTML =
        '<span class="inline-spinner" style="width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;margin-right:8px;"></span>Loading...';
    } else {
      button.disabled = false;
      button.textContent =
        originalText || button.dataset.originalText || "Submit";
    }
  }
}

// ============================================================
// UI-003: MODAL SYSTEM
// ============================================================

class ModalManager {
  constructor() {
    this.modals = new Map();
    this.activeModals = [];
    this.init();
  }

  init() {
    // Close on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.activeModals.length > 0) {
        this.close(this.activeModals[this.activeModals.length - 1]);
      }
    });
  }

  create(id, options = {}) {
    const modal = document.createElement("div");
    modal.id = id;
    modal.className = "modal-overlay";
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

    const content = document.createElement("div");
    content.className = "modal-content";
    content.style.cssText = `
            background: white;
            border-radius: 12px;
            max-width: ${options.width || "500px"};
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        `;

    if (options.title) {
      const header = document.createElement("div");
      header.className = "modal-header";
      header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
            `;
      header.innerHTML = `
                <h2 style="margin:0;font-size:1.25rem;">${options.title}</h2>
                <button class="modal-close" style="background:none;border:none;font-size:1.5rem;cursor:pointer;padding:0;line-height:1;">&times;</button>
            `;
      content.appendChild(header);
      header.querySelector(".modal-close").onclick = () => this.close(id);
    }

    const body = document.createElement("div");
    body.className = "modal-body";
    body.style.cssText = "padding: 20px;";
    content.appendChild(body);

    if (options.footer) {
      const footer = document.createElement("div");
      footer.className = "modal-footer";
      footer.style.cssText = `
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 16px 20px;
                border-top: 1px solid #e5e7eb;
            `;
      content.appendChild(footer);
    }

    modal.appendChild(content);

    // Close on backdrop click
    if (options.closeOnBackdrop !== false) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.close(id);
      });
    }

    document.body.appendChild(modal);
    this.modals.set(id, modal);

    return modal;
  }

  open(id) {
    const modal = this.modals.get(id) || document.getElementById(id);
    if (modal) {
      modal.style.display = "flex";
      this.activeModals.push(id);
      document.body.style.overflow = "hidden";
    }
  }

  close(id) {
    const modal = this.modals.get(id) || document.getElementById(id);
    if (modal) {
      modal.style.display = "none";
      this.activeModals = this.activeModals.filter((m) => m !== id);
      if (this.activeModals.length === 0) {
        document.body.style.overflow = "";
      }
    }
  }

  setContent(id, html) {
    const modal = this.modals.get(id) || document.getElementById(id);
    if (modal) {
      const body = modal.querySelector(".modal-body");
      if (body) body.innerHTML = html;
    }
  }

  confirm(message, options = {}) {
    return new Promise((resolve) => {
      const id = `confirm-${Date.now()}`;
      const modal = this.create(id, {
        title: options.title || "Confirm",
        width: "400px",
        footer: true,
      });

      const bodyEl = modal.querySelector(".modal-body");
      const msgP = document.createElement("p");
      msgP.style.margin = "0";
      msgP.textContent = message;
      bodyEl.innerHTML = "";
      bodyEl.appendChild(msgP);
      modal.querySelector(".modal-footer").innerHTML = `
                <button class="btn btn-outline modal-cancel">Cancel</button>
                <button class="btn btn-primary modal-confirm">${options.confirmText || "Confirm"}</button>
            `;

      modal.querySelector(".modal-cancel").onclick = () => {
        this.close(id);
        modal.remove();
        resolve(false);
      };

      modal.querySelector(".modal-confirm").onclick = () => {
        this.close(id);
        modal.remove();
        resolve(true);
      };

      this.open(id);
    });
  }
}

// ============================================================
// UI-004: NAVIGATION & SIDEBAR
// ============================================================

class NavigationManager {
  constructor() {
    this.sidebar = null;
    this.currentPage = null;
    this.init();
  }

  init() {
    this.sidebar = document.querySelector(".portal-sidebar");
    this.currentPage =
      window.location.pathname.split("/").pop() || "dashboard.html";

    // Set active nav item
    this.setActiveNavItem();

    // Mobile sidebar toggle
    const toggleBtn = document.querySelector(".sidebar-toggle");
    if (toggleBtn && this.sidebar) {
      toggleBtn.addEventListener("click", () => this.toggleSidebar());
    }

    // Close sidebar on link click (mobile)
    const navItems = document.querySelectorAll(".portal-nav-item");
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        if (window.innerWidth < 768) {
          this.closeSidebar();
        }
      });
    });
  }

  setActiveNavItem() {
    const navItems = document.querySelectorAll(".portal-nav-item");
    navItems.forEach((item) => {
      item.classList.remove("active");
      if (item.getAttribute("href") === this.currentPage) {
        item.classList.add("active");
      }
    });
  }

  toggleSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.toggle("active");
    }
  }

  closeSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.remove("active");
    }
  }

  showRoleNavigation(role) {
    const employeeNav = document.getElementById("employee-nav");
    const adminNav = document.getElementById("admin-nav");

    if (role === "admin") {
      if (employeeNav) employeeNav.style.display = "block";
      if (adminNav) adminNav.style.display = "block";
    } else if (role === "employee") {
      if (employeeNav) employeeNav.style.display = "block";
      if (adminNav) adminNav.style.display = "none";
    } else {
      if (employeeNav) employeeNav.style.display = "none";
      if (adminNav) adminNav.style.display = "none";
    }
  }
}

// ============================================================
// UI-005: ROLE-BASED UI
// ============================================================

class RoleUIManager {
  constructor() {
    this.currentRole = "customer";
  }

  setRole(role) {
    this.currentRole = role;
    this.applyRoleUI();
  }

  applyRoleUI() {
    // Show/hide elements based on role
    document.querySelectorAll("[data-role]").forEach((el) => {
      const roles = el.dataset.role.split(",").map((r) => r.trim());
      el.style.display = roles.includes(this.currentRole) ? "" : "none";
    });

    // Admin-only elements
    document.querySelectorAll("[data-admin-only]").forEach((el) => {
      el.style.display = this.currentRole === "admin" ? "" : "none";
    });

    // Staff-only elements
    document.querySelectorAll("[data-staff-only]").forEach((el) => {
      el.style.display =
        this.currentRole === "admin" || this.currentRole === "employee"
          ? ""
          : "none";
    });

    // Customer-only elements
    document.querySelectorAll("[data-customer-only]").forEach((el) => {
      el.style.display = this.currentRole === "customer" ? "" : "none";
    });
  }

  getRoleBadge(role) {
    const badges = {
      admin: '<span class="role-badge admin">ADMIN</span>',
      employee: '<span class="role-badge employee">STAFF</span>',
      customer: '<span class="role-badge customer">CUSTOMER</span>',
    };
    return badges[role] || "";
  }
}

// ============================================================
// UI-006: FORM UTILITIES
// ============================================================

class FormUtils {
  static validate(form) {
    let isValid = true;
    const errors = [];

    form.querySelectorAll("[required]").forEach((field) => {
      if (!field.value.trim()) {
        isValid = false;
        field.classList.add("error");
        errors.push(`${field.name || field.id} is required`);
      } else {
        field.classList.remove("error");
      }
    });

    // Email validation
    form.querySelectorAll('[type="email"]').forEach((field) => {
      if (field.value && !this.isValidEmail(field.value)) {
        isValid = false;
        field.classList.add("error");
        errors.push("Invalid email format");
      }
    });

    return { isValid, errors };
  }

  static isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  static serialize(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (data[key]) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  static populate(form, data) {
    for (const [key, value] of Object.entries(data)) {
      const field = form.querySelector(`[name="${key}"], #${key}`);
      if (field) {
        if (field.type === "checkbox") {
          field.checked = !!value;
        } else if (field.type === "radio") {
          form.querySelector(`[name="${key}"][value="${value}"]`).checked =
            true;
        } else {
          field.value = value;
        }
      }
    }
  }

  static reset(form) {
    form.reset();
    form
      .querySelectorAll(".error")
      .forEach((el) => el.classList.remove("error"));
  }
}

// ============================================================
// UI-007: TABLE UTILITIES
// ============================================================

class TableUtils {
  static create(data, columns, options = {}) {
    const table = document.createElement("table");
    table.className = "data-table";

    // Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col.label || col.key;
      if (col.sortable) th.style.cursor = "pointer";
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    if (data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="${columns.length}" style="text-align:center;padding:20px;color:#6b7280;">${options.emptyMessage || "No data"}</td>`;
      tbody.appendChild(tr);
    } else {
      data.forEach((row, index) => {
        const tr = document.createElement("tr");
        columns.forEach((col) => {
          const td = document.createElement("td");
          const value = row[col.key];
          td.innerHTML = col.render
            ? col.render(value, row, index)
            : (value ?? "-");
          tbody.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);

    return table;
  }

  static renderBadge(status) {
    const colors = {
      pending: "#f59e0b",
      in_transit: "#3b82f6",
      delivered: "#10b981",
      cancelled: "#ef4444",
      paid: "#10b981",
      sent: "#3b82f6",
      overdue: "#ef4444",
      draft: "#6b7280",
    };

    const color = colors[status] || "#6b7280";
    return `<span style="background:${color}20;color:${color};padding:4px 8px;border-radius:12px;font-size:0.75rem;font-weight:600;">${status.replace("_", " ").toUpperCase()}</span>`;
  }
}

// ============================================================
// UI-008: DATE & FORMAT UTILITIES
// ============================================================

class FormatUtils {
  static date(dateString, format = "short") {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date)) return "-";

    const options = {
      short: { month: "short", day: "numeric", year: "numeric" },
      long: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
      time: { hour: "2-digit", minute: "2-digit" },
      datetime: {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    };

    return date.toLocaleDateString("en-US", options[format] || options.short);
  }

  static currency(amount, currency = "USD") {
    if (typeof amount !== "number") return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  }

  static number(num, decimals = 0) {
    if (typeof num !== "number") return "-";
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: decimals,
    }).format(num);
  }

  static percentage(value, decimals = 0) {
    if (typeof value !== "number") return "-";
    return `${value.toFixed(decimals)}%`;
  }

  static relativeTime(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return this.date(dateString);
  }

  static truncate(str, length = 50) {
    if (!str) return "";
    return str.length > length ? str.substring(0, length) + "..." : str;
  }

  static initials(name) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  }
}

// ============================================================
// UI-009: ERROR HANDLING UI
// ============================================================

class ErrorUI {
  static show(error, container = null) {
    const message =
      typeof error === "string" ? error : error.message || "An error occurred";

    const errorEl = document.createElement("div");
    errorEl.className = "error-message";
    errorEl.style.cssText = `
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 10px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
    errorEl.innerHTML = `
            <span style="font-size:1.2em;">⚠️</span>
            <span>${message}</span>
            <button style="margin-left:auto;background:none;border:none;font-size:1.2em;cursor:pointer;" onclick="this.parentElement.remove()">×</button>
        `;

    if (container) {
      if (typeof container === "string") {
        container = document.querySelector(container);
      }
      container.insertBefore(errorEl, container.firstChild);
    } else {
      document
        .querySelector(".portal-main, main, body")
        .insertBefore(
          errorEl,
          document.querySelector(".portal-main, main, body").firstChild,
        );
    }

    return errorEl;
  }

  static showEmpty(container, message = "No data available", icon = "📭") {
    if (typeof container === "string") {
      container = document.querySelector(container);
    }

    container.innerHTML = `
            <div style="text-align:center;padding:40px;color:#6b7280;">
                <div style="font-size:3rem;margin-bottom:16px;">${icon}</div>
                <div style="font-size:1.1rem;">${message}</div>
            </div>
        `;
  }
}

// ============================================================
// UI-010: KEYBOARD SHORTCUTS
// ============================================================

class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.init();
  }

  init() {
    document.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      const key = this.getKeyCombo(e);
      const handler = this.shortcuts.get(key);
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    });
  }

  getKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push("ctrl");
    if (e.shiftKey) parts.push("shift");
    if (e.altKey) parts.push("alt");
    parts.push(e.key.toLowerCase());
    return parts.join("+");
  }

  register(combo, handler, description = "") {
    this.shortcuts.set(combo.toLowerCase(), handler);
  }

  unregister(combo) {
    this.shortcuts.delete(combo.toLowerCase());
  }

  enable() {
    this.enabled = true;
  }
  disable() {
    this.enabled = false;
  }
}

// ============================================================
// INITIALIZATION & EXPORTS
// ============================================================

// Create global instances
const toast = new ToastManager();
const loading = new LoadingManager();
const modal = new ModalManager();
const nav = new NavigationManager();
const roleUI = new RoleUIManager();
const shortcuts = new KeyboardShortcuts();

// Register default shortcuts
shortcuts.register(
  "ctrl+/",
  () => {
    if (window.MA3PL && window.MA3PL.toast) {
      window.MA3PL.toast.info(
        "Shortcuts: Ctrl+/ Help | Ctrl+D Diagnostics | Escape Close modal",
      );
    }
  },
  "Show help",
);

shortcuts.register(
  "ctrl+d",
  () => {
    if (window.runDiagnostics) {
      window.runDiagnostics();
    }
  },
  "Run diagnostics",
);

// Global availability
window.MA3PL = {
  toast,
  loading,
  modal,
  nav,
  roleUI,
  shortcuts,
  FormUtils,
  TableUtils,
  FormatUtils,
  ErrorUI,
};

export {
  ToastManager,
  LoadingManager,
  ModalManager,
  NavigationManager,
  RoleUIManager,
  FormUtils,
  TableUtils,
  FormatUtils,
  ErrorUI,
  KeyboardShortcuts,
  toast,
  loading,
  modal,
  nav,
  roleUI,
  shortcuts,
};
