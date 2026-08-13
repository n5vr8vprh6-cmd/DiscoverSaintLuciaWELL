/* ============================================================================
   /hub/journeys/:id — the Journey briefing
   ----------------------------------------------------------------------------
   The screen that has to justify the whole product. An advisor opens this from
   a notification, on a phone, and needs to be able to make a good first call
   from it — so the order is: who and how to reach them, what they asked for,
   what to ask, and only then the raw answers.

   GET renders. POST changes the stage or adds a note and redirects back
   (POST/redirect/GET), which means both work with JavaScript switched off and
   a refresh never re-submits.

   Ownership is enforced in the query (see hub-data.js) on top of RLS: asking
   for an id belonging to another advisor renders "not found", not somebody
   else's client.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { str, body } = require('../core.js');
const {
  hubPage, esc, emptyState, STAGES, STAGE_LABEL, WINDOW_LABEL, since
} = require('../hub-render.js');
const { journeyById, notesFor, setStage, addNote } = require('../hub-data.js');
const { brief, fullName, answerLabel } = require('../hub-brief.js');

module.exports = async function handler(req, res) {
  /* The id is read BEFORE the guard so that a signed-out advisor arriving from
     a notification email is sent back to this Journey after signing in, not to
     Home. See requireAdvisor() for why req.url cannot supply that itself. */
  const url = new URL(req.url, 'https://x');
  const id = str(url.searchParams.get('id'), 64);

  const advisor = await requireAdvisor(req, res,
    id ? `/hub/journeys/${encodeURIComponent(id)}` : '/hub/journeys');
  if (!advisor) return;
  if (!id) return notFound(res, advisor);

  if (req.method === 'POST') {
    const b = body(req) || {};
    const stage = str(b.stage, 20);
    const note = str(b.note, 4000);
    if (stage && STAGES.includes(stage)) await setStage(advisor.id, id, stage);
    if (note) await addNote(advisor.id, id, note);
    res.statusCode = 303;
    res.setHeader('Location', `/hub/journeys/${encodeURIComponent(id)}`);
    return res.end();
  }

  const j = await journeyById(advisor.id, id);
  if (!j) return notFound(res, advisor);

  const notes = await notesFor(advisor.id, id);
  const b = brief(j);
  const name = fullName(j);

  const body_ = `<div class="hub-main hub-main--detail">
  <div class="wrap">

    <p class="hub-back"><a href="/hub/journeys">← All Journeys</a></p>

    <header class="hub-detail-head">
      <p class="eyebrow">Shared ${esc(since(j.created_at))}${j.travel_window
        ? ' · ' + esc(WINDOW_LABEL[j.travel_window] || j.travel_window) : ''}</p>
      <h1>${esc(name)}</h1>
      <div class="hub-actions">
        ${j.consumer_email
          ? `<a class="btn btn--gold" href="mailto:${esc(j.consumer_email)}?subject=${
              encodeURIComponent('Your Saint Lucia WELL Journey')}">Email ${esc(j.consumer_first || '')}</a>` : ''}
        ${j.consumer_phone
          ? `<a class="btn btn--ghost" href="tel:${esc(j.consumer_phone.replace(/[^\d+]/g, ''))}">Call</a>` : ''}
      </div>
      <p class="hub-contact">
        ${j.consumer_email ? `<span>${esc(j.consumer_email)}</span>` : ''}
        ${j.consumer_phone ? `<span>${esc(j.consumer_phone)}</span>` : ''}
      </p>
    </header>

    <div class="hub-detail-grid">
      <div class="hub-detail-main">

        <section class="hub-card hub-card--brief">
          <h2>The briefing</h2>
          ${b.lines.map((l) => `<p>${esc(l)}</p>`).join('\n          ')}
          ${b.quote ? `
          <figure class="hub-quote">
            <blockquote>${esc(b.quote)}</blockquote>
            <figcaption>${esc(j.consumer_first || 'They')}, in their own words</figcaption>
          </figure>` : ''}
          ${b.eclipse ? `
          <div class="hub-eclipse">
            <p class="eyebrow">Eclipse appeared in their results</p>
            <p>${esc(b.eclipse)}</p>
          </div>` : ''}
        </section>

        <section class="hub-card">
          <h2>Worth asking</h2>
          <ul class="hub-prompts">
            ${b.prompts.map((p) => `<li>${esc(p)}</li>`).join('\n            ')}
          </ul>
          <p class="hub-hint">Questions, not a script. Their answers are a starting point for a
            conversation, not a brief to be fulfilled.</p>
        </section>

        <section class="hub-card">
          <h2>Notes</h2>
          <!-- Plain forms, both of them. POST/redirect/GET means a refresh
               never re-submits, and neither needs JavaScript to work. -->
          <form class="hub-note-form" method="POST" action="/hub/journeys/${esc(j.id)}">
            <label class="hub-field hub-field--wide" for="note">
              <span class="hub-field-label">Add a note</span>
              <textarea id="note" name="note" rows="3"
                placeholder="What you agreed, what to follow up, what they said."></textarea>
            </label>
            <button class="btn btn--ghost btn--sm" type="submit">Save note</button>
          </form>
          ${notes.length
            ? `<ul class="hub-notes">${notes.map((n) => `<li>
              <p>${esc(n.body)}</p>
              <span class="hub-note-when">${esc(since(n.created_at))}</span>
            </li>`).join('')}</ul>`
            : '<p class="hub-hint">No notes yet. These are yours — the consumer never sees them.</p>'}
        </section>

      </div>

      <aside class="hub-detail-side">
        <section class="hub-card">
          <h2>Stage</h2>
          <form method="POST" action="/hub/journeys/${esc(j.id)}">
            <div class="hub-stages">
              ${STAGES.map((s) => `<label class="hub-stage-opt">
                <input type="radio" name="stage" value="${s}"${s === j.stage ? ' checked' : ''}>
                <span>${esc(STAGE_LABEL[s])}</span>
              </label>`).join('\n              ')}
            </div>
            <button class="btn btn--ghost btn--sm" type="submit">Update</button>
          </form>
          ${j.last_activity_at
            ? `<p class="hub-hint">Last activity ${esc(since(j.last_activity_at))}.</p>` : ''}
        </section>

        ${(j.villages || []).length ? `
        <section class="hub-card">
          <h2>Villages matched</h2>
          <ul class="hub-villages">
            ${(j.villages || []).map((v) => `<li>${esc(v)}</li>`).join('\n            ')}
          </ul>
        </section>` : ''}

        <section class="hub-card">
          <h2>Their answers</h2>
          <!-- Kept, but demoted. The briefing above is the point; this is here
               so nothing is hidden from the advisor, not so it is read first. -->
          <dl class="hub-answers">
            ${answerRow('Needed most', 'intention', j.answers)}
            ${answerRow('Travelling', 'companions', j.answers)}
            ${answerRow('Pace', 'pace', j.answers)}
            ${answerRow('Recognised the description', 'recognition', j.answers)}
            ${j.timing ? `<dt>Timing, as they gave it</dt><dd>${esc(j.timing)}</dd>` : ''}
            ${j.source ? `<dt>Arrived from</dt><dd>${esc(j.source)}</dd>` : ''}
          </dl>
        </section>
      </aside>
    </div>

  </div>
</div>`;

  hubPage(res, { path: '/hub/journeys', title: name, advisor, body: body_ });
};

/* Shows the option the consumer actually read, never the code we stored it as. */
function answerRow(label, question, answers) {
  const value = answers && answers[question];
  if (!value) return '';
  return `<dt>${esc(label)}</dt><dd>${esc(answerLabel(question, value))}</dd>`;
}

/* Same response whether the id does not exist or belongs to someone else.
   Distinguishing them would let an advisor probe for other advisors' ids. */
function notFound(res, advisor) {
  hubPage(res, {
    path: '/hub/journeys', title: 'Not found', advisor, status: 404,
    body: `<div class="hub-main"><div class="wrap">${emptyState(
      'That Journey is not here.',
      'It may have been removed, or it belongs to another advisor.',
      { label: 'All Journeys', href: '/hub/journeys' })}</div></div>`
  });
}
