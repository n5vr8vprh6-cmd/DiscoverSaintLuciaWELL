/* Well Destination Foundations — measurement layer.
   Loads first so window.dataLayer exists before site.js checks for it
   (site.js pushes the form-capture events; this file does not duplicate them).

   ── TO ACTIVATE ──────────────────────────────────────────────────────────
   Paste your GTM container ID below (looks like "GTM-XXXXXXX") and the
   container loads automatically. Leave it empty and this file stays inert:
   events still queue on dataLayer, but no network request is made and the
   page behaves exactly as it does today.

   GTM was chosen because site.js already speaks dataLayer, and because it
   lets GA4 / Meta / LinkedIn be added later from the GTM UI without another
   code change. To use GA4 or Plausible directly instead, drop their snippet
   in place of the loadGtm() call — the event pushes below stay valid. */
(function () {
  'use strict';

  var GTM_ID = '';

  window.dataLayer = window.dataLayer || [];

  /* Don't pollute real data with automated traffic (same guard the GSAP and
     exit-intent layers use). Events still queue; nothing is transmitted. */
  var automated = navigator.webdriver === true;

  function track(event, props) {
    var payload = { event: event };
    if (props) { for (var k in props) { if (props[k] !== undefined) payload[k] = props[k]; } }
    window.dataLayer.push(payload);
  }
  /* exposed so other modules (exit-intent) can report without importing */
  window.wdfTrack = track;

  if (GTM_ID && !automated) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    document.head.appendChild(s);
  }

  /* ── Which part of the page did the click happen in? ────────────────── */
  function sectionOf(el) {
    var sec = el.closest('section[id]');
    if (sec) return sec.id;
    /* CTAs also live outside sections: sticky nav, footer, exit-intent modal */
    if (el.closest('.exit-modal')) return 'exit_intent';
    if (el.closest('.site-header')) return 'nav';
    if (el.closest('.site-footer')) return 'footer';
    return 'unknown';
  }

  /* ── Clicks: enrolment intent and outbound webinar ──────────────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a, button');
    if (!a) return;

    /* outbound to the Luma briefing — the only CTA that currently completes */
    if (a.tagName === 'A' && /luma\.com/.test(a.getAttribute('href') || '')) {
      track('webinar_click', { location: sectionOf(a), label: a.textContent.trim() });
      return;
    }

    var label = a.textContent.trim();

    /* data-cta first, label second. The regex below was written against the
       old button wording; renaming the buttons silently stopped both VIP
       paths being recorded at all, and nobody noticed because analytics is
       inert until a GTM id is set. An explicit attribute survives copy edits.
       The label branches stay as a fallback so anything not yet tagged keeps
       reporting exactly as it did. */
    var cta = a.getAttribute('data-cta');
    if (cta) {
      var TIERS = { online: 'standard', island: 'island', vip: 'vip', 'fit-call': 'vip_fit_call' };
      track('cta_click', { tier: TIERS[cta] || cta, location: sectionOf(a), label: label });
      return;
    }

    if (/enroll|get vip|buy now/i.test(label)) {
      track('cta_click', {
        tier: /vip/i.test(label) ? 'vip' : 'standard',
        location: sectionOf(a),
        label: label
      });
    } else if (/fit call/i.test(label)) {
      track('cta_click', { tier: 'vip_fit_call', location: sectionOf(a), label: label });
    }
  });

  /* ── FAQ opens: a direct read on what advisors actually worry about ─── */
  document.querySelectorAll('#faq details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      var q = d.querySelector('summary');
      track('faq_open', { question: q ? q.textContent.trim() : '' });
    });
  });

  /* ── Scroll depth: does anyone finish a 3,400-word page? ─────────────
     Deliberately NOT a window 'scroll' listener. In gsap mode Lenis drives
     the scroll and native scroll events never fire — window.scrollY moves
     but listeners stay silent, so a scroll handler here would record
     nothing for real visitors while appearing to work in flat/io mode.
     IntersectionObserver fires regardless of what is driving the scroll,
     which is why the reveal system and exit-intent already use it. */
  if ('IntersectionObserver' in window) {
    var marks = [25, 50, 75, 100];
    var sentinels = [];

    marks.forEach(function (m) {
      var s = document.createElement('div');
      s.setAttribute('aria-hidden', 'true');
      s.style.cssText = 'position:absolute;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden;';
      s.dataset.depth = m;
      document.body.appendChild(s);
      sentinels.push(s);
    });

    /* absolute + no positioned ancestor = offset from the document origin,
       so these travel with the content rather than the viewport */
    function place() {
      var h = document.documentElement.scrollHeight;
      sentinels.forEach(function (s) {
        var pct = parseInt(s.dataset.depth, 10) / 100;
        s.style.top = Math.max(0, Math.round(h * pct) - 1) + 'px';
      });
    }
    place();

    var depthIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        track('scroll_depth', { percent: parseInt(entry.target.dataset.depth, 10) });
        depthIo.unobserve(entry.target);
      });
    });
    sentinels.forEach(function (s) { depthIo.observe(s); });

    /* Document height moves under us: the pinned hero adds pin-spacers once
       ScrollTrigger settles, images load, and FAQ <details> expand. Re-place
       on any body size change rather than guessing with a fixed delay. */
    if ('ResizeObserver' in window) {
      new ResizeObserver(place).observe(document.body);
    } else {
      window.addEventListener('load', place);
      setTimeout(place, 2000);
    }
    window.addEventListener('resize', place, { passive: true });
  }
})();
