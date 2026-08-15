/* ============================================================================
   /hub/account — profile and settings
   ----------------------------------------------------------------------------
   Deliberately small. This is where an advisor corrects their name and adds the
   details that make their WELL link theirs — not a settings maze.

   Two things are NOT editable here on purpose:
     · the sign-in email, because changing it means re-verifying an identity and
       that belongs in its own flow rather than buried in a profile form;
     · the password, which goes through the same reset flow as everyone else so
       there is exactly one code path that sets a credential.
   ========================================================================== */
'use strict';

const { requireAdvisor } = require('../auth.js');
const { db, str, body: parseBody } = require('../core.js');
const { hubPage, esc, pageHead } = require('../hub-render.js');
const { field } = require('../hub-forms.js');

module.exports = async function handler(req, res) {
  const advisor = await requireAdvisor(req, res, '/hub/account');
  if (!advisor) return;

  let saved = false;
  if (req.method === 'POST') {
    /* Read-only while viewing as somebody. Editing another advisor's profile
       from inside their own Hub would be indistinguishable, in the record, from
       them editing it themselves. */
    if (advisor.viewingAs) {
      res.statusCode = 303;
      res.setHeader('Location', '/hub/account?saved=readonly');
      return res.end();
    }
    saved = await save(advisor, parseBody(req) || {});
    res.statusCode = 303;
    res.setHeader('Location', '/hub/account?saved=' + (saved ? '1' : '0'));
    return res.end();
  }

  const url = new URL(req.url, 'https://x');
  const flag = url.searchParams.get('saved');
  const link = `https://discoversaintluciawell.com/well/${advisor.public_code}`;

  const body = `<div class="hub-main">
  <div class="wrap wrap--narrow">
    ${pageHead('Account', 'Your details',
      'These appear where a consumer is asked whether to share their Journey with you.')}

    ${flag === '1' ? '<p class="hub-flash">Saved.</p>' : ''}
    ${flag === '0' ? '<p class="hub-flash hub-flash--bad">That did not save. Try again.</p>' : ''}
    ${flag === 'readonly' ? '<p class="hub-flash hub-flash--bad">Nothing was changed — you are viewing this Hub, not signed in as its owner.</p>' : ''}

    <!-- A plain form. The endpoint already does POST/redirect/GET with a flash
         message, which is the same behaviour fetch would have produced with
         more moving parts. -->
    <form class="hub-form hub-card" method="POST" action="/hub/account">
      <div class="hub-form-grid">
        ${field({ name: 'first_name', label: 'First name', autocomplete: 'given-name', value: advisor.first_name })}
        ${field({ name: 'last_name', label: 'Last name', autocomplete: 'family-name', value: advisor.last_name })}
        ${field({ name: 'business', label: 'Business or agency name', required: false, value: advisor.business, wide: true, optional: true })}
        ${field({ name: 'host_agency', label: 'Host agency', required: false, value: advisor.host_agency, optional: true })}
        ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', required: false, value: advisor.phone, optional: true })}
        ${field({ name: 'website', label: 'Website', type: 'url', autocomplete: 'url', required: false, value: advisor.website, optional: true, wide: true, hint: 'Include https://' })}
        ${field({ name: 'market', label: 'Where your clients are', required: false, value: advisor.market, optional: true, wide: true, hint: 'A city, a region, or the kind of traveller you work with.' })}
      </div>
      <button class="btn btn--gold" type="submit">Save</button>
    </form>

    <section class="hub-card">
      <h2>Your WELL link</h2>
      <div class="hub-link-row">
        <input id="well-link" value="${esc(link)}" readonly>
        <button class="btn btn--ghost btn--sm" type="button" data-copy="#well-link">Copy</button>
        <button class="btn btn--ghost btn--sm" type="button" data-qr="${esc(link)}">QR code</button>
      </div>
      <p class="hub-hint">Fixed for the life of your account. Anything already printed keeps working.</p>
    </section>

    <section class="hub-card">
      <h2>Sign-in</h2>
      <p class="hub-hint">You sign in as <strong>${esc(advisor.authEmail || advisor.email)}</strong>.</p>
      <p><a class="btn btn--ghost btn--sm" href="/hub/forgot">Change password</a></p>
      <p class="hub-hint">To change the address you sign in with, or to close your account,
        <a href="/about#contact">get in touch</a> — both need a person, not a form.</p>
    </section>

    <section class="hub-card">
      <h2>What we hold</h2>
      <p class="hub-hint">Journeys shared with you contain another person's contact details and
        what they told us about the trip they want. The
        <a href="/privacy">privacy policy</a> covers how that is handled, and it applies to you
        as well as to us.</p>
    </section>
  </div>
</div>`;

  hubPage(res, { path: '/hub/account', title: 'Account', advisor, body });
};

/* Only the fields on the form. Notably absent: status, public_code, slug,
   auth_user_id — an advisor must not be able to activate themselves or take
   over another advisor's link by posting extra keys. */
async function save(advisor, b) {
  const supabase = db();
  if (!supabase) return false;

  const patch = {
    first_name:  str(b.first_name, 80),
    last_name:   str(b.last_name, 80),
    business:    str(b.business, 160) || null,
    host_agency: str(b.host_agency, 160) || null,
    phone:       str(b.phone, 40) || null,
    website:     str(b.website, 300) || null,
    market:      str(b.market, 200) || null
  };
  if (!patch.first_name || !patch.last_name) return false;

  const { error } = await supabase.from('advisors').update(patch).eq('id', advisor.id);
  if (error) { console.error('account save', error); return false; }
  return true;
}
