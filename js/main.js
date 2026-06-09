// Miami Alliance 3PL - Main JavaScript
// Modern interactive features: scroll reveals, counters, floating effects, funnel tracking
// 2026 Redesign by Symbio

document.addEventListener("DOMContentLoaded", function () {
  // =========================================================================
  // Urgency Banner Height → CSS Custom Property
  // Keeps fixed header & hero padding in sync with the banner height
  // =========================================================================
  function updateBannerHeight() {
    var banner = document.querySelector(".urgency-banner");
    if (banner) {
      // Use bounding box + ceil so sub-pixel layout never underestimates height
      var h = Math.ceil(banner.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--banner-height", h + "px");
    } else {
      document.documentElement.style.setProperty("--banner-height", "0px");
    }
  }

  function scheduleBannerHeightUpdate() {
    window.requestAnimationFrame(updateBannerHeight);
  }

  updateBannerHeight();
  window.addEventListener("load", scheduleBannerHeightUpdate);
  window.addEventListener("resize", scheduleBannerHeightUpdate, {
    passive: true,
  });

  // Mobile browsers can change visual viewport without triggering window resize
  if (window.visualViewport) {
    window.visualViewport.addEventListener(
      "resize",
      scheduleBannerHeightUpdate,
      {
        passive: true,
      },
    );
  }

  // Recalculate when banner content wraps/un-wraps (font load, viewport changes)
  if ("ResizeObserver" in window) {
    var observedBanner = document.querySelector(".urgency-banner");
    if (observedBanner) {
      var bannerResizeObserver = new ResizeObserver(scheduleBannerHeightUpdate);
      bannerResizeObserver.observe(observedBanner);
    }
  }

  // =========================================================================
  // Mobile Navigation Toggle
  // =========================================================================
  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.querySelector(".nav-menu");

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      navMenu.classList.toggle("active");
      navToggle.classList.toggle("active");
      var expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
    });

    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", function () {
        navMenu.classList.remove("active");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", function (e) {
      if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
        navMenu.classList.remove("active");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });

    // Close mobile nav on Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navMenu.classList.contains("active")) {
        navMenu.classList.remove("active");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  // =========================================================================
  // Unified Scroll Handler (throttled via rAF — single listener for all scroll effects)
  // Consolidates: header glassmorphism, scroll progress, sticky CTA, WhatsApp float, parallax
  // =========================================================================
  const header = document.querySelector(".header");
  const progressBar = document.querySelector(".scroll-progress");
  let _scrollTicking = false;

  function _onScrollFrame() {
    const scrollY = window.scrollY;

    // 1. Glassmorphism header
    if (header) {
      if (scrollY > 50) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    }

    // 2. Scroll progress bar
    if (progressBar) {
      const docHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      progressBar.style.width =
        (docHeight > 0 ? (scrollY / docHeight) * 100 : 0) + "%";
    }

    // 3. Sticky CTA (show after scrolling past hero)
    if (stickyCta && heroSection) {
      const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
      if (scrollY > heroBottom) {
        stickyCta.classList.add("visible");
      } else {
        stickyCta.classList.remove("visible");
      }
    }

    // 4. WhatsApp float button
    if (whatsappFloat) {
      if (scrollY > 400) {
        whatsappFloat.classList.add("visible");
      } else {
        whatsappFloat.classList.remove("visible");
      }
    }

    // 5. Parallax on hero shapes/icons
    if ((heroShapes || heroFloatingIcons) && scrollY < window.innerHeight) {
      if (heroShapes) {
        heroShapes.style.transform = "translateY(" + scrollY * 0.15 + "px)";
      }
      if (heroFloatingIcons) {
        heroFloatingIcons.style.transform =
          "translateY(" + scrollY * 0.1 + "px)";
      }
    }

    _scrollTicking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!_scrollTicking) {
        _scrollTicking = true;
        requestAnimationFrame(_onScrollFrame);
      }
    },
    { passive: true },
  );

  // =========================================================================
  // Scroll Reveal (Intersection Observer)
  // =========================================================================
  const revealElements = document.querySelectorAll(
    ".reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children",
  );

  if (revealElements.length > 0 && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            // Don't unobserve — keep the class but stop observing for performance
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -60px 0px",
      },
    );

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    // Fallback: show everything immediately
    revealElements.forEach(function (el) {
      el.classList.add("revealed");
    });
  }

  // =========================================================================
  // Animated Counters
  // =========================================================================
  const counters = document.querySelectorAll("[data-count]");

  if (counters.length > 0 && "IntersectionObserver" in window) {
    const counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );

    counters.forEach(function (counter) {
      counterObserver.observe(counter);
    });
  }

  function animateCounter(el) {
    const target = el.getAttribute("data-count");
    const suffix = el.getAttribute("data-suffix") || "";
    const prefix = el.getAttribute("data-prefix") || "";
    const duration = 2000;
    const startTime = performance.now();

    // Check if target is a number
    const numTarget = parseFloat(target);
    if (isNaN(numTarget)) {
      el.textContent = prefix + target + suffix;
      return;
    }

    const isDecimal = target.includes(".");
    const decimalPlaces = isDecimal ? target.split(".")[1].length : 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * numTarget;

      if (isDecimal) {
        el.textContent = prefix + current.toFixed(decimalPlaces) + suffix;
      } else {
        el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  // =========================================================================
  // Sticky CTA & WhatsApp Float — merged into unified scroll handler
  // =========================================================================
  const stickyCta = document.querySelector(".sticky-cta");
  const heroSection = document.querySelector(".hero");
  const whatsappFloat = document.querySelector(".whatsapp-float");

  // =========================================================================
  // Smooth Scroll for Anchor Links
  // =========================================================================
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href !== "#") {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const headerHeight =
            document.querySelector(".header")?.offsetHeight || 70;
          const bannerHeight =
            document.querySelector(".urgency-banner")?.offsetHeight || 0;
          const targetPosition =
            target.getBoundingClientRect().top +
            window.scrollY -
            headerHeight -
            bannerHeight -
            20;
          window.scrollTo({
            top: targetPosition,
            behavior: "smooth",
          });
        }
      }
    });
  });

  // =========================================================================
  // Portal Sidebar Toggle
  // =========================================================================
  const sidebarToggle = document.querySelector(".sidebar-toggle");
  const portalSidebar = document.querySelector(".portal-sidebar");

  if (sidebarToggle && portalSidebar) {
    sidebarToggle.addEventListener("click", function () {
      portalSidebar.classList.toggle("active");
      var expanded = sidebarToggle.getAttribute("aria-expanded") === "true";
      sidebarToggle.setAttribute("aria-expanded", String(!expanded));
    });
  }

  // =========================================================================
  // Form Validation Helper
  // =========================================================================
  const forms = document.querySelectorAll("form[data-validate]");
  forms.forEach((form) => {
    form.addEventListener("submit", function (e) {
      let isValid = true;
      const requiredFields = form.querySelectorAll("[required]");

      requiredFields.forEach((field) => {
        if (!field.value.trim()) {
          isValid = false;
          field.classList.add("error");
          field.style.borderColor = "#ef4444";
        } else {
          field.classList.remove("error");
          field.style.borderColor = "";
        }
      });

      if (!isValid) {
        e.preventDefault();
        // Scroll to first error
        const firstError = form.querySelector(".error");
        if (firstError) {
          firstError.focus();
        }
      }
    });
  });

  // =========================================================================
  // CTA Button Tracking (Analytics)
  // =========================================================================
  document
    .querySelectorAll('.btn-primary, .btn-outline, [class*="cta"]')
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (window.MA3PLAnalytics) {
          var text = this.textContent.trim().substring(0, 50);
          var section = this.closest("section");
          var location = section
            ? section.id || section.className.split(" ")[0]
            : "header";
          MA3PLAnalytics.trackCTAClick(text, location);
        }
      });
    });

  // =========================================================================
  // Tilt Effect on Service Cards (subtle)
  // =========================================================================
  if (window.innerWidth > 768) {
    document.querySelectorAll(".service-card").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -3;
        const rotateY = ((x - centerX) / centerX) * 3;
        card.style.transform =
          "perspective(1000px) rotateX(" +
          rotateX +
          "deg) rotateY(" +
          rotateY +
          "deg) translateY(-5px)";
      });

      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  // =========================================================================
  // Parallax on Hero (subtle) — merged into unified scroll handler
  // =========================================================================
  const heroShapes = document.querySelector(".hero-shapes");
  const heroFloatingIcons = document.querySelector(".hero-floating-icons");

  // =========================================================================
  // Homepage Funnel Selection
  // =========================================================================
  const funnelPills = document.querySelectorAll(
    ".funnel-pill[data-funnel-service]",
  );
  const funnelServiceInput = document.getElementById("funnelServiceInput");
  const funnelCopy = document.querySelector("[data-funnel-copy]");

  if (funnelPills.length > 0 && funnelServiceInput) {
    const funnelCopyMap = {
      "DTC and Shopify":
        "Great fit for brands needing fast pick-pack-ship and branded unboxing.",
      "Amazon and Marketplace":
        "Perfect for multichannel operations that need strict SLA and inventory sync.",
      "B2B and Wholesale":
        "Ideal for palletized, case-pack, and wholesale routing requirements.",
    };

    function setFunnelType(pill) {
      const selected = pill.getAttribute("data-funnel-service");
      if (!selected) return;

      funnelPills.forEach(function (item) {
        item.classList.remove("is-active");
        item.setAttribute("aria-pressed", "false");
      });

      pill.classList.add("is-active");
      pill.setAttribute("aria-pressed", "true");
      funnelServiceInput.value = selected;

      if (funnelCopy && funnelCopyMap[selected]) {
        funnelCopy.textContent = funnelCopyMap[selected];
      }
    }

    funnelPills.forEach(function (pill) {
      pill.setAttribute("aria-pressed", pill.classList.contains("is-active"));
      pill.addEventListener("click", function () {
        setFunnelType(pill);
      });
    });

    const defaultActive = document.querySelector(".funnel-pill.is-active");
    if (defaultActive) {
      setFunnelType(defaultActive);
    }
  }

  // =========================================================================
  // Auto-update copyright year
  // =========================================================================
  document.querySelectorAll(".footer-bottom p").forEach(function (p) {
    const year = new Date().getFullYear();
    // Use textContent-safe approach: only replace 4-digit year in the text
    if (p.textContent && /\d{4}/.test(p.textContent)) {
      p.textContent = p.textContent.replace(/\d{4}/, year);
    }
  });

  // =========================================================================
  // Typing Effect for Hero (optional - add data-typed to h1)
  // =========================================================================
  const typedElement = document.querySelector("[data-typed]");
  if (typedElement) {
    const words = typedElement.getAttribute("data-typed").split(",");
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typingSpeed = 80;
    const deletingSpeed = 40;
    const pauseTime = 2000;

    function type() {
      const current = words[wordIndex];
      if (isDeleting) {
        typedElement.textContent = current.substring(0, charIndex - 1);
        charIndex--;
      } else {
        typedElement.textContent = current.substring(0, charIndex + 1);
        charIndex++;
      }

      if (!isDeleting && charIndex === current.length) {
        setTimeout(function () {
          isDeleting = true;
          type();
        }, pauseTime);
        return;
      }

      if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
      }

      setTimeout(type, isDeleting ? deletingSpeed : typingSpeed);
    }

    setTimeout(type, 1000);
  }
});
