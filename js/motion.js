/* ============================================================================
   MOTION — the consumer surface's choreography
   ----------------------------------------------------------------------------
   Built to the same craft bar as the Foundations page, but deliberately quieter.
   Foundations is a sales argument and performs; this is a destination brochure
   and invites. Same vocabulary, lower volume: shorter travel, gentler tilt,
   nothing that pins or scrubs.

   MODE LADDER
     gsap    — Lenis inertia + everything below
     io      — IntersectionObserver only (automatic if a CDN script fails, or
               forced with ?flat=1)
     instant — reduced-motion and automated agents. No observers are created,
               no elements are hidden, nothing animates.

   THE ONE HARD GUARANTEE
     `data-motion="ready"` is only ever set when something will definitely
     reveal the content, and a `settled` failsafe force-shows everything after
     3.6s regardless. Content can never be lost to a transition that did not run.

   Every effect below is additionally gated on a fine pointer where it depends
   on hovering, so touch devices never get a stuck transform.
   ========================================================================== */
(function () {
  'use strict';

  var body = document.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var automated = navigator.webdriver === true;
  var forceFlat = /[?&]flat=1/.test(location.search);
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── instant mode ────────────────────────────────────────────────────────
     Return before anything is hidden. The reveal CSS is scoped to
     body[data-motion="ready"], so leaving the attribute unset means every
     element simply renders as normal static content. */
  if (reduced || automated) {
    body.setAttribute('data-motion', 'instant');
    return;
  }

  var hasGsap = !forceFlat &&
    typeof window.gsap !== 'undefined' &&
    typeof window.ScrollTrigger !== 'undefined';

  body.setAttribute('data-motion', 'ready');
  body.setAttribute('data-mode', hasGsap ? 'gsap' : 'io');

  /* ══════════════════════════════════════════════════════════════════════
     1 · Split headlines into masked words
     Each word sits in an overflow-hidden slot and rises from below it, so the
     line assembles rather than fades. Splitting is done on text nodes only,
     which preserves inline <em> and <strong> — the hero headline depends on
     that, and a naive innerHTML split would eat it.
     ══════════════════════════════════════════════════════════════════════ */
  document.querySelectorAll('.hero h1, .page-header h1, .section-head h2, .final-cta h2')
    .forEach(function (el) {
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

  /* ══════════════════════════════════════════════════════════════════════
     2 · Stagger indices
     Set as a custom property rather than nth-child rules, so a grid of any
     length cascades correctly instead of stopping at the sixth child.
     ══════════════════════════════════════════════════════════════════════ */
  var STAGGER = '.lens-grid, .village-grid, .finder-steps, .expertise-grid,' +
                '.tile-grid, .prop-grid, .exp-list, .contact-grid, .path-list,' +
                '.day-grid, .arc-track, .cred-list, .check-list, .cmp-col ul';
  document.querySelectorAll(STAGGER).forEach(function (grid) {
    grid.setAttribute('data-stagger', '');
    Array.prototype.forEach.call(grid.children, function (child, i) {
      child.style.setProperty('--i', i);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════
     3 · One observer for everything that reveals
     ══════════════════════════════════════════════════════════════════════ */
  var targets = document.querySelectorAll(
    '[data-splitted], [data-stagger], .reveal-group, .reveal-item, .village-block, .split, .safety-note'
  );

  function markIn(el) {
    el.classList.add('is-revealed');
    /* The hard guarantee. Whatever happens to the transition, the content is
       visible 3.6s later — `settled` drops the transform and opacity outright. */
    setTimeout(function () { el.classList.add('settled'); }, 3600);
  }
  function showAll() { targets.forEach(markIn); }

  var failsafe = setTimeout(showAll, 2500);

  if (!('IntersectionObserver' in window)) {
    clearTimeout(failsafe); showAll();
  } else {
    var delivered = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        delivered = true;
        markIn(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
    /* If the observer never fires at all (headless, odd embedding), show
       everything rather than leaving a blank page. */
    setTimeout(function () { if (!delivered) showAll(); }, 2500);
  }

  /* ══════════════════════════════════════════════════════════════════════
     4 · 3D tilt, in the card's own accent
     Village and property cards tilt toward the pointer with a soft glare. The
     glare colour is the VILLAGE accent (--v), not a single gold — six villages
     with six identities should not all catch the light the same way.
     ══════════════════════════════════════════════════════════════════════ */
  if (finePointer) {
    document.querySelectorAll('.village-card, .prop-card, .tile-grid li').forEach(function (card) {
      card.setAttribute('data-tilt', '');
      var raf = 0;
      card.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top) / r.height;
          /* Gentler than Foundations (7/9deg): this is an editorial grid, not
             a pitch deck. 4/5deg reads as "responsive" without theatrics. */
          card.style.transform =
            'perspective(1000px) rotateX(' + ((0.5 - py) * 4).toFixed(2) + 'deg)' +
            ' rotateY(' + ((px - 0.5) * 5).toFixed(2) + 'deg) translateY(-2px)';
          card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
          card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        });
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     5 · Magnetic primary CTAs
     Only the ones that carry the conversion. A page where everything is
     magnetic is a page where nothing is.
     ══════════════════════════════════════════════════════════════════════ */
  if (finePointer) {
    document.querySelectorAll('.hero-ctas .btn--gold, .final-cta .btn--gold, .section-cta .btn--gold')
      .forEach(function (btn) {
        btn.classList.add('magnetic');
        btn.addEventListener('pointermove', function (e) {
          var r = btn.getBoundingClientRect();
          var dx = e.clientX - (r.left + r.width / 2);
          var dy = e.clientY - (r.top + r.height / 2);
          btn.style.transform = 'translate(' + (dx * 0.14).toFixed(1) + 'px,' + (dy * 0.22).toFixed(1) + 'px)';
        });
        btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     5b · Per-child indices for SVG and list animations
     The compass ticks/labels and the arc nodes need their own --i, and they
     are not children of a [data-stagger] grid.
     ══════════════════════════════════════════════════════════════════════ */
  document.querySelectorAll('.compass').forEach(function (svg) {
    var ticks = svg.querySelectorAll('.compass-tick');
    var labels = svg.querySelectorAll('.compass-label');
    for (var i = 0; i < ticks.length; i++) ticks[i].style.setProperty('--i', i);
    for (var j = 0; j < labels.length; j++) labels[j].style.setProperty('--i', j);
  });

  /* The compass draws once, when it first arrives. */
  var compass = document.querySelector('.compass');
  if (compass) {
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-drawn');
          cio.unobserve(e.target);
        });
      }, { threshold: 0.25 });
      cio.observe(compass);
      /* Same failsafe principle as the reveals: if the observer never fires,
         the instrument must still be drawn rather than sitting invisible. */
      setTimeout(function () { compass.classList.add('is-drawn'); }, 2600);
    } else {
      compass.classList.add('is-drawn');
    }

    /* ── Pointing at a direction explains it ──────────────────────────────
       The hit circles are deliberately generous (r=58 in a 620 viewBox), so
       adjacent ones overlap and plain :hover would light two at once, or
       whichever happens to be later in document order. Instead the whole SVG
       listens once and picks the point nearest the cursor — the behaviour is
       a Voronoi split of the ring, which is what "the one I am pointing at"
       actually means.

       Mouse only. Touch gets the legend as visible copy (see site.css), so
       there is no tap-to-reveal state to get stuck in. */
    var points = [].slice.call(compass.querySelectorAll('.compass-point[data-note]'));
    var readout = compass.parentNode.querySelector('.compass-readout');
    var readoutInner = readout && readout.querySelector('.compass-readout-inner');

    if (points.length && readoutInner && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var active = null;

      var centreOf = function (pt) {
        var hit = pt.querySelector('.compass-hit');
        return { x: +hit.getAttribute('cx'), y: +hit.getAttribute('cy') };
      };

      var setActive = function (pt) {
        if (pt === active) return;
        if (active) active.classList.remove('is-active');
        active = pt;
        if (!pt) {
          compass.classList.remove('is-probed');
          readout.classList.remove('is-shown');
          return;
        }
        pt.classList.add('is-active');
        compass.classList.add('is-probed');

        /* Built as nodes rather than innerHTML — the copy is ours, but there
           is no reason for a stray & or < in a future edit to break the line. */
        var name = document.createElement('b');
        name.textContent = pt.querySelector('.compass-label').textContent;
        readoutInner.textContent = '';
        readoutInner.appendChild(name);
        readoutInner.appendChild(document.createTextNode(pt.getAttribute('data-note')));
        readout.classList.add('is-shown');
      };

      compass.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;

        /* Cursor into the SVG's own coordinate space, so the maths is
           independent of how the figure is scaled at this viewport. */
        var box = compass.getBoundingClientRect();
        var vb = compass.viewBox.baseVal;
        var x = (e.clientX - box.left) / box.width * vb.width;
        var y = (e.clientY - box.top) / box.height * vb.height;

        /* Nothing lights in the dead centre — the ring is the instrument, the
           middle is the brand mark. 132 clears the inner ring at r=122. */
        var dxc = x - 310, dyc = y - 310;
        if (Math.sqrt(dxc * dxc + dyc * dyc) < 132) { setActive(null); return; }

        var best = null, bestD = Infinity;
        for (var i = 0; i < points.length; i++) {
          var c = centreOf(points[i]);
          var dx = x - c.x, dy = y - c.y;
          var d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = points[i]; }
        }
        setActive(bestD <= 118 * 118 ? best : null);
      });

      compass.addEventListener('pointerleave', function () { setActive(null); });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     6 · Reading-progress thread
     A hairline that fills teal → gold across the top of the document. Sampled
     on rAF because Lenis suppresses native scroll events.
     ══════════════════════════════════════════════════════════════════════ */
  var thread = document.createElement('div');
  thread.className = 'read-thread';
  thread.setAttribute('aria-hidden', 'true');
  body.appendChild(thread);

  /* ══════════════════════════════════════════════════════════════════════
     7 · Scroll-driven: hero parallax + reading thread
     One rAF loop for everything that depends on scroll position, so we sample
     once per frame instead of once per effect.
     ══════════════════════════════════════════════════════════════════════ */
  var heroMedia = document.querySelector('.hero-media');
  var parallaxImgs = [].slice.call(document.querySelectorAll('.village-block-media picture, .split-media .photo picture'));
  var arcTrack = document.querySelector('.arc-track');
  var arcNodes = arcTrack ? [].slice.call(arcTrack.children) : [];
  /* The five-day timeline lights the same way as the arc, but per item rather
     than from one progress value: the track is tall enough that a single
     measure of its travel through the viewport would light day five while day
     one is still off-screen. Each day lights when it crosses the reading line. */
  var dayTrack = document.querySelector('.day-track');
  var dayNodes = dayTrack ? [].slice.call(dayTrack.children) : [];
  /* The same hard guarantee the reveal system makes. Each day's copy is hidden
     until its node lights, which means a stalled rAF loop would leave the
     five-day plan blank. Four seconds later it is visible no matter what. */
  if (dayTrack) {
    setTimeout(function () { dayTrack.classList.add('settled'); }, 4000);
  }
  var ticking = false;

  /* Below 860px the hero is a STACKED band, not an overlay — .hero-media is in
     normal flow there, so translating it would slide the photograph out of its
     own frame rather than parallax it. Overlay-only effect. */
  var overlayHero = window.matchMedia('(min-width: 861px)');

  function frame() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var de = document.documentElement;
    var scrollable = de.scrollHeight - window.innerHeight;

    thread.style.transform = 'scaleX(' + (scrollable > 0 ? Math.min(1, y / scrollable) : 0) + ')';

    /* Hero: the photograph drifts up slightly slower than the page, and eases
       out its Ken Burns scale. Capped so it never detaches from the frame. */
    if (heroMedia) {
      if (overlayHero.matches && y < window.innerHeight * 1.2) {
        heroMedia.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0) scale(' +
          (1.06 - Math.min(y / window.innerHeight, 1) * 0.06).toFixed(4) + ')';
      } else if (!overlayHero.matches && heroMedia.style.transform) {
        heroMedia.style.transform = '';     /* clean up if the viewport shrank */
      }
    }

    /* The Eclipse arc lights as a path. The copper spine fills and each phase
       node ignites as the scroll reaches it — the six phases are a route, and
       this is the one place on the site where motion states that literally.
       Progress is measured against the track's own travel through the viewport
       rather than the page, so it reads the same at any page length. */
    if (arcTrack && arcNodes.length) {
      var ar = arcTrack.getBoundingClientRect();
      var span = window.innerHeight * 0.62;
      var p = (window.innerHeight - ar.top - window.innerHeight * 0.22) / span;
      p = Math.max(0, Math.min(1, p));
      arcTrack.style.setProperty('--arc-progress', p.toFixed(3));
      for (var a = 0; a < arcNodes.length; a++) {
        var threshold = (a + 0.55) / arcNodes.length;
        arcNodes[a].classList.toggle('is-lit', p >= threshold);
      }
    }

    /* Each day lights once its node reaches roughly two-thirds down the
       viewport — the point a reader is actually looking at, rather than the
       moment the element technically enters the screen. Latching (never
       unsetting) would be cheaper, but scrolling back up and seeing the path
       still lit ahead of you breaks the idea that it is a route being walked. */
    if (dayNodes.length) {
      var line = window.innerHeight * 0.68;
      for (var d = 0; d < dayNodes.length; d++) {
        dayNodes[d].classList.toggle(
          'is-lit', dayNodes[d].getBoundingClientRect().top <= line);
      }
    }

    /* Editorial imagery drifts a few pixels against its section. Subtle enough
       that you feel depth rather than notice movement. */
    for (var i = 0; i < parallaxImgs.length; i++) {
      var el = parallaxImgs[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
      var progress = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      el.style.transform = 'translate3d(0,' + (progress * -16).toFixed(1) + 'px,0)';
    }
    ticking = false;
  }

  /* Prime once synchronously so the thread and hero hold a correct state from
     the first paint, rather than staying unset until the visitor scrolls. */
  frame();

  (function loop() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    requestAnimationFrame(loop);
  })();

  /* ══════════════════════════════════════════════════════════════════════
     8 · Lenis inertia
     A feel upgrade only. If it fails to construct, native scrolling remains
     and every reveal above is entirely unaffected.
     ══════════════════════════════════════════════════════════════════════ */
  if (hasGsap && typeof window.Lenis !== 'undefined') {
    try {
      var lenis = new window.Lenis({ duration: 1.05, smoothWheel: true });
      window.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      window.gsap.ticker.lagSmoothing(0);
      lenis.on('scroll', window.ScrollTrigger.update);

      document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href^="#"], a[href*="#"]');
        if (!a) return;
        var href = a.getAttribute('href');
        var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#')) : '';
        if (!hash || hash === '#') return;
        var path = href.split('#')[0];
        if (path && path !== location.pathname) return;
        var target = document.querySelector(hash);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80 });
        history.pushState(null, '', hash);
      });
    } catch (err) { /* native scroll is a perfectly good fallback */ }
  }
})();
