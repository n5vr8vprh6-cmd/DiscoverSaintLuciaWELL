/* ============================================================================
   /hub/admin/subject — answering a privacy request from a real person
   ----------------------------------------------------------------------------
   Somebody emails concierge@ and says "what do you have about me", or "delete
   it". Privacy Policy §14 promises access, correction, erasure and portability;
   this is the screen that can actually deliver them, within the 30 days PIPEDA
   allows and the one month UK/EU GDPR allows.

   ONE ADDRESS AT A TIME, EXACT MATCH. Not a partial search: a rights request is
   about one identified person, and a lookup that returns everyone at gmail.com
   discloses other people's data in order to answer one person's question.

   ── WHAT THE SCREEN REFUSES TO PRETEND ───────────────────────────────────
   The advisor was emailed this person's name, email and phone number the moment
   they shared. That message sits in somebody else's mailbox and no delete here
   touches it. So erasure says so, in the interface and in the covering note it
   hands you, because a deletion confirmation that overstates its reach is the
   one dishonesty this whole system has been built to avoid. The Advisor Data
   Undertaking is what gives Duncan the standing to tell the advisor to delete
   their copy; this screen tells you to use it.

   THE LOOKUP ITSELF IS NOT AUDITED, and that is a considered decision rather
   than an omission. An admin already reads consumers' contact details unaudited
   on every advisor detail screen — this discloses nothing new, and a log entry
   per keystroke would bury the three entries that matter. Export, correction
   and erasure are all recorded.
   ========================================================================== */
'use strict';

const { requireAdmin } = require('../auth.js');
const { str, body: parseBody, looksLikeEmail } = require('../core.js');
const { hubPage, esc, pageHead, since, STAGE_LABEL } = require('../hub-render.js');
const { audit } = require('../admin-data.js');
const {
  findSubject, accessExport, correctSubject, eraseSubject, subjectKey
} = require('../subject-data.js');

module.exports = async function handler(req, res) {
  const admin = await requireAdmin(req, res, '/hub/admin/subject');
  if (!admin) return;

  if (req.method === 'POST') {
    const form = parseBody(req) || {};
    const email = str(form.email, 200).toLowerCase();
    const what = str(form.action, 20);

    /* Export leaves as a file rather than a redirect, so it is handled before
       the POST/redirect/GET path the other two follow. */
    if (what === 'export' && looksLikeEmail(email)) {
      const found = await findSubject(email);
      if (found && (found.journeys.length || found.advisorAccount)) {
        await audit(admin, 'subject_export', {
          detail: { subject_key: subjectKey(email), journeys: found.journeys.length }
        });
        const file = JSON.stringify(accessExport(found), null, 2);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        /* The filename carries the key, not the address — a downloaded file
           tends to end up somewhere less careful than the database. */
        res.setHeader('Content-Disposition',
          `attachment; filename="access-response-${String(found.key || 'subject').slice(0, 12)}.json"`);
        res.setHeader('Cache-Control', 'private, no-store');
        return res.end(file);
      }
    }

    const result = await act(admin, what, email, form);
    res.statusCode = 303;
    res.setHeader('Location', '/hub/admin/subject?q=' + encodeURIComponent(email) +
      '&done=' + encodeURIComponent(result));
    return res.end();
  }

  const url = new URL(req.url, 'https://x');
  const q = str(url.searchParams.get('q'), 200).toLowerCase();
  const done = str(url.searchParams.get('done'), 40);
  const found = looksLikeEmail(q) ? await findSubject(q) : null;

  const body = `<div class="hub-main">
  <div class="wrap">

    <p class="hub-back"><a href="/hub/admin">← Admin</a></p>

    ${pageHead('Admin', 'Privacy requests',
      'Everything held about one person, and what you are able to do about it.')}

    ${done ? `<p class="hub-flash${/failed|nothing|mismatch|not_/.test(done) ? ' hub-flash--bad' : ''}">${
      esc(DONE_MESSAGE[done] || done)}</p>` : ''}

    <section class="hub-card">
      <h2>Look somebody up</h2>
      <form method="GET" class="hub-search">
        <label class="hub-field hub-field--wide">
          <span class="hub-field-label">Their email address</span>
          <input name="q" type="email" value="${esc(q)}" autocomplete="off"
                 placeholder="the address they wrote to you from" required>
        </label>
        <button class="btn btn--gold btn--sm" type="submit">Find what we hold</button>
      </form>
      <p class="hub-hint">Exact match on the address, because a request is about one identified
        person. Check it is the address they actually shared with — people write in from a
        different one more often than you would think, and the answer to the wrong address is
        "we hold nothing", which is worse than no answer.</p>
    </section>

    ${!q ? '' : !looksLikeEmail(q) ? `
    <section class="hub-card"><p class="hub-hint">That is not an email address.</p></section>`
    : !found || (!found.journeys.length && !found.advisorAccount && !(found.waitlist || []).length) ? `
    <section class="hub-card">
      <h2>Nothing held</h2>
      <p class="hub-hint">No Journey, no advisor account and no waiting-list entry for
        <strong>${esc(q)}</strong>.
        That is itself a complete answer to an access request — tell them so plainly, and
        that nothing needed deleting.</p>
    </section>`
    : renderFound(found)}

  </div>
</div>`;

  hubPage(res, { path: '/hub/admin', title: 'Privacy requests', advisor: admin, body });
};

/* ── What we hold ────────────────────────────────────────────────────────── */
function renderFound(f) {
  const n = f.journeys.length;

  return `
    <section class="hub-card">
      <h2>${n === 0 ? 'No Journeys' : n === 1 ? 'One Journey' : `${n} Journeys`}${
        f.advisorAccount ? ', and an advisor account' : ''}</h2>
      <p class="hub-hint">Held for <strong>${esc(f.email)}</strong>.</p>
      ${f.advisorAccount ? `
      <p class="hub-hint">They also hold an advisor account —
        <a href="/hub/admin/advisors/${esc(f.advisorAccount.id)}">${esc(
          (f.advisorAccount.first_name || '') + ' ' + (f.advisorAccount.last_name || ''))}</a>.
        Deleting that account is done there, where the choice about their clients' Journeys
        is put to you properly.</p>` : ''}
    </section>

    ${(f.waitlist || []).length ? `
    <section class="hub-card">
      <h2>${f.waitlist.length === 1 ? 'On the Immersion waiting list' : `${f.waitlist.length} waiting-list entries`}</h2>
      ${f.waitlist.map((w) => `<p class="hub-hint">
        Joined ${esc(String(w.created_at).slice(0, 10))} ·
        ${esc(`${w.first_name || ''} ${w.last_name || ''}`.trim())} ·
        ${esc(w.phone || 'no phone')} ·
        ${esc(w.company || 'no company')}${w.host_agency ? ' · ' + esc(w.host_agency) : ''}
      </p>`).join('')}
      <p class="hub-hint">A request to be told when Immersion dates exist. Nobody on that list
        has been promised anything. Erasing below removes these rows too.</p>
    </section>` : ''}

    ${f.journeys.map(journeyCard).join('')}

    <section class="hub-card">
      <h2>Give them a copy</h2>
      <p class="hub-hint">A JSON file containing every field held, including the exact consent
        wording they agreed to and any notes their advisor wrote about them. That file is the
        access response — send it, rather than describing it.</p>
      ${post('export', 'Download the access response', f.email, 'btn--gold')}
    </section>

    <section class="hub-card">
      <h2>Correct something</h2>
      <p class="hub-hint">Contact details only, across all ${n === 1 ? 'their Journey' : n + ' Journeys'}.
        What they consented to and what they answered are not editable — correcting a phone number
        is a right; editing a consent record is falsifying one.</p>
      <form method="POST">
        <input type="hidden" name="action" value="correct">
        <input type="hidden" name="email" value="${esc(f.email)}">
        <div class="hub-form-grid">
          ${input('consumer_first', 'First name', f.journeys[0] && f.journeys[0].consumer_first)}
          ${input('consumer_last', 'Last name', f.journeys[0] && f.journeys[0].consumer_last)}
          ${input('consumer_email', 'Email', f.email)}
          ${input('consumer_phone', 'Phone', f.journeys[0] && f.journeys[0].consumer_phone)}
        </div>
        <button class="btn btn--ghost btn--sm" type="submit">Save the correction</button>
      </form>
    </section>

    <section class="hub-card hub-danger">
      <h2>Erase everything</h2>
      <p class="hub-hint">Destroys ${n === 1 ? 'this Journey' : `all ${n} Journeys`} and every note
        written about them. The consent record goes too — which is the point, and also why it
        cannot be undone.</p>

      <p class="hub-hint"><strong>What this does not reach.</strong> ${
        f.journeys.some((j) => j.notified_at)
          ? 'Their advisor was emailed this person’s name, email and phone at the time they shared. That message is in the advisor’s mailbox and nothing here touches it.'
          : 'No advisor notification was sent for these, so there is no emailed copy to chase.'}
        ${f.journeys.some((j) => j.notified_at)
          ? 'Ask the advisor to delete their copy — the Advisor Data Undertaking they accepted requires it — and tell the person you have done so. Do not tell them the data is gone everywhere.'
          : ''}</p>

      <form method="POST">
        <input type="hidden" name="action" value="erase">
        <input type="hidden" name="email" value="${esc(f.email)}">
        <label class="hub-field hub-field--wide">
          <span class="hub-field-label">Type their address to confirm</span>
          <input name="confirm" autocomplete="off" placeholder="${esc(f.email)}" required>
        </label>
        <label class="hub-stage-opt">
          <input type="checkbox" name="understood" value="yes" required>
          <span>I understand this destroys the consent evidence too</span>
        </label>
        <button class="btn btn--ghost btn--sm" type="submit">Erase everything we hold</button>
      </form>
    </section>`;
}

function journeyCard(j) {
  const who = j.advisor
    ? `${j.advisor.first_name || ''} ${j.advisor.last_name || ''}`.trim()
    : null;
  return `<section class="hub-card">
    <h2>Shared ${esc(since(j.created_at))}</h2>
    <dl class="hub-answers">
      ${row('Went to', who ? who + (j.advisor.business ? ' · ' + j.advisor.business : '') : 'Nobody — the link was unknown or paused')}
      ${row('They were emailed', j.notified_at ? new Date(j.notified_at).toISOString().slice(0, 10) : 'No')}
      ${row('Stage', STAGE_LABEL[j.stage] || j.stage)}
      ${row('Name given', `${j.consumer_first || ''} ${j.consumer_last || ''}`.trim())}
      ${row('Phone', j.consumer_phone)}
      ${row('Travel timing', j.timing)}
      ${row('Villages', (j.villages || []).join(', '))}
    </dl>
    ${j.context ? `<figure class="hub-quote">
      <blockquote>${esc(j.context)}</blockquote>
      <figcaption>What they wrote in their own words</figcaption>
    </figure>` : ''}
    ${j.notes.length ? `<p class="hub-hint"><strong>${j.notes.length}
      ${j.notes.length === 1 ? 'note' : 'notes'} their advisor wrote about them.</strong>
      These are personal data about this person written by somebody else, so they are in the
      access response and they go in an erasure.</p>` : ''}
    <details class="hub-consent">
      <summary>What they agreed to, ${esc(new Date(j.consent_at).toISOString().slice(0, 10))}</summary>
      <p>${esc(j.consent_text)}</p>
    </details>
  </section>`;
}

/* ── Actions ─────────────────────────────────────────────────────────────── */
async function act(admin, what, email, form) {
  if (!looksLikeEmail(email)) return 'bad_email';

  switch (what) {
    case 'correct': {
      const r = await correctSubject(email, {
        consumer_first: str(form.consumer_first, 80),
        consumer_last: str(form.consumer_last, 80),
        consumer_email: str(form.consumer_email, 200),
        consumer_phone: str(form.consumer_phone, 40)
      });
      if (!r.ok) return r.error;
      await audit(admin, 'subject_correct', {
        detail: { subject_key: subjectKey(email), rows: r.rows, fields: r.fields }
      });
      return 'corrected';
    }

    case 'erase': {
      /* Checked against the address we searched, not against anything else the
         form supplied — a stale page cannot authorise erasing a different
         person than the one it was showing. */
      if (str(form.confirm, 200).trim().toLowerCase() !== email) return 'confirm_mismatch';
      if (str(form.understood, 8) !== 'yes') return 'not_understood';

      const r = await eraseSubject(email);
      if (!r.ok) return r.error;

      /* THE ADDRESS IS NOT WRITTEN HERE. See api/_lib/subject-data.js — the key
         is reproducible from an address they give you later, so the record is
         still answerable without keeping what it erased. */
      await audit(admin, 'subject_erase', {
        detail: {
          subject_key: subjectKey(email),
          journeys: r.journeys, notes: r.notes, advisors: r.advisors, orphans: r.orphans
        }
      });
      return r.orphans ? 'erased_incomplete' : 'erased';
    }

    case 'export':
      return 'nothing_held';

    default:
      return 'unknown_action';
  }
}

/* ── Bits ────────────────────────────────────────────────────────────────── */
const row = (label, value) => value ? `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>` : '';

const input = (name, label, value) => `<label class="hub-field">
    <span class="hub-field-label">${esc(label)}</span>
    <input name="${esc(name)}" value="${esc(value || '')}" autocomplete="off">
  </label>`;

const post = (action, label, email, variant) => `<form method="POST">
    <input type="hidden" name="action" value="${esc(action)}">
    <input type="hidden" name="email" value="${esc(email)}">
    <button class="btn ${variant || 'btn--ghost'} btn--sm" type="submit">${esc(label)}</button>
  </form>`;

const DONE_MESSAGE = {
  corrected: 'Corrected. Tell them what was changed — a correction they cannot see is not one.',
  erased: 'Erased. Everything held here is gone, including the consent record. If an advisor ' +
    'was emailed their details, ask the advisor to delete their copy before you reply.',
  erased_incomplete: 'Erased the Journeys, but some advisor notes SURVIVED — the cascade did not ' +
    'fire. Do not tell them it is done. Check advisor_notes directly.',
  nothing_held: 'Nothing is held for that address, so there was nothing to export.',
  nothing_to_change: 'Nothing was filled in, so nothing changed.',
  confirm_mismatch: 'The address did not match, so nothing was erased.',
  not_understood: 'Erasing needs the confirmation box ticked.',
  bad_email: 'That is not an email address.',
  failed: 'That did not work. The database refused it — check the logs.'
};
