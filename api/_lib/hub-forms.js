/* ============================================================================
   HUB FORMS — the signed-out screens
   ----------------------------------------------------------------------------
   Login, register, forgot and reset share a shape, so they share a renderer.

   THE FORMS WORK BEFORE JAVASCRIPT DOES, up to a point: they are real <form>
   elements with real labels, real required attributes and real autocomplete
   hints, so a password manager understands them and a keyboard can complete
   them. js/hub.js intercepts submit to show inline errors rather than
   navigating; without it the browser still posts and the endpoint still
   answers, which is a worse experience but not a broken one.
   ========================================================================== */
'use strict';

const { esc } = require('./hub-render.js');

function field(f) {
  const id = 'f-' + f.name;
  return `<label class="hub-field${f.wide ? ' hub-field--wide' : ''}" for="${id}">
      <span class="hub-field-label">${esc(f.label)}${f.optional ? ' <span class="hub-opt">optional</span>' : ''}</span>
      <input id="${id}" name="${esc(f.name)}" type="${f.type || 'text'}"
        ${f.autocomplete ? `autocomplete="${esc(f.autocomplete)}"` : ''}
        ${f.required === false ? '' : 'required'}
        ${f.minlength ? `minlength="${f.minlength}"` : ''}
        ${f.value ? `value="${esc(f.value)}"` : ''}>
      ${f.hint ? `<span class="hub-hint">${esc(f.hint)}</span>` : ''}
    </label>`;
}

function authForm(o) {
  return `<div class="hub-auth">
  <div class="hub-auth-card">
    <!-- No eyebrow by default: the bar above already says Travel Advisor Hub,
         and it is sticky, so repeating it on the card reads as a mistake. -->
    ${o.eyebrow ? `<p class="eyebrow">${esc(o.eyebrow)}</p>` : ''}
    <h1>${esc(o.title)}</h1>
    ${o.lead ? `<p class="hub-lead">${esc(o.lead)}</p>` : ''}

    <form class="hub-form" method="POST" action="${esc(o.action)}" data-hub-form
          ${o.next ? `data-next="${esc(o.next)}"` : ''}
          ${o.done ? `data-done="${esc(o.done)}"` : ''}
          ${o.okMessage ? `data-ok="${esc(o.okMessage)}"` : ''}
          ${o.keep ? 'data-keep' : ''}
          ${o.attr || ''}>
      ${(o.hidden || []).map((n) => `<input type="hidden" name="${esc(n)}">`).join('\n      ')}
      <div class="hub-form-grid">
        ${(o.fields || []).map(field).join('\n        ')}
      </div>
      <!-- Same honeypot as the consumer share form. -->
      <div class="hub-hp" aria-hidden="true">
        <label>Company<input name="company" tabindex="-1" autocomplete="off"></label>
      </div>
      ${/* A real checkbox rather than a line of small print above the button.
            What an advisor promises about a traveller's data is a thing they
            agree to, and an agreement nobody had to touch is one nobody made.
            `required` is for the person; the endpoint checks it again, because
            an input attribute controls nothing that posts directly. */''}
      ${o.consent ? `<label class="hub-stage-opt hub-consent-box">
        <input type="checkbox" name="${esc(o.consent.name)}" value="yes" required>
        <span>${o.consent.label}</span>
      </label>` : ''}
      <button class="btn btn--gold" type="submit">${esc(o.submit)}</button>
      <p class="hub-form-status" role="status" aria-live="polite"></p>
    </form>

    ${o.alt ? `<p class="hub-auth-alt">${o.alt}</p>` : ''}
  </div>
</div>`;
}

module.exports = { authForm, field };
