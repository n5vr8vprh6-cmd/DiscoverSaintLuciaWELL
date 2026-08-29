/* ============================================================================
   /j/:token — the document a client keeps
   ----------------------------------------------------------------------------
   The second deliberately-public screen on the Hub router, after waitlist.js.
   It has no advisor session and must not want one: the person reading this is
   not a user of anything, they are somebody a travel advisor sent a link to.

   It is here rather than in its own function for the reason the router exists —
   Vercel counts functions — and here rather than in the static build because it
   reads a database.

   ── EVERYTHING IT SHOWS IS FROZEN ─────────────────────────────────────────
   The whole page comes out of `document` and `brand`, snapshotted at issue.
   Nothing is re-resolved against the knowledge bank at read time. A property
   renamed next year, an advisor who changes agencies, a bank rebuild — none of
   them may alter a document somebody is already holding. See
   design-itinerary.js and the itinerary_frozen() trigger in 022.

   ── WHAT IS NOT ON THIS PAGE, ON PURPOSE ──────────────────────────────────
   No price. No availability. No option tree. No booking action. No mismatch,
   no watch-out. These are design decisions rather than policy, and together
   they are the reason this cannot drift into a self-serve booking tool: there
   is exactly one way forward from here and it is a named person.

   LAST VERIFIED does appear. It is honest, and it is the line that makes the
   advisor structurally necessary — a dated fact invites the one question only
   a person can answer.

   ── FOUR WAYS A LINK CAN BE DEAD, AND THEY ARE NOT THE SAME ───────────────
   Withdrawn, expired, never existed, not migrated. A 404 for a revoked
   document tells a client they were forgotten; "your advisor has withdrawn
   this" tells them to pick up the phone. Only "never existed" gets a 404, and
   it says nothing about what might have been there.

   ── COUNTED, NOT LOGGED ───────────────────────────────────────────────────
   A view increments a counter. There is no row per view, no IP, no user agent
   — deliberately nothing that could later be joined against anything else.
   ========================================================================== */
'use strict';

const { str } = require('../core.js');
const { esc } = require('../hub-render.js');
/* Three levels, not two: hub-render.js sits one directory higher and reaches
   lib/ with ../../, and copying that path from there lands on api/lib/. */
const { render } = require('../../../lib/page.js');
const D = require('../design-data.js');

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  /* base64url, so the character class is deliberately narrow. A token that
     could contain anything else was not one of ours. */
  const token = str(url.searchParams.get('t'), 120).replace(/[^A-Za-z0-9_-]/g, '');

  const found = await D.itineraryByToken(token);

  if (!found.ok) return gone(res, found.reason);

  const row = found.row;
  /* Counted before rendering, and never allowed to fail the page. */
  await D.recordView(row.id, row.view_count);

  const doc = row.document || {};
  const brand = row.brand || {};
  const who = [brand.first_name, brand.last_name].filter(Boolean).join(' ');

  const body = `<div class="itin">
  <div class="wrap wrap--narrow">

    <header class="itin-head">
      <p class="eyebrow">Prepared for you${who ? ' by ' + esc(who) : ''}</p>
      <h1>${esc(doc.title || 'A Saint Lucia WELL journey')}</h1>
      ${doc.recipe ? `<p class="itin-shape">${esc(doc.recipe.name)}${
        doc.recipe.sub ? ' — ' + esc(doc.recipe.sub) : ''}</p>` : ''}
    </header>

    ${doc.open ? `<div class="itin-open">${paras(doc.open)}</div>` : ''}

    ${(doc.days || []).length ? `
    <section class="itin-block">
      <h2>The shape of the ${doc.nights ? esc(String(doc.nights)) + ' nights' : 'days'}</h2>
      <ol class="itin-days">
        ${doc.days.map((d) => `<li>
          <p class="itin-day-n">${esc(d.label)}</p>
          <div>
            ${d.shape ? `<p class="itin-day-shape">${esc(d.shape)}</p>` : ''}
            ${d.note ? `<p class="itin-day-note">${esc(d.note)}</p>` : ''}
          </div>
        </li>`).join('')}
      </ol>
    </section>` : ''}

    ${(doc.places || []).length ? `
    <section class="itin-block">
      <h2>Where</h2>
      <ul class="itin-places">
        ${doc.places.map((p) => `<li>
          <h3>${esc(p.name)}</h3>
          ${p.hook ? `<p>${esc(p.hook)}</p>` : ''}
          ${/* The one caveat that belongs in front of a client, and the line
                that makes the advisor necessary rather than optional. */''}
          ${p.verified_at
            ? `<p class="itin-verified">Details verified ${esc(p.verified_at)}. Availability and
                 inclusions are confirmed before anything is booked.</p>` : ''}
        </li>`).join('')}
      </ul>
    </section>` : ''}

    ${doc.advisorNote ? `
    <section class="itin-block itin-note">
      <h2>From ${esc(brand.first_name || 'your advisor')}</h2>
      ${paras(doc.advisorNote)}
    </section>` : ''}

    ${doc.close ? `<div class="itin-close">${paras(doc.close)}</div>` : ''}

    ${/* THE ONLY CALL TO ACTION ON THIS PAGE, AND IT IS A PERSON. Not a form,
          not a button, not a calendar. Their own contact details, snapshotted
          at issue so they stay correct for this document. */''}
    <footer class="itin-foot">
      <h2>Next</h2>
      <p>Nothing here is held or quoted. ${who ? esc(who) : 'Your advisor'} has the current
        availability and the details that move week to week.</p>
      <p class="itin-contact">
        ${who ? `<strong>${esc(who)}</strong>` : ''}
        ${brand.business ? `<span>${esc(brand.business)}</span>` : ''}
        ${brand.email ? `<a href="mailto:${esc(brand.email)}">${esc(brand.email)}</a>` : ''}
        ${brand.phone ? `<a href="tel:${esc(String(brand.phone).replace(/[^\d+]/g, ''))}">${esc(brand.phone)}</a>` : ''}
      </p>
      ${doc.verified && doc.verified.core
        ? `<p class="itin-prov">Property intelligence verified ${esc(doc.verified.core)}${
            doc.verified.expanded ? ' (wider scan ' + esc(doc.verified.expanded) + ')' : ''}.</p>` : ''}
    </footer>

  </div>
</div>`;

  page(res, 200, esc(doc.title || 'Your journey'), body);
};

/* Blank lines are paragraph breaks, and that is the whole of the formatting.
   The generated prose is plain text and must stay plain text — anything that
   interpreted markup here would be interpreting model output as markup. */
function paras(text) {
  return String(text).split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}

/* ── When there is nothing to show ────────────────────────────────────────
   Four states, four different sentences, and only one of them is a 404. */
const GONE = {
  revoked: {
    status: 410,
    title: 'This plan has been withdrawn',
    lines: ['Your advisor has withdrawn this version. That usually means a newer one is on '
      + 'its way — they will have it.']
  },
  expired: {
    status: 410,
    title: 'This link has expired',
    lines: ['Links to these plans do not stay open indefinitely. Your advisor can send you '
      + 'a current one.']
  },
  not_found: {
    status: 404,
    title: 'There is nothing at this link',
    lines: ['It may have been mistyped, or it may have been replaced. Whoever sent it to you '
      + 'will be able to send it again.']
  },
  not_migrated: {
    status: 503,
    title: 'Not available just now',
    lines: ['This is a problem at our end rather than with your link. Please try again shortly.']
  }
};

function gone(res, reason) {
  const s = GONE[reason] || GONE.not_found;
  page(res, s.status, s.title, `<div class="itin itin--gone">
  <div class="wrap wrap--narrow">
    <h1>${esc(s.title)}</h1>
    ${s.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
  </div>
</div>`);
}

/* ── The shell ────────────────────────────────────────────────────────────
   NOT hubPage(). That one stamps the advisor navigation, the Hub chrome and a
   surface of "advisor" onto every page it renders, and this page has neither an
   advisor nor a Hub. What it shares with the Hub is the stylesheet and the two
   headers that matter:

     noindex   — a personal document must never be in a search index.
     no-store  — and never in a shared cache. It is somebody's trip.

   THE `conversion` LAYOUT, WITH NOTHING CONFIGURED. Every part of that layout
   is driven by page.conversion — anchors, section nav, the gold CTA — so
   passing only a context yields a wordmark and nothing else, which is what this
   page wants. `destination` would have hung a full site nav and a "Find My WELL
   Journey" button beside a document whose entire design is that it has ONE call
   to action and that it is a person.

   The context string has to be set: wordmark() falls back to "Professional
   Education", which is what the advisor pages say and the wrong thing to tell
   a client reading their own trip. */
function page(res, status, title, body) {
  const html = render({
    key: 'itinerary',
    path: '/j',
    layout: 'conversion',
    surface: 'consumer',
    conversion: { context: 'A personal plan' },
    title: title + ' — Saint Lucia WELL',
    description: 'A personal travel plan.',
    noindex: true,
    scripts: false,
    js: [],
    styles: ['/css/hub.css'],
    advisor: null
  }, body);

  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(html);
}
