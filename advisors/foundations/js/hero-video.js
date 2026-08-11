/* Well Destination Foundations — ambient cinemagraph playback (all videos).
   Progressive enhancement over each always-present <img>/poster: a video is
   only fetched when it approaches the viewport, fades in on canplay, and
   never replaces its image in the DOM. Skipped entirely for
   prefers-reduced-motion, Save-Data / slow connections, and automated
   agents. Each video pauses off-screen and on hidden tabs. */
(function () {
  'use strict';

  var videos = Array.prototype.slice.call(document.querySelectorAll('video.ambient-video'));
  if (!videos.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var automated = navigator.webdriver === true;
  var conn = navigator.connection || navigator.webkitConnection;
  var frugal = !!(conn && (conn.saveData || /2g/.test(conn.effectiveType || '')));

  if (reduced || automated || frugal) return; /* the stills are the whole experience */

  /* The hero loop is ~4MB. On a phone the ambient motion is barely legible and
     the cost is real, so narrow viewports keep the poster. Same principle the
     Save-Data / 2G check above already applies, just one condition wider. */
  var narrow = window.matchMedia('(max-width: 820px)').matches;
  if (narrow) {
    videos = videos.filter(function (v) { return !v.classList.contains('hero-video'); });
    if (!videos.length) return;
  }

  function arm(video) {
    if (video.__armed) return;
    video.__armed = true;
    video.preload = 'auto';
    video.addEventListener('canplay', function onReady() {
      video.removeEventListener('canplay', onReady);
      var p = video.play();
      if (p && p.then) {
        p.then(function () { video.classList.add('is-ready'); })
         .catch(function () { /* autoplay blocked — the still remains */ });
      } else {
        video.classList.add('is-ready');
      }
    }, { once: true });
    video.load();
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          arm(v);
          if (!document.hidden) { v.play().catch(function () {}); }
        } else {
          v.pause();
        }
      });
    }, { rootMargin: '260px 0px', threshold: 0 });
    videos.forEach(function (v) { io.observe(v); });
  } else {
    videos.forEach(arm);
  }

  document.addEventListener('visibilitychange', function () {
    videos.forEach(function (v) {
      if (document.hidden) { v.pause(); }
      else {
        var r = v.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) { v.play().catch(function () {}); }
      }
    });
  });
})();
