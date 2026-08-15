/* ============================================================================
   HUB — the only client script the advisor surfaces load
   ----------------------------------------------------------------------------
   The Hub is server-rendered. Every form here is a real form that posts to a
   real endpoint and works with this file absent — this only removes the page
   reloads and puts errors next to the field that caused them.

   That is the test to apply to anything added below: if switching JavaScript
   off breaks it, it belongs on the server instead.

   Four jobs:
     1. submit auth forms over fetch and show the error inline
     2. copy the WELL link
     3. draw a QR code for it, with no library
     4. sign out (a POST, so it cannot be triggered by a link someone sends)
   ========================================================================== */
(function () {
  'use strict';

  /* ── 1. Forms ───────────────────────────────────────────────────────────── */
  function fields(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit') return;
      /* A checkbox has a `value` whether or not it is ticked, so reading
         el.value alone would post "yes" for a box nobody touched — which would
         hand the registration endpoint a forged acceptance of the Advisor Data
         Undertaking and make its server-side guard unreachable through the real
         form. The browser's `required` normally blocks submit first, which is
         exactly why this would have gone unnoticed. */
      if (el.type === 'checkbox') {
        if (el.checked) out[el.name] = el.value;
        return;
      }
      out[el.name] = el.value;
    });
    /* Where to go after signing in, carried on the form rather than in a field
       so it cannot be edited by hand in the page. The server re-checks it
       anyway — see safeNext() — because anything from a browser is a request,
       not an instruction. */
    if (form.dataset.next) out.next = form.dataset.next;
    return out;
  }

  function status(form, message, bad) {
    var el = form.querySelector('.hub-form-status');
    if (!el) return;
    el.textContent = message || '';
    if (bad) el.setAttribute('data-state', 'bad');
    else el.removeAttribute('data-state');
  }

  /* THE ENDPOINTS ANSWER IN CODES; THE SENTENCES LIVE HERE.
     That split is deliberate. An API that returns prose is an API whose
     wording drifts every time someone edits a handler, and these particular
     sentences are ones we have thought about — `invalid_credentials` is one
     message for both "no such account" and "wrong password" precisely so that
     nobody can use this form to discover who has an account. */
  var GENERIC = 'Something went wrong. Please try again.';
  var MESSAGES = {
    credentials_required: 'Please enter your email address and password.',
    invalid_credentials:  'That email address and password do not match. Please try again.',
    email_unverified:     'Please confirm your email address first — check your inbox for the link.',
    email_invalid:        'That email address does not look right — could you check it?',
    name_required:        'Please add your first and last name.',
    password_too_short:   'Please choose a password of at least 10 characters.',
    password_weak:        'That password was rejected as too easy to guess. Please try another.',
    token_missing:        'This reset link is incomplete. Please request a new one.',
    token_invalid:        'This reset link has expired. Please request a new one.',
    email_unavailable:    'We could not send the email just now. Please try again shortly.',
    not_configured:       'The Hub is not available at the moment. Please try again shortly.',
    rate_limited:         'That is a few too many attempts. Please wait a little and try again.',
    undertaking_required: 'Please read and agree to the Advisor Data Undertaking to create an account.'
  };

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.hasAttribute('data-hub-form')) return;
    e.preventDefault();

    var button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    status(form, 'Working…');

    fetch(form.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields(form))
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, d: d || {} }; })
        .catch(function () { return { ok: r.ok, d: {} }; });
    }).then(function (r) {
      if (button) button.disabled = false;

      if (!r.ok) {
        status(form, MESSAGES[r.d.error] || GENERIC, true);
        return;
      }

      /* Signed in — either straight from login, or from a registration that
         did not need email confirmation. */
      if (r.d.next) { location.assign(r.d.next); return; }
      if (r.d.signedIn) { location.assign('/hub'); return; }

      if (r.d.verify) {
        status(form, 'Check your email — we have sent you a link to confirm your address.');
        return;
      }
      if (form.hasAttribute('data-reload')) { location.reload(); return; }
      if (form.dataset.done) { location.assign(form.dataset.done); return; }

      status(form, form.dataset.ok || 'Done.');
      if (!form.hasAttribute('data-keep')) form.reset();
    }).catch(function () {
      if (button) button.disabled = false;
      status(form, GENERIC, true);
    });
  });

  /* Reset arrives with the token in the URL FRAGMENT — Supabase puts it there
     precisely so it is never sent to a server, ours or anyone's. Move it into
     the form and clear it from the address bar, so a shoulder-surfed screen or
     a pasted URL does not carry a working credential. */
  (function resetToken() {
    var form = document.querySelector('form[data-hub-reset]');
    if (!form || !location.hash) return;
    var params = new URLSearchParams(location.hash.slice(1));
    var access = params.get('access_token');
    if (!access) return;

    var put = function (name, value) {
      var input = form.querySelector('[name="' + name + '"]');
      if (input && value) input.value = value;
    };
    put('accessToken', access);
    put('refreshToken', params.get('refresh_token'));

    history.replaceState(null, '', location.pathname + location.search);
  })();

  /* ── 1b. CSV chosen from disk ────────────────────────────────────────────
     Read in the browser and dropped into the textarea, so the import screen
     never has to parse a multipart upload and the file itself is never sent
     anywhere — only the text the admin can see in the box before submitting.

     Without this the file input simply does nothing and the textarea still
     works, which is why the label says "…or choose a .csv file" rather than
     presenting it as the primary route. */
  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!input.hasAttribute || !input.hasAttribute('data-csv-file')) return;
    var file = input.files && input.files[0];
    var box = document.getElementById('csv');
    if (!file || !box) return;

    var reader = new FileReader();
    reader.onload = function () {
      box.value = String(reader.result || '');
      /* Nudge the eye to the thing that just changed — the box is below the
         file input and a silent fill looks like nothing happened. */
      box.focus();
      box.setSelectionRange(0, 0);
    };
    reader.onerror = function () {
      box.value = '';
      alert('That file could not be read. You can paste its contents instead.');
    };
    reader.readAsText(file);
  });

  /* ── 2. Copy ────────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var input = document.querySelector(btn.getAttribute('data-copy'));
    if (!input) return;

    var done = function () {
      var was = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = was; }, 1600);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).then(done, function () {
        input.select(); done();
      });
    } else {
      /* Older Safari and anything without the async clipboard. Selecting the
         text at least leaves it one keystroke away. */
      input.select();
      try { document.execCommand('copy'); } catch (err) { /* selection stands */ }
      done();
    }
  });

  /* ── 3. QR ──────────────────────────────────────────────────────────────── */
  /* Written out rather than imported. A QR encoder is about 120 lines for the
     byte-mode, low-EC, version-3 case we need, and that is a better trade than
     a third-party script on a page that renders another person's contact
     details — see the CSP note in lib/page.js. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-qr]');
    if (!btn) return;
    var value = btn.getAttribute('data-qr');

    var existing = document.querySelector('.hub-qr');
    if (existing) { existing.remove(); return; }

    var wrap = document.createElement('div');
    wrap.className = 'hub-qr';
    wrap.innerHTML = '<p class="hub-hint">Point a phone camera at this.</p>';

    try {
      wrap.insertBefore(qrSvg(value), wrap.firstChild);
    } catch (err) {
      /* If the link is too long for the version we support, say so plainly
         rather than showing a QR code that will not scan. */
      wrap.textContent = 'That link is too long to turn into a QR code here.';
    }

    btn.parentNode.parentNode.appendChild(wrap);
  });

  /* ── A minimal QR encoder ────────────────────────────────────────────────
     Byte mode, error correction level L, smallest version that fits (1–6).
     Enough for a WELL link, which is around 45 characters. Not a general
     implementation and does not pretend to be. */
  function qrSvg(text) {
    var m = qrMatrix(text);
    var size = m.length;

    /* SVG. One path, quiet zone of 4 modules. */
    var quiet = 4, dim = size + quiet * 2, d = '';
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        if (m[y][x]) d += 'M' + (x + quiet) + ',' + (y + quiet) + 'h1v1h-1z';
      }
    }
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + dim + ' ' + dim);
    svg.setAttribute('width', '180');
    svg.setAttribute('height', '180');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'QR code for your WELL link');
    svg.innerHTML = '<rect width="' + dim + '" height="' + dim + '" fill="#fff"/>' +
      '<path d="' + d + '" fill="#133239"/>';
    return svg;
  }

  /* QR-MATRIX-START — extracted verbatim by tools/qr-test.js, which checks it
     module-for-module against a reference encoder. Do not rename the markers. */
  function qrMatrix(text) {
    var data = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c > 255) throw new Error('non-latin1');
      data.push(c);
    }

    /* [version, data codewords at EC level L, EC codewords].
       STOPS AT VERSION 5 ON PURPOSE. Version 6-L is the first that splits the
       payload into two blocks, and interleaving them is a whole extra piece of
       machinery for a case we do not have: a WELL link is about 45 characters
       and version 5 holds 106. Anything longer throws, and the caller says so
       plainly rather than drawing a code that will not scan. */
    var VERSIONS = [
      [1, 19, 7], [2, 34, 10], [3, 55, 15], [4, 80, 20], [5, 108, 26]
    ];
    var v = null;
    for (var k = 0; k < VERSIONS.length; k++) {
      /* 4 bits mode + 8 bits length + payload, rounded up to whole bytes */
      if (data.length + 2 <= VERSIONS[k][1]) { v = VERSIONS[k]; break; }
    }
    if (!v) throw new Error('too long');

    var version = v[0], totalData = v[1], ecCount = v[2];
    var size = version * 4 + 17;

    /* Bit stream: mode 0100, 8-bit length, data, terminator, pad */
    var bits = [];
    var push = function (val, len) {
      for (var b = len - 1; b >= 0; b--) bits.push((val >> b) & 1);
    };
    push(4, 4);
    push(data.length, 8);
    data.forEach(function (byte) { push(byte, 8); });
    for (var t = 0; t < 4 && bits.length < totalData * 8; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);

    var codewords = [];
    for (var p = 0; p < bits.length; p += 8) {
      var byte = 0;
      for (var q = 0; q < 8; q++) byte = (byte << 1) | bits[p + q];
      codewords.push(byte);
    }
    var PAD = [0xEC, 0x11], padIndex = 0;
    while (codewords.length < totalData) codewords.push(PAD[padIndex++ % 2]);

    /* Reed–Solomon over GF(256) */
    var EXP = new Array(512), LOG = new Array(256);
    for (var e = 0, x = 1; e < 255; e++) {
      EXP[e] = x; LOG[x] = e;
      x <<= 1; if (x & 0x100) x ^= 0x11D;
    }
    for (var e2 = 255; e2 < 512; e2++) EXP[e2] = EXP[e2 - 255];

    var poly = [1];
    for (var g = 0; g < ecCount; g++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var pi = 0; pi < poly.length; pi++) {
        next[pi] ^= poly[pi];
        next[pi + 1] ^= poly[pi] ? EXP[(LOG[poly[pi]] + g) % 255] : 0;
      }
      poly = next;
    }

    var rs = codewords.slice().concat(new Array(ecCount).fill(0));
    for (var d = 0; d < codewords.length; d++) {
      var factor = rs[d];
      if (!factor) continue;
      for (var j = 0; j < poly.length; j++) {
        rs[d + j] ^= poly[j] ? EXP[(LOG[poly[j]] + LOG[factor]) % 255] : 0;
      }
    }
    var all = codewords.concat(rs.slice(codewords.length));

    /* Matrix */
    var m = [], reserved = [];
    for (var r = 0; r < size; r++) {
      m.push(new Array(size).fill(0));
      reserved.push(new Array(size).fill(false));
    }
    var set = function (rr, cc, val) { m[rr][cc] = val ? 1 : 0; reserved[rr][cc] = true; };

    var finder = function (rr, cc) {
      for (var a = -1; a <= 7; a++) {
        for (var b = -1; b <= 7; b++) {
          var y = rr + a, xx = cc + b;
          if (y < 0 || y >= size || xx < 0 || xx >= size) continue;
          var on = (a >= 0 && a <= 6 && (b === 0 || b === 6)) ||
                   (b >= 0 && b <= 6 && (a === 0 || a === 6)) ||
                   (a >= 2 && a <= 4 && b >= 2 && b <= 4);
          set(y, xx, on);
        }
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    for (var tm = 8; tm < size - 8; tm++) {
      set(6, tm, tm % 2 === 0);
      set(tm, 6, tm % 2 === 0);
    }
    set(size - 8, 8, 1);   /* dark module */

    /* Alignment pattern — one, centred, for versions 2–6 */
    if (version > 1) {
      var ac = size - 7;
      for (var aa = -2; aa <= 2; aa++) {
        for (var ab = -2; ab <= 2; ab++) {
          var on2 = Math.max(Math.abs(aa), Math.abs(ab)) !== 1;
          set(ac + aa, ac + ab, on2);
        }
      }
    }

    /* Format information area, reserved before data is laid in */
    for (var f = 0; f < 9; f++) {
      if (!reserved[8][f]) reserved[8][f] = true;
      if (!reserved[f][8]) reserved[f][8] = true;
    }
    for (var f2 = 0; f2 < 8; f2++) {
      reserved[8][size - 1 - f2] = true;
      reserved[size - 1 - f2][8] = true;
    }

    /* Zig-zag placement, mask 0 (row + col) % 2 === 0 */
    var bitIndex = 0;
    var nextBit = function () {
      var byteI = bitIndex >> 3;
      var bit = byteI < all.length ? (all[byteI] >> (7 - (bitIndex & 7))) & 1 : 0;
      bitIndex++;
      return bit;
    };
    var upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var step = 0; step < size; step++) {
        var rowI = upward ? size - 1 - step : step;
        for (var c2 = 0; c2 < 2; c2++) {
          var cc2 = col - c2;
          if (reserved[rowI][cc2]) continue;
          var bit2 = nextBit();
          if ((rowI + cc2) % 2 === 0) bit2 ^= 1;      /* mask 0 */
          m[rowI][cc2] = bit2;
        }
      }
      upward = !upward;
    }

    /* ── Format information ────────────────────────────────────────────────
       Derived rather than hardcoded, so that changing the EC level or the mask
       cannot silently leave a stale constant behind. Five data bits (EC level
       01 for L, then the three mask bits), BCH(15,5) remainder, XOR 0x5412.

       The placement below is the standard one and is easy to get subtly wrong:
       both copies carry all fifteen bits, the vertical copy skips the timing
       row, and the two copies run in opposite directions. tools/qr-test.js
       compares the finished matrix against a reference encoder for exactly
       this reason. */
    var fdata = (1 << 3) | 0;                 /* EC level L, mask 0 */
    var rem = fdata << 10;
    for (var fb = 14; fb >= 10; fb--) {
      if ((rem >> fb) & 1) rem ^= 0x537 << (fb - 10);
    }
    var format = ((fdata << 10) | rem) ^ 0x5412;
    var fbit = function (i) { return (format >> i) & 1; };

    for (var i2 = 0; i2 < 15; i2++) {
      var bitv = fbit(i2);
      /* Vertical copy, down the left of the top-left finder. */
      if (i2 < 6) m[i2][8] = bitv;
      else if (i2 < 8) m[i2 + 1][8] = bitv;       /* step over the timing row */
      else m[size - 15 + i2][8] = bitv;
      /* Horizontal copy, along row 8. */
      if (i2 < 8) m[8][size - i2 - 1] = bitv;
      else if (i2 === 8) m[8][7] = bitv;          /* step over the timing column */
      else m[8][14 - i2] = bitv;
    }
    m[size - 8][8] = 1;                            /* the dark module */

    return m;
  }
  /* QR-MATRIX-END */

  /* ── 4. Sign out ────────────────────────────────────────────────────────── */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    /* `data-signout` — the same attribute js/site.js uses, because the control
       is now the same component on both surfaces (lib/layouts.js
       profileControl). Renaming it here without renaming it there would leave
       sign-out working on consumer pages and silently navigating on Hub ones. */
    if (!form.hasAttribute('data-signout')) return;
    e.preventDefault();
    fetch('/api/auth/logout', { method: 'POST' })
      .then(function () { location.assign('/'); })
      .catch(function () { location.assign('/'); });
  });
})();
