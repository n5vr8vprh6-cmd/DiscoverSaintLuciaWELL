/* GET /hub/login — sign in. Already-signed-in advisors are sent onward. */
'use strict';
const { advisorFor, safeNext } = require('../_lib/auth.js');
const { hubPage } = require('../_lib/hub-render.js');
const { authForm } = require('../_lib/hub-forms.js');

module.exports = async function handler(req, res) {
  const next = safeNext((req.query || {}).next);
  const advisor = await advisorFor(req, res);
  if (advisor) { res.statusCode = 302; res.setHeader('Location', next); return res.end(); }

  hubPage(res, {
    path: '/hub/login',
    title: 'Sign in',
    body: authForm({
      title: 'Sign in.',
      lead: 'Your Journeys, your campaign link and your account.',
      action: '/api/auth/login',
      next,
      submit: 'Sign in',
      fields: [
        { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', wide: true },
        { name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', wide: true }
      ],
      alt: '<a href="/hub/forgot">Forgotten your password?</a> &nbsp;·&nbsp; ' +
           'No account yet? <a href="/hub/register">Create one</a>.'
    })
  });
};
