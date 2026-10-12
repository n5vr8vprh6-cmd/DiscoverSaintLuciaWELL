/* ============================================================================
   js/groups.js — WELL Group Studio form
   ----------------------------------------------------------------------------
   Progressive enhancement over a form that already works without it. The
   markup is one real <form method="POST" action="/advisors/groups/apply">, so
   a browser with scripting off posts it and gets a real answer
   (api/_lib/hub-screens/groups.js). This file only promotes it: it posts JSON,
   keeps the person on the page, and shows the success sentence inline.

   Loaded ONLY when SITE.groupStudio.intakeOpen is true (content/advisor-groups.js).
   When the form is not rendered there is nothing for this to attach to, and it
   is not sent at all.

   WHAT IS REPORTED TO ANALYTICS, AND WHAT IS NOT. Two events, and neither
   carries a name, an email, a link or a word of the concept:
     advisor_group_application_start   first interaction with the form
     advisor_group_application_submit  ONLY after the server answered ok — never
                                       on click, never on a failed request
   The submit event carries the program interest, which is one of three fixed
   codes, and the page. Nothing else.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-group-form]');
  if (!form) return;

  var errorEl  = form.querySelector('[data-gf-error]');
  var statusEl = form.querySelector('[data-gf-status]');
  var submitEl = form.querySelector('[data-gf-submit]');
  var done     = document.querySelector('[data-gf-done]');
  var doneText = document.querySelector('[data-gf-done-text]');

  function track(name, props) {
    try { if (window.dslwTrack) window.dslwTrack(name, props || {}); } catch (e) { /* analytics must never break the form */ }
  }

  /* Where the form was opened from, for the funnel. Free of anything identifying;
     the server caps it at 40 characters. */
  var src = form.querySelector('input[name="source"]');
  try {
    var p = new URLSearchParams(window.location.search).get('path');
    if (src && p) src.value = String(p).slice(0, 40);
  } catch (e) { /* no query string support: leave it empty */ }

  /* ── start ───────────────────────────────────────────────────────────── */
  var started = false;
  form.addEventListener('focusin', function () {
    if (started) return;
    started = true;
    track('advisor_group_application_start', { source_page: 'advisor_groups' });
  });

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function showError(message, fieldName) {
    if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
    if (statusEl) statusEl.textContent = '';
    var target = fieldName ? form.querySelector('[name="' + fieldName + '"]') : null;
    if (target && target.focus) target.focus();
    else if (errorEl) errorEl.scrollIntoView({ block: 'center' });
  }
  function clearError() {
    if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
  }

  function collect() {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; return; }
      if (el.type === 'checkbox') {
        if (!el.checked) return;
        if (el.name === 'support_needed') { (out.support_needed = out.support_needed || []).push(el.value); }
        else out[el.name] = el.value;
        return;
      }
      out[el.name] = el.value;
    });
    return out;
  }

  /* ── submit ──────────────────────────────────────────────────────────── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    /* The browser's own required-field check, with a sentence rather than a
       tooltip. The server is the authority; this only saves a round trip. */
    if (!form.checkValidity()) {
      var bad = form.querySelector(':invalid');
      var label = bad && bad.closest('.pf-field, .pf-choice, .pf-consent');
      var text = bad && bad.name === 'contact_consent'
        ? 'Please confirm that we may contact you about this application.'
        : 'Please complete the highlighted field' + (label ? ': ' + (label.querySelector('.pf-label, span') || {}).textContent : '.');
      showError(String(text).trim(), bad && bad.name);
      return;
    }
    var data = collect();
    if (!data.support_needed || !data.support_needed.length) {
      showError('Please choose at least one thing you would like help with.', 'support_needed');
      return;
    }

    if (submitEl) { submitEl.disabled = true; }
    if (statusEl) statusEl.textContent = 'Sending…';

    fetch(form.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, json: j }; });
    }).then(function (r) {
      if (r.ok && r.json && r.json.ok) {
        /* Reported only now, on a confirmed write. */
        track('advisor_group_application_submit', {
          program_interest: data.program_interest || undefined,
          source_page: 'advisor_groups'
        });
        form.hidden = true;
        if (doneText) doneText.textContent = form.getAttribute('data-thanks') || doneText.textContent;
        if (done) { done.hidden = false; done.focus(); }
        return;
      }
      if (submitEl) submitEl.disabled = false;
      var j = r.json || {};
      showError(j.message || 'Something went wrong. Please try again.', j.field);
    }).catch(function () {
      if (submitEl) submitEl.disabled = false;
      showError('We could not reach the server. Please check your connection and try again.');
    });
  });
})();
