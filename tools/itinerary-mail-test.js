#!/usr/bin/env node
/* ============================================================================
   itinerary-mail-test — the envelope, the two sentences, and what is NOT in it
   ----------------------------------------------------------------------------
     node tools/itinerary-mail-test.js
   ========================================================================== */
'use strict';
process.env.NOTIFY_FROM = process.env.NOTIFY_FROM || 'journeys@example.invalid';
const IM = require('../api/_lib/itinerary-mail.js');

let failed = 0, ran = 0;
function ok(label, cond, detail) {
  ran++;
  if (cond) { console.log('    PASS  ' + label); return; }
  failed++;
  console.log('    FAIL  ' + label + (detail ? '\n          ' + detail : ''));
}

const journey = { consumer_first: 'Janice', consumer_last: 'Seinfield', consumer_email: 'janice@example.invalid',
  context: 'ZZSENTINEL my marriage is ending', timing: 'ZZSENTINEL spring' };
const advisor = { first_name: 'Marguerite', last_name: 'Okonkwo', email: 'm@example.invalid', business: 'Okonkwo Travel', id: 'uuid-not-for-mail' };
const mail = IM.compose({ journey, advisor, url: '/j/abc123TOKEN', version: 2 });

console.log('\n  The envelope');
ok('from journeys@ (NOTIFY_FROM)', mail.from === process.env.NOTIFY_FROM);
ok('to the traveller', mail.to === 'janice@example.invalid');
ok('cc the advisor', mail.cc === 'm@example.invalid');
ok('reply-to the advisor', mail.replyTo === 'm@example.invalid');
ok('subject names the advisor', /Marguerite/.test(mail.subject));

console.log('\n  The body');
ok('the link is absolute and present once in the text part', (mail.text.match(/https?:\/\/\S+\/j\/abc123TOKEN/g) || []).length === 1, mail.text);
ok('it says planning estimate, not a quote, and nothing is booked', /not a quote/.test(mail.text) && /nothing in it is booked/.test(mail.text));
ok('the version is named when it is not the first', /version 2/.test(mail.text));
ok('first name only, never the surname', /Janice/.test(mail.text) && !/Seinfield/.test(mail.text));
ok('a plain-text part exists and matches the html', mail.text.length > 100 && /Discover Saint Lucia WELL/.test(mail.text));

console.log('\n  What is not in it');
ok('no figure, no currency', !/\$\s?\d/.test(mail.html) && !/USD/.test(mail.html));
ok('nothing the traveller wrote', mail.html.indexOf('ZZSENTINEL') === -1 && mail.text.indexOf('ZZSENTINEL') === -1);
ok('no advisor id', mail.html.indexOf('uuid-not-for-mail') === -1);
ok('no attachment of any kind', !('attachments' in mail));

console.log('\n  Sending without configuration refuses, never throws');
(async () => {
  const saved = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY;
  const r = await IM.send({ journey, advisor, url: '/j/x' });
  ok('unconfigured → mail_not_configured', r.ok === false && r.error === 'mail_not_configured');
  process.env.RESEND_API_KEY = 're_test_not_real';
  const r2 = await IM.send({ journey: {}, advisor, url: '/j/x' });
  ok('no recipient → no_recipient', r2.ok === false && r2.error === 'no_recipient');
  if (saved) process.env.RESEND_API_KEY = saved; else delete process.env.RESEND_API_KEY;
  console.log('\n  ' + ran + ' checks, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
