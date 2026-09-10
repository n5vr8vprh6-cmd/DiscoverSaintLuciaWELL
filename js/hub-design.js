/* ============================================================================
   ASK WELL — what the browser is allowed to decide on this screen
   ----------------------------------------------------------------------------
   Loaded only on /hub/journeys/:id/design. Everything the workspace shows —
   the shortlist, the bands, the arc, the estimate, the read-back — arrived
   with the page or comes back from the server as markup. The scripts below
   move that markup around and post forms as JSON so the page does not reload
   mid-conversation. None of them computes a colour, a height, a word or a
   figure; every one of them degrades to the plain form or link underneath.

   Present mode used to live here — a toggle that hid the advisor's working
   notes. Duncan took it out on 2026-09-10: "might as well make the experience
   transparent." What it hid is now simply on the page, and the two things
   that were only comfortable behind a toggle sit behind a <details> the
   advisor opens.
   ========================================================================== */

/* ============================================================================
   THE ISLAND — nearest pin to the cursor lights its card
   ----------------------------------------------------------------------------
   lib/components.js islandMap() rendered every pin as a link and every card
   hidden but one. This shows the card for the pin nearest the pointer (a
   Voronoi split, so overlapping hit circles can never light two), or for the
   pin that has focus — keyboard and touch get the same card. Mouse-only for
   the pointer path, as the compass does. Nothing is fetched; nothing is built.
   ========================================================================== */
(function () {
  'use strict';

  /* A WeakSet, not an attribute: markup the server re-sends must never arrive
     looking already bound. */
  var bound = new WeakSet();
  function bind(root) {
    if (bound.has(root)) return;
    bound.add(root);
    var svg = root.querySelector('.island-svg');
    var pins = [].slice.call(root.querySelectorAll('[data-pin]'));
    var cards = [].slice.call(root.querySelectorAll('[data-pin-card]'));
    if (!svg || !pins.length || !cards.length) return;

    var active = null;
    function show(slug) {
      if (slug === active) return;
      active = slug;
      cards.forEach(function (c) { c.hidden = c.getAttribute('data-pin-card') !== slug; });
      pins.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-pin') === slug); });
      root.classList.toggle('is-probed', Boolean(slug));
    }
    function centre(pin) {
      var dot = pin.querySelector('.island-dot');
      return { x: +dot.getAttribute('cx'), y: +dot.getAttribute('cy') };
    }

    /* Focus and touch: the pin itself. */
    pins.forEach(function (pin) {
      pin.addEventListener('focus', function () { show(pin.getAttribute('data-pin')); });
      pin.addEventListener('touchstart', function () { show(pin.getAttribute('data-pin')); }, { passive: true });
    });

    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    svg.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var box = svg.getBoundingClientRect();
      var vb = svg.viewBox.baseVal;
      var x = vb.x + (e.clientX - box.left) / box.width * vb.width;
      var y = vb.y + (e.clientY - box.top) / box.height * vb.height;
      var best = null, bestD = Infinity;
      for (var i = 0; i < pins.length; i++) {
        var c = centre(pins[i]);
        var dx = x - c.x, dy = y - c.y, d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = pins[i]; }
      }
      /* Within 60 units of a pin, or nothing changes — the last card stays. */
      if (best && bestD <= 60 * 60) show(best.getAttribute('data-pin'));
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-island]'), bind);
  /* After a live save the island band is the server's new markup; bind again. */
  document.addEventListener('fragment:swapped', function (e) {
    var slot = e.detail && e.detail.slot;
    if (!slot) return;
    Array.prototype.forEach.call(slot.querySelectorAll('[data-island]'), bind);
  });
})();

/* ============================================================================
   THE ONE NETWORK CALL ON THIS SCREEN
   ----------------------------------------------------------------------------
   Everything else the workspace shows — the shortlist, the four bands, the
   mismatch sentences — arrived with the page, computed on the server. This asks
   for the single paragraph that is written rather than calculated.

   ── IT NEVER BLOCKS THE SCREEN ────────────────────────────────────────────
   No overlay, no disabled page, no spinner over the shortlist. An advisor is on
   a call while this runs, and the rest of the workspace has to stay readable and
   scrollable throughout. The only thing that changes state is the button.

   ── THE BROWSER DECIDES NOTHING ───────────────────────────────────────────
   Severity and claim flags arrive from the server already judged. This renders
   them. A client that decided what counted as a high-severity claim would be a
   compliance control living in somebody's browser, where it can be edited.

   ── A DRAFT NEVER OVERWRITES TYPING ───────────────────────────────────────
   If the advisor has written anything, the draft does not replace it. Losing
   somebody's own sentence to a button they pressed expecting to be offered one
   is the kind of small betrayal that stops a tool being trusted mid-call.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-narrative]');
  if (!root) return;

  var go = root.querySelector('[data-narr-go]');
  var text = root.querySelector('[data-narr-text]');
  var status = root.querySelector('[data-narr-status]');
  var flags = root.querySelector('[data-narr-flags]');
  if (!go || !text) return;

  var busy = false;

  function say(msg) { if (status) status.textContent = msg || ''; }

  function showFlags(list) {
    if (!flags) return;
    if (!list || !list.length) { flags.hidden = true; flags.textContent = ''; return; }
    flags.hidden = false;
    flags.textContent = '';
    list.forEach(function (f) {
      var li = document.createElement('p');
      li.className = 'design-flag' + (f.severity === 'high' ? ' is-high' : '');
      li.textContent = f.message || f.rule;
      flags.appendChild(li);
    });
  }

  /* The button is a submit inside a real form (the JavaScript-off path). With
     JavaScript, the click is taken over and the same fields go as JSON, so the
     token can be shown once on this page. */
  go.addEventListener('click', function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (busy) return;
    busy = true;
    go.disabled = true;
    say('Writing…');
    showFlags(null);

    fetch('/hub/journeys/' + encodeURIComponent(root.getAttribute('data-share')) + '/design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'narrative',
        slugs: root.getAttribute('data-slugs') || '',
        /* The server has always read form.recipe here and the browser has never
           sent it, so the paragraph was written without the shape of the journey
           it describes. The value is server-rendered onto the section from the
           session, so it cannot disagree with what the document will use. */
        recipe: root.getAttribute('data-recipe') || ''
      })
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      var j = res.body || {};
      if (!j.ok) {
        say(j.message || 'That did not work. Your notes are untouched.');
        return;
      }
      if (text.value.trim()) {
        /* Offered, not imposed. */
        say('A draft is ready, but you have already written something — clear the '
          + 'box and ask again if you want to see it.');
        return;
      }
      text.value = j.text;
      showFlags(j.flags);
      say(j.high
        ? 'Read the flags before you read this out.'
        : 'A draft. Change anything you like.');
    }).catch(function () {
      say('Could not reach the writing service. Your notes are untouched.');
    }).then(function () {
      busy = false;
      go.disabled = false;
    });
  });
})();

/* ============================================================================
   ISSUING — the one irreversible thing this screen can do
   ----------------------------------------------------------------------------
   Freezes the document, mints the link, shows it once.

   ── THE LINK IS SHOWN ONCE AND THAT IS NOT A UI CHOICE ────────────────────
   The server holds a sha256 of the token and nothing else. There is no endpoint
   that can return it again, because there is no copy of it to return — so this
   is the only moment it exists in readable form, and the interface has to say
   so rather than let an advisor close the tab assuming they can come back.

   ── IT SAYS WHAT WILL HAPPEN BEFORE IT HAPPENS ────────────────────────────
   A confirm() rather than a straight POST. Everything else on this screen is
   reversible — regenerate the paragraph, change the shortlist, reload. This
   writes a frozen row and opens a live URL, and an advisor mid-call with a
   prospect watching should not discover that by having done it.

   ── NO OPTIMISTIC ANYTHING ────────────────────────────────────────────────
   Nothing appears until the server says the row exists. A link rendered
   hopefully and then withdrawn is worse than a two-second wait.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-issue]');
  if (!root) return;

  var go = root.querySelector('[data-issue-go]');
  var status = root.querySelector('[data-issue-status]');
  var result = root.querySelector('[data-issue-result]');
  var nights = root.querySelector('[data-issue-nights]');
  var note = root.querySelector('[data-issue-note]');
  var emailBox = root.querySelector('[data-issue-email]');
  var issueForm = root.querySelector('[data-issue-form]');
  /* With JavaScript running the form must never submit on its own: the 303
     path cannot show the token. Submit is cancelled here and the click handler
     below does the work. */
  if (issueForm) issueForm.addEventListener('submit', function (ev) { ev.preventDefault(); });
  if (!go || go.disabled) return;

  var busy = false;

  function say(m) { if (status) status.textContent = m || ''; }

  function show(data) {
    if (!result) return;
    var url = location.origin + data.url;

    result.hidden = false;
    result.textContent = '';

    var h = document.createElement('p');
    h.className = 'design-issued-h';
    h.textContent = 'Version ' + data.version + ' is live.';
    result.appendChild(h);

    var warn = document.createElement('p');
    warn.className = 'design-issued-warn';
    warn.textContent = 'Copy this link now. It is not stored anywhere we can read, '
      + 'so this is the only time it can be shown to you.';
    result.appendChild(warn);

    /* A readonly input rather than a <p>: it selects on click, survives being
       copied by keyboard, and cannot be edited into something that does not
       resolve. */
    var field = document.createElement('input');
    field.className = 'design-issued-link';
    field.readOnly = true;
    field.value = url;
    field.addEventListener('focus', function () { field.select(); });
    result.appendChild(field);

    var row = document.createElement('div');
    row.className = 'design-actions';

    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn--ghost btn--sm';
    copy.textContent = 'Copy link';
    copy.addEventListener('click', function () {
      field.focus();
      field.select();
      /* Clipboard access is refused outright in some contexts and the fallback
         is the thing that always works: the text is already selected, so
         Ctrl+C finishes the job. */
      var done = function () { copy.textContent = 'Copied'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () {
          copy.textContent = 'Press Ctrl+C';
        });
      } else {
        copy.textContent = 'Press Ctrl+C';
      }
    });
    row.appendChild(copy);

    var open = document.createElement('a');
    open.className = 'btn btn--ghost btn--sm';
    open.href = data.url;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Open it';
    row.appendChild(open);

    result.appendChild(row);

    if (data.emailed) {
      var sent = document.createElement('p');
      sent.className = 'design-issued-sent';
      sent.textContent = 'Emailed to ' + (data.emailedTo || 'the client') + ', copied to you.';
      result.appendChild(sent);
    } else if (data.emailError) {
      var nf = document.createElement('p');
      nf.className = 'design-flag is-high';
      nf.textContent = data.emailError === 'mail_not_configured' ? 'Email is not configured on this deployment — copy the link and send it yourself.'
        : data.emailError === 'no_recipient' ? 'This Journey has no email address — copy the link and send it yourself.'
        : 'The email did not go — the link is live; copy it and send it yourself.';
      result.appendChild(nf);
    }
    if (data.expires_at) {
      var exp = document.createElement('p');
      exp.className = 'design-issued-exp';
      var d = new Date(data.expires_at);
      exp.textContent = 'The link stops working on '
        + d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
        + ' unless you withdraw it sooner.';
      result.appendChild(exp);
    }

    if (data.high) {
      var f = document.createElement('p');
      f.className = 'design-flag is-high';
      f.textContent = data.high + ' thing' + (data.high === 1 ? '' : 's')
        + ' in the writing needs checking — open it and read before you send.';
      result.appendChild(f);
    }
  }

  go.addEventListener('click', function () {
    if (busy) return;
    if (!window.confirm('Issue this plan?\n\nIt freezes what is on this screen and opens a '
      + 'live link you can send. The link is shown to you once.')) return;

    busy = true;
    go.disabled = true;
    say('Writing and freezing…');

    fetch('/hub/journeys/' + encodeURIComponent(root.getAttribute('data-share')) + '/design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'issue',
        slugs: root.getAttribute('data-slugs') || '',
        recipe: root.getAttribute('data-recipe') || '',
        nights: nights ? nights.value : '',
        note: note ? note.value : '',
        email: Boolean(emailBox && emailBox.checked)
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) {
        say(j.message || 'That did not work. Nothing has been sent.');
        go.disabled = false;
        busy = false;
        return;
      }
      say('');
      show(j);
      /* Deliberately NOT re-enabled. Issuing again makes another version and
         another live link; that should be a decision taken on a reloaded page,
         not a second click on a button that has just succeeded. */
      go.textContent = 'Issued';
    }).catch(function () {
      say('Could not reach the server. Nothing has been sent.');
      go.disabled = false;
      busy = false;
    });
  });
})();

/* ============================================================================
   LIVE SAVE — the consultation editor, without a reload
   ----------------------------------------------------------------------------
   Every control on the Understand stage is a native input inside one form, and
   the form works with JavaScript off through a POST and a 303. This makes it
   save on change instead, because the advisor is tapping while asking and a
   full reload between "why now" and "how ready" is a beat lost in front of the
   client.

   ── IT SENDS THE SAME FIELDS TO THE SAME URL ──────────────────────────────
   As JSON rather than urlencoded, so the server can answer in kind. Nothing is
   computed here: which values are valid, what "overrode" means, whether the
   save counts — all decided by the server, exactly as if the form had been
   submitted. The browser only changes the status line.

   ── FAILURE IS A SENTENCE, NOT A LOST ANSWER ─────────────────────────────
   If the fetch fails the form is still a form. The advisor presses Save and
   the 303 path does what it always did.
   ========================================================================== */
(function () {
  'use strict';

  var forms = document.querySelectorAll('form[data-live]');
  if (!forms.length) return;

  function serialise(form) {
    var out = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) {
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        if (!Array.isArray(out[key])) out[key] = [out[key]];
        out[key].push(value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  Array.prototype.forEach.call(forms, function (form) {
    var status = form.querySelector('[data-live-status]');
    var timer = null;
    var inflight = false;

    function say(text) { if (status) status.textContent = text || ''; }

    function send() {
      if (inflight) { timer = setTimeout(send, 400); return; }
      inflight = true;
      say('Saving…');
      fetch(form.getAttribute('action') || location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serialise(form))
      }).then(function (r) { return r.json(); }).then(function (j) {
        say(j && j.ok ? 'Saved.' : (j && j.message) || 'Not saved — press Save to retry.');
        /* Anyone listening (the arc swap) gets the server's reply as-is. */
        if (j && j.ok) form.dispatchEvent(new CustomEvent('live:saved', { bubbles: true, detail: j }));
      }).catch(function () {
        say('Not saved — press Save to retry.');
      }).then(function () { inflight = false; });
    }

    /* Debounced so a range being dragged posts once, not forty times. */
    form.addEventListener('change', function (e) {
      clearTimeout(timer);
      timer = setTimeout(send, 250);
      /* A suggested month stops being a suggestion the moment it is touched. */
      var t = e.target;
      if (t && t.hasAttribute && t.hasAttribute('data-suggested')) {
        t.removeAttribute('data-suggested');
        var hint = form.querySelector('[data-suggest-hint]');
        if (hint) hint.textContent = 'The month they mean to travel.';
      }
    });
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t && (t.type === 'range' || t.type === 'number' || t.tagName === 'TEXTAREA')) {
        clearTimeout(timer);
        timer = setTimeout(send, 600);
      }
      /* The counter under "in their words" — a number the input already knows. */
      if (t && t.tagName === 'TEXTAREA' && t.maxLength > 0) {
        var count = form.querySelector('[data-words-count]');
        if (count) count.textContent = t.value.length ? t.value.length + ' of ' + t.maxLength : '';
      }
    });
  });

  /* The nights stepper. The number input works alone; these two buttons are
     the tappable version of typing. They dispatch change so the save above
     fires. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.parentNode;
      var input = wrap && wrap.querySelector('input[type="number"]');
      if (!input) return;
      var min = Number(input.min || 1), max = Number(input.max || 21);
      var cur = parseInt(input.value, 10);
      if (!Number.isFinite(cur)) cur = Number(input.placeholder) || min;
      var next = Math.min(max, Math.max(min, cur + Number(btn.getAttribute('data-step'))));
      input.value = String(next);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
})();

/* ============================================================================
   GALLERY — tap a thumb, the hero swaps in place
   ----------------------------------------------------------------------------
   The server rendered every frame and made every thumb a link to its own
   image; that is the whole behaviour with JavaScript off. Here a tap rebuilds
   the hero <picture> from the thumb's data-base / data-widths / data-alt —
   the same srcset shape lib/components.js mediaPicture() emits — so the
   browser is moving the server's markup around, not deciding anything. No
   fetch, no modal: on a shared screen a modal covers the conversation.
   ========================================================================== */
(function () {
  'use strict';

  function srcset(base, widths, ext) {
    return widths.map(function (w) { return base + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', ');
  }

  function picture(base, widths, alt, sizes) {
    var pic = document.createElement('picture');
    ['webp', 'jpg'].forEach(function (ext) {
      var s = document.createElement('source');
      s.type = ext === 'webp' ? 'image/webp' : 'image/jpeg';
      s.srcset = srcset(base, widths, ext);
      if (sizes) s.sizes = sizes;
      pic.appendChild(s);
    });
    var img = document.createElement('img');
    img.src = base + '-' + widths[widths.length - 1] + '.jpg';
    img.alt = alt || '';
    img.decoding = 'async';
    pic.appendChild(img);
    return pic;
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-gallery]'), function (fig) {
    var hero = fig.querySelector('.media-gallery-hero');
    if (!hero) return;
    var first = hero.querySelector('source');
    var sizes = first ? first.getAttribute('sizes') : null;

    fig.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-thumb]') : null;
      if (!a || !fig.contains(a)) return;
      var widths = String(a.getAttribute('data-widths') || '').split(',').map(Number).filter(Boolean);
      var base = a.getAttribute('data-base');
      if (!base || !widths.length) return;         /* let the link open the image */
      e.preventDefault();
      while (hero.firstChild) hero.removeChild(hero.firstChild);
      hero.appendChild(picture(base, widths, a.getAttribute('data-alt'), sizes));
      Array.prototype.forEach.call(fig.querySelectorAll('[data-thumb]'), function (t) {
        if (t === a) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
      });
    });
  });
})();

/* ============================================================================
   THE ARC — the server redraws it, the browser swaps it
   ----------------------------------------------------------------------------
   Each day is a plain form (see LIVE SAVE above, which posts it as JSON on
   change). When the reply carries `fragment`, it is the arc re-rendered by the
   same server function that drew the page, and it replaces the slot named by
   the form's data-fragment. Nothing is computed here: not a colour, not a
   height, not a word.

   "Draft a line" is day_note's button. The sentence comes back and, if the
   advisor has typed nothing, lands in the textarea and saves; if they have,
   it is offered beside their words and never over them.
   ========================================================================== */
(function () {
  'use strict';

  var slots = document.querySelectorAll('[data-fragment-slot]');
  if (!slots.length) return;

  /* Fragment swap: listen for the live-save result. LIVE SAVE dispatches a
     `live:saved` event on the form with the parsed JSON. */
  document.addEventListener('live:saved', function (e) {
    var form = e.target;
    var name = form && form.getAttribute && form.getAttribute('data-fragment');
    var j = e.detail || {};
    /* One named fragment, or a map of them — each the server's own markup. */
    var frags = j.fragments ? Object.assign({}, j.fragments) : {};
    if (name && j.fragment && !frags[name]) frags[name] = j.fragment;
    if (!Object.keys(frags).length) return;
    Object.keys(frags).forEach(function (k) {
      var slot = document.querySelector('[data-fragment-slot="' + k + '"]');
      if (!slot) return;
      slot.innerHTML = frags[k];
      document.dispatchEvent(new CustomEvent('fragment:swapped', { detail: { name: k, slot: slot } }));
    });
    if (typeof j.answered === 'number' && form.querySelector) {
      var count = form.querySelector('[data-answered]');
      if (count) count.textContent = j.answered + ' of 7 answered';
    }
  });

  /* Draft a line. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-daynote]'), function (btn) {
    var form = btn.closest('form');
    if (!form) return;
    var ta = form.querySelector('[data-day-note]');
    var src = form.querySelector('[data-day-note-source]');
    var status = form.querySelector('[data-daynote-status]');
    var out = form.querySelector('[data-daynote-out]');
    var page = document.querySelector('[data-narrative]');
    var slugs = page ? page.getAttribute('data-slugs') : '';
    var recipe = page ? page.getAttribute('data-recipe') : '';

    function say(t) { if (status) status.textContent = t || ''; }

    function accept(text) {
      ta.value = text;
      if (src) src.value = 'model';
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      if (out) { out.hidden = true; out.textContent = ''; }
      say('Drafted. Yours to change.');
    }

    ta.addEventListener('input', function () { if (src) src.value = 'advisor'; });

    btn.addEventListener('click', function () {
      btn.disabled = true;
      say('Drafting…');
      fetch(form.getAttribute('action') || location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'day_note',
          dayKey: btn.getAttribute('data-day-key'),
          dayLabel: btn.getAttribute('data-day-label'),
          dayText: btn.getAttribute('data-day-text'),
          slugs: slugs, recipe: recipe
        })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok || !j.text) { say((j && j.message) || 'No draft this time — write it in your own words.'); return; }
        if (!ta.value.trim()) { accept(j.text); return; }
        /* They have written something. Offer, never overwrite. */
        if (out) {
          out.hidden = false;
          out.textContent = '';
          var q = document.createElement('span'); q.textContent = j.text + ' ';
          var use = document.createElement('button'); use.type = 'button'; use.className = 'btn btn--ghost btn--sm';
          use.textContent = 'Use this instead';
          use.addEventListener('click', function () { accept(j.text); });
          out.appendChild(q); out.appendChild(use);
        }
        say('A draft is offered below your line.');
      }).catch(function () {
        say('No draft this time — write it in your own words.');
      }).then(function () { btn.disabled = false; });
    });
  });
})();

/* ============================================================================
   PREPARING OPTIONS — a few seconds between Understand and Compare
   ----------------------------------------------------------------------------
   The recommendations are computed on the server the moment Compare loads;
   nothing here decides anything. What this adds is the cognitive signal Duncan
   asked for: the ring, three lines that arrive in turn, then the page. The
   overlay is server-rendered and hidden; this reveals it, waits, and follows
   the link. Without JavaScript the link is a link. With reduced motion, one
   still line and under a second.
   ========================================================================== */
(function () {
  'use strict';
  var overlay = document.querySelector('[data-prepare-overlay]');
  if (!overlay) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[data-prepare]') : null;
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    overlay.hidden = false;
    document.body.classList.add('is-preparing');
    /* Force a frame so the transition runs from the hidden state. */
    void overlay.offsetWidth;
    overlay.classList.add('is-on');
    setTimeout(function () { location.href = link.href; }, reduced ? 800 : 2400);
  });
})();

