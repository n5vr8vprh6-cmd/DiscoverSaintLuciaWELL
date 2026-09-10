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
const { hubPage, esc, emptyState, since } = require('../hub-render.js');
const { journeyById } = require('../hub-data.js');
const { maskJourney } = require('../hub-mask.js');
const { fullName } = require('../hub-brief.js');
const K = require('../well-knowledge.js');
const N = require('../need-state.js');
const M = require('../design-match.js');
const D = require('../design-data.js');
const G = require('../design-generate.js');
const IT = require('../design-itinerary.js');
const S = require('../design-shape.js');
const E = require('../design-estimate.js');
const { renderDocument } = require('./itinerary.js');
const IM = require('../itinerary-mail.js');
const { maskEmail } = require('../hub-mask.js');
const { configured, reasonText } = require('../openai.js');
const { rung } = require('../gtm.js');
/* Three levels up to lib/, as itinerary.js and playbook.js learned the hard
   way. The same picture helper the consumer directory uses, so a srcset fix
   lands on both surfaces. */
const { mediaPicture, mediaGallery } = require('../../../lib/components.js');
/* The Understand stage lives in its own file: the reflection, the island, the
   seven-question conversation and the read-back. Pure — everything it needs
   arrives in v — so hub-preview.js renders it exactly as the Hub does. */
const U = require('./design-understand.js');
const { ringMark } = require('../../../lib/brand.js');

/* ── The four stages ──────────────────────────────────────────────────────
   One screen, ?step=, one stage visible at a time. The pattern is
   campaign-profile.js: a derived position, one POST per action, a 303 back.

   THE STORED STAGE IS A CONVENIENCE, NOT A FACT. design_sessions.stage carries
   a CHECK that, until migration 023 lands, does not admit these four names —
   so every stage write is best-effort (log, never fail the request) and the
   position is DERIVED from what has actually been saved. A deployment that ran
   ahead of the migration, which this project does routinely, loses nothing
   but a hint.

   Every headline speaks to the room, not to the advisor. The client is
   reading over a shoulder and the stage name is part of the conversation. */
const STAGES = ['understand', 'compare', 'shape', 'send'];
const STAGE_LABEL = { understand: 'Understand', compare: 'Compare', shape: 'Shape', send: 'Send' };
const STAGE_HEAD = {
  understand: 'What you told us, and what I heard',
  compare: 'Places worth comparing',
  shape: 'The shape of the week',
  send: 'What happens next'
};

/* Without ?step the workspace opens on Understand, every time. It used to
   derive a resume position from what was stored, which sent "Design this
   journey" straight to Compare the moment a consultation existed — Duncan's
   first note on 2026-09-10. The rail is how you move on. */
function resumeStage() { return 'understand'; }

/* Best-effort, and it must stay that way. */
async function setStage(session, advisor, stage) {
  if (!session || !session.id) return;
  /* Best-effort until 023 lands: its CHECK admits the four words the screen
     shows, 022's did not, and 23514 is not a missing migration. Never fail a
     request over a bookmark — the resume position is derived, not read. */
  try {
    const r = await D.updateSession(session.id, advisor.id, { stage });
    if (!r.ok) console.warn('setStage', stage, r.reason || 'refused');
  } catch (e) { console.warn('setStage', stage, String(e && e.message)); }
}
/* The plan the stage shows: the stored one when it has days, else a fresh
   skeleton (which is what the first edit will save). Null when there are no
   nights yet — the arc then says where to set them. */
function planFor(session, recipe, need, chosenSlugs, chosenProps) {
  const stored = session && session.day_plan;
  if (stored && Array.isArray(stored.days) && stored.days.length) return stored;
  const nights = need && need.nights;
  if (!nights) return null;
  return S.skeleton({ recipe, nights, chosen: chosenSlugs, properties: chosenProps });
}

function isJson(req) {
  return /application\/json/i.test(String((req.headers && req.headers['content-type']) || ''));
}

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

  /* What has already been sent. Only reachable once there is a session, which
     is only true after a first issue — so on a fresh workspace this is empty
     and the block says so rather than being absent. */
  const session = caps.consultation ? await D.currentSession(id, advisor.id) : null;
  const ranked = bank.ready ? await M.rankRecipes(need) : [];
  /* The shape. Chosen properties as full records (the SCREEN boundary; the
     prompt boundary is mayAssert and none of this reaches one), the recipe,
     and the plan — stored if the advisor has laid one, otherwise a skeleton
     from the recipe and the nights, unsaved until a day is touched. */
  const chosenSlugs = (session && session.shortlist && session.shortlist.chosen) || [];
  const chosenProps = {};
  for (const s of chosenSlugs) { const p = await K.property(s); if (p) chosenProps[s] = p; }
  const recipe = session && session.recipe_key ? await K.recipe(session.recipe_key) : null;
  const plan = planFor(session, recipe, need, chosenSlugs, chosenProps);

  /* The estimate: built from the plan and the lookup every time, then the
     advisor's stored edits laid over it. And the document as it would issue
     right now, for the preview — same assembler, same renderer. */
  const travelFrom = stored && stored.travel_from ? String(stored.travel_from).slice(0, 10) : null;
  const names = {}; Object.keys(chosenProps).forEach((s) => { names[s] = chosenProps[s].name; });
  const estimate = plan ? E.applyEdits(await E.build({ plan, travelFrom, names }), session && session.estimate) : null;
  const previewDoc = await IT.assemble({ recipeKey: session && session.recipe_key, nights: need.nights, slugs: chosenSlugs,
    open: null, close: null, dayPlan: plan, travelFrom, estimate: estimate ? E.freeze(estimate) : null, advisorNote: null });

  const issued = (caps.itinerary && session)
    ? await D.itinerariesFor(advisor.id, session.id) : [];

  const name = fullName(j) || 'This Journey';

  const frameworks = await K.frameworks();

  const want = str(url.searchParams.get('step'), 12);
  const step = STAGES.indexOf(want) !== -1 ? want : resumeStage(stored, session);

  /* Understand's extras: the floor from the places we're considering (rates,
     the same lookup the estimate uses), the advisor's own stories about
     places, and the four notes read off the row. */
  const floor = step === 'understand' ? await U.floor({ shortlist, travelFrom, nights: need.nights }) : null;
  const placeNotes = caps.placeNotes ? await D.placeNotesFor(advisor.id) : {};
  const notes = D.notesOf(stored);
  const body_ = buildBody({ id, name, need, seeded, stored, vocab, shortlist, also,
                            topVillage, caps, bank, frameworks, issued, ranked, session, step,
                            chosenSlugs, chosenProps, recipe, plan, estimate, previewDoc, travelFrom,
                            /* The month the Journey's window points at — a suggestion the
                               screen marks as such until the advisor touches it. */
                            suggestedMonth: N.travelFromWindow(raw.travel_window),
                            floor, placeNotes, notes, answers: raw.answers || {},
                            firstName: j.consumer_first || null,
                            brand: IT.brandOf(advisor),
                            clientEmail: raw.consumer_email ? maskEmail(raw.consumer_email) : null,
                            done: str(url.searchParams.get('done'), 20) });

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
const ACTIONS = {
  day_note: actionDayNote, narrative: actionNarrative,
  issue: 'dispatched-by-name', revoke: 'dispatched-by-name', recipe: 'dispatched-by-name',
  consult: 'dispatched-by-name', choose: 'dispatched-by-name', decline: 'dispatched-by-name',
  day: 'dispatched-by-name', estimate: 'dispatched-by-name',
  place_note: 'dispatched-by-name', heard_send: 'dispatched-by-name'
};

/* Actions posted by a plain <form> rather than by fetch. They redirect; the
   others answer in JSON. Kept as a list rather than inferred from a header,
   because "what does a failure look like to this caller" is a property of the
   action, not of the request that happened to arrive. */
const FORM_ACTIONS = ['revoke', 'recipe', 'consult', 'choose', 'decline', 'day', 'estimate', 'place_note', 'heard_send'];

const backTo = (id, done) =>
  '/hub/journeys/' + encodeURIComponent(id) + '/design' + (done ? '?done=' + done : '');

async function generate(req, res, v) {
  const { advisor, id, raw, caps } = v;

  /* Read and classify BEFORE refusing, so the refusal can be shaped for the
     caller. Parsing a body is not an effect; nothing below this line writes
     anything until view-as has been checked. */
  const form = readBody(req) || {};
  const name = str(form.action, 20);
  const run = Object.prototype.hasOwnProperty.call(ACTIONS, name) ? ACTIONS[name] : null;
  if (!run) return json(res, 400, { error: 'bad_action' });
  const isForm = FORM_ACTIONS.indexOf(name) !== -1;

  /* VIEW-AS REFUSES EVERYTHING, in the handler, first. A form action gets a
     redirect and a flash — handing a JSON blob to somebody who submitted a form
     with JavaScript off is a dead end with no way back. */
  if (advisor.viewingAs) {
    if (isForm) {
      res.statusCode = 303;
      res.setHeader('Location', backTo(id, 'readonly'));
      return res.end();
    }
    return json(res, 403, { error: 'read_only',
      message: 'You are viewing this advisor’s Hub. Writing under their name is not available here.' });
  }

  /* ── THE FORK, AND WHY IT SITS EXACTLY HERE ───────────────────────────────
     Below this line are two gates that exist ONLY because a model is about to
     be called: an OpenAI key, and a ledger to count the call in. Actions that
     write a row and call nothing must not be held behind either — a missing
     key is no reason to refuse to withdraw a live link from a client, and
     failing closed on an absent ledger would refuse it too.

     The view-as refusal is deliberately ABOVE this fork rather than repeated
     inside each branch, so an action added later cannot skip it by taking a new
     path. That is the trap the ACTIONS comment warns about for the third
     action; these are the fourth and fifth. */
  if (name === 'revoke') {
    return await actionRevoke(res, form, { advisor, id, caps });
  }

  /* The three stage actions. Form posts above the OpenAI and ledger gates,
     because none of them calls a model. Each re-reads the consultation itself
     rather than trusting a value computed for a different action. */
  if (name === 'consult' || name === 'choose' || name === 'decline' || name === 'day' || name === 'estimate' || name === 'place_note' || name === 'heard_send') {
    const seededNow = await N.seedFrom(raw.answers || {});
    const storedNow = caps.consultation ? await D.consultationFor(id, advisor.id) : null;
    const ctx = { advisor, id, raw, caps, stored: storedNow, seeded: seededNow,
      need: (storedNow && D.toNeedState(storedNow)) || seededNow, json: isJson(req) };
    if (name === 'consult') return await actionConsult(res, form, ctx);
    if (name === 'place_note') return await actionPlaceNote(res, form, ctx);
    if (name === 'heard_send') return await actionHeardSend(res, form, ctx);
    if (name === 'choose') return await actionChoose(res, form, ctx);
    if (name === 'day') return await actionDay(res, form, ctx);
    if (name === 'estimate') return await actionEstimate(res, form, ctx);
    return await actionDecline(res, form, ctx);
  }

  if (name === 'recipe') {
    const seededNow = await N.seedFrom(raw.answers || {});
    const storedNow = caps.consultation ? await D.consultationFor(id, advisor.id) : null;
    return await actionRecipe(res, form, {
      advisor, id, caps, stored: storedNow,
      need: (storedNow && D.toNeedState(storedNow)) || seededNow
    });
  }

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

  /* THE SEED IS KEPT BESIDE THE STATE, not discarded once the state exists.
     journey_consultations.seeded_from and .advisor_overrode are the only
     columns that will ever answer "is the Finder reading people correctly?",
     and they can only be written by something that still holds both. Read the
     stored row ONCE here rather than again inside actionIssue — two reads of
     the same row are two chances for them to disagree. */
  const seeded = await N.seedFrom(raw.answers || {});
  const stored = caps.consultation ? await D.consultationFor(id, advisor.id) : null;
  const need = (stored && D.toNeedState(stored)) || seeded;

  const slugs = String(form.slugs || '').split(',').map((s) => str(s, 60)).filter(Boolean).slice(0, 6);
  const recipeKey = str(form.recipe, 60) || null;

  /* ISSUE IS NOT A GENERATION, even though it makes two model calls on the
     way. It writes a row, it is not rate-limited by the generation counter,
     and what it returns is a link rather than a paragraph — so it takes its
     own path out rather than being bent into the ledger shape below. */
  if (name === 'issue') {
    return await actionIssue(res, form,
      { advisor, id, need, seeded, stored, slugs, recipeKey, caps, raw, json: isJson(req) });
  }


  /* A day note is written against a session that now exists by the time a
     day is edited — record it there rather than as null (a plan-era gap). */
  const sessionNow = (name === 'day_note' && caps.consultation) ? await D.currentSession(id, advisor.id) : null;
  const out = await run(form, { advisor, need, slugs, recipeKey });

  /* Recorded whether it worked or not. A ledger that only holds successes
     cannot answer "why did this advisor's session take four minutes", which is
     the question gtm.js:112 says the reason alone could not answer. */
  if (caps.ledger) {
    /* (advisorId, sessionId, entry) — the session is null until the advisor
       opens one; the counter mayGenerate() reads is per advisor per hour, so a
       note written before a session exists is still counted. */
    await D.recordGeneration(advisor.id, sessionNow ? sessionNow.id : null, {
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
/* ── Stage 2 · carrying properties forward ─────────────────────────────────
   Two writes that must agree: design_sessions.shortlist.chosen (what the rest
   of the workspace reads) and design_candidates (the ledger). Both here, in
   order, so they cannot drift. The full shortlist is saved first so a declined
   property has a row to carry its reason. */
async function actionChoose(res, form, v) {
  const { advisor, id, need, stored, caps } = v;
  const back = (done, step) => {
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, done) + '&step=' + (step || 'compare'));
    return res.end();
  };
  if (!caps.consultation) return back('not_migrated');

  const chain = await openChain(advisor, id, need, stored);
  if (!chain.ok) return back('consult_failed');
  const session = chain.session;

  const shortlist = await M.shortlistFor(need);
  const known = shortlist.map((c) => c.slug);
  const rawCarry = form.carry == null ? [] : (Array.isArray(form.carry) ? form.carry : [form.carry]);
  const slugs = rawCarry.map((s) => str(s, 60)).filter((s) => known.indexOf(s) !== -1);
  if (slugs.length > 3) return back('too_many');

  await D.saveCandidates(session.id, advisor.id, shortlist);
  const chose = await D.chooseCandidates(session.id, advisor.id, slugs);
  if (!chose.ok && chose.reason !== 'not_migrated') return back('choose_failed');

  await D.updateSession(session.id, advisor.id, {
    shortlist: { chosen: slugs, at: new Date().toISOString(), bank: session.knowledge_version || null }
  });
  await setStage(session, advisor, slugs.length ? 'shape' : 'compare');
  return back(slugs.length ? 'carried' : 'carried_none', slugs.length ? 'shape' : 'compare');
}

async function actionDecline(res, form, v) {
  const { advisor, id, need, stored, caps } = v;
  const back = (done) => {
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, done) + '&step=compare');
    return res.end();
  };
  if (!caps.consultation) return back('not_migrated');

  const slug = str(form.slug, 60);
  const reason = str(form.reason, 20);
  const okReason = DECLINE_REASONS.some(([k]) => k === reason) ? reason : null;

  const chain = await openChain(advisor, id, need, stored);
  if (!chain.ok) return back('consult_failed');
  const session = chain.session;

  /* The row has to exist to carry a reason. Saving the whole shortlist here is
     idempotent — saveCandidates replaces the session's rows — so a decline
     before any choose still lands. */
  const shortlist = await M.shortlistFor(need);
  if (!shortlist.some((c) => c.slug === slug)) return back('declined');
  await D.saveCandidates(session.id, advisor.id, shortlist);
  const kept = (session.shortlist && session.shortlist.chosen) || [];
  if (kept.length) await D.chooseCandidates(session.id, advisor.id, kept.filter((s) => s !== slug));
  await D.declineCandidate(session.id, advisor.id, slug, okReason);
  if (kept.indexOf(slug) !== -1) {
    await D.updateSession(session.id, advisor.id, {
      shortlist: Object.assign({}, session.shortlist, { chosen: kept.filter((s) => s !== slug) })
    });
  }
  return back('declined');
}

/* ── Stage 1 · saving the consultation ────────────────────────────────────
   THE FIRST WRITER OF seeded_from AND advisor_overrode WITH REAL CONTENT.
   openChain() deliberately leaves them NULL because it records no review;
   this records one, so it passes the seed and the diff. advisor_overrode is
   N.overridden(seeded, edited) — the fields the advisor changed from what the
   Finder proposed — which is the only data that will ever answer "is the
   Finder reading people correctly?".

   Codes are checked against the vocabulary and unknown values leave the field
   untouched. These columns feed prompts downstream, so a text column with no
   CHECK is only as clean as the code writing to it. */
async function actionConsult(res, form, v) {
  const { advisor, id, need, seeded, caps, json } = v;
  const back = (done, more) => {
    if (json) return jsonOut(res, done === 'saved', Object.assign({ done }, more || {}));
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, done) + '&step=understand#consult');
    return res.end();
  };
  if (!caps.consultation) return back('not_migrated');

  const vocab = await N.vocabulary();
  const allowed = (dim) => { const s = {}; (vocab[dim] || []).forEach((o) => { s[o.key] = true; }); return s; };
  const pick = (dim, field) => {
    const val = str(form[field || dim], 40);
    if (val === '') return null;
    return allowed(dim)[val] ? val : need[dim];
  };
  /* A list of codes from a checkbox group. An absent group is an EMPTY list,
     not "unchanged": with JavaScript off a form posts nothing for a group with
     no box ticked, and nothing ticked is exactly what the advisor said. */
  const list = (field, dim, max) => {
    const raw = form[field] == null ? [] : (Array.isArray(form[field]) ? form[field] : [form[field]]);
    const ok = allowed(dim);
    return raw.map((c) => str(c, 40)).filter((c) => ok[c]).filter((c, i, a) => a.indexOf(c) === i).slice(0, max);
  };
  const nights = form.nights === '' || form.nights == null ? null
    : Math.min(Math.max(parseInt(form.nights, 10) || 0, 1), 21) || null;

  const partial = form.partial === '1' || form.partial === 1 || form.partial === true;
  const edited = partial ? Object.assign({}, need) : Object.assign({}, need, {
    readiness: pick('readiness'), party: pick('party'), nights,
    constraints: list('constraints', 'constraints', 9),
    /* 024: lists. Before it, the single radio — as a one-item list, so the
       need-state has one shape whichever migration the deployment is on. */
    triggers: caps.conversation ? list('triggers', 'trigger', 7) : (pick('trigger') ? [pick('trigger')] : []),
    uncertainties: caps.conversation ? list('uncertainties', 'uncertainty', 10) : (pick('uncertainty') ? [pick('uncertainty')] : [])
  });

  /* The budget: a figure, and a band DERIVED from it (need-state.js bandFor).
     "Open, if it is right" is the advisor's tick. Before 024, the band radio. */
  if (partial) { /* codes untouched */ } else if (caps.conversation) {
    const digits = String(form.budget_usd == null ? '' : form.budget_usd).replace(/[^\d]/g, '');
    edited.budgetUsd = digits === '' ? null : Math.min(parseInt(digits, 10), 9999999);
    const open = form.budget_open === '1' || form.budget_open === 'on' || form.budget_open === true;
    edited.budget = N.bandFor(edited.budgetUsd, edited.nights, open);
  } else {
    edited.budget = pick('budget');
  }

  ['rhythm', 'activity', 'social', 'experience'].forEach((k) => {
    if (partial || form[k] == null || form[k] === '') return;
    const n = Number(form[k]);
    if (Number.isFinite(n)) edited[k] = Math.min(Math.max(Math.round(n * 100) / 100, 0), 1);
  });

  /* validate() is async. Un-awaited, `problems` was a Promise whose .length is
     undefined, and this guard never fired once. */
  const problems = await N.validate(edited);
  if (problems.length) { console.warn('consult refused', problems); return back('bad_consult'); }

  /* Outside the need-state, written only when the columns have been probed:
     023's month, and 024's one prose field. */
  const extra = {};
  if (caps.travel_from && !partial) {
    const m = str(form.travel_from, 10);
    extra.travel_from = /^\d{4}-\d{2}$/.test(m) ? m + '-01' : (/^\d{4}-\d{2}-\d{2}$/.test(m) ? m : null);
  }
  /* 025: four notes into one jsonb. Before 025 (024 only) the "why" note
     still has a home in in_their_words. A field the form did not post is left
     as it was — band 1's note posts alone, and must not blank the others. */
  const prior = D.notesOf(v.stored);
  const noteKeys = ['told', 'why', 'hesitate', 'around'];
  const notesNow = Object.assign({}, prior);
  noteKeys.forEach((k) => { if (form['note_' + k] !== undefined) notesNow[k] = str(form['note_' + k], D.NOTE_MAX); });
  if (caps.conversation) {
    extra.conversation = true;
    extra.in_their_words = notesNow.why || null;
  }
  if (caps.notes) extra.notes = notesNow;
  const saved = await D.saveConsultation(id, advisor.id, edited, {
    state: seeded, overrode: N.overridden(seeded, edited)
  }, extra);
  if (!saved.ok) return back(saved.reason === 'not_migrated' ? 'not_migrated' : 'consult_failed');

  const session = await D.currentSession(id, advisor.id);
  await setStage(session, advisor, 'understand');

  /* The read-back, re-rendered by the server for the browser to swap in — the
     same function that drew it on the page. */
  const travelFrom = extra.travel_from !== undefined ? extra.travel_from : ((v.stored && v.stored.travel_from) || null);
  const shortlistNow = await M.shortlistFor(edited);
  const floorNow = await U.floor({ shortlist: shortlistNow, travelFrom, nights: edited.nights });
  const heardHtml = U.heard({ need: edited, vocab, notes: notesNow, travelFrom, floor: floorNow, id, firstName: (v.raw && v.raw.consumer_first) || null });
  return back('saved', {
    fragment: heardHtml,
    fragments: { consult: heardHtml, 'budget-word': U.budgetWord(edited, floorNow), floor: U.floorLine(floorNow), 'whisper-energy': U.whisper(edited, shortlistNow),
      /* The island band, re-rendered from the new shortlist — the map answering as the answers change. */
      island: U.islandInner({ id, need: edited, vocab, shortlist: shortlistNow }) },
    answered: U.answeredCount(edited, travelFrom, notesNow)
  });
}


/* ── The advisor's own story about a place ─────────────────────────────────
   advisor_place_notes: theirs alone, about a place, shown on the island card
   and the Compare card. Form or JSON; view-as refused above. */
async function actionPlaceNote(res, form, v) {
  const { advisor, id, caps, json } = v;
  const slug = str(form.slug, 80);
  const stepBack = STAGES.indexOf(str(form.step, 12)) !== -1 ? str(form.step, 12) : 'compare';
  const back = (done, more) => {
    if (json) return jsonOut(res, done === 'story_saved', Object.assign({ done }, more || {}));
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, done) + '&step=' + stepBack + '#prop-' + encodeURIComponent(slug));
    return res.end();
  };
  if (!caps.placeNotes) return back('story_not_migrated');
  if (!slug || !(await K.property(slug))) return back('story_failed');
  const saved = await D.savePlaceNote(advisor.id, slug, str(form.body, D.PLACE_NOTE_MAX));
  if (!saved.ok) return back(saved.reason === 'not_migrated' ? 'story_not_migrated' : 'story_failed');
  const frag = saved.body ? `<span class="island-card-storywho">Your note</span> ${esc(saved.body)}` : '';
  return back('story_saved', { fragments: { ['story-' + slug]: frag }, body: saved.body });
}

/* ── Send what I heard ─────────────────────────────────────────────────────
   The read-back and the notes, emailed to the client from inside the call,
   copied to the advisor. Needs an address; refuses when nothing is marked. */
async function actionHeardSend(res, form, v) {
  const { advisor, id, raw, need, caps, json } = v;
  const back = (done, more) => {
    if (json) return jsonOut(res, done === 'heard_sent', Object.assign({ done }, more || {}));
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, done) + '&step=understand#consult');
    return res.end();
  };
  if (!caps.consultation) return back('not_migrated');
  if (!raw.consumer_email) return back('heard_no_email');
  const vocab = await N.vocabulary();
  const notes = D.notesOf(v.stored);
  const travelFrom = (v.stored && v.stored.travel_from) || null;
  const shortlistNow = await M.shortlistFor(need);
  const floorNow = await U.floor({ shortlist: shortlistNow, travelFrom, nights: need.nights });
  const hv = { need, vocab, notes, travelFrom, floor: floorNow };
  const text = U.heardText(hv);
  if (!text) return back('heard_nothing');
  const sent = await IM.sendHeard({ journey: raw, advisor, heard: text, notes: U.heardNotes(hv) });
  if (!sent.ok) return back(sent.error === 'mail_not_configured' ? 'heard_not_configured' : 'heard_failed');
  await D.markHeardSent(id, advisor.id);
  return back('heard_sent', { sentAt: new Date().toISOString(), to: maskEmail(raw.consumer_email) });
}

/* ── One day of the shape ─────────────────────────────────────────────────
   A plain form per day (works with JavaScript off, 303 back to the day) or
   the same fields as JSON from hub-design.js, which then receives the arc
   re-rendered BY THE SERVER to swap in. The browser moves markup the server
   wrote; it decides nothing. Validation is design-shape.js applyEdit —
   property must be one the advisor carried, band one of four words. */
async function actionDay(res, form, v) {
  const { advisor, id, need, stored, caps, json } = v;
  const n = parseInt(form.day, 10);
  const back = (done, ok) => {
    if (json) return jsonOut(res, ok !== false, { done });
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, done) + '&step=shape#day-' + (Number.isFinite(n) ? n : 1));
    return res.end();
  };
  if (!caps.consultation) return back('not_migrated', false);
  if (!Number.isFinite(n)) return back('bad_day', false);

  const chain = await openChain(advisor, id, need, stored);
  if (!chain.ok) return back('day_failed', false);
  const session = chain.session;
  const chosen = (session.shortlist && session.shortlist.chosen) || [];
  const props = {};
  for (const s of chosen) { const p = await K.property(s); if (p) props[s] = p; }
  const recipe = session.recipe_key ? await K.recipe(session.recipe_key) : null;
  const plan = planFor(session, recipe, need, chosen, props);
  if (!plan) return back('no_nights', false);

  const patch = {};
  if (form.property !== undefined) patch.property = str(form.property, 60);
  if (form.intensity !== undefined) patch.intensity = str(form.intensity, 10);
  if (form.note !== undefined) { patch.note = str(form.note, S.NOTE_MAX); patch.noteSource = str(form.noteSource, 10) === 'model' ? 'model' : 'advisor'; }
  const edited = S.applyEdit(plan, n, patch, { chosen });
  if (!edited.ok) { console.warn('day refused', edited.problems); return back('bad_day', false); }

  const saved = await D.updateSession(session.id, advisor.id, { day_plan: edited.plan });
  if (!saved.ok) return back(saved.reason === 'not_migrated' ? 'not_migrated' : 'day_failed', false);
  await setStage(session, advisor, 'shape');

  if (json) {
    /* The arc, re-rendered by the same function the page uses. */
    return jsonOut(res, true, { done: 'day_saved', fragment: arc(edited.plan, props, need, recipe) });
  }
  return back('day_saved');
}

/* ── The advisor's figures ────────────────────────────────────────────────
   Stores EDITS, not values: { edits: {key: {from,to}}, custom: [...] }. The
   table is rebuilt from the lookup on every read, so a rate refresh flows
   through and an edited line stays edited. Plain form or JSON; the JSON
   reply carries the re-rendered total so the browser swaps one cell. */
async function actionEstimate(res, form, v) {
  const { advisor, id, need, stored, caps, json } = v;
  const back = (done, ok) => {
    if (json) return jsonOut(res, ok !== false, { done });
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, done) + '&step=send#estimate');
    return res.end();
  };
  if (!caps.consultation) return back('not_migrated', false);
  if (!caps.estimate) return back('no_estimate_column', false);
  const chain = await openChain(advisor, id, need, stored);
  if (!chain.ok) return back('estimate_failed', false);
  const session = chain.session;
  const chosen = (session.shortlist && session.shortlist.chosen) || [];
  const props = {};
  for (const s of chosen) { const p = await K.property(s); if (p) props[s] = p; }
  const recipe = session.recipe_key ? await K.recipe(session.recipe_key) : null;
  const plan = planFor(session, recipe, need, chosen, props);
  if (!plan) return back('no_nights', false);
  const names = {}; chosen.forEach((s) => { if (props[s]) names[s] = props[s].name; });
  const travelFrom = stored && stored.travel_from ? String(stored.travel_from).slice(0, 10) : null;
  const base = await E.build({ plan, travelFrom, names });
  const saved = E.readEdits(form, base.lines.map((l) => l.key));
  const wrote = await D.updateSession(session.id, advisor.id, { estimate: saved });
  if (!wrote.ok) return back(wrote.reason === 'not_migrated' ? 'no_estimate_column' : 'estimate_failed', false);
  await setStage(session, advisor, 'send');
  if (json) {
    const est = E.applyEdits(base, saved);
    return jsonOut(res, true, { done: 'estimate_saved', fragment: estimateTotal(est) });
  }
  return back('estimate_saved');
}

function jsonOut(res, ok, payload) {
  return json(res, ok ? 200 : 400, Object.assign({ ok }, payload));
}

/* ── consultation → session, resolved or created ──────────────────────────
   Two callers now — issuing, and choosing a shape — so it lives once. Both
   need a session, and a session cannot exist without a consultation: 022
   declares design_sessions.consultation_id NOT NULL, and passing null there
   is the defect that made Issue fail at the last step of a live call.

   Returns the same { ok, reason, message } shape as design-data.js so a
   caller can hand the message straight to the advisor. */
async function openChain(advisor, id, need, stored) {
  let consultationId = stored && stored.id;

  if (!consultationId) {
    /* NO `seeded` ARGUMENT, AND THAT IS THE CAREFUL PART. saveConsultation
       writes seeded_from and advisor_overrode when handed a seed, and 022
       calls those two "the only thing that will ever answer: is the Finder
       reading people correctly?".

       advisor_overrode defaults to empty, and empty means "the advisor changed
       nothing". But no screen can edit a consultation yet — the advisor CANNOT
       change anything — so recording the seed here would write "the Finder was
       right" on every consultation for as long as the editor is missing. That
       is worse than teaching nothing: it manufactures a false answer to the
       one question the columns exist for.

       So seeded_from stays NULL, which honestly reads as "no advisor review
       was recorded", and the analysis is `where seeded_from is not null`. When
       the editor ships, THAT path passes { state, overrode } from
       N.overridden(seeded, edited). Do not "improve" this by passing the seed. */
    const saved = await D.saveConsultation(id, advisor.id, need);
    if (!saved.ok) {
      return { ok: false, reason: saved.reason,
        message: saved.message || 'Could not record the consultation, so nothing was changed.' };
    }
    consultationId = saved.id;
  }

  const existing = await D.currentSession(id, advisor.id);
  if (existing) return { ok: true, session: existing };

  /* versionStamp(), not bank.bank. The former is edition PLUS generation date
     and its own comment says it is the value frozen onto a session at creation;
     the latter names two different banks either side of a regeneration. */
  const opened = await D.openSession(consultationId, id, advisor.id, await K.versionStamp());
  if (!opened.ok) {
    return { ok: false, reason: opened.reason,
      message: opened.message || 'Could not open a session.' };
  }
  return { ok: true, session: opened.session };
}

/* ── Choosing a shape ─────────────────────────────────────────────────────
   A plain form POST and a 303, so it works with JavaScript off and a refresh
   never re-submits. It calls no model, which is why generate() dispatches it
   above the OpenAI and ledger gates.

   The key is validated against the bank rather than trusted: an unknown recipe
   would reach design-itinerary.js as a null lookup and silently produce the
   shapeless days this whole change exists to remove. Empty is allowed and
   means "number the days", which is a real choice. */
async function actionRecipe(res, form, v) {
  const { advisor, id, need, stored, caps } = v;

  if (!caps.consultation) {
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, 'not_migrated'));
    return res.end();
  }

  const asked = str(form.recipe, 60);
  const known = (await K.recipes()).map((r) => r.key);
  const key = asked && known.indexOf(asked) !== -1 ? asked : null;
  if (asked && !key) {
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, 'bad_recipe'));
    return res.end();
  }

  const chain = await openChain(advisor, id, need, stored);
  if (!chain.ok) {
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, 'shape_failed'));
    return res.end();
  }

  /* Lay the days for the new shape, keeping any day the advisor has already
     edited (mergePlan). Without nights there is nothing to lay yet, and the
     arc says so rather than guessing a week. */
  const recipeNow = key ? await K.recipe(key) : null;
  const chosenNow = (chain.session.shortlist && chain.session.shortlist.chosen) || [];
  const propsNow = {};
  for (const s of chosenNow) { const p = await K.property(s); if (p) propsNow[s] = p; }
  const patch = { recipe_key: key };
  if (need && need.nights) {
    patch.day_plan = S.mergePlan(chain.session.day_plan,
      S.skeleton({ recipe: recipeNow, nights: need.nights, chosen: chosenNow, properties: propsNow }));
  }
  await D.updateSession(chain.session.id, advisor.id, patch);
  await setStage(chain.session, advisor, 'shape');

  res.statusCode = 303;
  res.setHeader('Location', backTo(id, key ? 'shape' : 'shape_cleared') + '&step=shape');
  return res.end();
}

/* ── Withdraw ─────────────────────────────────────────────────────────────
   A plain form POST, so it works with JavaScript off, and a 303 back to the
   workspace so a refresh never re-submits.

   IT IS IRREVERSIBLE, AND MORE SO THAN IT LOOKS. revokeItinerary() nulls the
   token hash as well as stamping revoked_at, so the link cannot be turned
   back on — there is no readable copy of the token anywhere to restore. The
   button label has to carry that, because a confirm() is not there when
   JavaScript is off and the label always is.

   It makes no model call, which is why generate() dispatches it above the
   OpenAI and ledger gates: a missing key is no reason to refuse to withdraw a
   live document from somebody's client. */
async function actionRevoke(res, form, v) {
  const { advisor, id, caps } = v;

  if (!caps.itinerary) {
    res.statusCode = 303;
    res.setHeader('Location', backTo(id, 'not_migrated'));
    return res.end();
  }

  const target = str(form.itinerary, 64);
  const out = target
    ? await D.revokeItinerary(advisor.id, target)
    : { ok: false, reason: 'not_found' };

  res.statusCode = 303;
  res.setHeader('Location', backTo(id, out.ok ? 'withdrawn' : 'withdraw_failed'));
  return res.end();
}

async function actionIssue(res, form, v) {
  const { advisor, id, need, slugs, recipeKey, caps, raw } = v;
  const stored = v.stored;
  const wantsEmail = form.email === 'on' || form.email === true || form.email === 'true' || form.email === '1';
  const isForm = v.json === false;
  const back = (done) => { res.statusCode = 303; res.setHeader('Location', backTo(id, done) + '&step=send'); return res.end(); };
  /* With JavaScript off a 303 cannot show the token, so the only way the link
     reaches anyone is the email. Refuse to mint a link nobody will see. */
  if (isForm && !wantsEmail) return back('issue_needs_email');
  if (isForm && !(raw && raw.consumer_email)) return back('issue_no_address');

  if (!caps.itinerary) {
    return json(res, 503, { error: 'not_migrated', message: D.UNAVAILABLE.itinerary });
  }

  const may = await D.mayIssue(advisor.id);
  if (!may.ok) {
    return json(res, 429, { error: 'throttled',
      message: 'That is a lot of documents in one hour. Nothing is lost — try again shortly.' });
  }

  /* ── The chain: consultation → session → itinerary ────────────────────────
     A session is what an itinerary hangs off, and an advisor who has worked
     through the shortlist without one should not be stopped at the last step to
     be told so. Both are opened here if they do not exist yet.

     THE CONSULTATION IS NOT OPTIONAL, and this used to pass null for it.
     022 declares design_sessions.consultation_id NOT NULL, so the insert raised
     23502 and the advisor got "Could not open a session" at the last step of a
     live call. It was invisible until the migration landed — before that
     caps.itinerary is false and the button is honestly disabled, which is
     exactly why it shipped.

     Creating the row rather than relaxing the column: the schema says a session
     belongs to a consultation, and a session that belongs to nothing has no
     answer to "designed against what?". It also means seeded_from starts being
     written from the first issue, which is the only way that question ever gets
     data. */
  const chain = await openChain(advisor, id, need, stored);
  if (!chain.ok) return isForm ? back('issue_failed') : json(res, 503, { error: chain.reason, message: chain.message });
  const session = chain.session;

  /* THE SESSION IS THE AUTHORITY ON THE SHAPE, not the form. The advisor chose
     it in its own form and it was saved; the form field is only how the browser
     echoes it back. Falling back to the stored value means the JavaScript path
     and the no-JavaScript path cannot disagree about what the document says. */
  const shapeKey = recipeKey || session.recipe_key || null;

  const nights = Number(form.nights) || (need && need.nights) || null;
  const advisorNote = str(form.note, 4000);

  /* The two paragraphs. If either fails the issue fails — a document that
     opens with nothing is not a document, and half-issuing would leave a live
     token pointing at a fragment. */
  const gen = { need, advisor, slugs, recipeKey: shapeKey, rung: rung(advisor) };
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

  /* The estimate, built now from the lookup and the advisor's stored edits,
     then frozen with the dates its figures were observed. */
  const chosenNow = (session.shortlist && session.shortlist.chosen) || [];
  const propsNow = {}; for (const s of chosenNow) { const p = await K.property(s); if (p) propsNow[s] = p; }
  const recipeNow = shapeKey ? await K.recipe(shapeKey) : null;
  const planNow = planFor(session, recipeNow, need, chosenNow, propsNow);
  const namesNow = {}; chosenNow.forEach((s) => { if (propsNow[s]) namesNow[s] = propsNow[s].name; });
  const travelFromNow = stored && stored.travel_from ? String(stored.travel_from).slice(0, 10) : null;
  const estimateNow = planNow ? E.freeze(E.applyEdits(await E.build({ plan: planNow, travelFrom: travelFromNow, names: namesNow }), session.estimate)) : null;

  const doc = await IT.assemble({
    recipeKey: shapeKey, nights: (planNow && planNow.nights) || nights, slugs: chosenNow.length ? chosenNow : slugs,
    open: open.text, close: close.text,
    travelFrom: travelFromNow, estimate: estimateNow,
    dayPlan: session.day_plan || null,
    dayNotes: (session.day_plan && session.day_plan.notes) || {},
    advisorNote
  });

  const missing = IT.readiness(doc);
  if (missing.length) {
    if (isForm) return back('issue_not_ready');
    return json(res, 400, { error: 'not_ready',
      message: 'This still needs ' + missing.join(', ') + '.' });
  }

  const issued = await D.issueItinerary(advisor.id, session.id, id, doc, IT.brandOf(advisor));
  if (!issued.ok) {
    if (isForm) return back('issue_failed');
    return json(res, 502, { error: issued.reason,
      message: issued.reason === 'version_race'
        ? 'Another version was issued at the same moment. Reload and try again.'
        : 'Could not issue that. Nothing has been sent.' });
  }

  /* THE ONE TIME THE TOKEN EXISTS IN THE CLEAR — so the mail goes now or never.
     A failed mail does not fail the issue: the document is live; the advisor
     copies the link and sends it themselves. sent_at is written only when
     the mail actually left. */
  let emailed = false, emailError = null, emailedTo = null;
  if (wantsEmail) {
    if (!(raw && raw.consumer_email)) { emailError = 'no_recipient'; }
    else {
      const sent = await IM.send({ journey: raw, advisor, url: '/j/' + issued.token, version: issued.version });
      if (sent.ok) { emailed = true; emailedTo = maskEmail(raw.consumer_email); if (caps.sent_at) await D.markSent(advisor.id, issued.id); }
      else emailError = sent.error;
    }
  }
  if (isForm) return back(emailed ? 'issued_emailed' : 'issued_not_emailed');
  return json(res, 200, {
    emailed, emailError, emailedTo,
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
  const { id, name, caps, bank } = v;
  const step = STAGES.indexOf(v.step) !== -1 ? v.step : 'understand';

  TIER_MEANING = {};
  ((v.frameworks && v.frameworks.tiers) || []).forEach((r) => { TIER_MEANING[r.code] = r.meaning; });

  const STAGE_RENDER = { understand: understandStage, compare: compareStage, shape: shapeStage, send: sendStage };

  return `<div class="hub-main design design--${esc(step)}">
  <div class="wrap">

    ${flash(v.done)}

    ${banner(caps, bank)}

    <header class="design-head">
      <p class="eyebrow"><a href="/hub/journeys/${esc(id)}">${esc(name)}</a></p>
      ${rail(id, step)}
      <h1>${esc(STAGE_HEAD[step])}</h1>
      ${v.brand && (v.brand.first_name || v.brand.business) ? `<p class="design-with">With ${esc([v.brand.first_name, v.brand.last_name].filter(Boolean).join(' '))}${v.brand.business ? ' · ' + esc(v.brand.business) : ''}</p>` : ''}
    </header>

    ${STAGE_RENDER[step](v)}

    ${stageNav(id, step, v)}

    <footer class="design-foot">
      <p>Property intelligence verified ${esc(bank.verified.core || '—')}
         (wider scan ${esc(bank.verified.expanded || '—')}).
         Availability, inclusions and pricing are confirmed with the property before sale.</p>
      <p class="design-prov">${esc(bank.bank || 'bank not generated')} · read from ${esc(bank.source)}${step === 'understand' ? ' · map outline: geoBoundaries, CC BY 4.0' : ''}</p>
    </footer>

  </div>
</div>`;
}

/* ── The rail ─────────────────────────────────────────────────────────────
   Four LINKS, not buttons. Navigation between stages needs no JavaScript and
   no state — a link to ?step= is the whole mechanism. Done stages are the
   ones before the current position in the derived order. */
function rail(id, step) {
  const now = STAGES.indexOf(step);
  return `<ol class="design-rail" aria-label="Stages">${STAGES.map((s, i) => `
    <li class="${i < now ? 'is-done' : i === now ? 'is-now' : ''}">
      <a href="/hub/journeys/${esc(id)}/design?step=${s}"${i === now ? ' aria-current="step"' : ''}>
        <span class="design-rail-n">${i + 1}</span> ${esc(STAGE_LABEL[s])}</a>
    </li>`).join('')}</ol>`;
}

/* Forward and back, at the foot of every stage. Plain links. */
function stageNav(id, step, v) {
  const i = STAGES.indexOf(step);
  const prev = i > 0 ? STAGES[i - 1] : null;
  const next = i < STAGES.length - 1 ? STAGES[i + 1] : null;
  /* Understand → Compare carries a short "preparing options" interstitial:
     the markup is rendered here, hidden; hub-design.js only reveals it, waits,
     and follows the link. Without JavaScript the link is a link. */
  const first = v && v.firstName ? String(v.firstName) : '';
  const prepare = step === 'understand' && next ? ` data-prepare="${esc(first)}"` : '';
  const overlay = step === 'understand' && next ? `
  <div class="design-prepare" data-prepare-overlay hidden role="status" aria-live="polite">
    <div class="design-prepare-inner">
      ${ringMark(72, 1.4)}
      <p class="design-prepare-h">Preparing ${first ? esc(first) + '’s' : 'your'} options…</p>
      <ol class="design-prepare-steps">
        <li>Reading what you told us</li>
        <li>Matching the island’s villages</li>
        <li>Checking what each place offers</li>
      </ol>
    </div>
  </div>` : '';
  /* On Understand the forward link is the gold CTA inside the What-I-heard
     card (design-understand.js heard()), so the nav here carries only the way
     back to the Journey. */
  const forward = step === 'understand' ? '' : (next ? `<a class="btn btn--sm" href="/hub/journeys/${esc(id)}/design?step=${next}"${prepare}>${esc(STAGE_LABEL[next])} →</a>` : '');
  return `<nav class="design-stagenav">
    ${prev ? `<a class="btn btn--ghost btn--sm" href="/hub/journeys/${esc(id)}/design?step=${prev}">← ${esc(STAGE_LABEL[prev])}</a>` : `<a class="btn btn--ghost btn--sm" href="/hub/journeys/${esc(id)}">← Back to the Journey</a>`}
    ${forward}
  </nav>${overlay}`;
}

/* ── Stage 2 · Compare ────────────────────────────────────────────────────
   Brochure cards, not report rows. The photograph, the hook, what is
   included, the village in its own colour — the page a client would want to
   be turned. The four bands and the mismatch sentences are still here and
   still the honesty mechanism, but behind a disclosure the advisor opens and
   a disclosure closes: they stop being the first thing on the screen.

   CHOOSING WRITES THE LEDGER. design_candidates was built by 022 as the only
   table that will ever say whether the mapping is wrong, and nothing wrote it
   until this. Every shortlisted property gets a row; the carried ones are
   flagged; a put-aside one carries its reason.

   ONE FORM, NO NESTING. The choose form wraps the cards; each card's
   put-aside control points at its own form rendered after the main one via
   the `form` attribute, because a form inside a form is not HTML. */
function compareStage(v) {
  const { id, need, shortlist, session, caps, topVillage, also, vocab, frameworks } = v;
  const chosen = (session && session.shortlist && session.shortlist.chosen) || [];
  const tied = shortlist.length && shortlist[0].tiedGroup;
  const fw = frameworks || {};

  const cards = shortlist.map((c) => propertyCard(id, c, need, chosen, fw, v)).join('');
  const declines = shortlist.map((c) => `<form method="POST" id="decline-${esc(c.slug)}"
    action="/hub/journeys/${esc(id)}/design?step=compare">
    <input type="hidden" name="action" value="decline"><input type="hidden" name="slug" value="${esc(c.slug)}"></form>`).join('');

  return `<section class="design-block design-compare">
  ${tied ? `<p class="design-note">These ${shortlist.length} tie on every axis
    on what has been said so far. That is the moment to ask another question rather than pick one.</p>` : ''}
  ${shortlist.length ? `
  <form method="POST" action="/hub/journeys/${esc(id)}/design?step=compare" class="design-choose">
    <input type="hidden" name="action" value="choose">
    <ol class="design-props">${cards}</ol>
    <div class="design-actions design-choose-actions">
      <button class="btn btn--sm" type="submit"${caps.consultation ? '' : ' disabled'}>Carry these into the shape</button>
      <span class="design-hint">Up to three. ${chosen.length ? chosen.length + ' carried so far.' : ''}
        ${caps.consultation ? '' : esc(D.UNAVAILABLE.consultation)}</span>
    </div>
  </form>${declines}` : emptyState('The knowledge bank is not on this deployment yet.',
        'Run node tools/build-well-knowledge.js and redeploy.')}
</section>` + alsoIn(topVillage, also, vocab);
}

/* The advisor's own note about the place, with its edit form. Theirs alone;
   never a prompt, never the document. A <details> so the card stays a
   brochure until the advisor reaches for the story. */
function storyBlock(id, slug, body, caps) {
  if (!caps || !caps.placeNotes) return '';
  return `<details class="design-story-wrap"${body ? ' open' : ''}>
      <summary>${body ? 'Your note about this place' : 'Add your own note about this place'}</summary>
      <form method="POST" action="/hub/journeys/${esc(id)}/design?step=compare" class="design-story" data-live data-fragment="story-${esc(slug)}">
        <input type="hidden" name="action" value="place_note"><input type="hidden" name="slug" value="${esc(slug)}"><input type="hidden" name="step" value="compare">
        <textarea name="body" rows="2" maxlength="400" aria-label="Your note about this place" placeholder="A stay, a moment, the thing to say when it comes up.">${esc(body)}</textarea>
        <span class="design-field-hint">Yours alone — shown to you here and on Understand, never to the client.</span>
        <div class="design-actions"><button class="btn btn--ghost btn--sm" type="submit">Save</button><span class="design-hint" data-live-status role="status"></span></div>
      </form>
    </details>`;
}

/* Which village colours a property for THIS traveller: the one of its villages
   they weighted highest. Deterministic; ties go to the property's own order. */
function villageFor(p, need) {
  const vs = (p && p.villages) || [];
  if (!vs.length) return null;
  const w = (need && need.villages) || {};
  return vs.slice().sort((a, b) => (w[b] || 0) - (w[a] || 0))[0];
}

/* The six-rung ladder with the property's band lit. Words, not a bar — a
   client reads "Relax · Restore · Reconnect" and knows what it means. */
function continuumStrip(p, fw) {
  const order = fw.continuumOrder || [];
  const names = {};
  (fw.continuum || []).forEach((r) => { names[r.key] = r.name; });
  const on = p.continuum || [];
  if (!order.length) return '';
  if (!on.length) return `<p class="design-depth design-depth--unknown">Depth not mapped for this property.</p>`;
  return `<ol class="design-depth" aria-label="Depth">${order.map((k) => `<li class="${on.indexOf(k) !== -1 ? 'is-on' : ''}">${esc(names[k] || k)}</li>`).join('')}</ol>`;
}

const DECLINE_REASONS = [
  ['style', 'Not their style'], ['terrain', 'Terrain or access'], ['depth', 'Too deep, or not deep enough'],
  ['price', 'Price'], ['availability', 'Availability'], ['other', 'Something else']
];

function propertyCard(id, c, need, chosen, fw, v_) {
  v_ = v_ || {};
  const p = c.property || {};
  const vk = villageFor(p, need);
  const accent = vk ? ` style="--v: var(--v-${esc(vk)}); --v-ink: var(--v-${esc(vk)}-ink)"` : '';
  const carried = chosen.indexOf(c.slug) !== -1;
  const included = (p.included || []).slice(0, 3).map((f) => f.text || f);
  const price = p.price && p.price.text;

  return `<li class="design-prop${carried ? ' is-carried' : ''}${p.image ? '' : ' design-prop--text'}" id="prop-${esc(c.slug)}"${accent}>
  ${p.image ? `<div class="design-prop-media">${mediaGallery((p.image.images && p.image.images.length) ? p.image.images : [p.image], { sizes: '(min-width: 60rem) 44vw, 100vw', thumbSizes: '(min-width: 60rem) 7vw, 22vw' })}</div>` : ''}
  <div class="design-prop-body">
    ${p.modelTag ? `<p class="eyebrow">${esc(p.modelTag)}</p>` : ''}
    <h3>${esc(c.name)}</h3>
    ${p.hook ? `<p class="design-prop-hook">${esc(p.hook)}</p>` : ''}
    ${p.bestFor ? `<p class="design-prop-best"><b>Best for</b> ${esc(p.bestFor)}</p>` : ''}
    ${included.length ? `<ul class="design-prop-inc">${included.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    <div class="design-prop-meta">
      <div class="chips">${(p.villages || []).map((k) => `<span class="chip chip--v" style="--v: var(--v-${esc(k)}); --v-ink: var(--v-${esc(k)}-ink)">${esc(villageName(k))}</span>`).join('')}</div>
      ${continuumStrip(p, fw)}
    </div>
    ${c.verified_at ? `<p class="design-verified">Last verified ${esc(c.verified_at)}</p>` : ''}

    <details class="design-why">
      <summary>Why this fits · what to watch</summary>
      <div class="design-bands">${AXIS.map(([k, label]) => `<div class="band band-${esc(c.bands[k])}">
        <span class="band-axis">${label}</span><span class="band-word">${esc(BAND_WORD[c.bands[k]] || c.bands[k])}</span></div>`).join('')}</div>
      ${(c.mismatches || []).length ? `<ul class="design-mismatch">${c.mismatches.map((m) => `<li class="sev-${esc(m.severity)}">${esc(m.sentence)}${
        m.evidence ? `<span class="design-ev">${esc(m.evidence)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${price ? `<div class="design-price"><h4>${esc(p.priceTag || 'Public planning price signal')}</h4>
        <p>${esc(price)}</p><p class="design-hint">Planning guidance only. Never quote from this — every figure is reconfirmed before it is quoted to a client.</p></div>` : ''}
    </details>

    <div class="design-prop-actions">
      <label class="design-carry"><input type="checkbox" name="carry" value="${esc(c.slug)}"${carried ? ' checked' : ''}>
        <span>${carried ? 'Carried into the shape' : 'Carry into the shape'}</span></label>
      <span class="design-aside">
        <select name="reason" form="decline-${esc(c.slug)}" aria-label="Why not">${DECLINE_REASONS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
        <button class="btn btn--ghost btn--sm" type="submit" form="decline-${esc(c.slug)}">Put aside</button>
      </span>
    </div>
  </div>
</li>`;
}

function villageName(key) {
  const names = { longevity: 'Longevity', rainforest: 'Nature & Renewal', ocean: 'Ocean & Restoration',
    heritage: 'Heritage & Nourishment', movement: 'Movement & Adventure', connection: 'Connection & Romance' };
  return names[key] || key;
}

/* ── Stages 3 and 4 wrap what already exists ───────────────────────────── */
/* ── Stage 3 · Shape ──────────────────────────────────────────────────────
   The rubric, answered on one screen: beginning · middle · end are the
   recipe's phases; intensity is a word on each day; breaks are rest days.
   The arc is server-rendered — a CSS grid with one column per day — so it
   needs no JavaScript to draw. Colour is the village of the day's property;
   fill is the intensity; the WORD sits in the column because no colour
   carries meaning alone. Editing a day is a plain form; with JavaScript the
   same fields go as JSON and the server's re-rendered arc swaps in.

   THE CUES ARE FOR THE ADVISOR. The recipe's ask, its pacing rule with the
   plan checked against it, the continuum's own sentence about this depth,
   and each property's bestFor — prompts to their experience, hidden in
   the open. The client sees the arc; the advisor tells the story. */
function shapeStage(v) {
  const { id, ranked, session, caps, shortlist, need, frameworks, chosenProps, recipe, plan } = v;
  const recipeKey = session && session.recipe_key;
  return arcBlock(id, plan, chosenProps || {}, need, recipe, frameworks, caps)
    + shape(id, ranked, recipeKey, caps)
    + narrative(id, shortlist, caps, recipeKey);
}

const INTENSITY_WORD = { rest: 'Rest', low: 'Low', medium: 'Medium', high: 'High' };

function arcBlock(id, plan, props, need, recipe, fw, caps) {
  const nights = need && need.nights;
  if (!plan) {
    return `<section class="design-block design-arcblock">
  <h2>The shape of the week</h2>
  <p class="design-empty">${nights ? 'No days yet.' : 'How many nights? Set that on <a href="/hub/journeys/' + esc(id) + '/design?step=understand#consult">Understand</a> and the days appear here.'}</p>
</section>`;
  }
  /* The alternate rule is Active Recovery's own sentence; read it off the recipe rather than a key. */
  const flags = S.pacingFlags(plan, { alternate: Boolean(recipe && /^alternate/i.test(recipe.pacing || '')) });
  const depthKey = need && (need.continuumCeiling || need.continuumFloor);
  const rung = depthKey && ((fw && fw.continuum) || []).find((r) => r.key === depthKey);
  const chosen = Object.keys(props);

  return `<section class="design-block design-arcblock">
  <h2>${esc(String(plan.days.length))} nights, day by day</h2>
  <div class="design-arcwrap">
    <div data-fragment-slot="arc">${arc(plan, props, need, recipe)}</div>
    <aside class="design-cues">
      ${recipe && recipe.ask ? `<p class="design-cue-ask">${esc(recipe.ask)}</p>` : ''}
      ${recipe && recipe.pacing ? `<p class="design-cue-rule"><b>The rule</b> ${esc(recipe.pacing)}</p>` : ''}
      ${rung && rung.plan ? `<p class="design-cue-depth"><b>${esc(rung.name)} in a day</b> ${esc(rung.plan)}</p>` : ''}
      ${flags.length ? `<ul class="design-cue-flags">${flags.map((f) => `<li>${esc(f.text)}</li>`).join('')}</ul>`
        : `<p class="design-cue-ok">Paced within the guide’s rules.</p>`}
      <p class="design-cue-inferred">Intensity bands are inferred from each property’s verified offer until confirmed.</p>
    </aside>
  </div>

  <div class="design-days">
    ${plan.days.map((d) => dayEditor(id, d, props, chosen, caps)).join('')}
  </div>
</section>`;
}

/* The arc itself. Re-rendered whole by actionDay for the live swap. */
function arc(plan, props, need, recipe) {
  const days = plan.days;
  const spans = S.phaseSpans(days);
  const vk = (slug) => { const p = props[slug]; return p ? villageFor(p, need) : null; };
  return `<div class="design-arc" style="--days: ${days.length}">
    <p class="design-sr">${esc(arcSummary(days, props))}</p>
    <ol class="design-arc-phases">${spans.map((s) => `<li style="grid-column: ${s.from + 1} / ${s.to + 1}">${esc(s.label || '')}</li>`).join('')}</ol>
    <ol class="design-arc-days">${days.map((d) => {
      const k = vk(d.property);
      const accent = k ? ` style="--v: var(--v-${esc(k)}); --v-ink: var(--v-${esc(k)}-ink)"` : '';
      const band = d.intensity || 'unset';
      return `<li class="design-arc-day is-${esc(band)}${d.edited ? ' is-edited' : ''}" id="arc-day-${d.n}"${accent}>
        <a class="design-arc-col" href="#day-${d.n}" aria-label="Day ${d.n}, ${esc(INTENSITY_WORD[band] || 'intensity not set')}">
          <span class="design-arc-bar"><span class="design-arc-word">${esc(INTENSITY_WORD[band] || 'not set')}</span></span>
        </a>
        <span class="design-arc-n">Day ${d.n}</span>
        <span class="design-arc-prop">${d.property && props[d.property] ? esc(props[d.property].name) : '<span class="design-arc-none">no place</span>'}</span>
        ${d.note ? `<span class="design-arc-note">${esc(d.note)}</span>` : ''}
      </li>`; }).join('')}</ol>
  </div>`;
}

function arcSummary(days, props) {
  return days.map((d) => 'Day ' + d.n + ': ' + (INTENSITY_WORD[d.intensity] || 'not set')
    + (d.property && props[d.property] ? ' at ' + props[d.property].name : '')).join('. ');
}

/* One day's form. Native controls, one submit; with JavaScript, saves on
   change and swaps the arc. "Draft a note" is day_note's button at last. */
function dayEditor(id, d, props, chosen, caps) {
  const p = d.property && props[d.property];
  return `<details class="design-day" id="day-${d.n}">
    <summary><span class="design-day-n">Day ${d.n}</span> <span class="design-day-sum">${esc(d.phaseText || 'No phase')} · ${esc(INTENSITY_WORD[d.intensity] || 'intensity not set')}${p ? ' · ' + esc(p.name) : ''}</span></summary>
    <form method="POST" action="/hub/journeys/${esc(id)}/design?step=shape" class="design-day-form" data-live data-fragment="arc" data-day="${d.n}">
      <input type="hidden" name="action" value="day">
      <input type="hidden" name="day" value="${d.n}">
      <fieldset class="design-q"><legend>Where</legend>
        <div class="design-picks design-picks--seg">${chosen.map((s) => `<label class="design-pick"><input type="radio" name="property" value="${esc(s)}"${d.property === s ? ' checked' : ''}><span>${esc(props[s] ? props[s].name : s)}</span></label>`).join('')}
          ${chosen.length ? '' : '<span class="design-hint">Carry a place on Compare first.</span>'}</div></fieldset>
      <fieldset class="design-q"><legend>How much is asked of them</legend>
        <div class="design-picks design-picks--seg design-picks--band">${S.BANDS.map((b) => `<label class="design-pick"><input type="radio" name="intensity" value="${b}"${d.intensity === b ? ' checked' : ''}><span>${esc(INTENSITY_WORD[b])}</span></label>`).join('')}</div>
        ${p && p.intensity && p.intensity.typical ? `<p class="design-hint">${esc(p.name)} is typically ${esc(p.intensity.typical.join('–'))}${p.intensity.available ? ', with ' + esc(p.intensity.available.join('–')) + ' available' : ''} <em>(inferred)</em>.</p>` : ''}
      </fieldset>
      ${p && p.bestFor ? `<p class="design-day-best"><b>${esc(p.name)} is best for</b> ${esc(p.bestFor)}</p>` : ''}
      <fieldset class="design-q"><legend>A line for this day</legend>
        <textarea name="note" rows="2" maxlength="${S.NOTE_MAX}" data-day-note placeholder="What this day is for them — in your words, or ask for a draft to react to.">${esc(d.note || '')}</textarea>
        <input type="hidden" name="noteSource" value="${esc(d.noteSource || 'advisor')}" data-day-note-source>
        <div class="design-actions">
          <button type="button" class="btn btn--ghost btn--sm" data-daynote data-day-key="${esc(d.phase || 'day' + d.n)}" data-day-label="Day ${d.n}" data-day-text="${esc(d.phaseText || '')}">Draft a line</button>
          <span class="design-hint" data-daynote-status role="status"></span>
        </div>
        <p class="design-daynote-out" data-daynote-out hidden></p>
      </fieldset>
      <div class="design-actions">
        <button class="btn btn--sm" type="submit"${caps.consultation ? '' : ' disabled'}>Save day ${d.n}</button>
        <span class="design-hint" data-live-status role="status">${caps.consultation ? '' : esc(D.UNAVAILABLE.consultation)}</span>
      </div>
    </form>
  </details>`;
}

/* ── Stage 4 · Send ───────────────────────────────────────────────────────
   Review the week, put figures beside it, read the document as it will
   issue, then issue. The estimate is arithmetic over a dated lookup plus
   the advisor's own hand — never a model's — and the client sees it as a
   range labelled not a quote. The client may see the review and the
   estimate (the client is meant to see both) and hides the edit affordances,
   the provenance and the issue apparatus. */
function sendStage(v) {
  const { id, shortlist, session, caps, issued, plan, chosenProps, need, recipe, estimate, previewDoc, brand } = v;
  const recipeKey = session && session.recipe_key;
  return reviewBlock(plan, chosenProps || {}, need, recipe)
    + estimateBlock(id, estimate, caps, v.travelFrom)
    + previewBlock(previewDoc, brand)
    + issue(id, shortlist, caps, recipeKey, v.clientEmail)
    + issuedVersions(id, issued || [], caps);
}

function reviewBlock(plan, props, need, recipe) {
  if (!plan) return `<section class="design-block"><h2>The week</h2><p class="design-empty">No days laid yet — set the nights on Understand and lay the arc on Shape.</p></section>`;
  return `<section class="design-block design-review">
  <h2>The week, as it stands</h2>
  ${arc(plan, props, need, recipe)}
</section>`;
}

const CONF_WORD = { 'OBSERVED PUBLIC RATE': 'public rate', 'PUBLISHED TARIFF': 'published', 'QUOTE / CONFIRM': 'to confirm', ADVISOR: 'yours' };

function estimateBlock(id, est, caps, travelFrom) {
  if (!est) return '';
  const lines = est.lines.concat(est.custom || []);
  const cell = (l) => `<tr class="design-est-row kind-${esc(l.kind)}${l.edited ? ' is-edited' : ''}${l.confidence === E.QUOTE ? ' is-quote' : ''}">
      <th scope="row"><span class="design-est-label">${esc(l.label)}</span>${l.unit ? `<span class="design-est-unit">${esc(l.unit)}</span>` : ''}${l.why ? `<span class="design-est-why">${esc(l.why)}</span>` : ''}</th>
      <td class="design-est-figs"><label><span class="design-sr">from</span><input type="text" inputmode="numeric" name="from:${esc(l.key)}" value="${l.from == null ? '' : esc(String(l.from))}" placeholder="—"${l.kind === 'custom' ? ' readonly' : ''}></label>
        <span class="design-est-dash">–</span>
        <label><span class="design-sr">to</span><input type="text" inputmode="numeric" name="to:${esc(l.key)}" value="${l.to == null ? '' : esc(String(l.to))}" placeholder="—"${l.kind === 'custom' ? ' readonly' : ''}></label></td>
      <td class="design-est-conf"><span class="design-est-word">${esc(CONF_WORD[l.confidence] || l.confidence)}</span>${l.observed ? `<span>seen ${esc(l.observed)}</span>` : ''}${l.source ? `<a href="${esc(l.source)}" target="_blank" rel="noopener">source</a>` : ''}</td>
    </tr>`;
  return `<section class="design-block design-estimate" id="estimate">
  <h2>What it might cost</h2>
  <p class="design-note">${esc(E.header(est))}${travelFrom ? '' : ' No travel month is set on Understand, so each line shows the year’s span rather than a season.'}</p>
  <form method="POST" action="/hub/journeys/${esc(id)}/design?step=send" class="design-est-form" data-live data-fragment="est-total">
    <input type="hidden" name="action" value="estimate">
    <table class="design-est">
      <thead><tr><th scope="col">Line</th><th scope="col">From – to (USD)</th><th scope="col">Basis</th></tr></thead>
      <tbody>${lines.map(cell).join('')}</tbody>
      <tfoot><tr><th scope="row">Estimated total</th><td colspan="2" data-fragment-slot="est-total">${estimateTotal(est)}</td></tr></tfoot>
    </table>
    <details class="design-est-add">
      <summary>Add a line</summary>
      ${[0, 1, 2].map((n) => `<div class="design-est-addrow"><input type="text" name="custom_label" placeholder="What it is" maxlength="80" value="${esc(((est.custom || [])[n] || {}).label || '')}">
        <input type="text" inputmode="numeric" name="custom_from" placeholder="from" value="${((est.custom || [])[n] || {}).from == null ? '' : esc(String(est.custom[n].from))}">
        <input type="text" inputmode="numeric" name="custom_to" placeholder="to" value="${((est.custom || [])[n] || {}).to == null ? '' : esc(String(est.custom[n].to))}"></div>`).join('')}
      <p class="design-hint">Clear a line’s figures to go back to the public rate. Anything you type is marked as yours.</p>
    </details>
    <div class="design-actions">
      <button class="btn btn--sm" type="submit"${caps.estimate ? '' : ' disabled'}>Save figures</button>
      <span class="design-hint" data-live-status role="status">${caps.estimate ? '' : 'Estimates need migration 023.'}</span>
    </div>
  </form>
</section>`;
}

/* The total cell alone, so the live save swaps one thing. */
function estimateTotal(est) {
  const tot = est.total || {};
  return `<b class="design-est-total">${esc(E.range(tot.from, tot.to))}</b> <span class="design-est-sub">${tot.complete ? 'all lines included' : (tot.missing || 0) + (tot.missing === 1 ? ' line' : ' lines') + ' still to confirm'}</span>`;
}

/* The document as it would issue, through the one renderer. */
function previewBlock(doc, brand) {
  if (!doc) return '';
  return `<section class="design-block design-preview">
  <details class="design-why"><summary>Preview the document as it will issue</summary>
    <div class="design-preview-frame">${renderDocument(doc, brand, { preview: true })}</div>
  </details>
</section>`;
}

/* ── Stage 1 · Understand ─────────────────────────────────────────────────
   design-understand.js. What the Finder recorded, read back beside the island,
   then seven questions as a conversation and one paragraph that says what was
   heard. It is the consultation editor, and so the first writer of
   seeded_from and advisor_overrode with real content. */
function understandStage(v) { return U.understandStage(v); }

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

  <div class="design-mismatch">
    <h4>What is wrong with it</h4>
    <ul>${worst.map((m) => `<li class="sev-${esc(m.severity)}">${esc(m.sentence)}${
      m.evidence ? `<span class="design-ev">${esc(m.evidence)}</span>` : ''}</li>`).join('')}</ul>
  </div>

  <p class="design-verified">Last verified ${esc(c.verified_at || '—')}</p>
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
function narrative(id, shortlist, caps, chosen) {
  const slugs = shortlist.slice(0, 3).map((c) => c.slug).join(',');
  return `<section class="design-block" data-narrative data-share="${esc(id)}" data-slugs="${esc(slugs)}"
    data-recipe="${esc(chosen || '')}">
  <h2>A paragraph to read aloud</h2>
  <p class="design-note">Written from the codes
    above and the places you have shortlisted — never from anything ${esc("they")} typed. Yours to
    change; it is a draft, not an answer.</p>

  <div class="design-narr">
    <textarea class="design-narr-body" rows="7" data-narr-text
      placeholder="Write it yourself, or ask for a draft to react to."></textarea>
    <div class="design-narr-flags" data-narr-flags hidden></div>
    <div class="design-actions">
      <button type="button" class="btn btn--ghost btn--sm" data-narr-go>Draft a paragraph</button>
      <span class="design-hint" data-narr-status role="status"></span>
    </div>
  </div>

  ${caps.consultation ? '' : `<p class="design-hint">This will not be saved
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

   IN THE OPEN. The client is watching this screen; "Issue" and a
   raw share link are the advisor's apparatus, not part of the conversation. */
function issue(id, shortlist, caps, chosen, clientEmail) {
  const slugs = shortlist.slice(0, 3).map((c) => c.slug).join(',');
  return `<section class="design-block design-issue"
    data-issue data-share="${esc(id)}" data-slugs="${esc(slugs)}"
    data-recipe="${esc(chosen || '')}">
  <h2>Send it</h2>
  <p class="design-note">Freezes what is on this screen into a document and gives you a link
    to send. The link can be withdrawn later; what it points at cannot be edited, so issuing
    again makes a new version rather than changing this one.</p>

  <form method="POST" action="/hub/journeys/${esc(id)}/design?step=send" data-issue-form>
  <input type="hidden" name="action" value="issue">
  <input type="hidden" name="slugs" value="${esc(slugs)}">
  <input type="hidden" name="recipe" value="${esc(chosen || '')}">
  <div class="design-issue-fields design-issue-fields--one">
    <label class="hub-field hub-field--wide">
      <span class="hub-field-label">A note from you (optional)</span>
      <textarea rows="3" name="note" data-issue-note
        placeholder="The thing only you know. Appears in your name, unchanged."></textarea>
    </label>
    ${clientEmail ? `<label class="design-issue-email"><input type="checkbox" name="email" data-issue-email checked>
      <span>Also email the link to <b>${esc(clientEmail)}</b> — from journeys@, copied to you, replies come to you. Issue again to send again.</span></label>`
      : `<p class="design-hint">This Journey has no email address, so the link can only be copied.</p>`}
  </div>

  <div class="design-actions">
    <button type="submit" class="btn btn--gold btn--sm" data-issue-go${
      caps.itinerary ? '' : ' disabled'}>Issue this plan</button>
    <span class="design-hint" data-issue-status role="status">${
      caps.itinerary ? '' : esc(D.UNAVAILABLE.itinerary)}</span>
  </div>

  ${/* Filled in by the client once, and never re-fetched. The server does not
       hold this value in any readable form after the response. */''}
  <div class="design-issued" data-issue-result hidden></div>
  </form>
</section>`;
}

/* One line, said once, at the top. Every outcome an action can have needs a
   sentence here or the redirect lands silently and the advisor cannot tell
   whether anything happened. */
const DONE = {
  withdrawn: ['good', 'Withdrawn. That link stops working immediately.'],
  withdraw_failed: ['bad', 'That could not be withdrawn. Reload and check which versions are live — it may already be gone, or belong to a Journey that has moved.'],
  not_migrated: ['bad', 'Issuing is not available on this deployment yet.'],
  saved: ['good', 'Saved. The shortlist and the shape now know this.'],
  bad_consult: ['bad', 'Something in that could not be saved as written. Nothing changed.'],
  consult_failed: ['bad', 'That could not be saved. Nothing changed.'],
  carried: ['good', 'Carried into the shape.'],
  carried_none: ['good', 'Nothing carried yet — pick up to three when you are ready.'],
  too_many: ['bad', 'Three at most. Put one aside first.'],
  choose_failed: ['bad', 'That could not be recorded. Nothing changed.'],
  declined: ['good', 'Put aside, and the reason kept.'],
  shape: ['good', 'Arc chosen. The days are laid out below.'],
  day_saved: ['good', 'Saved. The arc follows it.'],
  bad_day: ['bad', 'That day could not be saved as written. Nothing changed.'],
  day_failed: ['bad', 'That day could not be saved. Nothing changed.'],
  no_nights: ['bad', 'Set the nights on Understand first — there are no days to edit yet.'],
  estimate_saved: ['good', 'Figures saved. The document will carry them, marked as yours.'],
  issued_emailed: ['good', 'Issued and emailed. The link is in their inbox, copied to you.'],
  issued_not_emailed: ['bad', 'Issued, but the email did not go. The link is live — open the version below and send it yourself.'],
  issue_needs_email: ['bad', 'With JavaScript off the link can only be emailed — tick the box and issue again.'],
  issue_no_address: ['bad', 'This Journey has no email address, so with JavaScript off there is no way to hand over the link.'],
  issue_not_ready: ['bad', 'Not ready to issue yet — it still needs a place, a shape and the two paragraphs.'],
  issue_failed: ['bad', 'That could not be issued. Nothing has been sent.'],
  estimate_failed: ['bad', 'Those figures could not be saved. Nothing changed.'],
  no_estimate_column: ['bad', 'Estimates need migration 023 on this deployment.'],
  shape_cleared: ['good', 'Cleared. The days will just be numbered.'],
  shape_failed: ['bad', 'That shape could not be saved, so nothing changed.'],
  bad_recipe: ['bad', 'That is not one of the shapes in the guide. Nothing changed.'],
  readonly: ['bad', 'Nothing was changed — you are viewing this Hub, not signed in as its owner.'],
  story_saved: ['good', 'Your note about the place is saved. It is yours alone.'],
  story_failed: ['bad', 'That note could not be saved. Nothing changed.'],
  story_not_migrated: ['bad', 'Notes about places need migration 025 on this deployment.'],
  heard_sent: ['good', 'Sent. What you heard is in their inbox, copied to you.'],
  heard_failed: ['bad', 'That could not be sent. Read it aloud, or try again in a moment.'],
  heard_nothing: ['bad', 'Nothing is marked yet, so there is nothing to send.'],
  heard_no_email: ['bad', 'This Journey has no email address, so what you heard can only be read aloud.'],
  heard_not_configured: ['bad', 'Email is not configured on this deployment.']
};

/* ── The shape of the journey ─────────────────────────────────────────────
   Six recipes sit in the bank. Until this existed, no screen could pick one,
   so every issued document had numbered days and nothing else — the pinned-
   ends-stretch-the-middle logic in design-itinerary.js never ran.

   RANKED, NEVER PRE-SELECTED. design-match.js scores them on the same three
   axes as a property and returns them in order with bands; nothing is chosen
   until the advisor chooses it. A bare list of six gets picked by position,
   and a silently-applied shape is exactly "a value they have to notice and
   undo" — the thing this screen refuses to do for the fields six Finder
   answers cannot know.

   "Number the days" is a real option, not an absence. Some journeys genuinely
   have no shape yet, and design-itinerary.js accepts that deliberately.

   THE CHOSEN SHAPE LEADS AND THE COMPARISON FOLLOWS. The week is
   what the advisor talks through with the prospect; the six-way ranking and
   the Partial/Thin bands are apparatus.

   A plain form. No JavaScript required, and none used. */
function shape(id, ranked, chosen, caps) {
  if (!ranked.length) return '';
  const picked = ranked.filter((r) => r.key === chosen)[0] || null;

  return `<section class="design-block design-shape">
  <h2>Which arc</h2>

  ${picked ? `<div class="design-shape-picked">
    <p class="design-shape-name">${esc(picked.name)}</p>
    ${picked.sub ? `<p class="design-note">${esc(picked.sub)}</p>` : ''}
  </div>` : `<p class="design-empty">No shape chosen — the days will be
    numbered and empty. Pick one below, or leave it if this journey does not have a shape yet.</p>`}

  <form method="POST" action="/hub/journeys/${esc(id)}/design">
    <input type="hidden" name="action" value="recipe">
    <p class="design-note">Ranked against what they told the Finder. Nothing is chosen for you.</p>
    <ul class="design-recipes">
      ${ranked.map((r) => `<li>
        <label class="design-recipe">
          <input type="radio" name="recipe" value="${esc(r.key)}"${r.key === chosen ? ' checked' : ''}>
          <span class="design-recipe-name">${esc(r.name)}</span>
          <span class="design-recipe-arc" aria-hidden="true">${(r.rhythm || []).map((ph) => `<i class="is-${esc(ph.intensity || 'unset')}" title="${esc(ph.label)}: ${esc(ph.intensity || 'not set')}"></i>`).join('')}</span>
          <span class="design-recipe-bands">${
            [['place', 'Places'], ['direction', 'Direction'], ['depth', 'Depth']].map(([k, ax]) => `<b class="band-${esc(r.bands[k])}"><span>${ax}</span>${
              esc(BAND_WORD[r.bands[k]] || r.bands[k])}</b>`).join('')}</span>
          ${r.matched.length ? `<span class="design-recipe-why">${esc(r.matched.join(' · '))}</span>` : ''}
        </label>
      </li>`).join('')}
      <li>
        <label class="design-recipe">
          <input type="radio" name="recipe" value=""${chosen ? '' : ' checked'}>
          <span class="design-recipe-name">Number the days</span>
          <span class="design-recipe-why">No shape yet. The document will list the nights and nothing more.</span>
        </label>
      </li>
    </ul>
    <button class="btn btn--ghost btn--sm" type="submit"${caps.consultation ? '' : ' disabled'}>Lay the days this way</button>
    ${caps.consultation ? '' : `<span class="design-hint">${esc(D.UNAVAILABLE.consultation)}</span>`}
  </form>
</section>`;
}

function flash(done) {
  const hit = DONE[done];
  if (!hit) return '';
  return `<p class="hub-flash${hit[0] === 'bad' ? ' hub-flash--bad' : ''}">${esc(hit[1])}</p>`;
}

/* ── What has already been sent ───────────────────────────────────────────
   The only place an advisor can see that a client is holding something, and
   the only place they can take it back.

   THE LINK IS NOT HERE, AND THE BLOCK SAYS SO. design-data.js keeps a sha256
   and nothing else, so there is no readable copy to show — an advisor who
   lost it will look here first, and silence would read as a bug rather than
   as the design.

   "Opened three times, last Tuesday" is the sentence 022 writes as the reason
   the counter exists at all: useful to an advisor, and it identifies nobody.

   IN THE OPEN. A live share link and a Withdraw button are the
   last things that should be on screen with the client watching. */
function issuedVersions(id, issued, caps) {
  if (!caps.itinerary) {
    return `<section class="design-block design-issued-list">
  <h2>Already sent</h2>
  <p class="design-note">${esc(D.UNAVAILABLE.itinerary)}</p>
</section>`;
  }
  if (!issued.length) return '';

  return `<section class="design-block design-issued-list">
  <h2>Already sent</h2>
  <p class="design-note">The link itself cannot be shown again — nothing here holds a readable
    copy of it. If it has been lost, issue a new version.</p>
  <ul class="design-versions">${issued.map((r) => version(id, r)).join('')}</ul>
</section>`;
}

function version(id, r) {
  const dead = Boolean(r.revoked_at);
  const expired = r.share_expires_at && new Date(r.share_expires_at) < new Date();
  const views = Number(r.view_count || 0);

  return `<li class="design-version${dead ? ' is-dead' : ''}">
    <div>
      <p class="design-version-n">Version ${esc(String(r.version))}${
        dead ? ' — withdrawn' : expired ? ' — expired' : ''}</p>
      <p class="design-version-when">Issued ${esc(since(r.issued_at))}.${r.sent_at ? ' Emailed to the client ' + esc(since(r.sent_at)) + '.' : ' Not emailed — the link was copied.'} ${
        views === 0 ? 'Not opened yet.'
          : 'Opened ' + views + (views === 1 ? ' time' : ' times')
            + (r.last_viewed_at ? ', last ' + since(r.last_viewed_at) : '') + '.'}${
        r.share_expires_at && !dead ? ' The link stops working ' + esc(onDay(r.share_expires_at)) + '.' : ''}</p>
    </div>
    ${dead || expired ? '' : `<form method="POST" action="/hub/journeys/${esc(id)}/design">
      <input type="hidden" name="action" value="revoke">
      <input type="hidden" name="itinerary" value="${esc(r.id)}">
      <button class="btn btn--ghost btn--sm" type="submit" data-revoke>Withdraw version ${
        esc(String(r.version))}</button>
      <span class="design-hint">The link stops working immediately and cannot be turned back on.</span>
    </form>`}
  </li>`;
}

const onDay = (iso) => { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return 'later'; } };

/* ── The rest of the village ─────────────────────────────────────────────── */
function alsoIn(villageKey, also, vocab) {
  const rows = (also.supporting || []).concat(also.basecamps || []);
  if (!villageKey || !rows.length) return '';
  const label = (vocab.villages || []).filter((v) => v.key === villageKey)[0];
  return `<section class="design-block">
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
