/* ============================================================================
   PRACTITIONER PAGE — section renderers
   ----------------------------------------------------------------------------
   The section types /practitioners needs that the shared library does not have:
   a hero that carries two pathway buttons, an ecosystem diagram, capability
   modules on a LIGHT skin (tileGrid is the Eclipse midnight world and must stay
   there), a destination band with village labels, the Visiting Practitioner
   Network band, and the two-step qualification form.

   Kept in its own file rather than appended to components.js (1,300+ lines and
   read top to bottom). It receives that file's helpers as an argument instead of
   requiring it, so the two never form a cycle: components.js requires this and
   hands over what it already has.

   EVERY SECTION HAS AN id. js/analytics.js derives an event's `location` from
   the nearest section[id]; a section without one reports as "unknown".

   NOTHING HERE OFFERS A CALENDAR. No "book a call", no scheduler, no booking
   URL, on the page or in the success state (brief §05, §09, §13). The only next
   step the page offers is the application. tools/practitioner-test.js asserts
   that on the rendered HTML, because the rule is easy to break with one
   well-meaning button.
   ========================================================================== */
'use strict';

const { VILLAGES } = require('../content/villages.js');
const P = require('../api/_lib/practitioner.js');

module.exports = function build(h) {
  const { esc, btn, paras, figure, mediaPicture } = h;

  /* An <a> that behaves as a button and tells js/practitioners.js which pathway
     to preselect. Without JavaScript it is an ordinary link to #apply, and the
     form's default (Retreat) is already selected, so nothing is lost. */
  const pathBtn = (cta, variant, pathway) =>
    `<a class="btn btn--${variant}" href="${esc(cta.href)}" data-pathway="${esc(pathway)}">${esc(cta.label)}</a>`;

  /* ══════════════════════════════════════════════════════════════════════════
     HERO — lead with the outcome, not the network
     ══════════════════════════════════════════════════════════════════════════ */
  /* The words and the photograph are two bands, not one layered on the other.
     They were layered first, and it failed for a reason specific to this
     picture: the group sits centre-bottom and the copy sits left-centre, so the
     veil that holds the headline's contrast also dimmed the very people the page
     exists to show ("I can see my work happening here"). Stacked, the headline
     sits on plain ink and the photograph runs full-bleed and undimmed beneath it. */
  function practitionerHero(s) {
    const img = s.img || {};
    const photo = img.base
      ? mediaPicture(img, { sizes: '100vw', priority: true })
      : figure(img);   // an honest art-direction panel if the picture is ever missing

    return `<section class="page-header section--ink practitioner-hero" id="top">
  <div class="wrap">
    <p class="eyebrow">${esc(s.eyebrow)}</p>
    <h1>${s.headline}</h1>
    ${[].concat(s.lead || []).map((p) => `<p class="lead">${p}</p>`).join('\n    ')}
    <div class="hero-ctas practitioner-ctas">
      ${pathBtn(s.primary, 'gold', 'retreat')}
      ${pathBtn(s.secondary, 'ghost', 'visiting')}
    </div>
    ${s.microcopy ? `<p class="practitioner-micro">${esc(s.microcopy)}</p>` : ''}
  </div>
</section>
<div class="practitioner-photo reveal-media">
  ${photo}
</div>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ECOSYSTEM — make the complexity visible, then remove it
     A clean editorial diagram, not icon-heavy cards (brief §03). The practice is
     at the centre because the page's claim is that it stays there; everything
     else is drawn as what surrounds it. Decorative geometry is aria-hidden and
     the meaning is a real list, so it reads correctly linearised.
     ══════════════════════════════════════════════════════════════════════════ */
  function ecosystem(s) {
    const nodes = s.nodes.map((n) => `<li class="eco-node eco-node--${esc(n.pos)}">
          <span class="eco-k">${esc(n.k)}</span>
          <span class="eco-t">${esc(n.t)}</span>
        </li>`).join('\n        ');

    return `<section class="section section--paper practitioner-value" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2 id="${esc(s.id)}-title">${s.headline}</h2>
    </div>
    <div class="practitioner-prose">
      ${paras(s.body)}
    </div>
    <div class="eco" data-eco aria-labelledby="${esc(s.id)}-eco">
      <p class="eco-label" id="${esc(s.id)}-eco">${esc(s.diagramLabel)}</p>
      <div class="eco-rings" aria-hidden="true"><span class="eco-pulse"></span><span class="eco-pulse"></span><span class="eco-pulse"></span></div>
      <ul class="eco-list">
        ${nodes}
      </ul>
    </div>
  </div>
</section>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CAPABILITIES — six restrained modules, then the one primary action
     ══════════════════════════════════════════════════════════════════════════ */
  function capabilities(s) {
    const cards = s.items.map((c) => `<li class="cap">
          <h3>${esc(c.t)}</h3>
          <p>${esc(c.s)}</p>
        </li>`).join('\n        ');

    return `<section class="section section--sand practitioner-caps" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2 id="${esc(s.id)}-title">${s.headline}</h2>
      ${[].concat(s.lead || []).map((p) => `<p class="lead">${p}</p>`).join('\n      ')}
    </div>
    <ul class="cap-grid">
        ${cards}
    </ul>
    <div class="section-cta section-cta--left">
      ${pathBtn(s.cta, 'gold', 'retreat')}
    </div>
    ${s.guardrail ? `<p class="section-footnote">${esc(s.guardrail)}</p>` : ''}
  </div>
</section>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DESTINATION — make the ecosystem tangible without re-teaching the whole
     consumer site. One wide, real Saint Lucia photograph; the six Wellness
     Villages named as quiet labels, in the words the consumer site uses. They are
     labels, not links and not map pins: the villages are a way of understanding
     the island, not six locations (content/villages.js).
     ══════════════════════════════════════════════════════════════════════════ */
  function destination(s) {
    const labels = VILLAGES.map((v, i) => `<li style="--i:${i}">${esc(v.short)}</li>`).join('\n          ');
    const e = s.eclipse;

    return `<section class="section section--sand practitioner-destination" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2 id="${esc(s.id)}-title">${s.headline}</h2>
    </div>
    <div class="practitioner-prose">
      ${paras(s.body)}
    </div>
    <div class="dest-figure reveal-media">
      ${figure(s.img, { className: 'dest-photo' })}
      <ul class="dest-labels" aria-label="The six Wellness Villages">
          ${labels}
      </ul>
    </div>
    <p class="practitioner-link">${btn(s.cta, 'ghost')}</p>

    <aside class="proof reveal-item" id="${esc(e.id)}" aria-labelledby="${esc(e.id)}-title">
      <p class="proof-kicker">${esc(e.kicker)}</p>
      <h3 id="${esc(e.id)}-title">${esc(e.headline)}</h3>
      ${paras(e.body)}
      <p class="proof-cta">${btn(e.cta, 'copper')}</p>
      <p class="proof-note">${esc(e.note)}</p>
    </aside>
  </div>
</section>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     VISITING PRACTITIONER NETWORK — the secondary pathway
     A change of pace: a deeper band and a quieter image, still inside the brand
     system. The qualification line is the load-bearing sentence and is styled as
     one; it is not small print.
     ══════════════════════════════════════════════════════════════════════════ */
  function network(s) {
    return `<section class="section section--ink practitioner-network" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="network-grid">
      <div class="network-copy">
        <p class="eyebrow">${esc(s.eyebrow)}</p>
        <h2 id="${esc(s.id)}-title">${s.headline}</h2>
        ${paras(s.body)}
        <p class="network-qual">${esc(s.qualification)}</p>
        <div class="section-cta section-cta--left">
          ${pathBtn(s.cta, 'gold', 'visiting')}
        </div>
      </div>
      <div class="network-media reveal-media">
        ${figure(s.img, { className: 'photo--dark' })}
      </div>
    </div>
  </div>
</section>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     THE FORM — selective, useful, easy to complete
     ──────────────────────────────────────────────────────────────────────────
     COMPLETE WITHOUT JAVASCRIPT. This is one real <form> with every field in the
     markup and a real action, so a browser with scripting off posts it and gets a
     real answer (hub-screens/practitioner.js). js/practitioners.js then promotes
     it: it hides step 2 and the pathway-specific groups, shows progress, and
     posts JSON. Building it the other way round would make the gate itself a
     thing that fails silently.

     Option values come from api/_lib/practitioner.js — the same tables the
     endpoint validates against — so the form and the check cannot disagree about
     what a legal answer is.

     THE HONEYPOT IS `company`; the real business field is `business`. See the
     screen for why the name matters.
     ══════════════════════════════════════════════════════════════════════════ */
  /* Example answers, shown light grey inside the box. See the note where they are
     defined; css/practitioners.css styles the placeholder. */
  const PH = {
      "email": "you@yourpractice.com",
      "phone": "+1 555 123 4567",
      "business": "e.g. Still Waters Wellness",
      "country": "e.g. Canada",
      "years": "e.g. 8 years",
      "modality": "e.g. Breathwork, nutrition coaching, somatic movement",
      "work": "e.g. A six-week breathwork program for founders, taught live and online",
      "serves": "e.g. Founders and senior leaders, mostly aged 35 to 55",
      "community": "e.g. A 4,000-subscriber newsletter and a private group of 300 members",
      "led_before_detail": "e.g. Three 20-person weekend retreats in Portugal, 2023 to 2025",
      "audience_size": "e.g. 2,500 Instagram followers and 800 email subscribers",
      "group_size": "e.g. 12 to 20",
      "price_range": "e.g. $2,500 to $3,500",
      "timing": "e.g. Spring 2027, five to seven nights",
      "previous_locations": "e.g. Tulum, the Algarve, the Catskills",
      "credentials": "e.g. RYT-500; certified breathwork facilitator",
      "experience_type": "e.g. A 60-minute morning breathwork session for up to 20 guests",
      "session_capacity": "e.g. Up to 20 guests",
      "availability": "e.g. Two to four weeks, November to April",
      "hospitality_experience": "e.g. Two seasons as a visiting practitioner at a resort in Costa Rica"
  };

  const field = (o) => {
    const id = 'pf-' + o.name;
    /* Branch fields (the ones that only apply to one pathway) carry `data-req`
       rather than `required`. Natively required, they would stop a
       JavaScript-off visitor who chose only one pathway from submitting at all
       — the other pathway's fields are in the markup too. js/practitioners.js
       and the server both enforce them for the pathway that was chosen. */
    const req = o.required === false ? '' : (o.branch ? ' data-req' : ' required');
    const common = `id="${id}" name="${esc(o.name)}"${req}${o.hint ? ` aria-describedby="${id}-hint"` : ''}${o.autocomplete ? ` autocomplete="${esc(o.autocomplete)}"` : ''}${(o.placeholder || PH[o.name]) ? ` placeholder="${esc(o.placeholder || PH[o.name])}"` : ''}${o.maxlength ? ` maxlength="${o.maxlength}"` : ''}`;
    const control = o.area
      ? `<textarea ${common} rows="${o.rows || 4}"></textarea>`
      : `<input ${common} type="${o.type || 'text'}"${o.inputmode ? ` inputmode="${o.inputmode}"` : ''}>`;
    return `<div class="pf-field${o.wide ? ' pf-field--wide' : ''}">
          <label for="${id}"><span class="pf-label">${esc(o.label)}</span>${o.required === false && o.badge !== false ? ` <span class="pf-opt">${esc(o.badge || 'optional')}</span>` : ''}</label>
          ${control}
          ${o.hint ? `<span class="pf-hint" id="${id}-hint">${esc(o.hint)}</span>` : ''}
        </div>`;
  };

  /* `req`: 'native' puts `required` on every radio in the group (a radio group
     needs only one answer, natively); 'js' marks the group for
     js/practitioners.js and the server to enforce, for branch-only groups. */
  const choice = (name, type, options, { legend, hint, req = 'native', cols } = {}) => `<fieldset class="pf-choice${cols ? ' pf-choice--' + cols : ''}"${req ? ' data-required-group' : ''}>
          <legend><span class="pf-label">${esc(legend)}</span></legend>
          ${hint ? `<span class="pf-hint">${esc(hint)}</span>` : ''}
          <div class="pf-options">
            ${options.map(([v, l]) => `<label class="pf-opt-card"><input type="${type}" name="${esc(name)}" value="${esc(v)}"${req === 'native' ? ' required' : ''}><span>${esc(l)}</span></label>`).join('\n            ')}
          </div>
        </fieldset>`;

  function practitionerForm(s) {
    const t = s.thanks;
    const pathOpts = Object.keys(P.PATHWAYS).map((k) => [k, {
      retreat: 'Building a Saint Lucia retreat',
      visiting: 'The Visiting Practitioner Network',
      both: 'Both'
    }[k]]);

    return `<section class="section section--paper practitioner-apply" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
  <div class="wrap">
    <div class="apply-grid">
      <div class="apply-intro">
        <p class="eyebrow">${esc(s.eyebrow)}</p>
        <h2 id="${esc(s.id)}-title" tabindex="-1">${s.headline}</h2>
        ${paras(s.body)}
        <p class="apply-privacy">${s.privacy}</p>
      </div>

      <div class="apply-card reveal-item">
        <form class="pf" method="POST" action="/practitioners/apply" data-practitioner-form
              data-thanks-retreat="${esc(P.THANKS.retreat)}"
              data-thanks-visiting="${esc(P.THANKS.visiting)}">

          <div class="pf-progress" data-pf-progress hidden>
            <p class="pf-progress-label" data-pf-progress-label aria-live="polite">Step 1 of 2 · About you</p>
            <div class="pf-bar" aria-hidden="true"><span data-pf-bar></span></div>
          </div>

          ${/* The honeypot. Off-screen rather than display:none, which some bots skip. */''}
          <div class="pf-hp" aria-hidden="true">
            <label>Company<input name="company" tabindex="-1" autocomplete="off"></label>
          </div>
          <input type="hidden" name="source" value="">

          <!-- STEP 1 -->
          <div class="pf-step" data-pf-step="1">
            <h3 class="pf-step-title">About you</h3>
            <div class="pf-grid">
              ${field({ name: 'first_name', label: 'First name', autocomplete: 'given-name', maxlength: 80 })}
              ${field({ name: 'last_name', label: 'Last name', autocomplete: 'family-name', maxlength: 80 })}
              ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', maxlength: 200, wide: true })}
              ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', maxlength: 40, required: false })}
              ${field({ name: 'business', label: 'Business or practice name', autocomplete: 'organization', maxlength: 140 })}
              <fieldset class="pf-links pf-field--wide">
                <legend><span class="pf-label">Where can we see your work?</span></legend>
                <p class="pf-hint pf-links-hint">Add at least one link. Each box takes a single link.</p>
                <div class="pf-grid">
                  ${field({ name: 'website_url', label: 'Website', type: 'text', inputmode: 'url', autocomplete: 'url', maxlength: 200, required: false, badge: false, placeholder: 'https://yourwebsite.com' })}
                  ${field({ name: 'social', label: 'Main social profile', type: 'text', inputmode: 'url', maxlength: 200, required: false, badge: false, placeholder: 'https://instagram.com/yourname', hint: 'The one profile you are most active on.' })}
                </div>
              </fieldset>
              ${field({ name: 'country', label: 'Country', autocomplete: 'country-name', maxlength: 80 })}
              ${field({ name: 'years', label: 'Years in practice or business', maxlength: 120, required: false })}
              ${field({ name: 'modality', label: 'Primary area of practice or modality', maxlength: 300, wide: true })}
            </div>
            ${choice('pathway', 'radio', pathOpts, { legend: 'What are you interested in?' })}
            <p class="pf-error" role="alert" data-pf-error hidden></p>
            <div class="pf-actions">
              <button class="btn btn--gold" type="button" data-pf-next hidden>Continue</button>
            </div>
          </div>

          <!-- STEP 2 -->
          <div class="pf-step" data-pf-step="2">
            <h3 class="pf-step-title">Your work and what you want to create</h3>
            <div class="pf-grid pf-grid--one">
              ${field({ name: 'work', label: 'Briefly describe your work or signature methodology', area: true, maxlength: 2000, wide: true })}
              ${field({ name: 'serves', label: 'Who do you primarily serve?', area: true, rows: 3, maxlength: 2000, wide: true })}
              ${field({ name: 'community', label: 'Tell us about your existing community or audience', area: true, rows: 3, maxlength: 2000, wide: true })}
            </div>
            ${choice('led_before', 'radio', [['yes', 'Yes'], ['no', 'No']], { legend: 'Have you previously led retreats, group programs or live experiences?', cols: 'inline' })}
            <div class="pf-cond" data-pf-when-led="yes">
              ${field({ name: 'led_before_detail', label: 'Tell us about them', area: true, rows: 3, maxlength: 2000, required: false, wide: true })}
            </div>
            <div class="pf-grid pf-grid--one">
              ${field({ name: 'audience_size', label: 'Approximate size of your engaged audience or community', maxlength: 120, required: false, wide: true })}
            </div>

            <div class="pf-branch" data-pf-branch="retreat">
              <h4 class="pf-branch-title">About the retreat</h4>
              ${choice('concept', 'radio', Object.keys(P.CONCEPT).map((k) => [k, P.CONCEPT[k]]), { legend: 'Do you already have a retreat or program concept?', req: 'js' })}
              <div class="pf-grid">
                ${field({ name: 'group_size', label: 'Expected group size', maxlength: 120, required: false, hint: 'If known.' })}
                ${field({ name: 'price_range', label: 'Target price range per participant', maxlength: 120, required: false, hint: 'If known.' })}
                ${field({ name: 'timing', label: 'Preferred timing or dates', maxlength: 300, required: false, wide: true })}
                ${field({ name: 'previous_locations', label: 'Where have you previously hosted groups?', maxlength: 300, required: false, wide: true })}
              </div>
              ${choice('help_with', 'checkbox', Object.keys(P.HELP_WITH).map((k) => [k, P.HELP_WITH[k]]), { legend: 'What would you most like help with?', hint: 'Choose any that apply.', cols: 'two', req: 'js' })}
            </div>

            <div class="pf-branch" data-pf-branch="visiting">
              <h4 class="pf-branch-title">About your practice on the island</h4>
              <div class="pf-grid pf-grid--one">
                ${field({ name: 'credentials', label: 'Certifications and professional credentials', area: true, rows: 3, maxlength: 2000, wide: true, branch: true })}
                ${field({ name: 'experience_type', label: 'The type of onsite experience you could deliver', area: true, rows: 3, maxlength: 2000, wide: true, branch: true })}
              </div>
              <div class="pf-grid">
                ${field({ name: 'session_capacity', label: 'Typical session or group capacity', maxlength: 120, required: false })}
                ${field({ name: 'availability', label: 'Availability and preferred engagement length', maxlength: 300, required: false })}
                ${field({ name: 'hospitality_experience', label: 'Previous resort or hospitality experience', area: true, rows: 3, maxlength: 2000, required: false, wide: true })}
              </div>
            </div>

            <div class="pf-grid pf-grid--one">
              ${field({ name: 'notes', label: 'Anything else we should know?', area: true, rows: 3, maxlength: 2000, required: false, wide: true })}
            </div>

            <p class="pf-error" role="alert" data-pf-error hidden></p>
            <div class="pf-actions">
              <button class="btn btn--ghost pf-back" type="button" data-pf-back hidden>Back</button>
              <button class="btn btn--gold" type="submit" data-pf-submit data-label-retreat="Submit Retreat Application" data-label-visiting="Submit Practitioner Profile" data-label-both="Submit Application">Submit Application</button>
            </div>
            <p class="pf-status" role="status" aria-live="polite" data-pf-status></p>
          </div>
        </form>

        <div class="pf-done" data-pf-done tabindex="-1" hidden>
          <svg class="pf-check" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true" focusable="false"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M15 27.5l8 8 14-16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <h3>Application received.</h3>
          <p data-pf-done-text>${esc(t)}</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
  }

  return { practitionerHero, ecosystem, capabilities, destination, network, practitionerForm };
};
