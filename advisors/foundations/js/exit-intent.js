/* Well Destination Foundations — exit-intent webinar popup.
   Desktop only (no true exit-intent on touch), fires once per session,
   and never at all once the visitor has already seen the webinar offer
   in the final CTA or already converted on a capture form. Runs
   independently of GSAP mode — this is a functional feature, not
   decorative motion. */
(function () {
  'use strict';

  var dialog = document.getElementById('exit-modal');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  /* Close/dismiss wiring is unconditional modal hygiene: whatever ends up
     opening this dialog, it must always be closable. Restoring scroll is
     done both here (covers click/backdrop close, which call this directly)
     and on the native 'close' event (the only hook the Escape key gives
     us), so neither path depends solely on the other. */
  function report(event) {
    if (typeof window.wdfTrack === 'function') window.wdfTrack(event);
  }

  function close() {
    dialog.close();
    document.body.style.overflow = '';
  }

  /* a click through to the Luma briefing also fires webinar_click in
     analytics.js; this marks it as the exit-intent path specifically */
  var cta = dialog.querySelector('.btn');
  if (cta) cta.addEventListener('click', function () { report('exit_intent_converted'); });
  dialog.addEventListener('close', function () {
    document.body.style.overflow = '';
    report('exit_intent_dismissed');
  });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) close();
  });
  dialog.querySelector('.exit-modal-close').addEventListener('click', close);
  dialog.querySelector('.exit-modal-dismiss').addEventListener('click', close);

  /* Everything below decides *whether* to trigger the dialog — desktop
     pointer only, never for automated tooling. */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!finePointer) return;
  if (navigator.webdriver === true) return;

  var STORAGE_KEY = 'wdf_exit_intent_shown';
  if (sessionStorage.getItem(STORAGE_KEY)) return;

  var seenWebinar = false;
  var webinarSection = document.getElementById('webinar');
  if (webinarSection && 'IntersectionObserver' in window) {
    var sectionIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { seenWebinar = true; sectionIo.disconnect(); }
      });
    }, { threshold: 0.3 });
    sectionIo.observe(webinarSection);
  }

  document.addEventListener('submit', function (e) {
    if (e.target.matches && e.target.matches('[data-capture]')) {
      sessionStorage.setItem(STORAGE_KEY, '1');
    }
  });

  var armed = false;
  var armTimer = setTimeout(function () { armed = true; }, 4000);

  function maybeShow(e) {
    if (!armed || seenWebinar || sessionStorage.getItem(STORAGE_KEY)) return;
    if (e.clientY > 0) return;
    show();
  }

  document.addEventListener('mouseout', maybeShow);

  function show() {
    sessionStorage.setItem(STORAGE_KEY, '1');
    clearTimeout(armTimer);
    document.removeEventListener('mouseout', maybeShow);
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    report('exit_intent_shown');
  }
})();
