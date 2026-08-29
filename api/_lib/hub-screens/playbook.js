/* ============================================================================
   /hub/campaign/playbook — the Advisor Playbook
   ----------------------------------------------------------------------------
   Everything the system knows about how one advisor should go to market, in one
   document they can read end to end and print.

   ── WHY IT IS A DOCUMENT AND NOT A DASHBOARD ──────────────────────────────
   The rest of the Hub is a working surface: lists, filters, controls, things
   you come back to. This is meant to be read once, properly, and then kept.
   docs/bible-feedback.md §2.1 is the reason it exists — the campaign engine is
   input-limited rather than model-limited, and an advisor cannot improve inputs
   they have never seen assembled. A dashboard shows you fields. A document
   shows you what your answers add up to, which is the only form in which the
   gaps are obvious.

   ── IT ASSEMBLES. IT DOES NOT GENERATE ────────────────────────────────────
   No model is called anywhere in this file. Day 1 and Day 2 come from
   gtm_profile, Day 3 from gtm_plan.skeleton, and everything around them from
   the doctrine bank — which is a committed file whose governance is the git
   diff. The only prose here that a model wrote is the plan skeleton, which was
   already generated, already claim-checked, and is quoted rather than rewritten.

   ── THE GAPS ARE THE POINT ────────────────────────────────────────────────
   A section with nothing in it says what is missing, why it costs something,
   and where to go and fill it. It is never hidden and never filled with a
   plausible default. An advisor reading a Playbook that quietly omits its empty
   half learns nothing; one reading "your campaign is writing for everybody
   because it does not know who you are for" learns the only thing that would
   change their results.

   ── DAY 2 IS FILLED HERE ──────────────────────────────────────────────────
   The icp_* columns arrived with migration 022 and nothing wrote them, so the
   priority-traveller section had a schema and no way to fill it. The form is on
   this screen rather than bolted onto /hub/campaign/profile, which is a
   deliberate one-question-per-screen conversation and would be the wrong place
   to append eight more fields.

   It uses the SAME vocabulary as a consultation — need-state.js — which is the
   whole payoff of building the two together: WELL Campaign can eventually
   target the need-states an advisor actually converts, because the campaign's
   ICP and the consultation now speak one language.

   ── PRINTING ──────────────────────────────────────────────────────────────
   css/hub.css carries the print rules. There is no PDF generator and no
   JavaScript on this page: an advisor prints it the way they print anything.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc, emptyState } = require('../hub-render.js');
const { profileFor, saveIcp, currentPlan, gapReport, rung } = require('../gtm.js');
const { CLASSES, DEFAULT: DEFAULT_CLASS } = require('../capacity.js');
const N = require('../need-state.js');
/* Three levels. api/_lib/gtm-generate.js reaches content/ with ../../ because it
   sits one directory higher; copying that path into a screen lands on
   api/content/ and 500s the route on every request. Second time in this feature
   — see the same note in itinerary.js about lib/page.js. */
const PLAYBOOK = require('../../../content/marketing-playbook.js');

/* The Day 2 columns, and the vocabulary dimension each one is drawn from.
   Written out rather than derived so that adding a column is a deliberate act
   with a diff — the same rule design-need.js follows for the same reason. */
const ICP_FIELDS = [
  { col: 'icp_current_states', dim: 'current', multi: true,
    label: 'What they are moving away from',
    why: 'The campaign writes to a state, not to a demographic.' },
  { col: 'icp_desired_states', dim: 'desired', multi: true,
    label: 'What they are moving toward',
    why: 'This is the promise the copy is allowed to make.' },
  { col: 'icp_trigger', dim: 'trigger', multi: false,
    label: 'Why they start looking now',
    why: 'Timing is what turns a reader into an enquiry.' },
  { col: 'icp_uncertainty', dim: 'uncertainty', multi: false,
    label: 'What stops them booking',
    why: 'The objection your copy has to answer before it is raised.' },
  { col: 'icp_readiness', dim: 'readiness', multi: false,
    label: 'How far along they usually are',
    why: 'Decides whether a piece should teach or ask.' },
  { col: 'icp_party', dim: 'party', multi: false,
    label: 'Who they travel with',
    why: 'Changes the room, the pace and the price conversation.' },
  { col: 'icp_budget', dim: 'budget', multi: false,
    label: 'Roughly where they sit',
    why: 'Kept as a band, never a number, and never shown to a client.' }
];

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/campaign/playbook');
  if (!advisor) return;

  if (req.method === 'POST') return await save(req, res, advisor);

  const profile = await profileFor(advisor.id);
  const plan = await currentPlan(advisor.id);
  const vocab = await N.vocabulary();
  const gaps = gapReport(profile);

  hubPage(res, {
    path: '/hub/campaign',
    title: 'Your Playbook',
    advisor,
    body: buildBody({
      advisor, profile: profile || {}, plan, vocab, gaps,
      saved: str(new URL(req.url, 'https://x').searchParams.get('done'), 20) === 'icp'
    })
  });
};

/* ── Saving Day 2 ─────────────────────────────────────────────────────────
   VIEW-AS REFUSES, in the handler rather than by hiding the form. Same rule as
   every other write in the Hub: staff supporting an advisor may read their
   Playbook, and must not put an ICP into it that the advisor will later act on
   believing it was their own answer.

   Values are validated against the vocabulary and anything unrecognised is
   dropped. These columns feed campaign prompts, so the same rule applies here
   as at the design projection: a text column with no CHECK constraint is only
   as clean as the code writing to it. */
async function save(req, res, advisor) {
  if (advisor.viewingAs) {
    res.statusCode = 303;
    res.setHeader('Location', '/hub/campaign/playbook?done=readonly');
    return res.end();
  }

  const form = parseBody(req) || {};
  const vocab = await N.vocabulary();
  const patch = {};

  ICP_FIELDS.forEach((f) => {
    const allowed = {};
    (vocab[f.dim] || []).forEach((o) => { allowed[o.key] = true; });

    if (f.multi) {
      const raw = form[f.col];
      const list = (Array.isArray(raw) ? raw : String(raw || '').split(','))
        .map((v) => str(v, 40)).filter((v) => allowed[v]).slice(0, 6);
      patch[f.col] = list.length ? list.join(',') : null;
    } else {
      const v = str(form[f.col], 40);
      patch[f.col] = allowed[v] ? v : null;
    }
  });

  /* saveIcp, not saveProfile: saveProfile copies only what is in FIELDS, so
     every value here would have been dropped while the page said Saved. */
  await saveIcp(advisor.id, patch);

  /* POST/redirect/GET, so a refresh never re-submits and the form works with
     JavaScript switched off — which it has to, because there is none here. */
  res.statusCode = 303;
  res.setHeader('Location', '/hub/campaign/playbook?done=icp');
  return res.end();
}

/* ── The document ─────────────────────────────────────────────────────────
   Exported so tools/hub-preview.js can render THIS against fixtures rather
   than a second template that agrees with it until somebody edits one. */
function buildBody(v) {
  const { advisor, profile, plan, vocab, gaps, saved } = v;

  return `<div class="hub-main playbook">
  <div class="wrap wrap--narrow">

    ${saved ? '<p class="hub-flash">Saved. Your next campaign will use it.</p>' : ''}

    <p class="hub-back"><a href="/hub/campaign">← Campaign</a></p>

    <header class="pb-head">
      <p class="eyebrow">Advisor Playbook</p>
      <h1>${esc([advisor.first_name, advisor.last_name].filter(Boolean).join(' ') || 'Your')} Playbook</h1>
      <p class="pb-sub">Everything WELL Campaign knows about how you go to market, and what it
        is still guessing at. Nothing on this page was written by a machine except the plan
        itself, which is quoted as it was generated.</p>
      <p class="pb-print">Printing this gives you the whole thing on paper — there is no
        download, because a file goes stale and this does not.</p>
    </header>

    ${whoYouAreFor(profile, gaps)}
    ${priorityTraveller(profile, vocab)}
    ${howYouShowUp(profile)}
    ${whatYouCanSustain(profile)}
    ${yourChannels(profile)}
    ${thePlan(plan)}
    ${neverSay(advisor)}

    <footer class="pb-foot">
      <p class="pb-prov">Doctrine ${esc(PLAYBOOK.provenance.edition || 'unversioned')} ·
        ${esc(String(PLAYBOOK.provenance.patternCount || 0))} patterns ·
        generated ${esc(PLAYBOOK.provenance.generated || '—')}</p>
    </footer>

  </div>
</div>`;
}

/* ── 1. Who you are for ───────────────────────────────────────────────────
   Day 1. Every field it needs already exists; what it adds is the cost of the
   ones that are empty, quoted from gtm.js's own GAPS table so there is one
   statement of what a missing field costs rather than two. */
function whoYouAreFor(p, gaps) {
  const rows = [
    ['Who you are for', p.icp],
    ['What you actually sell', p.positioning],
    ['Why you rather than anyone else', p.differentiator],
    ['Where your clients are', p.markets],
    ['What you specialise in', p.specialties],
    ['Clients you have actually served', p.client_examples]
  ].filter(([, val]) => String(val || '').trim());

  const missing = (gaps && gaps.missing) || [];

  return `<section class="pb-block">
  <h2>Your business</h2>
  ${rows.length ? `<dl class="pb-facts">
    ${rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join('')}
  </dl>` : '<p class="pb-empty">Nothing here yet.</p>'}

  ${missing.length ? `<div class="pb-gap">
    <h3>What this is missing, and what it costs</h3>
    <ul>${missing.map((m) => `<li>
      <b>${esc(m.label)}</b>
      <span>${esc(m.costs)}</span>
    </li>`).join('')}</ul>
    <p><a href="/hub/campaign/profile">Answer these →</a></p>
  </div>` : ''}
</section>`;
}

/* ── 2. Your priority traveller ───────────────────────────────────────────
   Day 2, and the section that had a schema and no way to fill it. The form is
   plain: checkboxes and selects, one submit, no JavaScript. */
function priorityTraveller(p, vocab) {
  const label = (dim, key) => {
    const hit = (vocab[dim] || []).filter((o) => o.key === key)[0];
    return hit ? hit.label : key;
  };
  const values = (col) => String(p[col] || '').split(',').map((s) => s.trim()).filter(Boolean);

  const answered = ICP_FIELDS.filter((f) => values(f.col).length);
  const filled = answered.length === ICP_FIELDS.length;

  return `<section class="pb-block">
  <h2>Your priority traveller</h2>
  <p class="pb-note">Not everyone you would take — the one you convert, and would take more of.
    This is the same vocabulary a consultation uses, which is what lets a campaign aim at the
    people your Journey Finder actually turns into enquiries.</p>

  ${answered.length ? `<dl class="pb-facts">
    ${answered.map((f) => `<dt>${esc(f.label)}</dt><dd>${
      esc(values(f.col).map((k) => label(f.dim, k)).join(' · '))}</dd>`).join('')}
  </dl>` : ''}

  ${/* No repo paths in advisor-facing copy. An earlier draft cited
        docs/bible-feedback.md here as the source of the claim, which is a file
        the reader cannot open and reads as leaked developer text. The finding
        belongs in this file's header, where the person who can act on it is. */''}
  ${filled ? `<p class="pb-note pb-screen-only">
    <a href="#icp-form">Change any of this →</a></p>` : `<p class="pb-empty">
    ${answered.length ? 'The rest of this is blank.' : 'Nothing here yet.'}
    Until it is answered your campaign has to write to a kind of person rather than to a
    moment in their life, and that is the one thing most likely to be making your copy
    feel generic.</p>`}

  ${/* The form is hidden when printing: it is apparatus, not document. */''}
  <form class="pb-form pb-screen-only" id="icp-form" method="POST" action="/hub/campaign/playbook">
    <h3>${filled ? 'Change it' : 'Answer it'}</h3>
    ${ICP_FIELDS.map((f) => field(f, vocab, values(f.col), label)).join('')}
    <button class="btn btn--ghost btn--sm" type="submit">Save</button>
  </form>
</section>`;
}

function field(f, vocab, chosen, label) {
  const opts = vocab[f.dim] || [];
  const has = (k) => chosen.indexOf(k) !== -1;

  if (f.multi) {
    return `<fieldset class="pb-field">
      <legend>${esc(f.label)} <span>${esc(f.why)}</span></legend>
      <div class="pb-checks">
        ${opts.map((o) => `<label class="pb-check">
          <input type="checkbox" name="${esc(f.col)}" value="${esc(o.key)}"${has(o.key) ? ' checked' : ''}>
          <span>${esc(o.label)}</span>
        </label>`).join('')}
      </div>
    </fieldset>`;
  }

  return `<label class="pb-field">
    <span class="pb-field-label">${esc(f.label)} <span>${esc(f.why)}</span></span>
    <select name="${esc(f.col)}">
      <option value="">Not sure yet</option>
      ${opts.map((o) => `<option value="${esc(o.key)}"${has(o.key) ? ' selected' : ''}>${
        esc(o.label)}</option>`).join('')}
    </select>
  </label>`;
}

/* ── 3. How you show up ───────────────────────────────────────────────────
   The expression profile, joined to the doctrine's own description of it.

   `risks` AND `growthEdge` ARE WHY THIS IS WORTH PRINTING. A section that lists
   only an advantage is a horoscope, and campaign-profile.js already refuses to
   present the persona as a verdict for the same reason. The doctrine carries
   both halves; this shows both. (An earlier draft of this function read a field
   called `wrong`, which does not exist on any of the six profiles — it would
   have rendered nothing at all, silently, and the section would have been pure
   flattery without anybody noticing it was missing a half.) */
function howYouShowUp(p) {
  const find = (k) => (PLAYBOOK.expressionProfiles || []).filter((e) => e.key === k)[0] || null;
  const primary = find(p.expr_primary);
  const secondary = find(p.expr_secondary);

  if (!primary) {
    return `<section class="pb-block">
  <h2>How you show up</h2>
  ${/* No number here on purpose. build.js:175 checks every "N questions" in the
        emitted HTML against content/journey.js, because a count retyped into
        copy is a count that goes stale — it caught "Five questions" in this very
        sentence. The intake's length is not this page's fact to state, and the
        guard is right that the safe way to reference a count is not to. */''}
  <p class="pb-empty">Not read yet. A short set of questions decides it —
    <a href="/hub/campaign/profile">answer them</a> and this fills in.</p>
</section>`;
  }

  return `<section class="pb-block">
  <h2>How you show up</h2>
  <p class="pb-lead"><b>${esc(primary.name)}</b>${
    secondary ? ', with ' + esc(secondary.name) : ''}${
    p.expr_confirmed ? '' : ' — a read, not a verdict, and you have not confirmed it yet'}.</p>
  <dl class="pb-facts">
    <dt>Your advantage</dt><dd>${esc(primary.advantage)}</dd>
    ${primary.risks ? `<dt>How it goes wrong</dt><dd>${
      esc(Array.isArray(primary.risks) ? primary.risks.join(' · ') : primary.risks)}</dd>` : ''}
    ${primary.growthEdge ? `<dt>Your growth edge</dt><dd>${
      esc(Array.isArray(primary.growthEdge) ? primary.growthEdge.join(' · ') : primary.growthEdge)}</dd>` : ''}
    ${(primary.jobs || []).length
      ? `<dt>Jobs it does well</dt><dd>${esc(primary.jobs.join(' · '))}</dd>` : ''}
    ${(primary.signals || []).length
      ? `<dt>What it looks like</dt><dd>${esc(primary.signals.join(' · '))}</dd>` : ''}
    ${primary.voice ? `<dt>How it should sound</dt><dd>${
      esc(Array.isArray(primary.voice) ? primary.voice.join(' · ') : primary.voice)}</dd>` : ''}
  </dl>
</section>`;
}

/* ── 4. What you can actually sustain ─────────────────────────────────────
   capacity.js is the authority; this quotes it. A plan bigger than the advisor
   can run is the most common way a campaign fails, and it fails silently —
   nobody reports "I did not post". */
function whatYouCanSustain(p) {
  const c = CLASSES[p.capacity_class] || CLASSES[DEFAULT_CLASS];
  if (!c) return '';
  return `<section class="pb-block">
  <h2>What you can actually sustain</h2>
  <p class="pb-lead"><b>${esc(c.name)}</b> — ${esc(c.reality)}</p>
  <dl class="pb-facts">
    <dt>A week</dt><dd>${esc(String(c.perWeek))} pieces</dd>
    <dt>A campaign</dt><dd>${esc(String(c.total))} pieces from ${
      esc(String(c.sourceAssets))} source asset${c.sourceAssets === 1 ? '' : 's'}</dd>
    <dt>The shape</dt><dd>${esc(c.shape)}</dd>
    <dt>The rule</dt><dd>${esc(c.rule)}</dd>
  </dl>
  ${p.capacity_class ? '' : `<p class="pb-note">You have not set this, so the default is assumed.
    <a href="/hub/campaign/profile">Change it →</a></p>`}
</section>`;
}

/* ── 5. Your channels ─────────────────────────────────────────────────────
   Only the ones the advisor actually has. A playbook listing TikTok advice for
   somebody with no TikTok is padding, and padding is how a document stops being
   read. */
const CHANNEL_COLS = ['website', 'linkedin', 'instagram', 'facebook', 'tiktok', 'newsletter'];

function yourChannels(p) {
  const mine = CHANNEL_COLS.filter((c) => String(p[c] || '').trim());
  if (!mine.length) {
    return `<section class="pb-block">
  <h2>Your channels</h2>
  <p class="pb-empty">None recorded, so a plan has nowhere to put anything.
    <a href="/hub/campaign/profile">Add them →</a></p>
</section>`;
  }

  const doc = (name) => (PLAYBOOK.channels || []).filter((c) => c.channel === name)[0] || null;

  /* SEVERAL OF THESE FIELDS ARE ARRAYS, and putting one straight into a
     template stringifies it with commas — which read as sentence punctuation
     and turned LinkedIn's four-step anatomy into one run-on line ending
     "...at roughly two lines.,A professional frame on...". Anatomy keeps its
     order because it IS an order; the rest are joined deliberately. */
  const list = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean);
  const joined = (v, n) => list(v).slice(0, n || 3).join(' · ');

  /* The ones with doctrine first. A channel we have nothing to say about is
     still shown — hiding it would let an advisor think it was covered — but it
     belongs at the end rather than as the first thing under the heading. */
  const ordered = mine.slice().sort((a, b) => (doc(b) ? 1 : 0) - (doc(a) ? 1 : 0));

  return `<section class="pb-block">
  <h2>Your channels</h2>
  <p class="pb-note">What the doctrine says about each of the ones you have. Depth on two beats
    presence on four — see the rule above.</p>
  ${ordered.map((name) => {
    const d = doc(name);
    if (!d) return `<div class="pb-channel"><h3>${esc(name)}</h3>
      <p class="pb-seeded">No doctrine for this one yet — the Bible does not cover it.</p></div>`;
    return `<div class="pb-channel">
      <h3>${esc(name)}</h3>
      ${list(d.anatomy).length ? `<ol class="pb-anatomy">${
        list(d.anatomy).map((a) => `<li>${esc(a)}</li>`).join('')}</ol>` : ''}
      ${list(d.converts).length ? `<p class="pb-conv"><b>Works</b> ${
        esc(joined(d.converts))}</p>` : ''}
      ${list(d.kills).length ? `<p class="pb-kills"><b>Kills it</b> ${
        esc(joined(d.kills))}</p>` : ''}
      ${list(d.cta).length ? `<p class="pb-cta"><b>Ask</b> ${esc(joined(d.cta, 2))}</p>` : ''}
      ${d.source === 'seed' ? `<p class="pb-seeded">Seeded, not researched.</p>` : ''}
    </div>`;
  }).join('')}
</section>`;
}

/* ── 6. The plan ──────────────────────────────────────────────────────────
   Day 3. Quoted, never rewritten — it was generated under a frozen claims rung
   and re-rendering it through a second voice would put words in it that nothing
   checked. */
function thePlan(plan) {
  const sk = plan && plan.skeleton;
  if (!sk) {
    return `<section class="pb-block">
  <h2>The plan</h2>
  <p class="pb-empty">No campaign built yet. <a href="/hub/campaign">Build one →</a></p>
</section>`;
  }

  const weeks = Array.isArray(sk.weeks) ? sk.weeks : [];
  return `<section class="pb-block">
  <h2>The plan</h2>
  ${sk.premise ? `<p class="pb-lead">${esc(sk.premise)}</p>` : ''}
  ${weeks.length ? `<ol class="pb-weeks">
    ${weeks.map((w) => `<li>
      <p class="pb-week-n">Week ${esc(String(w.week || ''))}</p>
      <div>
        ${w.theme ? `<p class="pb-week-theme">${esc(w.theme)}</p>` : ''}
        ${(w.actions || []).length ? `<ul>${w.actions.map((a) => `<li>${
          esc(a.what || a.action || a.title || '')}${a.why ? ` <span>${esc(a.why)}</span>` : ''}
        </li>`).join('')}</ul>` : ''}
      </div>
    </li>`).join('')}
  </ol>` : ''}
  <p class="pb-note pb-screen-only"><a href="/hub/campaign">See the written pieces →</a></p>
</section>`;
}

/* ── 7. What you may never say ────────────────────────────────────────────
   Last on purpose. It is the section an advisor will look for when they are
   about to publish something and are not sure, so it should be the easiest to
   find by scrolling to the end — and on paper, it is the last page.

   Quoted from the doctrine bank, not restated here, because claims.js enforces
   the same list and two copies of a compliance rule is one copy too many. */
function neverSay(advisor) {
  const never = (PLAYBOOK.icp && PLAYBOOK.icp.NEVER_PROMISE) || [];
  if (!never.length) return '';
  return `<section class="pb-block pb-never">
  <h2>What you may never say</h2>
  <p class="pb-note">These are checked in code on everything the campaign writes, and they apply
    just as much to what you write yourself. Your current level is
    <b>${esc(rung(advisor))}</b>.</p>
  <ul>${never.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
</section>`;
}

module.exports.buildBody = buildBody;
module.exports.ICP_FIELDS = ICP_FIELDS;
