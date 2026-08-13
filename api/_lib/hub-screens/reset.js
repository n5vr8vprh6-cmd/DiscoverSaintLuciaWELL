/* GET /hub/reset — set a new password from an emailed link.
   Supabase puts the recovery token in the URL FRAGMENT, which never reaches a
   server. js/hub.js reads it client-side and posts it; this page only renders
   the form. */
'use strict';
const { hubPage } = require('../hub-render.js');
const { authForm } = require('../hub-forms.js');

module.exports = async function handler(req, res) {
  hubPage(res, {
    path: '/hub/reset',
    title: 'Choose a new password',
    body: authForm({
      title: 'Choose a new password.',
      lead: 'Then you will be signed in.',
      action: '/api/auth/reset',
      submit: 'Save and sign in',
      /* Filled in by js/hub.js from the URL fragment, which is why they are
         hidden inputs rather than anything the server rendered a value into —
         the server never sees the token. */
      hidden: ['accessToken', 'refreshToken'],
      attr: 'data-hub-reset',
      done: '/hub',
      fields: [{ name: 'password', label: 'New password', type: 'password',
                 autocomplete: 'new-password', minlength: 10, wide: true,
                 hint: 'At least 10 characters.' }],
      alt: '<a href="/hub/login">Back to sign in</a>.'
    })
  });
};
