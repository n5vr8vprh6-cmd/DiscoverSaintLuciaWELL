/* Well Destination Foundations — progressive enhancement only.
   The page is fully readable and navigable without this file. */
(function () {
  'use strict';
  document.body.classList.add('js');

  /* Animation mode for the whole page, decided once:
     'gsap'    — GSAP + ScrollTrigger choreography (experience.js)
     'io'      — IntersectionObserver reveals (this file + motion.js)
     'instant' — everything visible immediately (reduced motion / agents)
     ?flat=1 forces 'io' — a QA escape hatch and a safety valve. */
  var reducedMode = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var instantMode = reducedMode || navigator.webdriver === true;
  var flat = /[?&]flat=1/.test(location.search);
  var gsapReady = !!(window.gsap && window.ScrollTrigger);
  window.__WDF_MODE = instantMode ? 'instant' : (gsapReady && !flat ? 'gsap' : 'io');
  if (window.__WDF_MODE === 'gsap') document.documentElement.classList.add('gsap');

  /* Mobile nav toggle */
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Scroll reveal (io mode only — experience.js owns .reveal in gsap mode) */
  var reduced = reducedMode;
  var automated = navigator.webdriver === true;
  var targets = document.querySelectorAll('.reveal');
  if (window.__WDF_MODE === 'gsap') {
    /* handled by experience.js */
  } else if (!reduced && !automated && 'IntersectionObserver' in window) {
    var ioFired = false;
    var io = new IntersectionObserver(function (entries) {
      ioFired = true;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    /* Fixed px margin, not %: a percentage of a very tall viewport can push
       end-of-page content permanently out of reach of the observer. */
    }, { rootMargin: '0px 0px -80px 0px', threshold: 0.1 });
    targets.forEach(function (el) { io.observe(el); });
    /* Safety net: if the observer never delivers (frame-starved webviews,
       reader modes), show everything rather than leave content hidden. */
    setTimeout(function () {
      if (!ioFired) targets.forEach(function (el) { el.classList.add('in'); });
    }, 2500);
  } else {
    targets.forEach(function (el) { el.classList.add('in'); });
  }

  /* Email capture — analytics-ready stubs. Two paths on the page:
     data-kind="reserve" (founding-seat intent) and data-kind="webinar".
     Wire the POST to your ESP or CRM (ConvertKit, HubSpot, Customer.io…). */
  var reduceMsgMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Array.prototype.forEach.call(document.querySelectorAll('[data-capture]'), function (form) {
    var msg = form.parentElement.querySelector('.form-msg');
    var kind = form.getAttribute('data-kind') || 'signup';
    var successText = form.getAttribute('data-success') || 'You’re on the list. Details arrive by email.';
    var input = form.querySelector('input[type="email"]');
    function setMsg(text, state) {
      if (!msg) return;
      msg.textContent = text;
      msg.classList.remove('is-error', 'is-success');
      /* restart the entrance animation each time the message changes */
      void msg.offsetWidth;
      msg.classList.add(state === 'error' ? 'is-error' : 'is-success');
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input && input.value || '').trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!valid) {
        setMsg('Enter a valid email address so we can reach you.', 'error');
        if (input) {
          if (!reduceMsgMotion) { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); }
          input.focus();
        }
        return;
      }
      /* Replace with a real POST once the ESP endpoint exists:
         fetch(endpoint, { method: 'POST', body: JSON.stringify(payload) }) */
      if (window.dataLayer) {
        var role = form.querySelector('[name="role"]');
        window.dataLayer.push({
          event: kind === 'vip' ? 'vip_interest' : 'webinar_signup',
          email_domain: email.split('@')[1],
          advisor_type: role ? role.value : undefined
        });
      }
      form.reset();
      setMsg(successText, 'success');
    });
    if (input) {
      input.addEventListener('animationend', function () { input.classList.remove('shake'); });
    }
  });
})();
