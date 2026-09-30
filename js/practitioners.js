/* ============================================================================
   /practitioners — behaviour
   ----------------------------------------------------------------------------
   Three jobs, all enhancement. The page and the form are complete without this
   file (lib/practitioner-sections.js ships one real <form> with every field in
   it, and /practitioners/apply answers a plain POST), so a browser that never
   runs it loses the steps, the progress bar and the inline success message —
   and nothing else.

     1. ANCHORS   Smooth scrolling is done by Lenis (js/motion.js) or by CSS.
                  Neither moves focus, so a keyboard or screen-reader user lands
                  nowhere in particular. This puts focus on the target once the
                  scroll has settled.
     2. PATHWAYS  The hero, capability, network and closing buttons preselect the
                  matching pathway on the form, and fire their analytics event.
     3. THE FORM  Two steps, conditional groups, Step 1 kept if the visitor goes
                  back (and if they reload), JSON submit, inline success.

   NO CALENDAR, NO BOOKING. The success state is text. Nothing here opens, embeds
   or links a scheduler, and the server never returns one.

   Analytics (js/analytics.js, dslwTrack): practitioner_retreat_cta,
   visiting_practitioner_cta, practitioner_form_started, practitioner_form_step_2,
   practitioner_form_submitted. Every call is guarded — analytics is optional.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function track(name, props) {
    try { if (window.dslwTrack) window.dslwTrack(name, props); } catch (e) { /* never break the page for a metric */ }
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* sessionStorage can throw (private windows, blocked storage). Every access is
     wrapped, and the page works identically when it is unavailable. */
  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del: function (k) { try { window.sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ── 1 · Anchors ───────────────────────────────────────────────────────── */
  var settle = reduced ? 0 : 900;   // Lenis takes about a second to arrive

  function focusTarget(id) {
    var el = document.getElementById(id);
    if (!el) return;
    /* On the form section the useful landing is its heading, not the section. */
    var heading = document.getElementById(id + '-title');
    var target = (id === 'apply' && heading) ? heading : el;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    var id = a.getAttribute('href').slice(1);
    if (!id || !document.getElementById(id)) return;
    window.setTimeout(function () { focusTarget(id); }, settle);
  });

  if (location.hash.length > 1) {
    window.addEventListener('load', function () {
      window.setTimeout(function () { focusTarget(decodeURIComponent(location.hash.slice(1))); }, 300);
    });
  }

  /* ── 2 · Pathways ──────────────────────────────────────────────────────── */
  var form = $('[data-practitioner-form]');

  function pathwayOf(a) {
    var p = a.getAttribute('data-pathway');
    if (p) return p;
    var m = /[?&]path=(retreat|visiting|both)\b/.exec(a.getAttribute('href') || '');
    return m ? m[1] : '';
  }
  function setPathway(p) {
    if (!form || !p) return;
    var radio = $('input[name="pathway"][value="' + p + '"]', form);
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var p = pathwayOf(a);
    if (!p) return;

    track(p === 'visiting' ? 'visiting_practitioner_cta' : 'practitioner_retreat_cta', {
      location: a.getAttribute('data-loc') || (a.closest('section[id]') || {}).id || 'unknown',
      label: (a.textContent || '').trim().slice(0, 80)
    });

    var href = a.getAttribute('href') || '';
    /* Only a link that lands ON the form should choose for the visitor. The hero's
       secondary button goes to the network section first, and must not pick a
       pathway on a form they have not reached. */
    if (/#apply$/.test(href)) {
      setPathway(p);
      /* A `?path=` link is a full URL, not a bare hash, so nothing else will
         scroll it: do it here. Bare `#apply` links are left to Lenis or CSS. */
      if (href.charAt(0) !== '#') {
        e.preventDefault();
        var apply = document.getElementById('apply');
        if (apply) {
          apply.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
          if (history.pushState) history.pushState(null, '', '#apply');
          window.setTimeout(function () { focusTarget('apply'); }, settle);
        }
      }
    }
  });

  /* ── 2b · Motion ─────────────────────────────────────────────────────────
     Everything here is gated on the site's own switch. js/motion.js sets
     body[data-motion="ready"] only when something will definitely reveal the
     content, and never for reduced-motion or automated visitors — so when that
     attribute is absent none of this runs, the CSS never hides anything, and the
     page is simply complete. No `scroll` listeners (Lenis suppresses them):
     IntersectionObserver for arrival, rAF sampling for the one thing that
     tracks position. */
  var motionOn = document.body.getAttribute('data-motion') === 'ready';

  /* Add `cls` to `el` the first time it is seen, and no later than the point
     where the observer has plainly not delivered. Same failsafe principle as
     motion.js: a transition that did not run must never leave content hidden. */
  function whenSeen(el, cls, threshold) {
    if (!el) return;
    var seen = false, delivered = false;
    function go() { if (seen) return; seen = true; el.classList.add(cls); }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var io = new IntersectionObserver(function (entries) {
      delivered = true;
      entries.forEach(function (e) { if (e.isIntersecting) { go(); io.disconnect(); } });
    }, { threshold: threshold || 0.2, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    setTimeout(function () { if (!delivered) go(); }, 2600);
  }

  if (motionOn) {
    /* FOCAL — the ecosystem assembles when it arrives; the photographs open. */
    whenSeen($('[data-eco]'), 'is-in', 0.35);

    /* The radar behind the diagram runs only while the diagram is on screen — a
       continuous animation that keeps running off-screen is a battery cost with no
       audience. Toggling .is-live pauses it (animation-play-state), it does not
       restart it. */
    var ecoLive = $('[data-eco]');
    if (ecoLive && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        ecoLive.classList.toggle('is-live', entries[0].isIntersecting);
      }, { rootMargin: '10% 0px 10% 0px' }).observe(ecoLive);
    }
    $$('.reveal-media').forEach(function (el) { whenSeen(el, 'is-in', 0.18); });
    whenSeen($('.practitioner-value'), 'is-in', 0.25);
    whenSeen($('.practitioner-network'), 'is-in', 0.25);

    /* CONTINUITY — the timeline's spine fills as the list is read, and each step
       lights as its dot crosses the reading line. rAF-sampled, and only while the
       list is on screen. */
    var tl = $('.path-list--timeline');
    if (tl) {
      tl.setAttribute('data-tl', '');
      var tlSteps = $$('.path-step', tl);
      var lastP = -1, running = false, onScreen = false;
      var frame = function () {
        var line = window.innerHeight * 0.62;
        var r = tl.getBoundingClientRect();
        var p = Math.min(1, Math.max(0, (line - r.top) / r.height));
        if (Math.abs(p - lastP) > 0.002) { tl.style.setProperty('--p', p.toFixed(3)); lastP = p; }
        tlSteps.forEach(function (s) { s.classList.toggle('is-passed', s.getBoundingClientRect().top + 28 < line); });
        if (onScreen) window.requestAnimationFrame(frame); else running = false;
      };
      frame();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          onScreen = entries[0].isIntersecting;
          if (onScreen && !running) { running = true; frame(); }
        }, { rootMargin: '20% 0px 20% 0px' }).observe(tl);
      }
    }
  }

  /* WAYFINDING — the context band marks the section you are in. A thin band at
     the upper third of the viewport decides, so it changes when a section
     actually owns the screen rather than when its first pixel appears. Sections
     that belong to a neighbour (the destination band follows "how it works")
     are mapped rather than left unlit. */
  var band = $('.pro-context--scroll .pro-context-nav');
  if (band && 'IntersectionObserver' in window) {
    var owner = { build: 'build', 'how-it-works': 'how-it-works', destination: 'how-it-works',
                  network: 'network', apply: 'apply', begin: 'apply' };
    var bandLinks = {};
    $$('a[href^="#"]', band).forEach(function (a) { bandLinks[a.getAttribute('href').slice(1)] = a; });
    var lit = null;
    var light = function (id) {
      var next = bandLinks[owner[id]] || null;
      if (next === lit) return;
      if (lit) lit.removeAttribute('aria-current');
      if (next) next.setAttribute('aria-current', 'true');
      lit = next;
    };
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) light(e.target.id); });
    }, { rootMargin: '-33% 0px -62% 0px' });
    $$('main section[id]').forEach(function (s) { navIo.observe(s); });
  }

  /* The primary action stays one tap away on a phone, from the end of the hero
     until the form itself (or the closing invitation) is on screen. Hidden from
     assistive tech and from tab order while it is off. */
  var hero = $('.practitioner-photo');
  var applySec = document.getElementById('apply');
  var beginSec = document.getElementById('begin');
  if (hero && applySec && 'IntersectionObserver' in window) {
    var stickyBar = document.createElement('div');
    stickyBar.className = 'practitioner-sticky';
    stickyBar.setAttribute('aria-hidden', 'true');
    stickyBar.setAttribute('inert', '');
    stickyBar.innerHTML = '<a class="btn btn--gold" href="#apply" data-pathway="retreat" data-loc="sticky">Tell Us About Your Retreat →</a>';
    document.body.appendChild(stickyBar);

    var past = false, formsOn = 0;
    var setBar = function () {
      var on = past && formsOn === 0;
      stickyBar.classList.toggle('is-on', on);
      stickyBar.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) stickyBar.removeAttribute('inert'); else stickyBar.setAttribute('inert', '');
    };
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      past = !e.isIntersecting && e.boundingClientRect.bottom < 0;
      setBar();
    }).observe(hero);
    var formIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target._on = e.isIntersecting; });
      formsOn = [applySec, beginSec].filter(function (x) { return x && x._on; }).length;
      setBar();
    }, { threshold: 0.05 });
    formIo.observe(applySec);
    if (beginSec) formIo.observe(beginSec);
  }

  if (!form) return;

  /* ── 3 · The form ──────────────────────────────────────────────────────── */
  var steps = $$('[data-pf-step]', form);
  var progress = $('[data-pf-progress]', form);
  var progressLabel = $('[data-pf-progress-label]', form);
  var bar = $('[data-pf-bar]', form);
  var nextBtn = $('[data-pf-next]', form);
  var backBtn = $('[data-pf-back]', form);
  var submitBtn = $('[data-pf-submit]', form);
  var statusEl = $('[data-pf-status]', form);
  var done = $('[data-pf-done]');
  var current = 1;
  var started = false;
  var KEY = 'dslw_pf_step1';

  var LABELS = { 1: 'Step 1 of 2 · About you', 2: 'Step 2 of 2 · Your work' };

  /* Take over from the no-JavaScript form. novalidate: the browser's own bubbles
     would fire on fields in a step that is hidden, and cannot express "one of
     website or social". The checks below say the same things in the page. */
  form.noValidate = true;
  form.setAttribute('data-enhanced', '');
  if (progress) progress.hidden = false;
  if (nextBtn) nextBtn.hidden = false;
  if (backBtn) backBtn.hidden = false;
  $$('.pf-step-title', form).forEach(function (h) { h.setAttribute('tabindex', '-1'); });

  function val(name) {
    var el = form.elements[name];
    return el && el.value ? String(el.value).trim() : '';
  }
  function checked(name) {
    return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; });
  }
  function pathway() { return checked('pathway')[0] || ''; }

  var EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

  function showStep(n, opts) {
    var prev = current;
    current = n;
    steps.forEach(function (s) { s.hidden = Number(s.getAttribute('data-pf-step')) !== n; });
    if (progressLabel) progressLabel.textContent = LABELS[n];
    if (bar) bar.style.transform = 'scaleX(' + (n === 1 ? 0.5 : 1) + ')';
    if (!opts || !opts.quiet) {
      var stepEl = $('[data-pf-step="' + n + '"]', form);
      /* 320ms, ease-out, interruptible (WAAPI) — it travels the way you are
         going, so Back reads as back. Not run on the quiet initial state. */
      if (motionOn && stepEl && stepEl.animate) {
        var dir = n > prev ? 1 : -1;
        stepEl.animate([{ opacity: 0, transform: 'translateX(' + (dir * 14) + 'px)' }, { opacity: 1, transform: 'none' }],
                       { duration: 320, easing: EASE });
      }
      var title = $('[data-pf-step="' + n + '"] .pf-step-title', form);
      var card = form.closest('.apply-card') || form;
      card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      if (title) { try { title.focus({ preventScroll: true }); } catch (e) { title.focus(); } }
    }
  }

  /* Conditional groups. The pathway decides which branch(es) show; "yes" to
     having led before reveals the detail field. */
  var firstSync = true;
  function easeIn(el) {
    if (motionOn && !firstSync && el.animate) {
      el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
                 { duration: 280, easing: EASE });
    }
  }
  function syncConditionals() {
    var p = pathway();
    $$('[data-pf-branch]', form).forEach(function (b) {
      var kind = b.getAttribute('data-pf-branch');
      var was = b.hidden;
      b.hidden = !(p === 'both' || p === kind);
      if (was && !b.hidden) easeIn(b);
    });
    var led = checked('led_before')[0] === 'yes';
    $$('[data-pf-when-led]', form).forEach(function (c) { var was = c.hidden; c.hidden = !led; if (was && !c.hidden) easeIn(c); });

    if (submitBtn) {
      submitBtn.textContent = submitBtn.getAttribute('data-label-' + (p || 'both')) || 'Submit Application';
    }
  }

  /* ── Validation ────────────────────────────────────────────────────────── */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* One link or nothing — the same rule as cleanLink() in api/_lib/practitioner.js,
     so the page and the server cannot disagree about what a link is. Empty is fine
     here (one of the two is enforced separately). */
  function linkOk(v) {
    if (!v) return true;
    if (/[\s,;]/.test(v) || v.charAt(0) === '@') return false;
    var u;
    try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : 'https://' + v); } catch (e) { return false; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return /^[^.]+(\.[^.]+)+$/.test(u.hostname) && /[a-z]{2,}$/i.test(u.hostname);
  }

  function clearErrors(scope) {
    $$('[aria-invalid]', scope).forEach(function (el) { el.removeAttribute('aria-invalid'); });
    $$('[data-pf-error]', scope).forEach(function (el) { el.hidden = true; el.textContent = ''; });
  }
  function fail(scope, message, el) {
    var box = $('[data-pf-error]', scope);
    if (box) { box.textContent = message; box.hidden = false; }
    if (el) {
      el.setAttribute('aria-invalid', 'true');
      try { el.focus(); } catch (e) { /* hidden */ }
    }
    return false;
  }
  function empty(el) { return !el || !String(el.value || '').trim(); }

  function validateStep1() {
    var scope = $('[data-pf-step="1"]', form);
    clearErrors(scope);
    var f = form.elements;
    if (empty(f.first_name)) return fail(scope, 'We need a first name.', f.first_name);
    if (empty(f.last_name)) return fail(scope, 'We need a last name.', f.last_name);
    if (!EMAIL.test(val('email'))) return fail(scope, 'That email address does not look right.', f.email);
    if (empty(f.business)) return fail(scope, 'We need your business or practice name.', f.business);
    if (empty(f.website_url) && empty(f.social)) {
      return fail(scope, 'Please add a link to your website or to your main social profile, so we can see your work.', f.website_url);
    }
    if (!linkOk(val('website_url'))) {
      return fail(scope, 'That website does not look like a single link. Please paste one link, for example https://yourwebsite.com.', f.website_url);
    }
    if (!linkOk(val('social'))) {
      return fail(scope, 'Please paste the full link to one profile, for example https://instagram.com/yourname — not a handle, and one link only.', f.social);
    }
    if (empty(f.country)) return fail(scope, 'We need your country.', f.country);
    if (empty(f.modality)) return fail(scope, 'Please tell us your primary area of practice.', f.modality);
    if (!pathway()) return fail(scope, 'Please choose what you are interested in.', $('input[name="pathway"]', form));
    return true;
  }

  function validateStep2() {
    var scope = $('[data-pf-step="2"]', form);
    clearErrors(scope);
    var f = form.elements;
    if (empty(f.work)) return fail(scope, 'Please describe your work.', f.work);
    if (empty(f.serves)) return fail(scope, 'Please tell us who you serve.', f.serves);
    if (empty(f.community)) return fail(scope, 'Please tell us about your community or audience.', f.community);
    if (!checked('led_before').length) {
      return fail(scope, 'Please tell us whether you have led groups before.', $('input[name="led_before"]', form));
    }
    var p = pathway();
    if (p === 'retreat' || p === 'both') {
      if (!checked('concept').length) {
        return fail(scope, 'Please tell us where your retreat idea is today.', $('input[name="concept"]', form));
      }
      if (!checked('help_with').length) {
        return fail(scope, 'Please choose what you would most like help with.', $('input[name="help_with"]', form));
      }
    }
    if (p === 'visiting' || p === 'both') {
      if (empty(f.credentials)) return fail(scope, 'Please list your certifications or credentials.', f.credentials);
      if (empty(f.experience_type)) return fail(scope, 'Please describe the experience you could deliver onsite.', f.experience_type);
    }
    return true;
  }

  /* ── Step 1 survives going backwards, and reloading ────────────────────── */
  var STEP1 = ['first_name', 'last_name', 'email', 'phone', 'business', 'website_url', 'social', 'country', 'years', 'modality'];

  function saveStep1() {
    var o = {};
    STEP1.forEach(function (n) { o[n] = val(n); });
    o.pathway = pathway();
    store.set(KEY, JSON.stringify(o));
  }
  function restoreStep1(keepPathway) {
    var raw = store.get(KEY);
    if (!raw) return;
    var o;
    try { o = JSON.parse(raw); } catch (e) { return; }
    STEP1.forEach(function (n) {
      var el = form.elements[n];
      if (el && !el.value && o[n]) el.value = o[n];
    });
    if (!keepPathway && o.pathway && !pathway()) setPathway(o.pathway);
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */
  form.addEventListener('focusin', function () {
    if (!started) { started = true; track('practitioner_form_started', {}); }
  });
  form.addEventListener('input', function (e) {
    if (STEP1.indexOf(e.target.name) !== -1) saveStep1();
    if (e.target.getAttribute && e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'pathway') saveStep1();
    if (e.target.name === 'pathway' || e.target.name === 'led_before') syncConditionals();
  });

  if (nextBtn) nextBtn.addEventListener('click', function () {
    if (!validateStep1()) return;
    saveStep1();
    track('practitioner_form_step_2', { pathway: pathway() });
    showStep(2);
  });
  if (backBtn) backBtn.addEventListener('click', function () { showStep(1); });

  var STEP1_FIELDS = STEP1.concat(['pathway']);

  /* A server-side refusal. A field from step 1 means going back to fix it. */
  function showError(message, fieldName) {
    if (statusEl) statusEl.textContent = '';
    var el = fieldName ? $('[name="' + fieldName + '"]', form) : null;
    var step = fieldName && STEP1_FIELDS.indexOf(fieldName) !== -1 ? 1 : current;
    if (step !== current) showStep(step, { quiet: true });
    return fail($('[data-pf-step="' + step + '"]', form), message, el);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    /* Enter inside a step-1 field submits the form: treat it as "Continue". */
    if (current === 1) { if (nextBtn) nextBtn.click(); return; }
    if (!validateStep1()) { showStep(1); return; }
    if (!validateStep2()) return;

    var body = {};
    $$('input, textarea', form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (el.checked) (body[el.name] = body[el.name] || []).push(el.value);
      } else if (el.type === 'radio') {
        if (el.checked) body[el.name] = el.value;
      } else {
        body[el.name] = el.value;
      }
    });

    submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Sending…';

    fetch(form.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; });
    }).then(function (r) {
      submitBtn.disabled = false;
      if (r.ok && r.j && r.j.ok) {
        var p = body.pathway;
        var text = form.getAttribute(p === 'visiting' ? 'data-thanks-visiting' : 'data-thanks-retreat');
        store.del(KEY);
        track('practitioner_form_submitted', { pathway: p });
        form.hidden = true;
        var t = $('[data-pf-done-text]', done);
        if (t && text) t.textContent = text;
        done.hidden = false;
        (form.closest('.apply-card') || done).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        try { done.focus({ preventScroll: true }); } catch (err) { done.focus(); }
        return;
      }
      showError((r.j && r.j.message) || 'Something went wrong. Please try again.', r.j && r.j.field);
    }).catch(function () {
      submitBtn.disabled = false;
      showError('We could not reach the server. Please check your connection and try again.', null);
    });
  });

  /* ── Start ─────────────────────────────────────────────────────────────── */
  var q = /[?&]path=(retreat|visiting|both)\b/.exec(location.search);
  restoreStep1(Boolean(q));
  if (q) {
    setPathway(q[1]);
    var src = $('input[name="source"]', form);
    if (src) src.value = 'path-' + q[1];
  }
  syncConditionals();
  firstSync = false;
  showStep(1, { quiet: true });
})();
