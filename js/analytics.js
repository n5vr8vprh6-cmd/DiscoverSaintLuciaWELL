/* ============================================================================
   MEASUREMENT — one domain, two funnels, kept distinguishable
   ----------------------------------------------------------------------------
   Generalized from the Foundations page's analytics layer. The new dimension is
   `surface` (consumer | advisor), set per page in lib/page.js and read off
   <body data-surface>. Brief §15 requires consumer and advisor analytics to
   stay distinguishable while still allowing funnel reporting across the same
   domain — one dataLayer, one schema, one extra field.

   ── TO ACTIVATE ──────────────────────────────────────────────────────────
   Paste the GTM container ID below. Left empty this file stays inert: events
   still queue on dataLayer and can be inspected in the console, but no network
   request is made and the page behaves exactly as it does now.
   ========================================================================== */
(function () {
  'use strict';

  var GTM_ID = '';

  window.dataLayer = window.dataLayer || [];

  /* Automated traffic still queues events locally but transmits nothing —
     the same guard the motion and finder layers use. */
  var automated = navigator.webdriver === true;
  var surface = document.body.getAttribute('data-surface') || 'consumer';
  var pageKey = document.body.getAttribute('data-page') || location.pathname;

  function track(event, props) {
    var payload = { event: event, surface: surface, page: pageKey };
    var attr = window.dslwAttribution ? window.dslwAttribution() : null;
    if (attr) {
      if (attr.advisor)  payload.advisor_ref = attr.advisor;
      if (attr.source)   payload.source = attr.source;
      if (attr.campaign) payload.campaign = attr.campaign;
    }
    if (props) {
      for (var k in props) {
        if (Object.prototype.hasOwnProperty.call(props, k) && props[k] !== undefined) {
          payload[k] = props[k];
        }
      }
    }
    window.dataLayer.push(payload);
  }
  window.dslwTrack = track;

  if (GTM_ID && !automated) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    document.head.appendChild(s);
  }

  /* ── Page view ───────────────────────────────────────────────────────────
     Fired once per page so the two funnels can be reconstructed step by step
     on a single domain. Carries `surface`, so a consumer path
     (/ → /journey) and an advisor path (/advisors → /advisors/foundations)
     stay separable in reporting while still joining on the advisor referral. */
  track('page_view', { path: location.pathname, title: document.title });

  /* ── Where on the page did it happen? ───────────────────────────────────── */
  function sectionOf(el) {
    var sec = el.closest('section[id]');
    if (sec) return sec.id;
    if (el.closest('.site-header')) return 'nav';
    if (el.closest('.site-footer')) return 'footer';
    return 'unknown';
  }

  /* ── Clicks ─────────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a, button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var label = (a.textContent || '').trim().slice(0, 80);

    var where = sectionOf(a);
    var cta = a.getAttribute('data-cta') || '';

    /* The one CTA that carries the whole consumer funnel. */
    if (/^\/journey/.test(href)) {
      track('finder_cta_click', { location: where, label: label });
      return;
    }

    /* ── Advisor funnel (brief 2026-10-11 §6) ──────────────────────────────
       The brief's event names, added alongside the three that already existed
       rather than instead of them — nothing has ever been transmitted (the GTM
       id is empty), so there is no history to protect, but a trigger written
       against the old names should keep working the day one is set.

       NO PERSONAL DATA in any of these. Properties are the page, the place on
       it, and a fixed offer code. A click is also only a click: nothing here
       records that an enrolment, a registration or a purchase HAPPENED. Luma
       and ThriveCart complete on their own domains and need their own
       integration or callback to be counted; this file does not pretend. */
    var props = { source_page: pageKey, cta_location: where };

    /* A paid checkout, and ONLY a live one. A button that is still pending
       renders as a link to the briefing (content/advisor-foundations.js) with
       data-cta="enrollment-pending", so this branch cannot fire for it. */
    if ((cta === 'online' || cta === 'island' || cta === 'vip') && /theburnoutclinic\.com/.test(href)) {
      track('advisor_foundations_checkout_click', { source_page: pageKey, cta_location: where, offer_variant: cta });
      return;
    }
    /* Interest in a product that is not open yet. Useful precisely because it
       is NOT a checkout: it measures demand for the offer without claiming
       that anything was bought. */
    if (cta === 'enrollment-pending') {
      track('advisor_enrollment_pending_click', {
        source_page: pageKey, cta_location: where, offer_variant: a.getAttribute('data-offer') || undefined
      });
      return;
    }
    if (/luma\.com/.test(href)) {
      track('briefing_click', { location: where, label: label });                 /* legacy */
      track('advisor_luma_outbound_click', props);
      return;
    }
    if (/^\/advisors\/intro(?:[?#]|$)/.test(href)) {
      track('advisor_briefing_cta_click', props);
    }
    if (/^\/hub\/register(?:[?#]|$)/.test(href)) {
      track('advisor_hub_signup_click', { source_page: pageKey, cta_location: where });
    }
    if (/^\/advisors\/immersion\/waitlist(?:[?#]|$)/.test(href)) {
      track('advisor_immersion_waitlist_click', { source_page: pageKey, cta_location: where });
    }

    /* Crossing from the consumer surface into the advisor hierarchy. Kept last
       and kept as it was, so the three branches above can also report here. */
    if (/^\/advisors/.test(href)) {
      track('advisor_surface_click', { location: where, destination: href, label: label });
    }
  });

  /* ── Scroll depth ────────────────────────────────────────────────────────
     Sampled from window.scrollY on rAF rather than by injecting sentinel
     elements or listening for scroll events. Both alternatives are wrong here:

       · Injected absolutely-positioned sentinels become part of the body's
         scrollable overflow once `overflow-x: hidden` makes body a scroll
         container. Placing one at 100% of scrollHeight then GROWS scrollHeight,
         the ResizeObserver re-places it lower, and the document inflates without
         bound — measured at 26,124px against 10,432px of real content before
         this was replaced.

       · A `scroll` listener records nothing for real visitors, because when
         Lenis drives the page native scroll events never fire. `window.scrollY`
         does stay accurate under Lenis, which is why sampling it works in both
         modes and needs no fallback branch. */
  var depthMarks = [25, 50, 75, 100];
  var fired = {};
  var depthTicking = false;

  function sampleDepth() {
    var de = document.documentElement;
    var scrollable = de.scrollHeight - window.innerHeight;
    if (scrollable > 0) {
      var pct = ((window.scrollY || de.scrollTop) / scrollable) * 100;
      for (var i = 0; i < depthMarks.length; i++) {
        var m = depthMarks[i];
        if (!fired[m] && pct >= m - 0.5) {
          fired[m] = true;
          track('scroll_depth', { percent: m });
        }
      }
    }
    depthTicking = false;
  }

  (function depthLoop() {
    if (!depthTicking) { depthTicking = true; requestAnimationFrame(sampleDepth); }
    requestAnimationFrame(depthLoop);
  })();
})();
