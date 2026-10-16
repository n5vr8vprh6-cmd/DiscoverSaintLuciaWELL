/* ============================================================================
   CONSENT — analytics stays off until a visitor says yes
   ----------------------------------------------------------------------------
   One question, asked once: may Google Analytics load? Nothing is requested and
   no analytics cookie is set until the answer is yes. js/analytics.js asks this
   file, never the other way round, so a page that loads analytics.js WITHOUT
   this file (it should not exist) simply tracks nothing.

   WHAT IT DOES NOT DO
     · It does not gate the cookies an advisor's signed-in session needs. Those
       are strictly necessary and privacy §7 describes them separately.
     · It does not touch the Hub: the Hub pages load neither script.

   THE RULES, IN ONE PLACE
     · No answer yet  → banner shows, analytics off.
     · Accepted       → analytics on. Stored on this device only.
     · Declined       → analytics off. Stored, so the banner stays away.
     · Global Privacy Control present and no stored answer → treated as a
       decline, banner not shown. An explicit answer still wins, via the footer's
       "Cookie settings".
     · An answer is asked for again after twelve months.
     · localStorage unavailable (private modes, blocked storage) → the answer
       lasts for the page only, and the banner returns on the next one. It never
       errors and never falls back to "yes".

   Exposes window.dslwConsent: analytics() → boolean, onChange(fn), open().
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'dslw_consent';
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

  var listeners = [];
  var memory = null;      /* the answer for this page when storage is unavailable */
  var state = null;       /* null = not asked · true = accepted · false = declined */
  var el = null;

  function read() {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = memory; }
    if (!raw) return null;
    try {
      var v = JSON.parse(raw);
      var t = v && new Date(v.at).getTime();
      if (!v || typeof v.analytics !== 'boolean' || isNaN(t)) return null;
      if (Date.now() - t > MAX_AGE_MS) return null;
      return v.analytics;
    } catch (e) { return null; }
  }

  function write(granted) {
    var raw = JSON.stringify({ v: 1, analytics: granted, at: new Date().toISOString() });
    memory = raw;
    try { window.localStorage.setItem(KEY, raw); } catch (e) { /* kept in memory only */ }
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state === true); } catch (e) { /* one listener must not silence the rest */ }
    }
  }

  function decide(granted) {
    var changed = state !== granted;
    state = granted;
    write(granted);
    hide();
    if (changed) notify();
  }

  function hide() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  }

  function show(focus) {
    if (el) { if (focus) el.querySelector('button').focus(); return; }
    /* A <div>, and its own button classes (not .btn): Foundations brings its own
       stylesheet, and its element and button rules reached a <section> and a
       .btn--ghost-dark inside it. The decline button was nearly invisible there. */
    el = document.createElement('div');
    el.className = 'consent';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Cookie preferences');
    el.innerHTML =
      '<p class="consent-text">We would like to use Google Analytics to see which pages are useful. ' +
      'It sets cookies and sends usage data to Google. Nothing loads unless you accept. ' +
      '<a href="/privacy#cookies">How this works</a></p>' +
      '<div class="consent-actions">' +
        '<button type="button" class="consent-btn consent-btn--accept" data-consent="accept">Accept analytics</button>' +
        '<button type="button" class="consent-btn consent-btn--decline" data-consent="decline">No thanks</button>' +
      '</div>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-consent]');
      if (b) decide(b.getAttribute('data-consent') === 'accept');
    });
    document.body.appendChild(el);
    /* Non-modal: it never takes focus on its own, only when the visitor asked
       for it from the footer. */
    if (focus) el.querySelector('button').focus();
  }

  /* The footer's "Cookie settings" link. Its href is /privacy#cookies, so it
     still goes somewhere useful if this script did not load. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-consent-open]');
    if (a) { e.preventDefault(); show(true); }
  });

  window.dslwConsent = {
    analytics: function () { return state === true; },
    onChange: function (fn) { listeners.push(fn); },
    open: function () { show(true); }
  };

  state = read();
  if (state === null && navigator.globalPrivacyControl === true) state = false;
  if (state === null) show(false);
})();
