/* ============================================================================
   /hub/admin/import — create advisors in bulk from CSV
   ----------------------------------------------------------------------------
   IT ALWAYS PREVIEWS FIRST. Paste or choose a file, see every row with a verdict
   against it, then confirm. There is no path through this screen that writes
   before showing you what it is about to write.

   CSV rather than .xlsx, deliberately — see api/_lib/csv.js. The file is read in
   the BROWSER by js/hub.js and posted as text, so nothing here parses multipart
   uploads and no dependency is added to do it.

   Two limits, both real rather than defensive:
     · fifty rows a run. Each is an auth-user create, an insert and possibly an
       email; a serverless function has seconds, not minutes.
     · invitations are opt-in. Fifty rows means fifty sends, and Resend rate
       limits — so "create quietly, invite later" is offered as a first-class
       choice rather than buried.
   ========================================================================== */
'use strict';

const { requireAdmin } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc, pageHead } = require('../hub-render.js');
const { toObjects } = require('../csv.js');
const { createAdvisor } = require('../admin-people.js');
const { db } = require('../core.js');

const MAX_ROWS = 50;

/* The headings a person would actually type, all reaching the same field. */
const ALIASES = {
  firstname: 'firstName', first: 'firstName', givenname: 'firstName',
  lastname: 'lastName', last: 'lastName', surname: 'lastName', familyname: 'lastName',
  email: 'email', emailaddress: 'email',
  business: 'business', company: 'business', agency: 'business',
  hostagency: 'hostAgency', host: 'hostAgency',
  website: 'website', url: 'website', site: 'website',
  note: 'note', notes: 'note', howwemet: 'note', where: 'note'
};

module.exports = async function handler(req, res) {
  const admin = await requireAdmin(req, res, '/hub/admin/import');
  if (!admin) return;

  if (req.method === 'POST') {
    const b = parseBody(req) || {};
    const text = typeof b.csv === 'string' ? b.csv : '';
    const invite = b.invite === 'yes';
    const rows = analyse(text, await existingEmails());

    /* Two-phase. Without an explicit confirm this only ever renders. */
    if (b.confirm !== 'yes') {
      return render(res, admin, { text, rows, invite, stage: 'preview' });
    }

    const results = [];
    for (const r of rows.filter((x) => x.verdict === 'create').slice(0, MAX_ROWS)) {
      const out = await createAdvisor(admin, r.data, { invite });
      results.push({ email: r.data.email, ok: out.ok, invited: out.invited, error: out.error });
      /* A small gap between sends. Resend rate limits, and fifty in a burst is
         exactly the shape that trips it. */
      if (invite) await new Promise((s) => setTimeout(s, 350));
    }
    return render(res, admin, { rows, results, invite, stage: 'done' });
  }

  return render(res, admin, { stage: 'start' });
};

/* ── Verdicts ────────────────────────────────────────────────────────────── */
function analyse(text, taken) {
  if (!text.trim()) return [];
  const { rows } = toObjects(text, ALIASES);

  const seen = new Set();
  return rows.slice(0, MAX_ROWS + 25).map((raw, i) => {
    const data = {
      firstName: str(raw.firstName, 80),
      lastName: str(raw.lastName, 80),
      email: str(raw.email, 200).toLowerCase(),
      business: str(raw.business, 160),
      hostAgency: str(raw.hostAgency, 160),
      website: str(raw.website, 300),
      note: str(raw.note, 600)
    };

    let verdict = 'create', why = '';
    if (i >= MAX_ROWS) { verdict = 'skip'; why = `Beyond the ${MAX_ROWS}-row limit — import again`; }
    else if (!data.firstName || !data.lastName) { verdict = 'skip'; why = 'Missing a name'; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) { verdict = 'skip'; why = 'Email is missing or malformed'; }
    else if (taken.has(data.email)) { verdict = 'skip'; why = 'Already registered'; }
    else if (seen.has(data.email)) { verdict = 'skip'; why = 'Duplicated earlier in this file'; }

    if (verdict === 'create') seen.add(data.email);
    return { data, verdict, why };
  });
}

async function existingEmails() {
  const supabase = db();
  if (!supabase) return new Set();
  const { data } = await supabase.from('advisors').select('email');
  return new Set((data || []).map((r) => String(r.email).toLowerCase()));
}

/* ── Render ──────────────────────────────────────────────────────────────── */
function render(res, admin, { text = '', rows = [], results, invite, stage }) {
  const willCreate = rows.filter((r) => r.verdict === 'create').length;
  const skipped = rows.length - willCreate;

  const body = `<div class="hub-main">
  <div class="wrap">

    <p class="hub-back"><a href="/hub/admin/advisors">← Advisors</a></p>

    ${pageHead('Admin', 'Import advisors', 'Paste a CSV, check what it will do, then confirm.')}

    ${stage === 'done' ? doneBlock(results, invite) : ''}

    ${stage !== 'done' ? `
    <form class="hub-form hub-card" method="POST" action="/hub/admin/import" data-csv-form>
      <label class="hub-field hub-field--wide" for="csv">
        <span class="hub-field-label">CSV</span>
        <textarea id="csv" name="csv" rows="8"
          placeholder="firstName,lastName,email,business,hostAgency,website,note
Jo,Park,jo@example.com,Park Travel,Fora,https://example.com,Toronto workshop">${esc(text)}</textarea>
        <span class="hub-hint">Headings can be "First name", "firstName" or "first" — all reach the
          same field. Only first name, last name and email are required.
          Up to ${MAX_ROWS} rows a run.</span>
      </label>

      <p class="hub-hint">
        <label class="hub-file">
          <input type="file" accept=".csv,text/csv" data-csv-file>
          <span>…or choose a .csv file</span>
        </label>
        Excel: <strong>Save As → CSV</strong>. The file is read in your browser and never uploaded.
      </p>

      <div class="hub-stages">
        <label class="hub-stage-opt">
          <input type="radio" name="invite" value="no"${invite ? '' : ' checked'}>
          <span>Create quietly — invite them later</span>
        </label>
        <label class="hub-stage-opt">
          <input type="radio" name="invite" value="yes"${invite ? ' checked' : ''}>
          <span>Email each of them a link to set a password now</span>
        </label>
      </div>

      <button class="btn btn--ghost" type="submit">${stage === 'preview' ? 'Re-check' : 'Check the file'}</button>
    </form>` : ''}

    ${stage === 'preview' && rows.length ? `
    <section class="hub-card">
      <h2>What this will do</h2>
      <p class="hub-hint"><strong>${willCreate}</strong> to create${
        skipped ? `, <strong>${skipped}</strong> skipped` : ''}. Nothing has been written yet.</p>

      <ul class="hub-journeys">
        ${rows.map((r) => `<li class="hub-journey">
          <span class="hub-journey-name">${esc((r.data.firstName + ' ' + r.data.lastName).trim() || '(no name)')}</span>
          <span class="hub-journey-meta">
            <span class="hub-tag" data-tag="${r.verdict === 'create' ? 'create' : 'skip'}">${
              r.verdict === 'create' ? 'Will create' : 'Skip'}</span>
            <span>${esc(r.data.email || '—')}</span>
          </span>
          ${r.why ? `<span class="hub-journey-villages">${esc(r.why)}</span>` : ''}
        </li>`).join('')}
      </ul>

      ${willCreate ? `
      <form method="POST" action="/hub/admin/import" class="hub-confirm">
        <input type="hidden" name="csv" value="${esc(text)}">
        <input type="hidden" name="invite" value="${invite ? 'yes' : 'no'}">
        <input type="hidden" name="confirm" value="yes">
        <button class="btn btn--gold" type="submit">Create ${willCreate} ${
          willCreate === 1 ? 'advisor' : 'advisors'}${invite ? ' and email them' : ''}</button>
      </form>` : '<p class="hub-hint">Nothing in this file can be created.</p>'}
    </section>` : ''}

    ${stage === 'preview' && !rows.length
      ? '<p class="hub-flash hub-flash--bad">No rows found. Check the file has a heading row.</p>' : ''}

  </div>
</div>`;

  hubPage(res, { path: '/hub/admin', title: 'Import advisors', advisor: admin, body });
}

function doneBlock(results, invite) {
  const made = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const notInvited = made.filter((r) => invite && !r.invited);

  return `<section class="hub-card">
    <h2>Done</h2>
    <p class="hub-flash">Created ${made.length} ${made.length === 1 ? 'advisor' : 'advisors'}${
      invite ? `, emailed ${made.filter((r) => r.invited).length}` : ''}.</p>

    ${notInvited.length ? `<p class="hub-flash hub-flash--bad">${notInvited.length} ${
      notInvited.length === 1 ? 'account was' : 'accounts were'} created but not emailed. They exist and
      can be invited from their own record.</p>` : ''}

    ${failed.length ? `
    <p class="hub-hint">These were not created:</p>
    <ul class="hub-journeys">
      ${failed.map((r) => `<li class="hub-journey">
        <span class="hub-journey-name">${esc(r.email)}</span>
        <span class="hub-journey-meta"><span>${esc(r.error || 'failed')}</span></span>
      </li>`).join('')}
    </ul>` : ''}

    <p class="hub-more"><a href="/hub/admin/advisors?view=active">See them</a></p>
  </section>`;
}
