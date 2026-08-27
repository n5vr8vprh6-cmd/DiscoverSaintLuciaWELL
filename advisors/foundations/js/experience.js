/* Well Destination Foundations — the immersive journey (GSAP + ScrollTrigger).
   Runs only when site.js decides mode === 'gsap' (libraries present, motion
   allowed, no ?flat=1). Everything here is choreography over the same
   semantic page; content never depends on this file.

   The arc: arrive at night → scroll raises the sun over the Pitons →
   travel sideways through the three days → walk the pathway as it draws
   itself → arrive at the invitation. */
(function () {
  'use strict';
  if (window.__WDF_MODE !== 'gsap') return;

  gsap.registerPlugin(ScrollTrigger);

  /* Mobile browsers resize the viewport when the URL bar shows or hides. The
     hero's height is set in svh (css: .gsap .hero) so it does NOT move with
     that chrome — but this file pins it with end: '+=85%', and GSAP resolves
     that percentage against window.innerHeight, which DOES. So the hero's
     height stayed put while its release point slid 60-100px under the reader
     on every scroll direction change: the page appeared to bounce. Telling
     ScrollTrigger to ignore chrome-driven resizes makes the pin as stable as
     the CSS already was. */
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ── Lenis inertia scrolling, driven by the GSAP ticker ─────────────── */
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ duration: 0.7, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var target = a.getAttribute('href');
      if (target.length > 1 && document.querySelector(target)) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -68 });
      }
    });
  }

  /* ── Initial hidden states (inline, so we own them end-to-end) ──────── */
  var otherSplits = gsap.utils.toArray('[data-splitted]');
  gsap.set('[data-splitted] .wi', { yPercent: 115 });
  gsap.set(gsap.utils.toArray('[data-stagger]').reduce(function (acc, g) {
    return acc.concat(Array.prototype.slice.call(g.children));
  }, []), { autoAlpha: 0, y: 26 });

  /* ── Failsafe: whatever happens to individual tweens (a ScrollTrigger
     refresh from a late-loading webfont has been seen to strand a hero
     tween mid-flight), every reveal is visible by 3s no matter what. ── */
  var heroFadeTargets = '.hero .lead, .hero-ctas, .hero-note, .hero-journeyline';
  setTimeout(function () {
    document.querySelectorAll('[data-splitted], [data-stagger], .reveal').forEach(function (el) {
      el.classList.add('settled');
    });
    gsap.set(heroFadeTargets, { autoAlpha: 1, y: 0 });
  }, 3000);

  /* ── Act I · Arrival: entrance, then scroll clears the morning mist ──
     The headline itself stays un-animated: it sits inside the pinned hero
     timeline, and an entrance tween there has been seen to get stranded
     mid-flight (same class of race as the failsafe above guards against),
     which is worse for the page's single most important line than just
     rendering it immediately. */
  var setSun = (window.WDF_ATMOS && window.WDF_ATMOS.setSun) || function () {};
  var sun = { level: 0.08 };
  setSun(sun.level);

  gsap.from(heroFadeTargets, {
    y: 26, autoAlpha: 0, duration: 1.0, ease: 'power3.out', stagger: 0.09, delay: 0.55
  });

  gsap.timeline({
    scrollTrigger: {
      trigger: '.hero', start: 'top top', end: '+=85%',
      scrub: 0.3, pin: true, anticipatePin: 1
    }
  })
    .to(sun, { level: 1, ease: 'none', onUpdate: function () { setSun(sun.level); } }, 0)
    .fromTo('.hero-photo img, .hero-video', { scale: 1.10 }, { scale: 1.0, ease: 'none' }, 0)
    .to('.hero-veil', { opacity: 0.06, ease: 'none' }, 0)
    .fromTo('.hero-journeyline .thread',
      { scaleY: 0.25, transformOrigin: 'top center' }, { scaleY: 1, ease: 'none' }, 0)
    .to('.scroll-cue', { autoAlpha: 0, duration: 0.12 }, 0)
    .to('.hero-inner', { yPercent: -7, ease: 'none' }, 0.2);

  /* ── Generic reveals: headlines, grids, editorial blocks ────────────── */
  otherSplits.forEach(function (el) {
    gsap.to(el.querySelectorAll('.wi'), {
      yPercent: 0, duration: 1.0, ease: 'expo.out', stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true }
    });
  });

  gsap.utils.toArray('[data-stagger]').forEach(function (grid) {
    gsap.to(grid.children, {
      autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out',
      stagger: grid.classList.contains('pillars')
        ? { each: 0.06, grid: 'auto', from: 'start' }
        : 0.08,
      scrollTrigger: { trigger: grid, start: 'top 86%', once: true }
    });
  });

  gsap.utils.toArray('.reveal').forEach(function (el) {
    gsap.to(el, {
      autoAlpha: 1, y: 0,
      duration: el.hasAttribute('data-stagger') ? 0.4 : 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  /* ── Cinematic drift on the art-directed panels ─────────────────────── */
  gsap.utils.toArray('.photo').forEach(function (el) {
    gsap.fromTo(el, { y: 44 }, {
      y: -44, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.3 }
    });
  });

  /* ── Ghost typography: place names sliding behind the editorial ─────── */
  gsap.utils.toArray('.ghost').forEach(function (el) {
    gsap.fromTo(el, { xPercent: 3 }, {
      xPercent: -12, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.4 }
    });
  });

  /* ── Act II · The three days travel sideways (desktop only) ─────────── */
  gsap.matchMedia().add('(min-width: 900px)', function () {
    var section = document.querySelector('#curriculum');
    var track = section && section.querySelector('.days');
    if (!track) return;
    track.classList.add('h-track');
    var pan = function () { return Math.max(0, track.scrollWidth - track.parentElement.clientWidth); };
    gsap.to(track, {
      x: function () { return -pan(); },
      ease: 'none',
      scrollTrigger: {
        trigger: section, start: 'top top',
        end: function () { return '+=' + Math.max(pan(), 1); },
        scrub: 0.3, pin: true, anticipatePin: 1, invalidateOnRefresh: true
      }
    });
    return function () { track.classList.remove('h-track'); gsap.set(track, { clearProps: 'x' }); };
  });

  /* ── Act III · The pathway draws itself ─────────────────────────────── */
  var journey = document.querySelector('.journey');
  if (journey) {
    gsap.set(journey, { '--jp': 0 });
    gsap.to(journey, {
      '--jp': 1, ease: 'none',
      scrollTrigger: { trigger: journey, start: 'top 78%', end: 'bottom 52%', scrub: 0.3 }
    });
    journey.querySelectorAll('li').forEach(function (li) {
      ScrollTrigger.create({
        trigger: li, start: 'top 74%',
        onEnter: function () { li.classList.add('lit'); },
        onLeaveBack: function () { li.classList.remove('lit'); }
      });
    });
  }

  /* ── The method draws itself too ─────────────────────────────────────
     Same mechanic as the pathway above, on the one other block whose
     content is genuinely a sequence: an enquiry carried step by step to a
     quotable journey. Reusing --jp keeps it one motion system, not a new
     effect. Non-gsap modes get the fully-drawn line via the CSS default. */
  var flow = document.querySelector('.matchflow');
  if (flow) {
    gsap.set(flow, { '--jp': 0 });
    gsap.to(flow, {
      '--jp': 1, ease: 'none',
      scrollTrigger: { trigger: flow, start: 'top 80%', end: 'bottom 60%', scrub: 0.3 }
    });
    flow.querySelectorAll('li').forEach(function (li) {
      ScrollTrigger.create({
        trigger: li, start: 'top 76%',
        onEnter: function () { li.classList.add('lit'); },
        onLeaveBack: function () { li.classList.remove('lit'); }
      });
    });
  }

  /* ── Keep measurements honest once webfonts land ────────────────────── */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  /* …and honest again whenever the page changes height.
     The FAQ is 13 <details>. Opening one adds ~115px to the document; opening
     all of them adds ~1,750px. Every trigger below the accordion then holds a
     stale start/end, and both pinned sections release at the wrong scroll
     position. analytics.js already watches the body for its scroll-depth
     sentinels for exactly this reason — ScrollTrigger simply was never told.
     Debounced, because a refresh re-measures every trigger on the page. */
  if ('ResizeObserver' in window) {
    var refreshTimer = null;
    new ResizeObserver(function () {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 120);
    }).observe(document.body);
  }

  /* ── Deep links: the native hash jump happens before pin spacers grow
     the page, leaving the viewport ~2 pinned-sections short of the target.
     Re-anchor once everything is measured. ── */
  if (location.hash && document.querySelector(location.hash)) {
    var reanchor = function () {
      ScrollTrigger.refresh();
      var target = document.querySelector(location.hash);
      if (!target) return;
      if (lenis) { lenis.scrollTo(target, { offset: -68, immediate: true }); }
      else { window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 68); }
      ScrollTrigger.update();
      /* Everything the reader scrolled past arrives already landed */
      ScrollTrigger.getAll().forEach(function (st) {
        if (st.animation && st.progress > 0 && !st.vars.scrub) { st.animation.progress(1); }
      });
      var header = document.querySelector('.site-header');
      if (header) header.classList.remove('hidden');
    };
    if (document.readyState === 'complete') { setTimeout(reanchor, 60); }
    else { window.addEventListener('load', function () { setTimeout(reanchor, 60); }); }
  }
})();
