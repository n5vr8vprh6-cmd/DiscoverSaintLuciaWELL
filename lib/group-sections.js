/* ============================================================================
   lib/group-sections.js — the WELL Group Studio form and its closed state
   ----------------------------------------------------------------------------
   Registered into RENDERERS from lib/components.js, the same way
   lib/practitioner-sections.js is, and for the same reason: the page is the
   sales conversation and a form is one section of it.

   IT REUSES THE `.pf-*` CLASSES. css/practitioners.css already styles a
   labelled field, a choice card, an error line, a status line and a done panel
   to this site's standard, and a second form with its own look would be a
   second thing to keep accessible. The page loads that stylesheet via
   `extraStyles`. The two small helpers below are copied rather than imported
   because practitioner-sections.js's are closed over its own placeholder table
   and its pathway branching; sharing them would mean reaching into that
   closure, and the branching logic is exactly what this form does not have.

   ONE STEP, NOT TWO. The practitioner form is two steps because it serves two
   pathways. This one has a single audience, and eleven fields on one screen is
   shorter than a "Continue" button the reader has to trust.

   COMPLETE WITHOUT JAVASCRIPT. One real <form> with a real action, so a
   browser with scripting off posts it and gets a real answer
   (hub-screens/groups.js). js/groups.js promotes it to a JSON post.

   Option values come from api/_lib/group-studio.js — the same tables the
   endpoint validates against — so the form and the check cannot disagree about
   what a legal answer is.

   THE HONEYPOT IS `company`; the real business field is `business`.

   TWO STATES, DECIDED AT BUILD TIME BY SITE.groupStudio.intakeOpen:
     open    — the form
     closed  — an honest "applications open shortly" panel with real routes and
               NO form. A form that cannot store what it collects is worse than
               none, so the closed state does not render the fields at all.
   ========================================================================== */
'use strict';

const G = require('../api/_lib/group-studio.js');

module.exports = function build(h) {
  const { esc, paras } = h;

  const PH = {
    email: 'you@youragency.com',
    phone: '+1 555 123 4567',
    business: 'e.g. Meridian Travel',
    country: 'e.g. Canada',
    host_agency: 'e.g. an independent host agency or consortium, if any',
    audience_size: 'e.g. 1,800 newsletter subscribers and 400 past clients',
    expected_travellers: 'e.g. 12 to 20',
    departure_window: 'e.g. Spring 2027, five to seven nights',
    budget_range: 'e.g. $3,000 to $4,500 per person'
  };

  const field = (o) => {
    const id = 'gf-' + o.name;
    const req = o.required === false ? '' : ' required';
    const ph = PH[o.name] ? ` placeholder="${esc(PH[o.name])}"` : '';
    const common = `id="${id}" name="${esc(o.name)}"${req}${o.hint ? ` aria-describedby="${id}-hint"` : ''}` +
      `${o.autocomplete ? ` autocomplete="${esc(o.autocomplete)}"` : ''}${o.maxlength ? ` maxlength="${o.maxlength}"` : ''}${ph}`;
    const control = o.area
      ? `<textarea ${common} rows="${o.rows || 4}"></textarea>`
      : `<input ${common} type="${o.type || 'text'}"${o.inputmode ? ` inputmode="${o.inputmode}"` : ''}>`;
    return `<div class="pf-field${o.wide ? ' pf-field--wide' : ''}">
          <label for="${id}"><span class="pf-label">${esc(o.label)}</span>${o.required === false ? ' <span class="pf-opt">optional</span>' : ''}</label>
          ${control}
          ${o.hint ? `<span class="pf-hint" id="${id}-hint">${esc(o.hint)}</span>` : ''}
        </div>`;
  };

  const choice = (name, type, options, { legend, hint, required = true, cols } = {}) =>
    `<fieldset class="pf-choice${cols ? ' pf-choice--' + cols : ''}">
          <legend><span class="pf-label">${esc(legend)}</span></legend>
          ${hint ? `<span class="pf-hint">${esc(hint)}</span>` : ''}
          <div class="pf-options">
            ${options.map(([v, l]) => `<label class="pf-opt-card"><input type="${type}" name="${esc(name)}" value="${esc(v)}"${required && type === 'radio' ? ' required' : ''}><span>${esc(l)}</span></label>`).join('\n            ')}
          </div>
        </fieldset>`;

  /* ── THE FORM ─────────────────────────────────────────────────────────── */
  function groupForm(s) {
    const skin = esc(s.skin || 'sand');
    const interestOpts = Object.keys(G.PROGRAM_INTEREST).map((k) => [k, G.PROGRAM_INTEREST[k]]);
    const supportOpts = Object.keys(G.SUPPORT).map((k) => [k, G.SUPPORT[k]]);

    /* CLOSED. No fields, no action, no script hooks: nothing here can be
       mistaken for a working form, by a person or by a scraper. */
    if (!s.open) {
      return `<section class="section section--${skin} practitioner-apply" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="apply-grid">
      <div class="apply-intro">
        <p class="eyebrow">${esc(s.eyebrow)}</p>
        <h2 id="${esc(s.id)}-title" tabindex="-1">${esc(s.closedHeadline)}</h2>
        ${paras(s.closedBody)}
      </div>
      <div class="apply-card reveal-item">
        <ul class="gf-routes">
          ${s.closedRoutes.map((r) => `<li>
            <h3>${esc(r.title)}</h3>
            <p>${esc(r.text)}</p>
            <a class="contact-link" href="${esc(r.href)}">${esc(r.label)}</a>
          </li>`).join('\n          ')}
        </ul>
      </div>
    </div>
  </div>
</section>`;
    }

    return `<section class="section section--${skin} practitioner-apply" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="apply-grid">
      <div class="apply-intro">
        <p class="eyebrow">${esc(s.eyebrow)}</p>
        <h2 id="${esc(s.id)}-title" tabindex="-1">${s.headline}</h2>
        ${paras(s.body)}
        <p class="apply-privacy">${s.privacy}</p>
      </div>

      <div class="apply-card reveal-item">
        <form class="pf" method="POST" action="/advisors/groups/apply" data-group-form
              data-thanks="${esc(G.THANKS)}" novalidate>

          ${/* The honeypot. Off-screen rather than display:none, which some bots skip. */''}
          <div class="pf-hp" aria-hidden="true">
            <label>Company<input name="company" tabindex="-1" autocomplete="off"></label>
          </div>
          <input type="hidden" name="source" value="">

          <div class="pf-step">
            <h3 class="pf-step-title">About you</h3>
            <div class="pf-grid">
              ${field({ name: 'first_name', label: 'First name', autocomplete: 'given-name', maxlength: 80 })}
              ${field({ name: 'last_name', label: 'Last name', autocomplete: 'family-name', maxlength: 80 })}
              ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', maxlength: 200, wide: true })}
              ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', maxlength: 40, required: false })}
              ${field({ name: 'business', label: 'Agency or business name', autocomplete: 'organization', maxlength: 140 })}
              ${field({ name: 'host_agency', label: 'Host agency or consortium', maxlength: 300, required: false, wide: true })}
              <fieldset class="pf-links pf-field--wide">
                <legend><span class="pf-label">Where can we see your work?</span></legend>
                <p class="pf-hint pf-links-hint">Optional. Each box takes a single link.</p>
                <div class="pf-grid">
                  ${field({ name: 'website_url', label: 'Website', type: 'text', inputmode: 'url', autocomplete: 'url', maxlength: 200, required: false })}
                  ${field({ name: 'social', label: 'Main social profile', type: 'text', inputmode: 'url', maxlength: 200, required: false })}
                </div>
              </fieldset>
              ${field({ name: 'country', label: 'Country', autocomplete: 'country-name', maxlength: 80 })}
              ${field({ name: 'experience', label: 'Your relevant travel experience', area: true, rows: 3, maxlength: 2000, required: false, wide: true })}
              ${field({ name: 'group_experience', label: 'Groups you have produced or led before', area: true, rows: 3, maxlength: 2000, required: false, wide: true, hint: 'If any. A first group is a fair answer.' })}
            </div>

            <h3 class="pf-step-title gf-section">The group</h3>
            ${choice('program_interest', 'radio', interestOpts, { legend: 'What are you interested in?' })}
            <div class="pf-grid pf-grid--one">
              ${field({ name: 'concept', label: 'Briefly describe the group or retreat concept', area: true, maxlength: 2000, wide: true })}
              ${field({ name: 'audience', label: 'Who are the travellers? Describe the audience', area: true, rows: 3, maxlength: 2000, wide: true })}
            </div>
            <div class="pf-grid">
              ${field({ name: 'audience_size', label: 'Engaged audience or known travellers', maxlength: 120, required: false, wide: true })}
              ${field({ name: 'expected_travellers', label: 'Expected travellers', maxlength: 120, required: false })}
              ${field({ name: 'departure_window', label: 'Target dates or window', maxlength: 300, required: false })}
              ${field({ name: 'budget_range', label: 'Intended budget per person', maxlength: 120, required: false, hint: 'Optional, and not a quote request.', wide: true })}
            </div>

            ${choice('support_needed', 'checkbox', supportOpts, { legend: 'What would you like help with?', hint: 'Choose all that apply.', required: false })}

            <div class="pf-grid pf-grid--one">
              ${field({ name: 'how_you_sell', label: 'How do you currently reach and sell to this audience?', area: true, rows: 3, maxlength: 2000, wide: true, hint: 'Including whether you would lead the sales.' })}
              ${field({ name: 'notes', label: 'Anything else we should know?', area: true, rows: 3, maxlength: 2000, required: false, wide: true })}
            </div>

            <label class="pf-consent">
              <input type="checkbox" name="contact_consent" value="yes" required>
              <span>You may contact me about this application.</span>
            </label>

            <p class="pf-error" role="alert" data-gf-error hidden></p>
            <div class="pf-actions">
              <button class="btn btn--gold" type="submit" data-gf-submit>Submit group concept</button>
            </div>
            <p class="pf-status" role="status" aria-live="polite" data-gf-status></p>
          </div>
        </form>

        <div class="pf-done" data-gf-done tabindex="-1" hidden>
          <svg class="pf-check" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true" focusable="false"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 27l8 8 14-16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <h3>Application received.</h3>
          <p data-gf-done-text>${esc(G.THANKS)}</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
  }

  return { groupForm };
};
