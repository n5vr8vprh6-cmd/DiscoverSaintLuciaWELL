/* ============================================================================
   PROPERTY PHOTO LIGHTBOX — /explore
   ----------------------------------------------------------------------------
   Clicking a property's photograph opens a modal gallery of that property's
   frames (overview, rooms, lobby, dining, spa, grounds…), so a traveller or an
   advisor gets the story of the place without leaving for the property's own
   site.

   PROGRESSIVE. Each trigger is a real link to the property's hero image, so with
   no script it opens the photograph and nothing is lost. The frames come from a
   JSON island the build writes beside the cards (#prop-gallery-data), which is
   the same content/properties-media.js manifest everything else reads — nothing
   is authored here.

   A native <dialog> does the hard parts: top-layer modality, inert page behind,
   focus containment and Esc. This adds: ←/→/Home/End, swipe, thumbnails,
   backdrop-click to close, focus back on the trigger, the page held still
   behind it (Lenis is told to leave the dialog alone: data-lenis-prevent).
   No motion is added under prefers-reduced-motion (css/site.css).
   ========================================================================== */
(function () {
  'use strict';

  var island = document.getElementById('prop-gallery-data');
  if (!island || typeof HTMLDialogElement === 'undefined') return;
  var DATA;
  try { DATA = JSON.parse(island.textContent); } catch (e) { return; }

  var KIND = {
    hero: 'Overview', spa: 'Spa', room: 'Rooms', lobby: 'Lobby',
    gym: 'Gym', activity: 'Activities', dining: 'Dining', exterior: 'Grounds'
  };
  var SIZES = '(max-width: 900px) 96vw, min(1100px, 82vw)';

  var dlg, el = {}, state = { key: null, i: 0, trigger: null };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function set(img, ext) {
    return img.widths.map(function (w) { return img.base + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', ');
  }
  function picture(img, sizes, eager) {
    var last = img.widths[img.widths.length - 1];
    return '<picture><source type="image/webp" srcset="' + esc(set(img, 'webp')) + '" sizes="' + esc(sizes) + '">' +
      '<source type="image/jpeg" srcset="' + esc(set(img, 'jpg')) + '" sizes="' + esc(sizes) + '">' +
      '<img src="' + esc(img.base) + '-' + last + '.jpg" alt="' + esc(img.alt || '') + '" decoding="async"' +
      (eager ? '' : ' loading="lazy"') + '></picture>';
  }

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'lb';
    dlg.setAttribute('data-lenis-prevent', '');
    dlg.setAttribute('aria-label', 'Property photographs');
    dlg.innerHTML =
      '<div class="lb-frame">' +
        '<button type="button" class="lb-close" aria-label="Close photographs">' +
          '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>' +
        '<div class="lb-stage">' +
          '<button type="button" class="lb-nav lb-prev" aria-label="Previous photograph">' +
            '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M14 4l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
          '<figure class="lb-figure"><div class="lb-photo"></div>' +
            '<figcaption class="lb-caption" aria-live="polite"><span class="lb-title"></span><span class="lb-kind"></span><span class="lb-count"></span></figcaption></figure>' +
          '<button type="button" class="lb-nav lb-next" aria-label="Next photograph">' +
            '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M8 4l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div>' +
        '<ol class="lb-thumbs" aria-label="Choose a photograph"></ol>' +
        '<p class="lb-credit"></p>' +
      '</div>';
    document.body.appendChild(dlg);
    el.photo = dlg.querySelector('.lb-photo');
    el.title = dlg.querySelector('.lb-title');
    el.kind = dlg.querySelector('.lb-kind');
    el.count = dlg.querySelector('.lb-count');
    el.thumbs = dlg.querySelector('.lb-thumbs');
    el.credit = dlg.querySelector('.lb-credit');
    el.prev = dlg.querySelector('.lb-prev');
    el.next = dlg.querySelector('.lb-next');

    dlg.querySelector('.lb-close').addEventListener('click', close);
    el.prev.addEventListener('click', function () { go(-1); });
    el.next.addEventListener('click', function () { go(1); });
    /* The dialog fills the viewport, so a click that lands on the dialog itself
       (not on the frame's content) is a click on the backdrop. */
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === dlg.querySelector('.lb-frame')) close(); });
    dlg.addEventListener('close', function () {
      document.documentElement.classList.remove('lb-open');
      if (state.trigger && document.contains(state.trigger)) state.trigger.focus({ preventScroll: true });
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Home') { e.preventDefault(); show(0); }
      else if (e.key === 'End') { e.preventDefault(); show(DATA[state.key].images.length - 1); }
    });
    /* Swipe: a mostly-horizontal drag of more than 48px turns the page. */
    var x0 = null, y0 = 0;
    el.photo.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; });
    el.photo.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    });
    el.photo.addEventListener('pointercancel', function () { x0 = null; });
  }

  function show(i) {
    var g = DATA[state.key], n = g.images.length;
    state.i = (i + n) % n;
    var img = g.images[state.i];
    el.photo.innerHTML = picture(img, SIZES, true);
    el.title.textContent = g.name;
    el.kind.textContent = KIND[img.kind] || img.kind;
    el.count.textContent = (state.i + 1) + ' of ' + n;
    el.credit.textContent = img.credit ? 'Photograph: ' + img.credit : '';
    var btns = el.thumbs.querySelectorAll('button');
    for (var k = 0; k < btns.length; k++) {
      if (k === state.i) btns[k].setAttribute('aria-current', 'true'); else btns[k].removeAttribute('aria-current');
    }
    var cur = btns[state.i];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    /* Warm the neighbours so the arrows feel instant. */
    [state.i + 1, state.i - 1].forEach(function (j) {
      var nb = g.images[(j + n) % n], pre = new Image();
      pre.sizes = SIZES; pre.srcset = set(nb, 'jpg');
    });
  }

  function go(d) { show(state.i + d); }

  function open(key, trigger) {
    if (!DATA[key]) return false;
    if (!dlg) build();
    state.key = key; state.trigger = trigger;
    var g = DATA[key];
    el.thumbs.innerHTML = g.images.map(function (img, k) {
      return '<li><button type="button" data-i="' + k + '" aria-label="' + esc((KIND[img.kind] || img.kind) + ', photograph ' + (k + 1)) + '">' +
        picture(img, '7rem', true) + '<span>' + esc(KIND[img.kind] || img.kind) + '</span></button></li>';
    }).join('');
    Array.prototype.forEach.call(el.thumbs.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { show(Number(b.getAttribute('data-i'))); });
    });
    var multi = g.images.length > 1;
    el.prev.hidden = el.next.hidden = !multi;
    show(0);
    document.documentElement.classList.add('lb-open');
    dlg.showModal();
    dlg.querySelector('.lb-close').focus({ preventScroll: true });
    return true;
  }

  function close() { if (dlg && dlg.open) dlg.close(); }

  Array.prototype.forEach.call(document.querySelectorAll('a[data-gallery]'), function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   /* let "open in new tab" work */
      if (open(a.getAttribute('data-gallery'), a)) e.preventDefault();
    });
  });
})();
