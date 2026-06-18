/* Sunny Shop — Level 2 animation layer (no app.js dependency) */
(function () {
  'use strict';

  const SCRAMBLE_CHARS = '@#$%&ABCDEFGHIJKLMNOP';
  const priceFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  let activeMagBtn = null;
  let activeTiltCard = null;
  let cursorGlowEl = null;
  let glowX = 0;
  let glowY = 0;
  let glowTargetX = 0;
  let glowTargetY = 0;
  let glowRaf = null;
  let activeSparkles = 0;

  /* ─── Utilities ───────────────────────────────────────────── */

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function isDesktopPointer() {
    return window.matchMedia('(pointer: fine) and (min-width: 521px)').matches;
  }

  function isInternalPageLink(anchor) {
    if (!anchor || anchor.target === '_blank') return false;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
    try {
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin && /\.html?$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function parseInrAmount(text) {
    const n = parseFloat(String(text).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  /* ─── 1. Scroll-shrink header sentinel ──────────────────── */

  function initHeaderScrollShrink() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:80px;height:1px;pointer-events:none';
    document.body.prepend(sentinel);

    new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      header.classList.toggle('header-scrolled', !entry.isIntersecting);
    }).observe(sentinel);
  }

  /* ─── 2. Magnetic buttons ───────────────────────────────── */

  function resetMagnetic(btn) {
    if (!btn) return;
    btn.style.setProperty('--mag-x', '0px');
    btn.style.setProperty('--mag-y', '0px');
  }

  function initMagneticButtons() {
    document.addEventListener('mousemove', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) {
        if (activeMagBtn) {
          resetMagnetic(activeMagBtn);
          activeMagBtn = null;
        }
        return;
      }

      if (activeMagBtn && activeMagBtn !== btn) {
        resetMagnetic(activeMagBtn);
      }

      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, 48 / dist);
      const max = 8;
      const tx = (dx / dist) * max * pull;
      const ty = (dy / dist) * max * pull;

      btn.style.setProperty('--mag-x', `${tx}px`);
      btn.style.setProperty('--mag-y', `${ty}px`);
      activeMagBtn = btn;
    });

    document.addEventListener('mouseleave', () => {
      if (activeMagBtn) {
        resetMagnetic(activeMagBtn);
        activeMagBtn = null;
      }
    });
  }

  /* ─── 3. Cursor glow (desktop) ──────────────────────────── */

  function initCursorGlow() {
    if (!isDesktopPointer()) return;

    cursorGlowEl = document.createElement('div');
    cursorGlowEl.className = 'cursor-glow';
    document.body.appendChild(cursorGlowEl);

    document.addEventListener('mousemove', (e) => {
      glowTargetX = e.clientX;
      glowTargetY = e.clientY;
    });

    const tick = () => {
      if (!cursorGlowEl) return;
      glowX = lerp(glowX, glowTargetX, 0.12);
      glowY = lerp(glowY, glowTargetY, 0.12);
      cursorGlowEl.style.left = `${glowX}px`;
      cursorGlowEl.style.top = `${glowY}px`;
      glowRaf = requestAnimationFrame(tick);
    };
    glowRaf = requestAnimationFrame(tick);
  }

  /* ─── 4. Product card 3D tilt ───────────────────────────── */

  function resetTilt(card) {
    if (!card) return;
    card.classList.remove('is-tilting');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  }

  function initProductTilt() {
    document.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.product-card');
      if (!card) {
        if (activeTiltCard) {
          resetTilt(activeTiltCard);
          activeTiltCard = null;
        }
        return;
      }

      if (activeTiltCard && activeTiltCard !== card) {
        resetTilt(activeTiltCard);
      }

      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;

      card.classList.add('is-tilting');
      card.style.setProperty('--ry', `${px * 16}deg`);
      card.style.setProperty('--rx', `${-py * 16}deg`);
      activeTiltCard = card;
    });

    document.addEventListener('mouseleave', () => {
      if (activeTiltCard) {
        resetTilt(activeTiltCard);
        activeTiltCard = null;
      }
    });
  }

  /* ─── 5. Scroll reveal (IntersectionObserver) ───────────── */

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        revealObserver.unobserve(el);

        const parent = el.parentElement;
        const pendingSiblings = parent
          ? [...parent.children].filter(
              (child) =>
                child !== el &&
                (child.classList.contains('card') || child.classList.contains('product-card')) &&
                child.classList.contains('reveal-pending')
            )
          : [];

        const idx = parent
          ? [...parent.children].filter(
              (c) => c.classList.contains('card') || c.classList.contains('product-card')
            ).indexOf(el)
          : 0;

        const delay = Math.max(0, idx) * 80 + pendingSiblings.length * 0;

        setTimeout(() => {
          el.classList.remove('reveal-pending');
          el.classList.add('reveal-in');
        }, delay);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  function registerRevealElement(el) {
    if (!el || el.dataset.revealRegistered) return;
    if (!el.classList.contains('card') && !el.classList.contains('product-card')) return;
    if (el.closest('.car-blueprint') || el.closest('.hero-section')) return;

    el.dataset.revealRegistered = '1';
    el.classList.add('reveal-pending');
    revealObserver.observe(el);
  }

  function scanRevealCards(root = document) {
    root.querySelectorAll('.card, .product-card').forEach(registerRevealElement);
  }

  function initScrollReveal() {
    scanRevealCards();

    const productsGrid = document.getElementById('products');
    if (productsGrid) {
      new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (node.matches('.card, .product-card')) registerRevealElement(node);
            if (node.querySelectorAll) scanRevealCards(node);
          });
        });
      }).observe(productsGrid, { childList: true });
    }

    new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches('.card, .product-card')) registerRevealElement(node);
          if (node.querySelectorAll) scanRevealCards(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ─── 6. Logo text scramble ─────────────────────────────── */

  function initLogoScramble() {
    const logo = document.querySelector('.logo');
    if (!logo) return;

    const finalText = logo.textContent.trim();
    if (!finalText) return;

    logo.classList.add('is-scrambling');
    const len = finalText.length;
    const duration = 800;
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const locked = Math.floor(t * len);
      let out = '';

      for (let i = 0; i < len; i++) {
        if (i < locked) {
          out += finalText[i];
        } else {
          out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }

      logo.textContent = out;

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        logo.textContent = finalText;
        logo.classList.remove('is-scrambling');
      }
    }

    requestAnimationFrame(tick);
  }

  /* ─── 7. Button ripple ──────────────────────────────────── */

  function initButtonRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  }

  /* ─── 8. Page transition ────────────────────────────────── */

  function initPageTransitions() {
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (!anchor || !isInternalPageLink(anchor)) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      e.preventDefault();
      const href = anchor.href;

      document.body.classList.add('page-exiting');

      setTimeout(() => {
        window.location.href = href;
      }, 300);
    });
  }

  /* ─── 9. Price counter on scroll ────────────────────────── */

  const priceObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const card = entry.target;
        priceObserver.unobserve(card);

        const strong = card.querySelector('.product-meta strong');
        if (!strong || strong.dataset.counted === '1') return;

        const target = parseInrAmount(strong.textContent);
        strong.dataset.counted = '1';
        strong.dataset.priceTarget = String(target);

        if (target <= 0) return;

        const duration = 800;
        const start = performance.now();

        function frame(now) {
          const t = Math.min(1, (now - start) / duration);
          const value = Math.round(target * easeOutQuad(t));
          strong.textContent = priceFormatter.format(value);
          if (t < 1) requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
      });
    },
    { threshold: 0.45 }
  );

  function registerPriceCard(card) {
    if (!card || card.dataset.priceObserved === '1') return;
    if (!card.classList.contains('product-card')) return;
    if (!card.querySelector('.product-meta strong')) return;

    card.dataset.priceObserved = '1';
    priceObserver.observe(card);
  }

  function scanPriceCards(root = document) {
    root.querySelectorAll('.product-card').forEach(registerPriceCard);
  }

  function initPriceCounters() {
    scanPriceCards();

    const productsGrid = document.getElementById('products');
    if (productsGrid) {
      new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (node.matches('.product-card')) registerPriceCard(node);
            if (node.querySelectorAll) scanPriceCards(node);
          });
        });
      }).observe(productsGrid, { childList: true });
    }
  }

  /* ─── 10. Cart badge bounce (MutationObserver) ──────────── */

  function popCartBadge(el) {
    if (!el) return;
    el.classList.remove('badge-pop');
    void el.offsetWidth;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    el.classList.add('badge-pop');
    el.addEventListener(
      'animationend',
      () => el.classList.remove('badge-pop'),
      { once: true }
    );
  }

  function attachCartCountWatcher(el) {
    if (!el || el._ssCartWatching) return;
    el._ssCartWatching = true;

    let prev = el.textContent;
    const observer = new MutationObserver(() => {
      if (el.textContent !== prev) {
        prev = el.textContent;
        popCartBadge(el);
      }
    });

    observer.observe(el, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  function initCartBadgeBounce() {
    attachCartCountWatcher(document.getElementById('cart-count'));

    const nav = document.querySelector('header nav');
    if (nav) {
      new MutationObserver(() => {
        attachCartCountWatcher(document.getElementById('cart-count'));
      }).observe(nav, { childList: true, subtree: true });
    }
  }

  /* ─── 11. Image sparkle trail ───────────────────────────── */

  function spawnSparkle(img) {
    if (activeSparkles >= 3) return;

    const card = img.closest('.product-card');
    if (!card) return;

    const imgRect = img.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const sparkle = document.createElement('span');
    sparkle.className = 'img-sparkle';
    sparkle.style.left = `${imgRect.left - cardRect.left + Math.random() * imgRect.width}px`;
    sparkle.style.top = `${imgRect.top - cardRect.top + Math.random() * imgRect.height}px`;

    card.appendChild(sparkle);
    activeSparkles += 1;

    sparkle.addEventListener(
      'animationend',
      () => {
        sparkle.remove();
        activeSparkles = Math.max(0, activeSparkles - 1);
      },
      { once: true }
    );
  }

  function initImageSparkles() {
    document.addEventListener(
      'mouseenter',
      (e) => {
        const img = e.target.closest('.product-card img');
        if (!img) return;
        for (let i = 0; i < 3; i++) spawnSparkle(img);
      },
      true
    );
  }

  /* ─── 12. Solar system background ───────────────────────── */

  function buildSolarSystem() {
    const ringConfig = [
      { cls: 'orbit-ring-1', size: 200, duration: 8, reverse: false, dots: [{ size: 8, color: 'amber', angle: 0 }] },
      {
        cls: 'orbit-ring-2',
        size: 340,
        duration: 14,
        reverse: true,
        dots: [
          { size: 6, color: 'amber', angle: 0 },
          { size: 6, color: 'white', angle: 180 },
        ],
      },
      { cls: 'orbit-ring-3', size: 500, duration: 20, reverse: false, dots: [{ size: 10, color: 'dim', angle: 0 }] },
      {
        cls: 'orbit-ring-4',
        size: 680,
        duration: 28,
        reverse: true,
        dots: [
          { size: 5, color: 'amber', angle: 0 },
          { size: 5, color: 'amber', angle: 120 },
          { size: 5, color: 'amber', angle: 240 },
        ],
      },
      { cls: 'orbit-ring-5', size: 860, duration: 38, reverse: false, dots: [{ size: 7, color: 'white-glow', angle: 0 }] },
    ];

    const wobble = document.createElement('div');
    wobble.className = 'solar-system-wobble';

    const core = document.createElement('div');
    core.className = 'solar-core';
    wobble.appendChild(core);

    ringConfig.forEach((ring) => {
      const ringEl = document.createElement('div');
      ringEl.className = `orbit-ring ${ring.cls}`;
      ringEl.style.width = `${ring.size}px`;
      ringEl.style.height = `${ring.size}px`;

      const path = document.createElement('div');
      path.className = 'orbit-path';
      ringEl.appendChild(path);

      const spinner = document.createElement('div');
      spinner.className = 'orbit-spinner';
      spinner.style.setProperty('--orbit-duration', `${ring.duration}s`);
      spinner.style.setProperty('--orbit-direction', ring.reverse ? 'reverse' : 'normal');

      ring.dots.forEach((dot) => {
        const arm = document.createElement('div');
        arm.className = 'dot-arm';
        arm.style.setProperty('--angle', `${dot.angle}deg`);

        const dotEl = document.createElement('span');
        dotEl.className = `orbit-dot dot-${dot.color} size-${dot.size}`;
        arm.appendChild(dotEl);
        spinner.appendChild(arm);
      });

      ringEl.appendChild(spinner);
      wobble.appendChild(ringEl);
    });

    const system = document.createElement('div');
    system.className = 'solar-system';
    system.setAttribute('aria-hidden', 'true');
    system.appendChild(wobble);
    return system;
  }

  function initSolarSystem() {
    if (document.querySelector('.solar-system')) return;

    const system = buildSolarSystem();
    document.body.prepend(system);

    document.addEventListener('visibilitychange', () => {
      system.classList.toggle('is-paused', document.visibilityState === 'hidden');
    });
  }

  /* ─── 13. Hero blueprint reveal ─────────────────────────── */

  function initHeroTitleWords() {
    const title = document.querySelector('.hero-title');
    if (!title || title.dataset.wordsSplit === '1') return;

    const words = title.textContent.trim().split(/\s+/);
    title.innerHTML = words
      .map((word, i) => `<span class="hero-word" style="animation-delay:${i * 0.12}s">${word}</span>`)
      .join(' ');
    title.dataset.wordsSplit = '1';
  }

  function initBlueprintScanLit(blueprint) {
    const scanLine = blueprint.querySelector('.scan-line');
    const parts = [...blueprint.querySelectorAll('.car-part')];
    if (!scanLine || !parts.length) return;

    const litCooldown = new WeakMap();
    let rafId = 0;

    function tick() {
      if (!blueprint.classList.contains('scanning') && !blueprint.classList.contains('scan-complete')) {
        rafId = 0;
        return;
      }

      const scanY = scanLine.getBoundingClientRect().top;

      parts.forEach((part) => {
        const rect = part.getBoundingClientRect();
        if (scanY < rect.top || scanY > rect.bottom) return;

        const last = litCooldown.get(part) || 0;
        if (performance.now() - last < 180) return;

        litCooldown.set(part, performance.now());
        part.classList.add('lit');
        setTimeout(() => part.classList.remove('lit'), 200);
      });

      rafId = requestAnimationFrame(tick);
    }

    blueprint._startScanLit = () => {
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    blueprint._stopScanLit = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    };
  }

  function triggerBlueprintSequence(blueprint) {
    const steps = [
      { delay: 0, action: () => blueprint.classList.add('scanning') },
      { delay: 0, action: () => blueprint._startScanLit?.() },
      { delay: 500, part: 'wheels' },
      { delay: 1000, part: 'engine' },
      { delay: 1500, part: 'headlights' },
      { delay: 2000, part: 'exhaust' },
      { delay: 2500, part: 'interior' },
      {
        delay: 3000,
        action: () => {
          blueprint.classList.remove('scanning');
          blueprint.classList.add('scan-complete');
        },
      },
      {
        delay: 6800,
        action: () => {
          blueprint.classList.add('scan-done');
          blueprint._stopScanLit?.();
        },
      },
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        if (step.part) {
          const el = blueprint.querySelector(`[data-part="${step.part}"]`);
          if (el) el.classList.add('visible');
        }
        if (step.action) step.action();
      }, step.delay);
    });
  }

  function initHeroBlueprint() {
    const blueprint = document.querySelector('.car-blueprint');
    if (!blueprint || blueprint.dataset.heroInit === '1') return;

    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) initHeroTitleWords();

    initBlueprintScanLit(blueprint);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        blueprint.dataset.heroInit = '1';
        triggerBlueprintSequence(blueprint);
      },
      { threshold: 0.3 }
    );

    observer.observe(blueprint);
  }

  /* ─── Boot ────────────────────────────────────────────────── */

  function init() {
    initSolarSystem();
    initHeaderScrollShrink();
    initMagneticButtons();
    initCursorGlow();
    initProductTilt();
    initScrollReveal();
    initLogoScramble();
    initButtonRipple();
    initPageTransitions();
    initPriceCounters();
    initCartBadgeBounce();
    initImageSparkles();
    initHeroBlueprint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
