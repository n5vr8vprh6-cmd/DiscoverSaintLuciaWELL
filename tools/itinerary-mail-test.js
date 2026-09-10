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

console.log('\n  What I heard, sent back');
const heard = IM.composeHeard({ journey, advisor, heard: 'A life transition. 7 nights in February 2027, with friends. Around $18,000 all in.',
  notes: [{ label: 'On running hot', text: 'ZZNOTE the year has emptied her out' }, { label: 'Things to plan around', text: '' }] });
ok('same envelope: from journeys@, to the traveller, cc and reply-to the advisor',
  heard.from === process.env.NOTIFY_FROM && heard.to === 'janice@example.invalid' && heard.cc === 'm@example.invalid' && heard.replyTo === 'm@example.invalid');
ok('the paragraph is in it, and the note with its label', /A life transition\./.test(heard.text) && /On running hot/.test(heard.text) && /ZZNOTE/.test(heard.text));
ok('an empty note is dropped', !/Things to plan around/.test(heard.html));
ok('first name only, and the advisor signs it', /Janice/.test(heard.text) && !/Seinfield/.test(heard.text) && /Okonkwo Travel/.test(heard.text));
ok('no link, no attachment, no property name', !/https?:\/\//.test(heard.html) && !('attachments' in heard) && !/Anse Chastanet|Jade Mountain/.test(heard.html));
ok('the only figure is the one the client gave', (heard.text.match(/\$[\d,]+/g) || []).join() === '$18,000');
ok('the advisor id is not in it', heard.html.indexOf('uuid-not-for-mail') === -1);

console.log('\n  Sending without configuration refuses, never throws');
(async () => {
  const saved = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY;
  const r = await IM.send({ journey, advisor, url: '/j/x' });
  ok('unconfigured → mail_not_configured', r.ok === false && r.error === 'mail_not_configured');
  process.env.RESEND_API_KEY = 're_test_not_real';
  const r2 = await IM.send({ journey: {}, advisor, url: '/j/x' });
  ok('no recipient → no_recipient', r2.ok === false && r2.error === 'no_recipient');
  const r3 = await IM.sendHeard({ journey, advisor, heard: '   ' });
  ok('nothing heard → nothing_heard, never an empty mail', r3.ok === false && r3.error === 'nothing_heard');
  if (saved) process.env.RESEND_API_KEY = saved; else delete process.env.RESEND_API_KEY;
  console.log('\n  ' + ran + ' checks, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
