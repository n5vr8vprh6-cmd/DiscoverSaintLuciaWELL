/* Well Destination Foundations — motion choreography.
   Split-text reveals, staggered grids, 3D tilt with gold glare, scroll-driven
   journey line, count-up statistics, magnetic CTAs, nav hide-on-scroll and a
   reading-progress thread. Progressive enhancement throughout: content is
   fully present without this file, and prefers-reduced-motion (or an
   automated agent) gets everything instantly, static. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var automated = navigator.webdriver === true;
  var instant = reduced || automated;
  /* set by site.js (loads first): 'gsap' | 'io' | 'instant' */
  var gsapMode = window.__WDF_MODE === 'gsap';

  /* ── 1 · Split headlines into masked words ─────────────────────────── */
  var splitTargets = document.querySelectorAll('.section-head h2, .final-cta h2');
  splitTargets.forEach(function (el) {
    var idx = 0;
    function splitNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var wi = document.createElement('span'); wi.className = 'wi';
          wi.style.setProperty('--i', idx++);
          wi.textContent = part;
          w.appendChild(wi);
          frag.appendChild(w);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('w')) {
        Array.prototype.slice.call(node.childNodes).forEach(splitNode);
      }
    }
    Array.prototype.slice.call(el.childNodes).forEach(splitNode);
    el.setAttribute('data-splitted', '');
  });

  /* ── 2 · Stagger indices for grids ─────────────────────────────────── */
  document.querySelectorAll('[data-stagger]').forEach(function (grid) {
    Array.prototype.forEach.call(grid.children, function (child, i) {
      child.style.setProperty('--i', i);
    });
  });

  /* ── 3 · One observer for splits + staggers (+ safety net) ─────────── */
  var motionTargets = document.querySelectorAll('[data-splitted], [data-stagger]');
  /* markIn starts the choreography; 'settled' is the hard guarantee that no
     text can stay hidden if a transition is interrupted or never ticks. */
  function markIn(el) {
    el.classList.add('in');
    setTimeout(function () { el.classList.add('settled'); }, 3600);
  }
  function showAll() { motionTargets.forEach(markIn); }
  if (gsapMode) {
    /* experience.js owns reveals; it carries its own frame-health failsafe */
  } else if (instant || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var delivered = false;
    var io = new IntersectionObserver(function (entries) {
      delivered = true;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { markIn(entry.target); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
    motionTargets.forEach(function (el) { io.observe(el); });
    setTimeout(function () { if (!delivered) showAll(); }, 2500);
  }

  /* ── 4 · Count-up statistics ───────────────────────────────────────── */
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-target'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var t0 = performance.now(), dur = 1400;
    function frame(now) {
      var p = Math.min((now - t0) / dur, 1);
      el.textContent = prefix + (target * ease(p)).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counters = document.querySelectorAll('[data-target]');
  if (instant || !('IntersectionObserver' in window)) {
    /* leave the server-rendered numbers untouched */
  } else {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { runCounter(entry.target); cio.unobserve(entry.target); }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ── 5 · 3D tilt cards with gold glare ─────────────────────────────── */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!instant && finePointer) {
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var raf = 0;
      card.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top) / r.height;
          card.style.transform =
            'perspective(900px) rotateX(' + ((0.5 - py) * 7).toFixed(2) + 'deg)' +
            ' rotateY(' + ((px - 0.5) * 9).toFixed(2) + 'deg) translateY(-2px)';
          card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
          card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        });
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ── 6 · Magnetic primary CTAs ─────────────────────────────────────── */
  if (!instant && finePointer) {
    document.querySelectorAll('.hero-ctas .btn, .invest-card .btn').forEach(function (btn) {
      btn.classList.add('magnetic');
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = 'translate(' + (dx * 0.18).toFixed(1) + 'px,' + (dy * 0.28).toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });
  }

  /* ── 7 · Scroll: journey-line progress, nav hide, reading thread ───── */
  var journey = document.querySelector('.journey');
  var journeySteps = journey ? Array.prototype.slice.call(journey.querySelectorAll('li')) : [];
  var header = document.querySelector('.site-header');
  var navLinks = document.getElementById('nav-links');

  var thread = document.createElement('div');
  thread.className = 'progress-thread';
  thread.setAttribute('aria-hidden', 'true');
  document.body.appendChild(thread);

  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY;
      var doc = document.documentElement;

      /* reading progress */
      var max = doc.scrollHeight - window.innerHeight;
      thread.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);

      /* header: hide scrolling down, show scrolling up */
      if (header) {
        var menuOpen = navLinks && navLinks.classList.contains('open');
        if (!menuOpen) {
          header.classList.toggle('hidden', y > lastY && y > 320);
        }
        header.classList.toggle('scrolled', y > 40);
      }
      lastY = y;

      /* journey line fill + node lighting (gsap mode scrubs this itself) */
      if (journey && !gsapMode) {
        var r = journey.getBoundingClientRect();
        var anchor = window.innerHeight * 0.72;
        var p = Math.min(Math.max((anchor - r.top) / r.height, 0), 1);
        journey.style.setProperty('--jp', p.toFixed(4));
        journeySteps.forEach(function (li) {
          var lr = li.getBoundingClientRect();
          li.classList.toggle('lit', lr.top + 20 < anchor);
        });
      }
    });
  }
  if (instant) {
    if (journey) {
      journey.style.setProperty('--jp', 1);
      journeySteps.forEach(function (li) { li.classList.add('lit'); });
    }
  } else {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 8 · Entrance: run the hero sequence once fonts settle ─────────── */
  function begin() { document.body.classList.add('loaded'); }
  if (instant) { begin(); }
  else if (document.fonts && document.fonts.ready) {
    var done = false;
    document.fonts.ready.then(function () { if (!done) { done = true; begin(); } });
    setTimeout(function () { if (!done) { done = true; begin(); } }, 900);
  } else {
    setTimeout(begin, 120);
  }
})();
