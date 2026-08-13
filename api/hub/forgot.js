/* GET /hub/forgot — request a reset link. */
'use strict';
const { hubPage } = require('../_lib/hub-render.js');
const { authForm } = require('../_lib/hub-forms.js');

module.exports = async function handler(req, res) {
  hubPage(res, {
    path: '/hub/forgot',
    title: 'Reset your password',
    body: authForm({
      title: 'Reset your password.',
      lead: 'We will email you a link. It works once, and expires.',
      action: '/api/auth/forgot',
      submit: 'Send the link',
      /* Identical wording whether or not the address is registered. The
         endpoint answers identically too — see api/auth/forgot.js — so this
         form cannot be used to find out who has an account. */
      okMessage: 'If that address has an account, the link is on its way.',
      fields: [{ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', wide: true }],
      alt: '<a href="/hub/login">Back to sign in</a>.'
    })
  });
};
