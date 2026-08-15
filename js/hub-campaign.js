/* ============================================================================
   HUB CAMPAIGN — building the plan, one call at a time
   ----------------------------------------------------------------------------
   Loaded only on /hub/campaign. Everything here is orchestration: the server
   decides what a plan says, what is safe to copy and what an advisor may claim.

   ── WHY THE BROWSER DRIVES THE LOOP ────────────────────────────────────────
   A plan is a skeleton plus roughly eight pieces of copy. Generating all of it
   in one request would take twenty seconds and Vercel kills a function at ten,
   so the sequence has to live somewhere that is not on a clock. That is the
   browser. Each call is its own request, each result is saved as it lands, and
   closing the tab half way through leaves a half-finished plan rather than
   nothing — which is why the overlay says so.

   ── WHAT IS DELIBERATELY NOT DUPLICATED HERE ───────────────────────────────
   Severity, copyability and the claim rules all arrive from the server on each
   response. This file never decides whether something is safe; it only shows
   what it was told. A second opinion in the browser is a second opinion that
   can disagree, and the one that can be edited with devtools would win.
   ========================================================================== */
(function () {
  'use strict';

  var plan = document.getElementById('gtm-plan');
  var build = document.getElementById('gtm-build');
  var rebuild = document.getElementById('gtm-rebuild');
  var overlay = document.getElementById('gtm-thinking');
  if (!overlay) return;

  var stepEl = document.getElementById('gtm-step');
  var barEl = document.getElementById('gtm-bar');
  var countEl = document.getElementById('gtm-count');

  /* ── The overlay ───────────────────────────────────────────────────────── */
  function show(step) {
    overlay.hidden = false;
    document.body.classList.add('gtm-busy');
    if (step) stepEl.textContent = step;
  }
  function hide() {
    overlay.hidden = true;
    document.body.classList.remove('gtm-busy');
  }
  function progress(done, total, step) {
    if (step) stepEl.textContent = step;
    var pct = total ? Math.round((done / total) * 100) : 0;
    barEl.style.width = pct + '%';
    countEl.textContent = total ? done + ' of ' + total + ' written' : '';
  }

  function post(body) {
    return fetch('/api/gtm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        return { status: r.status, data: j };
      }, function () {
        /* A response that is not JSON is a proxy error or a redirect to the
           login page. Either way it is not something to parse. */
        return { status: r.status, data: { error: 'unreadable' } };
      });
    }, function () {
      return { status: 0, data: { error: 'offline' } };
    });
  }

  /* ── Building ──────────────────────────────────────────────────────────── */
  function buildPlan() {
    show('Reading your profile');
    progress(0, 0);

    post({ action: 'plan' }).then(function (res) {
      if (res.status !== 200 || !res.data.ok) {
        hide();
        alertish(res.data.message || 'The plan could not be built just now. Try again in a moment.');
        return;
      }
      /* The skeleton is stored. Reload so the server renders the weeks — the
         alternative is a copy of the plan template living in this file, which
         would drift from the real one the first time either changed. The
         flag tells the reloaded page to carry straight on filling it in. */
      try { sessionStorage.setItem('gtm-continue', '1'); } catch (e) { /* private mode */ }
      location.reload();
    });
  }

  /* Fill in every block that has no copy yet, one at a time. Sequential rather
     than parallel: eight simultaneous requests is how you meet a rate limit
     that exists to catch runaway loops, and nobody is waiting any less. */
  function fillPending(auto) {
    var blocks = [].slice.call(document.querySelectorAll('.gtm-block[data-kind]:not([data-kind="none"])'))
      .filter(function (b) { return !b.querySelector('.gtm-body'); });

    if (!blocks.length) { hide(); return; }
    if (auto) show('Writing your copy');

    var total = blocks.length;
    var done = 0;

    function next() {
      var b = blocks.shift();
      if (!b) {
        progress(total, total, 'Finished');
        setTimeout(hide, 600);
        return;
      }
      progress(done, total, 'Writing your copy');

      post({
        action: 'asset',
        plan_id: plan ? plan.getAttribute('data-plan') : '',
        week: b.getAttribute('data-week'),
        position: b.getAttribute('data-pos')
      }).then(function (res) {
        done++;
        if (res.status === 200 && res.data.ok) {
          paint(b, res.data.asset);
        } else {
          /* One piece failing must not stop the rest. That is the entire
             reason the plan is generated in pieces. */
          fail(b, res.data.message);
        }
        next();
      });
    }
    next();
  }

  /* ── Painting one asset ────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function rowsFor(text) {
    var t = String(text || '');
    return Math.max(4, Math.min(18, t.split('\n').length + Math.floor(t.length / 60) + 2));
  }

  /* SEVERITY IS NOT DECIDED HERE. `asset.severity` and `asset.copyable` come
     from the server's deterministic checker; this only renders them. */
  function flagsHtml(asset) {
    var flags = asset.flags || [];
    if (!flags.length) return '';
    var high = asset.severity === 'high';
    var items = flags.map(function (f) {
      return '<li><strong>' + esc(f.match) + '</strong> — ' + esc(f.why) +
        (f.instead && f.instead.length
          ? '<span class="gtm-instead">Try instead: ' + esc(f.instead.join('; ')) + '</span>' : '') +
        '</li>';
    }).join('');
    return '<div class="gtm-flags' + (high ? ' gtm-flags--high' : '') + '">' +
      '<p class="gtm-flags-head">' +
      (high ? 'Edit this before you use it' : 'Worth a look, but you can still copy it') +
      '</p><ul>' + items + '</ul></div>';
  }

  var KIND_LABEL = {
    caption: 'Social caption', email: 'Email', sms: 'Text message',
    dm: 'Direct message', script: 'What to say', outline: 'Outline'
  };

  /* Labels say what the angle DOES. "Pain" is a marketing word; "Lead with
     what is wrong" is a choice an advisor can make without a glossary. */
  var ANGLE_LABEL = {
    pain: 'Lead with what is wrong',
    aspiration: 'Lead with what they want back',
    proof: 'Lead with something you know',
    practical: 'Lead with the decision'
  };

  function anglesHtml(current) {
    var buttons = Object.keys(ANGLE_LABEL).map(function (k) {
      return '<button type="button" class="btn btn--ghost btn--sm" data-gtm="angle" data-angle="' +
        k + '"' + (current === k ? ' disabled' : '') + '>' + esc(ANGLE_LABEL[k]) + '</button>';
    }).join('');
    return '<details class="gtm-angles"><summary>Try another angle' +
      (current ? ' <span class="gtm-angle-now">now: ' + esc(ANGLE_LABEL[current] || current) + '</span>' : '') +
      '</summary><p class="hub-hint">Rewrites this one piece from a different starting point. ' +
      'It does not cost you a build — you already paid for this plan.</p>' +
      '<div class="gtm-actions">' + buttons + '</div></details>';
  }

  function consentHtml(kind) {
    if (kind !== 'sms' && kind !== 'dm' && kind !== 'email') return '';
    var what = kind === 'sms' ? 'text' : kind === 'dm' ? 'message' : 'email';
    return '<p class="gtm-consent"><strong>Before you send this ' + what + ':</strong> ' +
      "Canada's CASL and the US TCPA both require consent before a commercial message, and it is " +
      'the sender who carries that — you, not us. A past client who booked with you recently is ' +
      'usually covered; somebody who has never heard from you is not. If you are not sure, ask ' +
      'them first. This is a prompt to check, not legal advice.</p>';
  }

  function paint(b, asset) {
    var kind = b.getAttribute('data-kind');
    var id = 'gtm-a-' + b.getAttribute('data-week') + '-' + b.getAttribute('data-pos');
    b.setAttribute('data-asset', asset.id);

    b.querySelector('.gtm-block-body').innerHTML =
      flagsHtml(asset) +
      consentHtml(kind) +
      '<label class="gtm-label" for="' + id + '">' + esc(KIND_LABEL[kind] || 'Copy') +
        (asset.edited ? ' <span class="gtm-edited">edited</span>' : '') + '</label>' +
      '<textarea id="' + id + '" class="gtm-body" rows="' + rowsFor(asset.body) + '" readonly>' +
        esc(asset.body) + '</textarea>' +
      '<div class="gtm-actions">' +
        '<button type="button" class="btn btn--gold btn--sm gtm-copy" data-copy="#' + id + '"' +
          (asset.copyable ? '' : ' disabled') + '>' +
          (asset.copyable ? 'Copy' : 'Edit it first') + '</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-gtm="edit">Edit</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-gtm="regenerate">Regenerate</button>' +
        '<button type="button" class="btn btn--ghost btn--sm gtm-revert"' +
          (asset.edited ? '' : ' hidden') + ' data-gtm="revert">Revert</button>' +
      '</div>' +
      anglesHtml(asset.angle);

    tally();
  }

  function fail(b, message) {
    b.querySelector('.gtm-block-body').innerHTML =
      '<p class="gtm-failed">' + esc(message || 'This piece did not come back.') +
      ' Nothing else in the plan was affected.</p>' +
      '<div class="gtm-actions"><button type="button" class="btn btn--gold btn--sm" ' +
      'data-gtm="regenerate">Try again</button></div>';
  }

  /* The "3/8 written" badge, recounted from the DOM rather than incremented —
     a counter and the thing it counts drift the moment one path forgets it. */
  function tally() {
    var badge = plan && plan.querySelector('.hub-stage');
    if (!badge) return;
    var all = plan.querySelectorAll('.gtm-block[data-kind]:not([data-kind="none"])').length;
    var have = plan.querySelectorAll('.gtm-block .gtm-body').length;
    badge.textContent = have + '/' + all + ' written';
    badge.setAttribute('data-stage', have === all ? 'booked' : 'new');
  }

  /* ── Per-block actions ─────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-gtm]');
    if (!btn) return;
    var b = btn.closest('.gtm-block');
    if (!b) return;

    var what = btn.getAttribute('data-gtm');
    var ta = b.querySelector('.gtm-body');
    var assetId = b.getAttribute('data-asset');

    if (what === 'edit') {
      if (!ta) return;
      if (ta.hasAttribute('readonly')) {
        ta.removeAttribute('readonly');
        ta.focus();
        btn.textContent = 'Save';
        b.classList.add('is-editing');
      } else {
        busy(btn, 'Saving');
        post({ action: 'edit', asset_id: assetId, body: ta.value }).then(function (res) {
          if (res.status === 200 && res.data.ok) {
            paint(b, res.data.asset);
          } else {
            unbusy(btn, 'Save');
            alertish(res.data.message || 'That did not save.');
          }
        });
      }
      return;
    }

    if (what === 'revert') {
      busy(btn, 'Reverting');
      post({ action: 'revert', asset_id: assetId }).then(function (res) {
        if (res.status === 200 && res.data.ok) paint(b, res.data.asset);
        else { unbusy(btn, 'Revert'); alertish(res.data.message || 'Could not revert that.'); }
      });
      return;
    }

    if (what === 'regenerate' || what === 'angle') {
      busy(btn, what === 'angle' ? 'Rewriting' : 'Writing');
      post({
        action: 'asset', force: '1',
        angle: what === 'angle' ? btn.getAttribute('data-angle') : '',
        plan_id: plan ? plan.getAttribute('data-plan') : '',
        week: b.getAttribute('data-week'),
        position: b.getAttribute('data-pos')
      }).then(function (res) {
        if (res.status === 200 && res.data.ok) paint(b, res.data.asset);
        else { unbusy(btn, what === 'angle' ? 'Try again' : 'Regenerate'); fail(b, res.data.message); }
      });
    }
  });

  function busy(btn, label) {
    btn.disabled = true;
    btn.dataset.was = btn.textContent;
    btn.textContent = label + '…';
  }
  function unbusy(btn, label) {
    btn.disabled = false;
    btn.textContent = btn.dataset.was || label;
  }

  /* One place to say something went wrong. `alert` is ugly but it is also
     unmissable, and a silent failure on a screen that just spent a minute of
     somebody's time is worse than ugly. */
  function alertish(msg) { window.alert(msg); }

  /* ── Wiring ────────────────────────────────────────────────────────────── */
  if (build) build.addEventListener('click', buildPlan);
  if (rebuild) rebuild.addEventListener('click', function () {
    if (window.confirm('Build a new plan? Your current one stays until the new one is ready.')) {
      buildPlan();
    }
  });

  /* Carry on after the reload that follows a successful skeleton. */
  var resume = false;
  try {
    resume = sessionStorage.getItem('gtm-continue') === '1';
    if (resume) sessionStorage.removeItem('gtm-continue');
  } catch (e) { /* private mode — the manual buttons still work */ }

  if (plan) {
    tally();
    if (resume) fillPending(true);
  }
})();
