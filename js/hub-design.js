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
