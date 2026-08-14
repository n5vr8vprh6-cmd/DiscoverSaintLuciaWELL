/* ============================================================================
   GET /hub/register — create an advisor account
   ----------------------------------------------------------------------------
   THE THREE OPTIONAL FIELDS EXIST TO MAKE APPROVAL POSSIBLE, and they earn their
   place on a form that should otherwise be as short as it can be.

   An admin looking at the pending queue has to answer one question: is this a
   real travel advisor? Name and email cannot answer it. Host agency and website
   usually can.

   "Have we met?" is the one that matters most, and it is not there for
   completeness — it is the fast path. Someone who writes "Toronto workshop,
   June" is a person Duncan already knows, and can be approved on sight instead
   of waiting for a conversation. It surfaces directly in the approval queue for
   that reason.

   All three are optional, and the form says so. Registration is open; making
   someone justify themselves before they can even see the product would be a
   different decision from the one that was taken.
   ========================================================================== */
'use strict';
const { advisorFor } = require('../auth.js');
const { hubPage } = require('../hub-render.js');
const { authForm } = require('../hub-forms.js');

module.exports = async function handler(req, res) {
  const advisor = await advisorFor(req, res);
  if (advisor) { res.statusCode = 302; res.setHeader('Location', '/hub'); return res.end(); }

  hubPage(res, {
    path: '/hub/register',
    title: 'Create your account',
    body: authForm({
      title: 'Create your account.',
      /* Says plainly what happens next. An advisor who registers and then
         cannot receive Journeys should have been told why, not discover it. */
      lead: 'You will get your Hub straight away. Receiving Journeys from ' +
            'consumers is switched on once we have confirmed your account.',
      action: '/api/auth/register',
      submit: 'Create account',
      fields: [
        { name: 'firstName', label: 'First name', autocomplete: 'given-name' },
        { name: 'lastName', label: 'Last name', autocomplete: 'family-name' },
        { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', wide: true },
        { name: 'business', label: 'Business or agency', autocomplete: 'organization',
          required: false, optional: true },
        { name: 'hostAgency', label: 'Host agency', required: false, optional: true },
        { name: 'website', label: 'Website', type: 'url', autocomplete: 'url',
          required: false, optional: true, wide: true, hint: 'Include https://' },
        { name: 'registrationNote', label: 'Have we met?', required: false, optional: true,
          wide: true,
          hint: 'A workshop, a webinar, someone who suggested us — anything that helps us place you. It speeds this up.' },
        { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password',
          minlength: 10, wide: true, hint: 'At least 10 characters.' }
      ],
      alt: 'Already have an account? <a href="/hub/login">Sign in</a>.<br>' +
           'By creating an account you agree to our <a href="/terms">terms</a> ' +
           'and <a href="/privacy">privacy policy</a>.'
    })
  });
};
