/* GET /hub/register — create an advisor account. */
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
          required: false, optional: true, wide: true },
        { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password',
          minlength: 10, wide: true, hint: 'At least 10 characters.' }
      ],
      alt: 'Already have an account? <a href="/hub/login">Sign in</a>.<br>' +
           'By creating an account you agree to our <a href="/terms">terms</a> ' +
           'and <a href="/privacy">privacy policy</a>.'
    })
  });
};
