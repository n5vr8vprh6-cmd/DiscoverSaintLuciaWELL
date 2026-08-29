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
        slugs: root.getAttribute('data-slugs') || ''
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
