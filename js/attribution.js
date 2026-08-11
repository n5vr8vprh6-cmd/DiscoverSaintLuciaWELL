/* ============================================================================
   ATTRIBUTION — source and advisor referral, preserved across the funnel
   ----------------------------------------------------------------------------
   Brief §14 and §15. The consumer engine is source-agnostic: traffic arrives
   from social, Meta ads, newsletters, SLTA/DMO activity, partners, PR, QR
   codes, events, organic search, direct links, or a trained advisor's campaign.

   TWO CLASSES OF PARAMETER, DELIBERATELY SEPARATED
     · advisor referral (`advisor`, `ref`) — establishes lead ownership. Only
       these confer ownership, and only the FIRST one seen in a session wins,
       so a later untagged visit cannot silently reassign a lead.
     · everything else (utm_*, `src`, `campaign`) — retained for attribution
       and reporting only.

   Stored in sessionStorage, not a cookie: no consent banner is required for
   first-party session state, and it expires when the visit does. Nothing here
   is sent anywhere — it decorates internal links and rides along on analytics
   events so a funnel can be reconstructed later.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'dslw.attr';
  var OWNER_PARAMS = ['advisor', 'ref'];
  var SOURCE_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'campaign'];

  function read() {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function write(data) {
    try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  var params = new URLSearchParams(location.search);
  var stored = read();
  var changed = false;

  /* Advisor ownership: first touch wins and is never overwritten. */
  OWNER_PARAMS.forEach(function (p) {
    var v = params.get(p);
    if (v && !stored.advisor) {
      stored.advisor = v.slice(0, 120);
      stored.advisorParam = p;
      stored.advisorAt = new Date().toISOString();
      changed = true;
    }
  });

  /* Source data: last touch wins — it describes how they got here this time. */
  SOURCE_PARAMS.forEach(function (p) {
    var v = params.get(p);
    if (v) { stored[p] = v.slice(0, 120); changed = true; }
  });

  if (!stored.landing) {
    stored.landing = location.pathname;
    stored.referrer = document.referrer || '(direct)';
    changed = true;
  }
  if (changed) write(stored);

  /* ── Carry attribution across internal navigation ─────────────────────────
     Same-origin links get the advisor param reattached so a funnel survives a
     visitor who opens /advisors/foundations in a new tab, where sessionStorage
     of the original tab is not shared. Only the ownership param travels —
     utm_* stays out of internal URLs to keep analytics paths clean. */
  function decorate() {
    if (!stored.advisor) return;
    var key = stored.advisorParam || 'advisor';
    var links = document.querySelectorAll('a[href^="/"], a[href^="./"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.dataset.noAttr !== undefined) continue;
      var url = new URL(a.getAttribute('href'), location.origin);
      if (url.searchParams.has(key)) continue;
      url.searchParams.set(key, stored.advisor);
      a.setAttribute('href', url.pathname + url.search + url.hash);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorate);
  } else {
    decorate();
  }

  /* Exposed so analytics.js can attach it to every event, and so the Journey
     Finder can include it when a result is handed to an advisor. */
  window.dslwAttribution = function () {
    return {
      advisor: stored.advisor || null,
      source: stored.utm_source || stored.src || null,
      medium: stored.utm_medium || null,
      campaign: stored.utm_campaign || stored.campaign || null,
      landing: stored.landing || null,
      referrer: stored.referrer || null
    };
  };
})();
