/* ============================================================================
   /hub/journeys/:id/design — ASK WELL, the consultation workspace
   ----------------------------------------------------------------------------
   An advisor opens this with a prospect on the other end of a shared screen and
   works through it out loud: this is what you told us, this is what I heard,
   here are two or three directions and here is what is wrong with each of them.

   ── THE PAGE IS NOT GENERATED. TWO BLOCKS ON IT ARE ───────────────────────
   Everything the GET renders — the shortlist, the reasons, the mismatches, the
   day skeleton — is plain arithmetic over vectors that already exist. That is
   why the page arrives complete rather than behind a spinner, and in front of a
   prospect that difference is the whole feel of the thing.

   The POST is where a model appears, and only ever through design-generate.js:
   the paragraph an advisor reads aloud, and the two that open and close an
   issued document. Both are asked for by a button, both arrive after the page,
   and neither can hold up anything the advisor is already looking at.

   (This header used to say no model was called anywhere in this file. That was
   true when the file only rendered, and stopped being true the moment it grew a
   POST — worth correcting rather than leaving as a comment that reassures.)

   ── THE PROSPECT IS READING OVER A SHOULDER ───────────────────────────────
   POTENTIAL MISMATCH and WATCH-OUT are advisor working notes. Read cold, mid
   sentence, by the person the trip is for, they are the worst thing that could
   be on the screen. So the page ships a PRESENT toggle: one class on <body>,
   one key, and every working note is hidden while the type gets bigger.

   It is a body class rather than a second render for a reason a second render
   would eventually prove: two templates of one screen drift, and the one that
   drifts is the one nobody is looking at. The server always sends the full
   markup; the browser only decides whether to show it.

   ── VIEW-AS ───────────────────────────────────────────────────────────────
   Staff can read a design and can write nothing. Enforced in the handler, not
   by hiding a control. The consultation itself needs no masking, which falls
   out of the no-free-text rule: it is codes and weights and identifies nobody.

   ── BEFORE 022 ────────────────────────────────────────────────────────────
   Everything above still renders. The need-state is seeded from the Journey's
   own Finder answers, the scoring is computation, and only saving is
   unavailable — said plainly in a banner rather than by a page that half works.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { str, json, body: readBody } = require('../core.js');
const { hubPage, esc, emptyState } = require('../hub-render.js');
const { journeyById } = require('../hub-data.js');
const { maskJourney } = require('../hub-mask.js');
const { fullName } = require('../hub-brief.js');
const K = require('../well-knowledge.js');
const N = require('../need-state.js');
const M = require('../design-match.js');
const D = require('../design-data.js');
const G = require('../design-generate.js');
const IT = require('../design-itinerary.js');
const { configured, reasonText } = require('../openai.js');
const { rung } = require('../gtm.js');

const BAND_WORD = {
  strong: 'Strong', partial: 'Partial', thin: 'Thin', absent: 'Absent', unknown: 'Not known'
};
const AXIS = [
  ['place', 'Place'], ['direction', 'Direction'], ['depth', 'Depth'], ['ingredients', 'Ingredients']
];

module.exports = async function handler(req, res) {
  /* Read the id BEFORE the guard, so an advisor who is signed out arrives back
     here rather than at Home. requireAdvisor cannot take it from req.url — that
     is the rewritten /api/hub URL and safeNext() rejects it. */
  const url = new URL(req.url, 'https://x');
  const id = str(url.searchParams.get('id'), 64);

  const advisor = await requireAdvisor(req, res,
    id ? `/hub/journeys/${encodeURIComponent(id)}/design` : '/hub/journeys');
  if (!advisor) return;
  if (!id) return notFound(res, advisor);

  /* Ownership is in the query, on top of RLS. An id belonging to another
     advisor renders "not found" — never 403, which would confirm it exists. */
  const raw = await journeyById(advisor.id, id);
  if (!raw) return notFound(res, advisor);
  const j = maskJourney(raw, advisor.viewingAs);

  const caps = await D.capabilities();
  const bank = await K.version();

  if (req.method === 'POST') return await generate(req, res, { advisor, id, raw, caps });


  /* Saved consultation wins; otherwise seed from what they actually selected in
     the Finder. hub-brief.js's discipline applies to the seed: it is a fixed
     mapping from what somebody chose, never an inference about them. */
  const stored = caps.consultation ? await D.consultationFor(id, advisor.id) : null;
  const seeded = await N.seedFrom(raw.answers || {});
  const need = stored ? D.toNeedState(stored) : seeded;

  const shortlist = bank.ready ? await M.shortlistFor(need) : [];
  const vocab = await N.vocabulary();

  /* The rest of the strongest village, listed and never ranked. One village and
     one line of signal is not a vector, so these are shown as inventory the
     advisor can reach for rather than as candidates that lost. */
  const topVillage = Object.keys(need.villages || {})
    .sort((a, b) => need.villages[b] - need.villages[a])[0] || null;
  const also = topVillage ? await K.alsoInVillage(topVillage) : { supporting: [], basecamps: [] };

  const name = fullName(j) || 'This Journey';

  const frameworks = await K.frameworks();
  const body_ = buildBody({ id, name, need, seeded, stored, vocab, shortlist, also,
                            topVillage, caps, bank, frameworks });

  hubPage(res, {
    path: '/hub/journeys', title: 'Design · ' + name, advisor,
    body: body_, js: ['/js/hub-design.js']
  });
};

/* ── Generation ───────────────────────────────────────────────────────────
   JSON, not a redirect: this is called from the workspace while an advisor is
   on a call, and a full page reload mid-consultation loses their scroll
   position and their place in the conversation. The GET above stays a plain
   page that works with JavaScript off — only the writing needs the browser.

   IT RUNS INSIDE THE HUB ROUTER, which is why vercel.json now sets
   maxDuration 60 on api/hub/index.js. The narrative asks openai.js for 20
   seconds; inside a function with the platform default that is a 504 with
   nothing written and no explanation — openai.js:47 records that exact bug
   happening to the campaign builder.

   VIEW-AS REFUSES, IN THE HANDLER. Not by hiding the button. Staff supporting
   an advisor may read the workspace; putting words into somebody's mouth that
   they will then read aloud to their own client is a different thing. Same
   rule as gtm.js and account.js. */
/* day_note IS REACHABLE AND HAS NO BUTTON YET. It is written, tested and swept
   for leaks, but the UI that calls it is the day plan, which needs a recipe and
   a night count this screen does not collect yet. Recording that here rather
   than leaving it to be discovered: it is guarded exactly like narrative —
   advisor-only, own Journey, view-as refused, rate-limited, ledgered — so it is
   an unused door in a locked corridor rather than an open one. */
/* The values are what makes an action name valid; only the first two are CALLED
   through this table. `issue` returns a link rather than a paragraph and takes
   (res, form, v) instead of (form, ctx), so generate() dispatches it by name
   before it reaches run() — the entry here exists so an unknown action is still
   the only thing that 400s. Marked rather than left as a trap for whoever adds
   the fourth one. */
const ACTIONS = { day_note: actionDayNote, narrative: actionNarrative, issue: 'dispatched-by-name' };

async function generate(req, res, v) {
  const { advisor, id, raw, caps } = v;

  if (advisor.viewingAs) {
    return json(res, 403, { error: 'read_only',
      message: 'You are viewing this advisor’s Hub. Writing under their name is not available here.' });
  }

  const form = readBody(req) || {};
  const name = str(form.action, 20);
  const run = Object.prototype.hasOwnProperty.call(ACTIONS, name) ? ACTIONS[name] : null;
  if (!run) return json(res, 400, { error: 'bad_action' });

  if (!configured()) {
    return json(res, 503, { error: 'not_configured', message: reasonText('not_configured') });
  }

  /* FAILS CLOSED. mayGenerate() returns false when it could not count — a
     missing ledger means generation refuses rather than proceeding uncounted,
     because an uncounted generation is an unbounded one. */
  const may = await D.mayGenerate(advisor.id);
  if (!may.ok) {
    return json(res, 429, { error: 'throttled', message: may.message ||
      'That is more writing than this is meant to do in an hour. Nothing is lost — try again shortly.' });
  }

  const need = caps.consultation
    ? D.toNeedState(await D.consultationFor(id, advisor.id)) || await N.seedFrom(raw.answers || {})
    : await N.seedFrom(raw.answers || {});

  const slugs = String(form.slugs || '').split(',').map((s) => str(s, 60)).filter(Boolean).slice(0, 6);
  const recipeKey = str(form.recipe, 60) || null;

  /* ISSUE IS NOT A GENERATION, even though it makes two model calls on the
     way. It writes a row, it is not rate-limited by the generation counter,
     and what it returns is a link rather than a paragraph — so it takes its
     own path out rather than being bent into the ledger shape below. */
  if (name === 'issue') {
    return await actionIssue(res, form, { advisor, id, need, slugs, recipeKey, caps });
  }

  const out = await run(form, { advisor, need, slugs, recipeKey });

  /* Recorded whether it worked or not. A ledger that only holds successes
     cannot answer "why did this advisor's session take four minutes", which is
     the question gtm.js:112 says the reason alone could not answer. */
  if (caps.ledger) {
    /* (advisorId, sessionId, entry) — the session is null until the advisor
       opens one; the counter mayGenerate() reads is per advisor per hour, so a
       note written before a session exists is still counted. */
    await D.recordGeneration(advisor.id, null, {
      kind: out.kind, model: out.model, ms: out.ms,
      promptChars: out.promptChars, usage: out.usage,
      reason: out.ok ? null : out.reason
    });
  }

  if (!out.ok) {
    return json(res, 502, { error: out.reason || 'failed', message: reasonText(out.reason) });
  }

  /* The flags travel WITH the text, never instead of it. An advisor who can see
     the flagged sentence can fix it in a second; one shown "generation failed"
     has to start again on a call, and the sentence was usually nearly right. */
  return json(res, 200, {
    ok: true, kind: out.kind, text: out.text,
    flags: out.flags, high: out.high, ms: out.ms
  });
}

function actionDayNote(form, ctx) {
  return G.generateDayNote(Object.assign({}, ctx, {
    day: {
      key: str(form.dayKey, 20), label: str(form.dayLabel, 60), text: str(form.dayText, 200)
    },
    rung: rung(ctx.advisor)
  }));
}

function actionNarrative(form, ctx) {
  return G.generateNarrative(Object.assign({}, ctx, { rung: rung(ctx.advisor) }));
}


/* ── Issue ────────────────────────────────────────────────────────────────
   The end of a consultation: freeze what was designed into a document, mint a
   link, and hand the advisor the link ONCE.

   IT REFUSES IN VIEW-AS, and that check is already above — generate() rejects
   every action for a staff member looking at somebody else's Hub. Issuing is
   the sharpest case: it puts a document into a client's hands, co-branded with
   an advisor's name, that the advisor did not write and cannot unsend without
   revoking it.

   THE TOKEN IS RETURNED ONCE AND NEVER LOGGED. The database holds a sha256 of
   it; nothing here writes it to a console, an audit row or an error. If the
   advisor loses the link they issue version 2, which is the same thing a bank
   does when you lose a card.

   READINESS IS CHECKED IN SENTENCES, not booleans. "Not ready" with no reason
   is the message that makes somebody click again harder. */
async function actionIssue(res, form, v) {
  const { advisor, id, need, slugs, recipeKey, caps } = v;

  if (!caps.itinerary) {
    return json(res, 503, { error: 'not_migrated', message: D.UNAVAILABLE.itinerary });
  }

  const may = await D.mayIssue(advisor.id);
  if (!may.ok) {
    return json(res, 429, { error: 'throttled',
      message: 'That is a lot of documents in one hour. Nothing is lost — try again shortly.' });
  }

  /* A session is what an itinerary hangs off, and an advisor who has worked
     through the shortlist without one should not be stopped at the last step
     to be told so. Opened here if it does not exist yet. */
  let session = await D.currentSession(id, advisor.id);
  if (!session) {
    const bank = await K.version();
    const opened = await D.openSession(null, id, advisor.id, bank.bank);
    if (!opened.ok) return json(res, 503, { error: opened.reason, message: opened.message || 'Could not open a session.' });
    session = opened.session;
  }

  const nights = Number(form.nights) || (need && need.nights) || null;
  const advisorNote = str(form.note, 4000);

  /* The two paragraphs. If either fails the issue fails — a document that
     opens with nothing is not a document, and half-issuing would leave a live
     token pointing at a fragment. */
  const gen = { need, advisor, slugs, recipeKey, rung: rung(advisor) };
  const open = await G.generateItinOpen(gen);
  const close = await G.generateItinClose(gen);

  if (caps.ledger) {
    for (const o of [open, close]) {
      await D.recordGeneration(advisor.id, session.id, {
        kind: o.kind, model: o.model, ms: o.ms, promptChars: o.promptChars,
        usage: o.usage, reason: o.ok ? null : o.reason
      });
    }
  }

  if (!open.ok || !close.ok) {
    const reason = open.ok ? close.reason : open.reason;
    return json(res, 502, { error: reason || 'failed', message: reasonText(reason) });
  }

  const doc = await IT.assemble({
    recipeKey, nights, slugs,
    open: open.text, close: close.text,
    dayNotes: (session.day_plan && session.day_plan.notes) || {},
    advisorNote
  });

  const missing = IT.readiness(doc);
  if (missing.length) {
    return json(res, 400, { error: 'not_ready',
      message: 'This still needs ' + missing.join(', ') + '.' });
  }

  const issued = await D.issueItinerary(advisor.id, session.id, id, doc, IT.brandOf(advisor));
  if (!issued.ok) {
    return json(res, 502, { error: issued.reason,
      message: issued.reason === 'version_race'
        ? 'Another version was issued at the same moment. Reload and try again.'
        : 'Could not issue that. Nothing has been sent.' });
  }

  /* THE ONE TIME THE TOKEN EXISTS IN THE CLEAR. */
  return json(res, 200, {
    ok: true, version: issued.version,
    url: '/j/' + issued.token,
    expires_at: issued.expires_at,
    flags: open.flags.concat(close.flags),
    high: open.high + close.high
  });
}

/* ── The page ─────────────────────────────────────────────────────────────
   Exported so tools/hub-preview.js renders THIS, against fixtures, rather than
   a second template that looks the same until the day it does not. Everything
   it needs is a parameter; it reads no database and knows no advisor. */
function buildBody(v) {
  const { id, name, need, seeded, stored, vocab, shortlist, also, topVillage, caps, bank } = v;
  const tied = shortlist.length && shortlist[0].tiedGroup;

  TIER_MEANING = {};
  ((v.frameworks && v.frameworks.tiers) || []).forEach((r) => { TIER_MEANING[r.code] = r.meaning; });

  return `<div class="hub-main design">
  <div class="wrap">

    ${banner(caps, bank)}

    <header class="design-head">
      <p class="eyebrow"><a href="/hub/journeys/${esc(id)}">${esc(name)}</a></p>
      <h1>Design this journey</h1>
      <p class="design-sub">Everything here is computed from what they told the Finder and what
        you have added. Nothing on this page is written by a machine.</p>
      <div class="design-actions">
        <button type="button" class="btn" data-present>Present mode</button>
        <span class="design-hint" data-hide-in-present>Hides your working notes. Press P.</span>
      </div>
    </header>

    ${readTheTraveller(need, seeded, stored, vocab)}

    <section class="design-block">
      <h2>Directions worth comparing</h2>
      ${tied ? `<p class="design-note" data-hide-in-present>
        These ${shortlist.length} are indistinguishable on what has been said so far — they tie on
        every axis. That is the moment to ask another question rather than pick one.</p>` : ''}
      ${shortlist.length
        ? `<ol class="design-list">${shortlist.map(candidate).join('')}</ol>`
        : emptyState('The knowledge bank is not on this deployment yet.',
            'Run node tools/build-well-knowledge.js and redeploy.')}
    </section>

    ${narrative(id, shortlist, caps)}

    ${alsoIn(topVillage, also, vocab)}

    ${issue(id, shortlist, caps)}

    <footer class="design-foot" data-hide-in-present>
      <p>Property intelligence verified ${esc(bank.verified.core || '—')}
         (wider scan ${esc(bank.verified.expanded || '—')}).
         Availability, inclusions and pricing are confirmed with the property before sale.</p>
      <p class="design-prov">${esc(bank.bank || 'bank not generated')} · read from ${esc(bank.source)}</p>
    </footer>

  </div>
</div>`;
}

/* ── Banner ───────────────────────────────────────────────────────────────
   Said once, at the top, in words that name the fix. A page that silently drops
   its save button teaches an advisor that the button is sometimes there. */
function banner(caps, bank) {
  const lines = [];
  if (!caps.database) lines.push('This deployment has no database configured, so nothing here can be saved.');
  else if (!caps.consultation) lines.push(D.UNAVAILABLE.consultation);
  if (!bank.ready) lines.push('The knowledge bank has not been generated on this deployment.');
  if (!lines.length) return '';
  return `<div class="design-banner" role="status">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
}

/* ── What they said, and what we heard ───────────────────────────────────── */
function readTheTraveller(need, seeded, stored, vocab) {
  const label = (dim, key) => {
    const hit = (vocab[dim] || []).filter((o) => o.key === key)[0];
    return hit ? hit.label : key;
  };
  const weighted = (dim, bag) => {
    const keys = Object.keys(bag || {}).sort((a, b) => bag[b] - bag[a]);
    if (!keys.length) return '<span class="design-empty">not yet</span>';
    /* Sorted by weight, but six identically-styled chips read as "everywhere",
       which is the one thing this row must never say. Whatever ties for the top
       weight leads and the rest recede — order and type weight carry it, so it
       still reads with colour stripped. */
    const top = bag[keys[0]];
    return keys.map((k) => `<span class="chip${bag[k] === top ? ' chip--lead' : ''}">${
      esc(label(dim, k))}</span>`).join('');
  };

  /* The fields six Finder answers cannot supply. Shown as gaps rather than
     guesses: a blank an advisor fills is worth more than a value they have to
     notice and undo. */
  const gaps = [
    ['trigger', 'Why now'], ['uncertainty', 'What could stop them'],
    ['readiness', 'How ready'], ['budget', 'Budget band'], ['nights', 'Nights']
  ].filter(([k]) => need[k] == null);

  const overrode = stored && stored.advisor_overrode && stored.advisor_overrode.length
    ? stored.advisor_overrode : null;

  return `<section class="design-block">
  <h2>What they are moving between</h2>
  <div class="design-states">
    <div><h3>Away from</h3><div class="chips">${weighted('current', need.current)}</div></div>
    <div class="design-arrow" aria-hidden="true">→</div>
    <div><h3>Toward</h3><div class="chips">${weighted('desired', need.desired)}</div></div>
  </div>

  <dl class="design-facts">
    <dt>Places</dt><dd class="chips">${weighted('villages', need.villages)}</dd>
    <dt>Directions</dt><dd class="chips">${weighted('compass', need.compass)}</dd>
    <dt>Depth discussed</dt><dd>${
      need.continuumFloor
        ? esc(label('continuum', need.continuumFloor)) + ' to ' + esc(label('continuum', need.continuumCeiling))
        : '<span class="design-empty">not yet</span>'}</dd>
    <dt>Travelling as</dt><dd>${need.party ? esc(label('party', need.party)) : '<span class="design-empty">not yet</span>'}</dd>
    <dt>Relationship to wellness</dt><dd>${
      need.orientation ? esc(label('orientation', need.orientation)) : '<span class="design-empty">not yet</span>'}</dd>
  </dl>

  ${gaps.length ? `<div class="design-gaps" data-hide-in-present>
    <h3>Ask about</h3>
    <p>Six answers cannot know these. They are blank rather than guessed.</p>
    <ul>${gaps.map(([, l]) => `<li>${esc(l)}</li>`).join('')}</ul>
  </div>` : ''}

  ${overrode ? `<p class="design-note" data-hide-in-present>
    You changed ${overrode.length} field${overrode.length === 1 ? '' : 's'} from what the Finder proposed:
    ${esc(overrode.join(', '))}.</p>` : ''}
</section>`;
}

/* ── One candidate ────────────────────────────────────────────────────────
   Bands as words with their matched terms underneath. There is no number here
   and there is no total: the advisor argues with a reason and cannot argue with
   a score, which is the whole reason the bands are words. */
function candidate(c) {
  const bands = AXIS.map(([k, l]) => `
    <div class="band band-${esc(c.bands[k])}">
      <span class="band-axis">${esc(l)}</span>
      <span class="band-word">${esc(BAND_WORD[c.bands[k]] || c.bands[k])}</span>
    </div>`).join('');

  const matched = (c.detail.place.matched || []).concat(c.detail.direction.matched || []);
  const worst = c.mismatches.slice().sort((a, b) =>
    ({ high: 0, medium: 1, low: 2 }[a.severity] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.severity] ?? 3));

  return `<li class="design-card">
  <div class="design-card-head">
    <h3>${esc(c.name)}</h3>
    ${/* Only when the source actually assigns one. The fifteen deep profiles carry
         no tier field, and the absent value is NOT 'D' — FW.tiers defines D as "no
         verified formal WELL offer found", the opposite of what a deep profile is.
         A letter here is a claim about a property, so none is printed unless the
         guide made one. */''}
    ${c.tier ? `<span class="design-tier" title="${esc(tierMeaning(c.tier))}">${esc(c.tier)}</span>` : ''}
  </div>

  <div class="design-bands">${bands}</div>

  ${matched.length ? `<p class="design-why"><b>Answers</b> ${esc(matched.join(' · '))}</p>` : ''}

  <div class="design-mismatch" data-hide-in-present>
    <h4>What is wrong with it</h4>
    <ul>${worst.map((m) => `<li class="sev-${esc(m.severity)}">${esc(m.sentence)}${
      m.evidence ? `<span class="design-ev">${esc(m.evidence)}</span>` : ''}</li>`).join('')}</ul>
  </div>

  <p class="design-verified" data-hide-in-present>Last verified ${esc(c.verified_at || '—')}</p>
</li>`;
}

/* A-B-C-D means something specific and unobvious — B is "supporting verified WELL
   signal", D is "no verified formal WELL offer found" — so the letter always carries
   its definition. Read from the bank's own FW.tiers, set once per render: a second
   copy of the scale in this file would be a second thing to keep in step, and the
   half that drifts is the half nobody is looking at. */
let TIER_MEANING = {};
function tierMeaning(code) { return TIER_MEANING[code] || code; }

/* ── The one piece of writing ─────────────────────────────────────────────
   The only generated prose on this screen, and it is the last thing built
   rather than the first. Everything above it is arithmetic the advisor can
   check; this is a paragraph they will read aloud, so it arrives with the
   claim flags attached and a plain textarea to fix it in.

   IT IS NOT BEHIND THE OVERLAY. The shortlist is server-rendered in the same
   response and appears when the page appears — in front of a prospect there is
   no spinner between opening the workspace and having something to talk about.
   Only this one block waits on a model, and only when the advisor asks it to.

   NO JAVASCRIPT, NO BUTTON. The section still renders, still shows the textarea,
   and an advisor can write the paragraph themselves — which is the safe
   direction for that failure to go. */
function narrative(id, shortlist, caps) {
  const slugs = shortlist.slice(0, 3).map((c) => c.slug).join(',');
  return `<section class="design-block" data-narrative data-share="${esc(id)}" data-slugs="${esc(slugs)}">
  <h2>The shape of it</h2>
  <p class="design-note" data-hide-in-present>A paragraph to read aloud, written from the codes
    above and the places you have shortlisted — never from anything ${esc("they")} typed. Yours to
    change; it is a draft, not an answer.</p>

  <div class="design-narr">
    <textarea class="design-narr-body" rows="7" data-narr-text
      placeholder="Write it yourself, or ask for a draft to react to."></textarea>
    <div class="design-narr-flags" data-narr-flags hidden></div>
    <div class="design-actions" data-hide-in-present>
      <button type="button" class="btn btn--ghost btn--sm" data-narr-go>Draft a paragraph</button>
      <span class="design-hint" data-narr-status role="status"></span>
    </div>
  </div>

  ${caps.consultation ? '' : `<p class="design-hint" data-hide-in-present>This will not be saved
    yet — migration 022 is not on this deployment.</p>`}
</section>`;
}

/* ── Issue ────────────────────────────────────────────────────────────────
   The end of the consultation. One button, and what comes back is a link the
   advisor copies once.

   DISABLED WITH A NAMED REASON, NEVER HIDDEN. journey.js:42 is the precedent:
   a hidden button is a suggestion, a disabled one with a sentence beside it is
   an explanation. An advisor who cannot issue should know why without opening
   a support ticket.

   IT IS BELOW THE FOLD BY CONSTRUCTION, at the bottom of the working screen
   and after everything it depends on. Issuing is the one irreversible act here
   — the document freezes and the link is live — so it should not be reachable
   before the advisor has scrolled past the thing they are freezing.

   HIDDEN IN PRESENT MODE. The client is watching this screen; "Issue" and a
   raw share link are the advisor's apparatus, not part of the conversation. */
function issue(id, shortlist, caps) {
  const slugs = shortlist.slice(0, 3).map((c) => c.slug).join(',');
  return `<section class="design-block design-issue" data-hide-in-present
    data-issue data-share="${esc(id)}" data-slugs="${esc(slugs)}">
  <h2>Send it</h2>
  <p class="design-note">Freezes what is on this screen into a document and gives you a link
    to send. The link can be withdrawn later; what it points at cannot be edited, so issuing
    again makes a new version rather than changing this one.</p>

  <div class="design-issue-fields">
    <label class="hub-field">
      <span class="hub-field-label">Nights</span>
      <input type="number" min="1" max="21" data-issue-nights placeholder="7">
    </label>
    <label class="hub-field hub-field--wide">
      <span class="hub-field-label">A note from you (optional)</span>
      <textarea rows="3" data-issue-note
        placeholder="The thing only you know. Appears in your name, unchanged."></textarea>
    </label>
  </div>

  <div class="design-actions">
    <button type="button" class="btn btn--gold btn--sm" data-issue-go${
      caps.itinerary ? '' : ' disabled'}>Issue this plan</button>
    <span class="design-hint" data-issue-status role="status">${
      caps.itinerary ? '' : esc(D.UNAVAILABLE.itinerary)}</span>
  </div>

  ${/* Filled in by the client once, and never re-fetched. The server does not
       hold this value in any readable form after the response. */''}
  <div class="design-issued" data-issue-result hidden></div>
</section>`;
}

/* ── The rest of the village ─────────────────────────────────────────────── */
function alsoIn(villageKey, also, vocab) {
  const rows = (also.supporting || []).concat(also.basecamps || []);
  if (!villageKey || !rows.length) return '';
  const label = (vocab.villages || []).filter((v) => v.key === villageKey)[0];
  return `<section class="design-block" data-hide-in-present>
  <h2>Also in ${esc(label ? label.label : villageKey)}</h2>
  <p class="design-note">Carried, never ranked. These have a village and a line of signal, which is
    not enough to score against a brief — but they are real inventory, and sometimes one of them is
    the answer.</p>
  <ul class="design-also">${rows.map((r) => `<li>
    ${r.tier ? `<span class="design-tier" title="${esc(tierMeaning(r.tier))}">${esc(r.tier)}</span>`
      : '<span class="design-tier design-tier--none" title="No tier assigned">·</span>'}
    <b>${esc(r.name)}</b>
    <span>${esc(r.signal || '')}</span>
  </li>`).join('')}</ul>
</section>`;
}

/* Same response whether the id does not exist or belongs to somebody else.
   Distinguishing them lets an advisor probe for other advisors' ids. */
function notFound(res, advisor) {
  hubPage(res, {
    path: '/hub/journeys', title: 'Not found', advisor, status: 404,
    body: `<div class="hub-main"><div class="wrap">${emptyState(
      'That Journey is not here.',
      'It may have been removed, or it belongs to another advisor.',
      { label: 'All Journeys', href: '/hub/journeys' })}</div></div>`
  });
}

module.exports.buildBody = buildBody;
