/* ============================================================================
   ASK WELL — the one thing the browser decides
   ----------------------------------------------------------------------------
   Loaded only on /hub/journeys/:id/design. It does exactly one job: PRESENT
   MODE, which hides the advisor's working notes and enlarges the type.

   ── WHY THAT JOB EXISTS ───────────────────────────────────────────────────
   This screen is opened on a shared call with the person the trip is for. "What
   is wrong with it", the watch-outs, the verification dates and the gaps are
   written for the advisor. Read cold, over a shoulder, mid-sentence, they stop
   being craft and start being an argument against the trip somebody is being
   sold. So there is a key that puts them away.

   ── WHY IT IS A CLASS AND NOT A SECOND RENDER ─────────────────────────────
   A present-mode template would drift from the working one, and the half that
   drifts is the half nobody is looking at. The server always sends the whole
   page; this only decides whether part of it is visible. Which also means the
   page still works with JavaScript off — it just always shows the notes, which
   is the safe direction for that failure to go.

   ── THE STATE IS PER TAB, ON PURPOSE ──────────────────────────────────────
   sessionStorage, not localStorage: present mode belongs to the call you are on,
   not to the browser forever. An advisor who opens this tomorrow, alone, should
   see their notes without having to remember a setting they turned on once.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'dslw.design.present';
  var btn = document.querySelector('[data-present]');
  if (!btn) return;

  var root = document.body;

  function label(on) {
    btn.textContent = on ? 'Working mode' : 'Present mode';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function apply(on, remember) {
    root.classList.toggle('is-present', on);
    label(on);
    if (!remember) return;
    /* Private windows and blocked site data both throw here. A toggle that
       cannot be remembered is a toggle that still works. */
    try { sessionStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* nothing to do */ }
  }

  var stored = null;
  try { stored = sessionStorage.getItem(KEY); } catch (e) { /* nothing to do */ }
  apply(stored === '1', false);

  btn.addEventListener('click', function () {
    apply(!root.classList.contains('is-present'), true);
  });

  /* P toggles it, so an advisor can put the notes away without hunting for a
     button while somebody is watching. Ignored while typing, and ignored when a
     modifier is held so browser and OS shortcuts are untouched. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'p' && e.key !== 'P') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var el = document.activeElement;
    if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;
    if (el && el.isContentEditable) return;
    e.preventDefault();
    apply(!root.classList.contains('is-present'), true);
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

  go.addEventListener('click', function () {
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
        note: note ? note.value : ''
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
    form.addEventListener('change', function () {
      clearTimeout(timer);
      timer = setTimeout(send, 250);
    });
    form.addEventListener('input', function (e) {
      if (e.target && (e.target.type === 'range' || e.target.tagName === 'TEXTAREA')) {
        clearTimeout(timer);
        timer = setTimeout(send, 600);
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
    if (!name || !j.fragment) return;
    var slot = document.querySelector('[data-fragment-slot="' + name + '"]');
    if (!slot) return;
    slot.innerHTML = j.fragment;
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
