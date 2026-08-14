/* ============================================================================
   /hub/admin/advisors/new — create one advisor
   ----------------------------------------------------------------------------
   An admin creating an account has already done the vetting that `pending`
   exists to force, so these arrive `active` — stated explicitly in
   admin-people.js rather than left to the schema default.

   THERE IS NO PASSWORD FIELD, and there never will be. The account is created
   with a random secret nobody sees, and the person is emailed a link to choose
   their own.
   ========================================================================== */
'use strict';

const { requireAdmin } = require('../auth.js');
const { str, body: parseBody } = require('../core.js');
const { hubPage, esc, pageHead } = require('../hub-render.js');
const { field } = require('../hub-forms.js');
const { createAdvisor } = require('../admin-people.js');

module.exports = async function handler(req, res) {
  const admin = await requireAdmin(req, res, '/hub/admin/advisors/new');
  if (!admin) return;

  if (req.method === 'POST') {
    const b = parseBody(req) || {};
    const r = await createAdvisor(admin, {
      firstName: str(b.firstName, 80),
      lastName: str(b.lastName, 80),
      email: str(b.email, 200),
      business: str(b.business, 160),
      hostAgency: str(b.hostAgency, 160),
      website: str(b.website, 300),
      note: str(b.note, 600)
    }, { invite: b.invite !== 'no' });

    res.statusCode = 303;
    res.setHeader('Location', r.ok
      ? `/hub/admin/advisors/${r.advisor.id}?done=${r.invited ? 'created_invited' : 'created_quiet'}`
      : `/hub/admin/advisors/new?err=${encodeURIComponent(r.error)}`);
    return res.end();
  }

  const url = new URL(req.url, 'https://x');
  const err = str(url.searchParams.get('err'), 60);

  const body = `<div class="hub-main">
  <div class="wrap wrap--narrow">

    <p class="hub-back"><a href="/hub/admin/advisors">← Advisors</a></p>

    ${pageHead('Admin', 'Add an advisor',
      'They arrive active — creating an account here is the approval.')}

    ${err ? `<p class="hub-flash hub-flash--bad">${esc(ERRORS[err] || err)}</p>` : ''}

    <form class="hub-form hub-card" method="POST" action="/hub/admin/advisors/new">
      <div class="hub-form-grid">
        ${field({ name: 'firstName', label: 'First name', autocomplete: 'off' })}
        ${field({ name: 'lastName', label: 'Last name', autocomplete: 'off' })}
        ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'off', wide: true,
                  hint: 'Where the invitation goes. It must be one they can receive.' })}
        ${field({ name: 'business', label: 'Business or agency', required: false, optional: true })}
        ${field({ name: 'hostAgency', label: 'Host agency', required: false, optional: true })}
        ${field({ name: 'website', label: 'Website', type: 'url', required: false, optional: true, wide: true })}
        ${field({ name: 'note', label: 'Note', required: false, optional: true, wide: true,
                  hint: 'How you know them. Shown on their record, not to them.' })}
      </div>

      <div class="hub-stages">
        <label class="hub-stage-opt">
          <input type="radio" name="invite" value="yes" checked>
          <span>Email them a link to set a password now</span>
        </label>
        <label class="hub-stage-opt">
          <input type="radio" name="invite" value="no">
          <span>Create quietly — invite later</span>
        </label>
      </div>

      <button class="btn btn--gold" type="submit">Create the account</button>
    </form>

    <p class="hub-hint">You are not setting a password. The account is created with a secret nobody
      sees, and they choose their own through the link.</p>

  </div>
</div>`;

  hubPage(res, { path: '/hub/admin', title: 'Add an advisor', advisor: admin, body });
};

const ERRORS = {
  name_required: 'A first and last name are needed.',
  email_invalid: 'That email address does not look right.',
  already_exists: 'Somebody already has an account with that address.',
  auth_create_failed: 'The account could not be created. There may already be a login for that address.',
  not_configured: 'The backend is not configured.'
};
