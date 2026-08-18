/* ============================================================================
   THE WELL JOURNEY FINDER
   ----------------------------------------------------------------------------
   Six questions → the three villages that best answer them → the experiences
   inside those villages → an advisor, or an email if they are not ready to talk
   to one yet.

   The question set is DATA, read from #finder-data. Nothing in this file names
   a question or an answer literally — including the result hash, which is built
   and parsed from `questions` at both ends. Adding a question used to break that
   round trip silently: an old link restored fewer answers and scored a
   different result, with no error anywhere.

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

  /* App-shell furniture. Optional on purpose: if any of it is missing the tool
     still runs as a plain in-page quiz, which is what it was before. */
  var launchEl = document.getElementById('finder-launch');
  var barEl = document.getElementById('finder-bar');
  var stepsEl = document.getElementById('finder-rail');
  var exitEl = document.getElementById('finder-exit');
  var washEl = document.getElementById('finder-wash');
  var shapingEl = document.getElementById('finder-shaping');
  var beginEl = document.getElementById('finder-begin');

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* The bar is up from the first frame, not from Begin. Without it the launch
     screen carries no brand mark and no way out at all — the global header it
     replaced is gone by then. The step rail is the part that waits, since
     there is no step to be on yet. */
  if (barEl) barEl.hidden = false;
  if (stepsEl) stepsEl.hidden = true;

  var questions = DATA.questions;
  var fieldsets = Array.prototype.slice.call(formEl.querySelectorAll('.finder-q'));
  var stepNodes = stepsEl
    ? Array.prototype.slice.call(stepsEl.querySelectorAll('li'))
    : [];
  var backBtn = formEl.querySelector('[data-finder-back]');
  var nextBtn = formEl.querySelector('[data-finder-next]');
  var answers = {};
  var step = 0;

  /* ── The wash ─────────────────────────────────────────────────────────────
     The whole of the "the destination responds to you" idea, done with the
     accent colours the six villages already carry rather than a photograph per
     answer. After each choice the leading village is whatever the existing
     scoring already says it is, and its accent cross-fades in behind the shell.

     Deliberately faint. It should register as the room changing colour, not as
     a background image — if a visitor notices it as an effect it is too strong.
     Reduced motion gets the colour without the transition. */
  function wash() {
    if (!washEl) return;
    var top = score()[0];
    if (!top) return;
    washEl.style.setProperty('--wash', top.color);
    washEl.classList.add('is-on');
  }

  /* ── Navigation ─────────────────────────────────────────────────────────── */
  function lightSteps(i) {
    stepNodes.forEach(function (n, x) {
      n.classList.toggle('is-active', x === i);
      n.classList.toggle('is-done', x < i);
    });
  }

  function show(i, userInitiated) {
    step = i;
    fieldsets.forEach(function (fs, n) { fs.hidden = n !== i; });
    lightSteps(i);
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
    wash();
  });

  /* ── STATE 0 → 1 ───────────────────────────────────────────────────────── */
  function begin() {
    if (launchEl) launchEl.hidden = true;
    formEl.hidden = false;
    if (stepsEl) stepsEl.hidden = false;
    show(0, true);
    track('finder_begin', {});
  }
  if (beginEl) beginEl.addEventListener('click', begin);

  /* Exit goes back where they came from, but only if that was us — an
     off-site referrer must not be able to steer this button, and a direct
     arrival has no history to go back to. */
  if (exitEl) {
    exitEl.addEventListener('click', function () {
      var from = document.referrer;
      var internal = false;
      try { internal = !!from && new URL(from).origin === location.origin; }
      catch (e) { internal = false; }
      track('finder_exit', { step: step });
      if (internal && history.length > 1) history.back();
      else location.href = '/';
    });
  }

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

  /* ── STATE 5 · shaping ────────────────────────────────────────────────────
     A transition, not a progress bar, and specifically not a timer pretending
     to compute. The scoring is synchronous and instant; what takes time is the
     visitor's eye moving from a question to a result, and this covers that. The
     beats are named after what the four answers actually contributed, so the
     pause says something rather than just occupying the moment.

     It is skipped entirely on `instant` — which is how a shared #r= link
     arrives. Someone opening a friend's result has not answered anything, and
     performing a computation at them would be theatre. */
  function shaping(then, instant) {
    if (instant || reduced || !shapingEl) return then();
    formEl.hidden = true;
    shapingEl.hidden = false;
    shapingEl.classList.add('is-running');

    var beats = shapingEl.querySelectorAll('.shaping-beats li');
    var done = false;
    function finishUp() {
      if (done) return;
      done = true;
      shapingEl.hidden = true;
      shapingEl.classList.remove('is-running');
      then();
    }
    /* Driven by the animation itself so the pause is exactly as long as the
       reveal, and a failsafe in case animationend never fires (a background
       tab will not run it). */
    var last = beats[beats.length - 1];
    if (last) last.addEventListener('animationend', finishUp, { once: true });
    setTimeout(finishUp, 1600);
  }

  /* ── The Compass readout ──────────────────────────────────────────────────
     Which directions the answers leaned toward — NAMED, NOT MEASURED.

     We do hold real weighted totals and could render "Restore ●●●●●". We do
     not, on purpose. Dots imply a measurement, and six questions cannot
     support one: the difference between a four and a five would be an artefact
     of how the weights were hand-tuned, not something we learned about the
     person. Naming the directions is the honest version of the same signal —
     it still shows the tool understood them, without dressing a preference up
     as a score.

     Directions come from the answered options' own compass labels, so this can
     never drift from what the Compass on the homepage says.

     WHY IT IS SHORT, AND WHY IT IS NOT PADDED OUT.
     Only question 1 carries compass labels, because only question 1 asks about
     intention. "With a partner" and "Gentle" are real answers but they are not
     compass directions, and assigning them one — Reconnect for a partner, say —
     would be us inventing a reading of the person rather than reporting what
     they told us. So this returns one direction, plus Return when the
     recognition answer is yes: that gate is what surfaces Eclipse, and Return
     is the Eclipse arc's own sixth phase (the same provenance recorded in
     content/home.js for the homepage Compass).

     One or two honest directions beats five padded ones. If a longer readout is
     ever wanted, the way to get it is more questions, not more inference. */
  function compassDirections() {
    var out = [];
    questions.forEach(function (q) {
      var value = answers[q.id];
      if (!value) return;
      q.options.forEach(function (o) {
        if (o.value === value && o.compass && out.indexOf(o.compass) === -1) {
          out.push(o.compass);
        }
      });
    });
    if (answers.recognition === 'yes' && out.indexOf('Return') === -1) out.push('Return');
    return out;
  }

  /* ── Result ─────────────────────────────────────────────────────────────── */
  function finish(instant) {
    var matched = score();
    var exps = experiencesFor(matched);
    var wantsEclipse = answers.recognition === 'yes';
    var directions = compassDirections();

    track('finder_complete', {
      intention: answers.intention,
      companions: answers.companions,
      pace: answers.pace,
      eclipse_surfaced: wantsEclipse,
      villages: matched.map(function (v) { return v.key; }).join(',')
    });

    /* The photograph. Villages already carry built, correctly-sized imagery;
       only the three matched ones are ever requested. `loading="lazy"` on the
       two runners-up because on a laptop they are below the fold. */
    function photo(v, eager) {
      if (!v.image || !v.image.base || !v.image.widths) return '';
      var set = v.image.widths.map(function (w) {
        return v.image.base + '-' + w + '.jpg ' + w + 'w';
      }).join(', ');
      return '<div class="result-media">' +
        '<img src="' + esc(v.image.base) + '-' + v.image.widths[0] + '.jpg"' +
        ' srcset="' + esc(set) + '"' +
        ' sizes="(max-width: 860px) 100vw, 33vw"' +
        ' alt="' + esc(v.image.alt || '') + '"' +
        ' loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async">' +
      '</div>';
    }

    /* The first card is the recommendation and now looks like one. It used to
       be identical to the other two apart from the words "Closest match",
       which made the ranking something you had to read rather than see. */
    var villageCards = matched.map(function (v, i) {
      var lead = i === 0;
      return '<li class="village-card result-card' + (lead ? ' result-card--lead' : '') +
          '" style="--v:' + esc(v.color) + ';--v-ink:' + esc(v.ink) + '">' +
        photo(v, lead) +
        '<div class="result-card-body">' +
          '<span class="result-rank">' + (lead ? 'Closest match' : 'Also for you') + '</span>' +
          '<span class="village-rule" aria-hidden="true"></span>' +
          '<h4 class="village-card-title">' + esc(v.name) + '</h4>' +
          '<p class="village-subline">' + esc(v.subline) + '</p>' +
          '<p class="village-body">' + esc(v.body) + '</p>' +
          '<ul class="chip-list">' + v.themes.slice(0, 3).map(function (t) {
            return '<li>' + esc(t) + '</li>';
          }).join('') + '</ul>' +
          '<p class="result-anchors"><b>Places in this village</b>' +
            esc(v.anchors.join(' · ')) + '</p>' +
        '</div>' +
      '</li>';
    }).join('');

    var expItems = exps.map(function (x) {
      return '<li><h5>' + esc(x.title) + '</h5><p>' + esc(x.note) + '</p></li>';
    }).join('');

    /* The copy filled about half the block and the rest was dark nothing. The
       Eclipse mark is the right thing to put there: it is the identity of the
       product being offered, it is already drawn for a dark ground (it is the
       `--sign` treatment on /eclipse), and it costs one small asset we have
       already built. Decorative alt is empty — the heading beside it names the
       thing, so a screen reader announcing the logo twice would be noise. */
    var eclipseBlock = wantsEclipse
      ? '<div class="result-eclipse">' +
          '<div class="result-eclipse-copy">' +
            '<p class="eyebrow eyebrow--copper">One more to consider</p>' +
            '<h4>Eclipse — when rest alone is no longer enough</h4>' +
            '<p>A curated recovery journey through Saint Lucia, designed by practitioners and health professionals. ' +
            'It is sequenced rather than assembled: rainforest before deeper reflection, movement before release, ' +
            'restoration after intensity. Guided entry before arrival, and integration after you return home.</p>' +
            '<div class="section-cta section-cta--left">' +
              /* A NEW TAB, because this is a detour and not a destination.
                 Somebody who has just spent a minute building a result should
                 be able to read about Eclipse and still have their result
                 sitting where they left it. The primary action below is
                 deliberately NOT treated this way: hijacking the thing a page
                 is asking you to do is what makes a page feel untrustworthy. */
              '<a class="btn btn--copper" href="/eclipse" target="_blank" rel="noopener">Discover Eclipse</a>' +
            '</div>' +
          '</div>' +
          '<div class="result-eclipse-mark" aria-hidden="true">' +
            '<picture>' +
              '<source srcset="/assets/eclipse/eclipse-mark-440.webp" type="image/webp">' +
              '<img src="/assets/eclipse/eclipse-mark-440.png" alt="" width="440" height="440" loading="lazy" decoding="async">' +
            '</picture>' +
          '</div>' +
        '</div>'
      : '';

    /* The chips stay as the text version of the same fact — they are what a
       screen reader reads and what shows if the ring is missing. The ring
       itself is moved in below, beside the heading. */
    var compassBlock = directions.length
      ? '<div class="result-compass">' +
          '<p class="result-compass-label">Your Compass</p>' +
          '<ul class="result-compass-list">' + directions.map(function (d) {
            return '<li>' + esc(d) + '</li>';
          }).join('') + '</ul>' +
        '</div>'
      : '';

    /* "You began with · Restore" used to sit here, directly above a Compass
       readout whose first chip was also Restore. Two labels, one fact. The
       Compass block keeps it, because that is the name of the system this
       belongs to; the loose line goes. */
    var html =
      '<div class="result-head">' +
        '<div class="result-head-copy">' +
          '<h3>Your Saint Lucia begins here.</h3>' +
          '<p class="lead">Three villages answer what you named. They are a starting point, not a package — ' +
          'an advisor will shape the sequence around your time, your energy and who you are traveling with.</p>' +
          compassBlock +
        '</div>' +
        '<div class="result-head-figure" data-compass-slot></div>' +
      '</div>' +
      '<ul class="village-grid result-villages">' + villageCards + '</ul>' +
      (expItems ? '<div class="result-block"><h4>Experiences inside them</h4><ul class="result-exp">' + expItems + '</ul></div>' : '') +
      eclipseBlock +
      /* The primary action is filled in after the advisor lookup resolves —
         see `wireShare()`. It renders as the unattributed CTA first so the
         result is complete and actionable even if the lookup never answers. */
      '<div class="result-actions" data-share-actions>' +
        '<a class="btn btn--gold" href="/about#contact" data-share-primary>Speak with a Saint Lucia WELL Advisor</a>' +
        '<a class="btn btn--ghost" href="/explore#villages" target="_blank" rel="noopener">Explore all six villages</a>' +
        '<button type="button" class="btn btn--ghost" data-finder-restart>Start again</button>' +
      '</div>' +
      '<div class="share-panel" id="share-panel" hidden></div>' +
      '<form class="capture" id="finder-capture" novalidate>' +
        '<label for="finder-email">Not ready to talk to anyone yet?</label>' +
        '<p class="capture-note">We can send this result and a short introduction to the island. One email, no series.</p>' +
        '<div class="capture-row">' +
          '<input type="email" id="finder-email" name="email" required autocomplete="email" placeholder="you@example.com">' +
          '<button class="btn btn--ghost" type="submit">Send it to me</button>' +
        '</div>' +
        /* This is the only place on the site that asks for personal data, and
           it said nothing about what happens to it. The sentence states use,
           non-sharing and removal, and every word of it has to stay true of
           whatever the ESP is eventually set to do.

           It deliberately does NOT link to /privacy: that page does not exist
           yet, and a consent line pointing at a 404 is worse than one that
           does not. See the TODO at CAPTURE_ENDPOINT — the link goes in as
           part of wiring the endpoint, not before. */
        '<p class="capture-consent">We use it only to send those two emails — never sold, never shared — and you can ask us to remove it at any time.</p>' +
        '<p class="capture-status" id="capture-status" role="status" aria-live="polite"></p>' +
      '</form>';

    /* The markup is built before the transition starts, so the pause covers
       work that is genuinely finished rather than standing in for work that
       has not begun. */
    /* Move the build-time compass into the result and take its bearing.

       `is-drawn` is not optional: under body[data-motion="ready"] the labels
       start at opacity 0 and only the drawn state animates them in, so without
       it the ring arrives as an empty circle. `is-probed` is the existing
       hover mechanism — it dims the directions that are not active, which is
       what makes the lit ones read as chosen rather than merely brighter. */
    function placeCompass() {
      var fig = document.getElementById('finder-compass');
      var slot = resultEl.querySelector('[data-compass-slot]');
      if (!fig || !slot || !directions.length) return;
      slot.appendChild(fig);
      fig.hidden = false;
      var svg = fig.querySelector('.compass');
      if (!svg) return;
      svg.classList.add('is-drawn', 'is-probed');
      [].forEach.call(svg.querySelectorAll('.compass-point'), function (g) {
        var label = g.querySelector('.compass-label');
        var name = label ? label.textContent.trim() : '';
        g.classList.toggle('is-active', directions.indexOf(name) !== -1);
      });
    }

    shaping(function () {
      resultEl.innerHTML = html;
      placeCompass();
      if (launchEl) launchEl.hidden = true;
      formEl.hidden = true;
      resultEl.hidden = false;
      /* The step rail has nothing left to point at once the questions are
         done, and leaving "Fit" lit implies there is more to come. */
      if (stepsEl) stepsEl.hidden = true;
      /* `preventScroll`, then go to the top ourselves. A bare focus() scrolls
         the result into view, which on a sticky-header layout parks the
         heading and the top of the Compass underneath the bar. A result should
         begin at its beginning. */
      resultEl.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      wash();
      wireResult();
      wireShare();
    }, instant);

    /* Count the completion — a number and a timestamp, never the answers.
       Skipped on `instant`, which means a restored shared link: someone
       reading a friend's result has not completed anything. */
    if (!instant) countCompletion();

    /* Shareable and returnable without us storing anything. */
    try {
      /* DERIVED FROM `questions`, never a hand-written list. This used to name
         the four answers literally, and its parser named them again at the
         bottom of the file — so adding a question broke the round trip in a
         way nothing would have caught: an old link restores fewer answers,
         scores them, and shows a DIFFERENT result with no error anywhere. */
      var hash = '#r=' + questions.map(function (q) { return answers[q.id]; }).join('-');
      history.replaceState(null, '', location.pathname + hash);
    } catch (e) { /* non-fatal */ }
  }

  /* ── Sharing a Journey with an advisor ────────────────────────────────────
     The Finder stays anonymous. Nothing above this point has sent anything
     about the visitor anywhere. This is the one place a person can choose to
     become known, and it only happens on a deliberate click followed by a
     deliberate consent.

     The result is fully useful without it. If the lookup fails, if the network
     is down, if the backend does not exist yet — the unattributed CTA is
     already rendered and the page is complete. */
  /* The wording is from the Privacy & Consent Implementation Guide §B, and it
     is deliberately specific where my first attempt was vague. It names the
     advisor, says plainly that they are independent and handle the information
     under their own practices, and states that sharing is not a marketing
     opt-in. Consent that does not say who receives the data is not consent.

     Built per advisor rather than held as a constant, because the name is part
     of what is being agreed to — and the exact string is stored with the record
     (`consent_text`), so we can always show what a given person actually saw. */
  /* ── WHAT THEY AGREE TO ───────────────────────────────────────────────
     Two strings, because there are two genuinely different things happening
     and pretending otherwise would make one of them false.

     REFERRED: they arrived through a named advisor's link and are handing
     their details to that person. Third-party disclosure, disclosed as such.

     HOUSE: nobody referred them. Their details go to the Discover Saint Lucia
     WELL team — the operator, not a third party — who will introduce them to
     one advisor from the network. Saying "we are sharing this with an
     independent advisor" at that moment would be untrue: no advisor has been
     chosen yet.

     THE HOUSE WORDING IS SEQUENCED ON PURPOSE. An earlier draft opened with
     "share with our network" and corrected itself afterwards, which is a
     consent you have to read twice. It now says what happens first, then what
     happens next.

     "not before" is a promise the design already keeps — the Journey sits on
     the house account until a person presses Introduce, and that press is the
     only thing that discloses it. Free to make, and it is the sentence that
     makes handing over a phone number feel safe.

     Whichever is shown is stored verbatim in `consent_text`, so we can always
     produce exactly what a given person read. */
  var CONSENT_TAIL =
    ' Sharing your Journey does not subscribe you to marketing emails.';

  function shareConsent(advisorName) {
    if (advisorName) {
      return 'By choosing “Share my Journey,” you agree that Discover Saint Lucia ' +
        'WELL may share your contact information, Journey Finder result and the ' +
        'travel details you provide with ' + advisorName + ' so they can contact you about ' +
        'planning your Saint Lucia journey. Your advisor is an independent travel ' +
        'professional and handles information they receive under their own privacy ' +
        'practices.' + CONSENT_TAIL;
    }
    return 'By choosing “Share my Journey,” you agree that Discover Saint Lucia ' +
      'WELL may hold your contact information, Journey Finder result and the travel ' +
      'details you provide, and introduce you to one advisor from our network of ' +
      'qualified Saint Lucia WELL advisors, who will contact you about planning your ' +
      'journey. Your details reach that advisor when we make the introduction, not ' +
      'before. Advisors are independent travel professionals and handle information ' +
      'they receive under their own privacy practices.' + CONSENT_TAIL;
  }

  function attribution() {
    try { return (window.dslwAttribution && window.dslwAttribution()) || {}; }
    catch (e) { return {}; }
  }

  function shareForm(advisorName) {
    var who = advisorName ? esc(advisorName) : 'the Saint Lucia WELL team';
    return '' +
      '<form class="share-form" id="share-form" novalidate>' +
        '<h4 class="share-title">Share your Journey with ' + who + '</h4>' +
        '<p class="share-note">They will see what your Journey pointed toward, so the ' +
          'first conversation can start from what you actually need.</p>' +
        '<div class="share-grid">' +
          '<label>First name<input name="firstName" autocomplete="given-name" required></label>' +
          '<label>Last name<input name="lastName" autocomplete="family-name" required></label>' +
          '<label>Email<input type="email" name="email" autocomplete="email" required></label>' +
          '<label>Phone <span class="share-opt">optional</span>' +
            '<input type="tel" name="phone" autocomplete="tel"></label>' +
          '<label class="share-wide">When are you thinking of travelling?' +
            /* The option VALUE is the normalised travel window the Hub sorts
               by; the option TEXT is what the consumer reads and what the
               advisor sees quoted back. Both are sent. "Within the next
               month" exists because an advisor needs to know the difference
               between six weeks away and six days away, and the old buckets
               could not express it. */
            '<select name="timing">' +
              '<option value="">Not sure yet</option>' +
              '<option value="30d">Within the next month</option>' +
              '<option value="31-90d">1–3 months</option>' +
              '<option value="3-6mo">3–6 months</option>' +
              '<option value="6-12mo">6–12 months</option>' +
              '<option value="12mo+">More than a year away</option>' +
            '</select></label>' +
          '<label class="share-wide">Anything you would like them to know? ' +
            '<span class="share-opt">optional</span>' +
            '<textarea name="context" rows="3"></textarea>' +
            '<span class="share-hint">Please don’t include medical or other sensitive ' +
              'information that isn’t needed for travel planning.</span></label>' +
        '</div>' +
        /* Not visible, not reachable by keyboard, not announced. Anything that
           fills it is not a person. */
        '<div class="share-hp" aria-hidden="true">' +
          '<label>Company<input name="company" tabindex="-1" autocomplete="off"></label>' +
        '</div>' +
        '<label class="share-consent">' +
          '<input type="checkbox" name="consent" required>' +
          /* The worst of the three to lose a page over: leaving a half-filled
             form to read a policy loses the form. */
          '<span>' + esc(shareConsent(advisorName)) + ' See the <a href="/privacy" target="_blank" rel="noopener">privacy page</a>.</span>' +
        '</label>' +
        '<div class="share-actions">' +
          '<button class="btn btn--gold" type="submit">Share my Journey</button>' +
          '<button class="btn btn--ghost" type="button" data-share-cancel>Not now</button>' +
        '</div>' +
        '<p class="share-status" role="status" aria-live="polite"></p>' +
      '</form>';
  }

  function wireShare() {
    var panel = document.getElementById('share-panel');
    var primary = resultEl.querySelector('[data-share-primary]');
    if (!panel || !primary) return;

    var attr = attribution();
    var advisorName = null;

    function openShare(e) {
      if (e) e.preventDefault();
      panel.innerHTML = shareForm(advisorName);
      panel.hidden = false;
      var form = document.getElementById('share-form');
      var first = form.querySelector('input[name="firstName"]');
      if (first) first.focus();
      form.querySelector('[data-share-cancel]').addEventListener('click', function () {
        panel.hidden = true;
        panel.innerHTML = '';
        primary.focus();
      });
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        submitShare(form, advisorName);
      });
      track('share_opened', { attributed: !!advisorName });
    }

    /* ── WHO IS THIS GOING TO? ────────────────────────────────────────────
       Asked with the referral if there is one, and without it if there is not.
       With no parameter the endpoint answers with the house account — the
       central pool (brief §8) — so a visitor who arrived cold now has a real
       destination instead of a link to the contact form.

       THE SERVER DECIDES, and this only asks what to call it. api/share.js
       resolves the recipient again on its own terms, so a hand-edited page
       cannot send a Journey anywhere it was not going to go.

       If the lookup fails, or no house account is configured, the CTA it was
       rendered with stands: a link to the contact page, which is a real
       destination and was the whole behaviour until today. */
    var query = attr.advisor ? '?slug=' + encodeURIComponent(attr.advisor) : '';
    fetch('/api/advisor' + query)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.advisor) return;

        if (d.advisor.firstName) {
          advisorName = d.advisor.firstName;
          primary.textContent = 'Share my WELL Journey with ' + advisorName;
        } else if (d.advisor.house) {
          /* advisorName stays null, which is what selects the team consent
             wording — see shareConsent(). Nobody has been matched to them yet
             and the copy must not imply otherwise. */
          primary.textContent = 'Share my WELL Journey with the Saint Lucia WELL team';
        } else {
          return;
        }

        primary.setAttribute('href', '#share-panel');
        primary.addEventListener('click', openShare);
      })
      .catch(function () { /* unattributed CTA stands */ });
  }

  function submitShare(form, advisorName) {
    var status = form.querySelector('.share-status');
    var button = form.querySelector('button[type="submit"]');
    var get = function (n) {
      var el = form.querySelector('[name="' + n + '"]');
      return el ? el.value.trim() : '';
    };

    if (!get('firstName') || !get('lastName')) {
      return fail(status, 'Please add your first and last name.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(get('email'))) {
      return fail(status, 'That email address does not look right — could you check it?');
    }
    if (!form.querySelector('[name="consent"]').checked) {
      return fail(status, 'Please confirm you are happy for this to be sent.');
    }

    button.disabled = true;
    status.removeAttribute('data-state');
    status.textContent = 'Sending…';

    /* The select's value is the normalised window; its label is what they read.
       Sending both means the advisor sees the sentence the consumer chose, and
       the Hub sorts on something it defined rather than on prose. */
    var timingEl = form.querySelector('[name="timing"]');
    var timingLabel = timingEl && timingEl.selectedIndex > 0
      ? timingEl.options[timingEl.selectedIndex].text : '';

    var attr = attribution();
    fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: get('firstName'), lastName: get('lastName'),
        email: get('email'), phone: get('phone'),
        timing: timingLabel, travelWindow: get('timing'),
        context: get('context'),
        company: get('company'),                       /* honeypot */
        consent: true, consentText: shareConsent(advisorName),
        advisor: attr.advisor || null,
        /* A hint. api/share.js re-resolves it and decides whether this is
           really an entry — nothing here can make one. */
        sweeps: attr.sweeps || null,
        source: attr.source || null,
        session: sessionId(),
        answers: answers,
        villages: score().map(function (v) { return v.name; })
      })
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (res) {
      if (!res.ok) throw new Error((res.d && res.d.error) || 'failed');
      /* ── THE CONFIRMATION ECHOES THE SERVER ───────────────────────────
         `entered` is what api/share.js actually wrote, not what this page
         believed when it drew the form. If the draw closed in the minutes
         somebody spent filling it in, they are told they shared — which is
         true — and nothing about a draw they are not in.

         This is the one lie the feature could tell, and telling it would be
         easy: the page already knows a draw code was in the link. It is not
         allowed to answer from that. */
      var entered = !!(res.d && res.d.entered);
      var already = !!(res.d && res.d.alreadyEntered);
      track('journey_shared', { attributed: !!advisorName, entered: entered });
      form.innerHTML =
        '<h4 class="share-title">Sent.</h4>' +
        '<p class="share-note">' +
          (advisorName ? esc(advisorName) + ' has your Journey' : 'Your Journey is on its way') +
          ' and can help you explore how it might come to life in Saint Lucia. ' +
          'Your result stays on this page — the link in your address bar will bring you back to it.</p>' +
        (entered
          ? '<p class="share-note share-entered"><strong>Your entry is counted.</strong> ' +
            esc(advisorName || 'Your advisor') + ' will be in touch about the draw — ' +
            'it is theirs to run, so any questions about it go to them.</p>'
          /* Said plainly rather than repeating "your entry is counted", which
             would imply a second ticket, or saying nothing, which would read as
             a failure. It also removes the reason to keep resubmitting. */
          : already
            ? '<p class="share-note share-entered"><strong>You are already in this draw.</strong> ' +
              'It is one entry per person, so this does not add another — but ' +
              esc(advisorName || 'your advisor') + ' has this Journey too.</p>'
            : '');
    }).catch(function (err) {
      button.disabled = false;
      fail(status, String(err.message) === 'rate_limited'
        ? 'That has been sent a few times already. Please try again a little later.'
        : 'Something went wrong sending that. Please try again, or email concierge@discoversaintluciawell.com.');
    });
  }

  function fail(status, message) {
    status.setAttribute('data-state', 'error');
    status.textContent = message;
  }

  /* Fire and forget, and only when there is an advisor to attribute it to.
     `keepalive` so it survives the visitor immediately navigating away, and
     every failure is swallowed — a counter must never be visible to anyone. */
  function countCompletion() {
    var attr = attribution();
    if (!attr.advisor) return;
    try {
      fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          kind: 'finder_complete',
          advisor: attr.advisor,
          session: sessionId()
        })
      }).catch(function () {});
    } catch (e) { /* nothing here is worth an error */ }
  }

  /* A random, browser-scoped id so a visit and a completion can be joined into
     a funnel. It identifies a browsing session, not a person, and it is
     regenerated the moment the tab closes. */
  function sessionId() {
    try {
      var k = 'dslw.sid';
      var v = sessionStorage.getItem(k);
      if (!v) {
        v = (String(Math.random()) + String(Date.now())).replace(/0\./g, '');
        sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return ''; }
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
        if (stepsEl) stepsEl.hidden = false;
        if (washEl) washEl.classList.remove('is-on');
        history.replaceState(null, '', location.pathname);
        show(0, true);
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    /* ── Email capture ──────────────────────────────────────────────────────
       STUB. There is no ESP endpoint yet, so this validates, reports honestly,
       and records the intent — it does not pretend to have sent anything.
       Wire CAPTURE_ENDPOINT when the ESP is chosen; the event schema below is
       already what the funnel report expects.

       TODO — DO NOT WIRE THIS ENDPOINT ALONE.
       Setting it turns this form from a no-op into real collection of personal
       data, and three things have to land in the same change:
         1. /privacy exists as a real page (it is `pending: true` in site.js
            today and renders as plain text, not a link);
         2. the consent line above links to it;
         3. the removal promise in that line is actually honourable — someone
            has to be able to act on the request.
       Until then this form sends nothing, which is why the current wording is
       true. Wiring the endpoint without the other three makes it false. */
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

  /* ── Restore a shared result ──────────────────────────────────────────────
     `instant` — someone arriving on a friend's link has answered nothing, so
     performing a "shaping your journey" sequence at them would be pure
     theatre. They get the result directly, which is what they clicked for. */
  /* The other half of the round trip, and derived from the same source. A link
     made before a question was added simply has too few parts, fails the
     validity check below, and falls through to the ordinary launch screen —
     which is the right outcome. Restoring a partial answer set would show
     somebody a result that is not the one they were sent. */
  var m = /#r=([a-z-]+)/.exec(location.hash);
  if (m) {
    var parts = m[1].split('-');
    answers = {};
    if (parts.length === questions.length) {
      questions.forEach(function (q, i) { answers[q.id] = parts[i]; });
    }
    var valid = parts.length === questions.length && questions.every(function (q) {
      return q.options.some(function (o) { return o.value === answers[q.id]; });
    });
    if (valid) {
      if (launchEl) launchEl.hidden = true;
      finish(true);
      return;
    }
    answers = {};
  }

  /* STATE 0. The launch screen owns the first frame; the questions stay hidden
     until Begin. Where there is no app shell — the component rendered without
     its furniture — fall through to the old behaviour of opening on question
     one, so this file degrades rather than dead-ends. */
  if (launchEl) {
    formEl.hidden = true;
    show(0);
  } else {
    formEl.hidden = false;
    show(0);
  }
})();
