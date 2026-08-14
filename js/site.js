/* ============================================================================
   SITE CHROME — navigation, sticky header state, hero mode
   ----------------------------------------------------------------------------
   Enhancement only. Every link works, every section reads, and the mobile menu
   is reachable with this file absent — the nav simply renders as a plain list.
   ========================================================================== */
(function () {
  'use strict';

  var body = document.body;

  /* Unlocks the sticky/transparent header treatment in CSS. Everything gated
     behind this attribute degrades to a plainly legible header without it. */
  body.setAttribute('data-enhanced', 'true');

  /* Tells the header it may go transparent over a dark hero. Set from JS
     rather than baked into the markup so a page with no hero never inherits
     it, and so the safe state survives a script failure. */
  var hero = document.querySelector('.hero.dark');
  if (hero) body.setAttribute('data-hero', 'dark');

  /* ── The signed-in profile control ──────────────────────────────────────
     Consumer pages are static files on a CDN, so they cannot know who is
     reading them. Rather than have every visitor pay for a session probe to
     learn something almost none of them need, a signed-in advisor carries a
     readable cookie holding a first name and two initials — nothing else, and
     nothing that grants anything. See WHO in api/_lib/auth.js.

     A VISITOR WITH NO COOKIE CAUSES NO REQUEST AND NO DOM CHANGE. That is the
     whole design: a traveller who has never signed in should never learn this
     exists.

     Hub pages render this server-side instead (lib/layouts.js profileControl),
     so the slot arrives already filled and this leaves it alone. Keep the two
     shapes in step — they share CSS. */
  (function profile() {
    var slot = document.querySelector('[data-acct-slot]');
    if (!slot || slot.children.length) return;      /* absent, or already server-rendered */

    var raw = null;
    try {
      var m = document.cookie.match(/(?:^|;\s*)dslw_who=([^;]*)/);
      if (!m) return;                               /* not signed in — stop, silently */
      raw = JSON.parse(decodeURIComponent(m[1]));
    } catch (e) { return; }
    if (!raw || !raw.n) return;

    var el = document.createElement('details');
    el.className = 'acct';
    /* textContent for the name, never innerHTML: this value round-trips
       through a cookie the user can edit, so it is treated as hostile even
       though it came from us. */
    el.innerHTML =
      '<summary aria-label="Your account">' +
        '<span class="acct-avatar" aria-hidden="true"></span>' +
        '<span class="acct-name"></span>' +
      '</summary>' +
      '<div class="acct-menu">' +
        '<a href="/hub">Your Hub</a>' +
        '<a href="/hub/journeys">Journeys</a>' +
        '<a href="/hub/account">Account settings</a>' +
        '<form method="POST" action="/api/auth/logout" data-signout>' +
          '<button type="submit">Sign out</button>' +
        '</form>' +
      '</div>';
    el.querySelector('.acct-avatar').textContent = String(raw.i || '').slice(0, 2);
    el.querySelector('.acct-name').textContent = String(raw.n).slice(0, 40);
    slot.appendChild(el);
  })();

  /* Sign out from anywhere on the site. The endpoint also answers a plain form
     post with a redirect, so this only removes the page reload. */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.hasAttribute || !form.hasAttribute('data-signout')) return;
    e.preventDefault();
    fetch('/api/auth/logout', { method: 'POST' })
      .then(function () { location.assign('/'); })
      .catch(function () { location.assign('/'); });
  });

  /* ── Mobile navigation ──────────────────────────────────────────────────── */
  function wireToggle(toggleSel, panelSel) {
    var toggle = document.querySelector(toggleSel);
    var panel = document.querySelector(panelSel);
    if (!toggle || !panel) return;

    toggle.addEventListener('click', function () {
      var open = panel.getAttribute('data-open') === 'true';
      panel.setAttribute('data-open', String(!open));
      toggle.setAttribute('aria-expanded', String(!open));
    });

    /* Close on navigation and on Escape — a menu that traps you is a bug. */
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        panel.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.getAttribute('data-open') === 'true') {
        panel.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  wireToggle('.site-header:not(.site-header--conversion) .nav-toggle', '#nav-links');
  wireToggle('.site-header--conversion .nav-toggle', '#conv-links');

  /* ── Header state ────────────────────────────────────────────────────────
     `data-at-top` drives the transparent treatment; `data-hidden` drives
     hide-on-scroll-down.

     Both are derived from an rAF sample of window.scrollY rather than from
     scroll events or an IntersectionObserver sentinel. Scroll events never
     fire while Lenis drives the page, and a sentinel adds a DOM node whose
     only job is to be observed. scrollY stays accurate under Lenis, so one
     sampler covers both states and both fallback modes.

     `data-at-top` is written on the first frame, before any scrolling, so the
     transparent state is established immediately rather than flashing in. */
  var header = document.querySelector('.site-header');
  if (header) {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var last = 0;
    var ticking = false;

    function sample() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;

      header.setAttribute('data-at-top', String(y < 24));

      if (!reduced && Math.abs(y - last) > 8) {
        /* Never hide the header while a menu is open — that would take the
           close control off-screen with the menu still expanded. */
        var menuOpen = document.querySelector('[data-open="true"]');
        header.setAttribute('data-hidden', String(y > last && y > 220 && !menuOpen));
        last = y;
      }
      ticking = false;
    }

    sample();
    (function loop() {
      if (!ticking) { ticking = true; requestAnimationFrame(sample); }
      requestAnimationFrame(loop);
    })();
  }
})();
