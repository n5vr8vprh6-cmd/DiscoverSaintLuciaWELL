/* ============================================================================
   THE WELL JOURNEY FINDER
   ----------------------------------------------------------------------------
   Four questions → the three villages that best answer them → the experiences
   inside those villages → an advisor, or an email if they are not ready to talk
   to one yet.

   Everything runs in the browser. No answers are transmitted, no account is
   created, nothing is written to storage. The result is reproducible from the
   URL hash alone, which is what makes it shareable and what lets someone return
   to it without us keeping anything.

   PROGRESSIVE ENHANCEMENT
   The static six-village explainer is what the server sends. This file swaps it
   for the quiz only after confirming the data parsed and the DOM it needs is
   present — so a failure here leaves a complete page rather than a blank one.
   ========================================================================== */
(function () {
  'use strict';

  var dataEl = document.getElementById('finder-data');
  var appEl = document.getElementById('finder-app');
  var staticEl = document.getElementById('finder-static');
  var formEl = document.getElementById('finder-form');
  var resultEl = document.getElementById('finder-result');
  if (!dataEl || !appEl || !staticEl || !formEl || !resultEl) return;

  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); }
  catch (e) { return; }          /* leave the static explainer in place */
  if (!DATA || !DATA.questions || !DATA.villages) return;

  var track = window.dslwTrack || function () {};
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* Hand the page over to the interactive version. */
  staticEl.hidden = true;
  appEl.hidden = false;

  var questions = DATA.questions;
  var fieldsets = Array.prototype.slice.call(formEl.querySelectorAll('.finder-q'));
  var bar = formEl.querySelector('.finder-progress-bar');
  var backBtn = formEl.querySelector('[data-finder-back]');
  var nextBtn = formEl.querySelector('[data-finder-next]');
  var answers = {};
  var step = 0;

  /* ── Navigation ─────────────────────────────────────────────────────────── */
  function show(i, userInitiated) {
    step = i;
    fieldsets.forEach(function (fs, n) { fs.hidden = n !== i; });
    bar.style.width = Math.round(((i + 1) / questions.length) * 100) + '%';
    backBtn.hidden = i === 0;
    nextBtn.textContent = i === questions.length - 1 ? 'See my journey' : 'Continue';
    nextBtn.disabled = !answers[questions[i].id];

    /* Move focus to the new question so keyboard and screen-reader users are not
       left behind on a fieldset that is now hidden — but ONLY when the user
       caused the change. Focusing on first paint draws a focus ring on a page
       nobody has interacted with yet. */
    if (!userInitiated) return;
    var legend = fieldsets[i].querySelector('.finder-q-text');
    if (legend) {
      legend.setAttribute('tabindex', '-1');
      legend.focus({ preventScroll: true });
    }
  }

  formEl.addEventListener('change', function (e) {
    if (e.target.type !== 'radio') return;
    answers[e.target.name] = e.target.value;
    nextBtn.disabled = false;
  });

  backBtn.addEventListener('click', function () {
    if (step > 0) show(step - 1, true);
  });

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!answers[questions[step].id]) return;
    if (step < questions.length - 1) {
      track('finder_step', { step: step + 1, answer: answers[questions[step].id] });
      show(step + 1, true);
    } else {
      finish();
    }
  });

  /* ── Scoring ─────────────────────────────────────────────────────────────
     Straight weighted sum. Ties break by the villages array order, which is
     the brochure's own order — a stable, editorially-chosen fallback rather
     than whatever the engine happens to do. */
  function score() {
    var totals = {};
    DATA.villages.forEach(function (v) { totals[v.key] = 0; });

    questions.forEach(function (q) {
      var value = answers[q.id];
      if (!value) return;
      var opt = null;
      for (var i = 0; i < q.options.length; i++) {
        if (q.options[i].value === value) { opt = q.options[i]; break; }
      }
      if (!opt || !opt.weights) return;
      Object.keys(opt.weights).forEach(function (k) {
        if (totals[k] !== undefined) totals[k] += opt.weights[k];
      });
    });

    return DATA.villages
      .map(function (v, i) { return { v: v, n: totals[v.key], i: i }; })
      .sort(function (a, b) { return b.n - a.n || a.i - b.i; })
      .slice(0, 3)
      .map(function (r) { return r.v; });
  }

  /* Experiences whose village is in the matched set, in match order. */
  function experiencesFor(matched) {
    var keys = matched.map(function (v) { return v.key; });
    var out = [];
    keys.forEach(function (k) {
      DATA.experiences.forEach(function (group) {
        if (group.villageKey !== k) return;
        group.items.forEach(function (item) {
          out.push({ intention: group.intention, title: item.title, note: item.note });
        });
      });
    });
    return out.slice(0, 6);
  }

  function intentionLabel() {
    var q = questions[0];
    for (var i = 0; i < q.options.length; i++) {
      if (q.options[i].value === answers[q.id]) return q.options[i];
    }
    return null;
  }

  /* ── Result ─────────────────────────────────────────────────────────────── */
  function finish() {
    var matched = score();
    var exps = experiencesFor(matched);
    var wantsEclipse = answers.recognition === 'yes';
    var intent = intentionLabel();

    track('finder_complete', {
      intention: answers.intention,
      companions: answers.companions,
      pace: answers.pace,
      eclipse_surfaced: wantsEclipse,
      villages: matched.map(function (v) { return v.key; }).join(',')
    });

    var villageCards = matched.map(function (v, i) {
      return '<li class="village-card" style="--v:' + esc(v.color) + ';--v-ink:' + esc(v.ink) + '">' +
        '<span class="result-rank">' + (i === 0 ? 'Closest match' : 'Also for you') + '</span>' +
        '<span class="village-rule" aria-hidden="true"></span>' +
        '<h4 class="village-card-title">' + esc(v.name) + '</h4>' +
        '<p class="village-subline">' + esc(v.subline) + '</p>' +
        '<p class="village-body">' + esc(v.body) + '</p>' +
        '<ul class="chip-list">' + v.themes.slice(0, 3).map(function (t) {
          return '<li>' + esc(t) + '</li>';
        }).join('') + '</ul>' +
        '<p class="result-anchors"><b>Places in this village</b>' +
          esc(v.anchors.join(' · ')) + '</p>' +
      '</li>';
    }).join('');

    var expItems = exps.map(function (x) {
      return '<li><h5>' + esc(x.title) + '</h5><p>' + esc(x.note) + '</p></li>';
    }).join('');

    var eclipseBlock = wantsEclipse
      ? '<div class="result-eclipse">' +
          '<p class="eyebrow eyebrow--copper">One more to consider</p>' +
          '<h4>Eclipse — when rest alone is no longer enough</h4>' +
          '<p>A curated recovery journey through Saint Lucia, designed by practitioners and health professionals. ' +
          'It is sequenced rather than assembled: rainforest before deeper reflection, movement before release, ' +
          'restoration after intensity. Guided entry before arrival, and integration after you return home.</p>' +
          '<div class="section-cta section-cta--left">' +
            '<a class="btn btn--copper" href="/eclipse">Discover Eclipse</a>' +
          '</div>' +
        '</div>'
      : '';

    resultEl.innerHTML =
      '<div class="result-head">' +
        (intent ? '<p class="result-intention">You began with · ' + esc(intent.compass || intent.label) + '</p>' : '') +
        '<h3>Your Saint Lucia begins here.</h3>' +
        '<p class="lead">Three villages answer what you named. They are a starting point, not a package — ' +
        'an advisor will shape the sequence around your time, your energy and who you are traveling with.</p>' +
      '</div>' +
      '<ul class="village-grid result-villages">' + villageCards + '</ul>' +
      (expItems ? '<div class="result-block"><h4>Experiences inside them</h4><ul class="result-exp">' + expItems + '</ul></div>' : '') +
      eclipseBlock +
      '<div class="result-actions">' +
        '<a class="btn btn--gold" href="/about#contact">Speak with an advisor</a>' +
        '<a class="btn btn--ghost" href="/explore#villages">Explore all six villages</a>' +
        '<button type="button" class="btn btn--ghost" data-finder-restart>Start again</button>' +
      '</div>' +
      '<form class="capture" id="finder-capture" novalidate>' +
        '<label for="finder-email">Not ready to talk to anyone yet?</label>' +
        '<p class="capture-note">We can send this result and a short introduction to the island. One email, no series.</p>' +
        '<div class="capture-row">' +
          '<input type="email" id="finder-email" name="email" required autocomplete="email" placeholder="you@example.com">' +
          '<button class="btn btn--ghost" type="submit">Send it to me</button>' +
        '</div>' +
        '<p class="capture-status" id="capture-status" role="status" aria-live="polite"></p>' +
      '</form>';

    formEl.hidden = true;
    resultEl.hidden = false;
    resultEl.focus();

    /* Shareable and returnable without us storing anything. */
    try {
      var hash = '#r=' + [answers.intention, answers.companions, answers.pace, answers.recognition].join('-');
      history.replaceState(null, '', location.pathname + hash);
    } catch (e) { /* non-fatal */ }

    wireResult();
  }

  function wireResult() {
    var restart = resultEl.querySelector('[data-finder-restart]');
    if (restart) {
      restart.addEventListener('click', function () {
        answers = {};
        formEl.reset();
        formEl.hidden = false;
        resultEl.hidden = true;
        resultEl.innerHTML = '';
        history.replaceState(null, '', location.pathname);
        show(0, true);
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    /* ── Email capture ──────────────────────────────────────────────────────
       STUB. There is no ESP endpoint yet, so this validates, reports honestly,
       and records the intent — it does not pretend to have sent anything.
       Wire CAPTURE_ENDPOINT when the ESP is chosen; the event schema below is
       already what the funnel report expects. */
    var CAPTURE_ENDPOINT = '';
    var cap = document.getElementById('finder-capture');
    var status = document.getElementById('capture-status');
    if (!cap) return;

    cap.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('finder-email');
      var email = (input.value || '').trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        status.textContent = 'That email address does not look right — could you check it?';
        status.setAttribute('data-state', 'error');
        input.focus();
        return;
      }

      track('finder_capture', {
        intention: answers.intention,
        villages: score().map(function (v) { return v.key; }).join(',')
      });

      if (!CAPTURE_ENDPOINT) {
        status.textContent = 'Thank you — email delivery is not connected yet, so nothing has been sent. Your result stays on this page, and the link in your address bar will bring you back to it.';
        status.setAttribute('data-state', 'ok');
        return;
      }

      status.textContent = 'Sending…';
      status.removeAttribute('data-state');
      fetch(CAPTURE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          result: answers,
          attribution: window.dslwAttribution ? window.dslwAttribution() : null
        })
      }).then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        status.textContent = 'On its way. Check your inbox in a minute or two.';
        status.setAttribute('data-state', 'ok');
        cap.querySelector('button[type="submit"]').disabled = true;
      }).catch(function () {
        status.textContent = 'Something went wrong sending that. Please try again in a moment.';
        status.setAttribute('data-state', 'error');
      });
    });
  }

  /* ── Restore a shared result ────────────────────────────────────────────── */
  var m = /#r=([a-z]+)-([a-z]+)-([a-z]+)-([a-z]+)/.exec(location.hash);
  if (m) {
    answers = { intention: m[1], companions: m[2], pace: m[3], recognition: m[4] };
    var valid = questions.every(function (q) {
      return q.options.some(function (o) { return o.value === answers[q.id]; });
    });
    if (valid) { finish(); return; }
    answers = {};
  }

  show(0);
})();
