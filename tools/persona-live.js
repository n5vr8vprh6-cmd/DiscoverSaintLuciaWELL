/* ============================================================================
   persona-live.js — does the persona change the WORDS?
   ----------------------------------------------------------------------------
     node tools/persona-live.js        two personas, same advisor, real model

   THIS SPENDS MONEY. About two cents. It is the only question the stubbed
   suite cannot answer, and the whole of D2a rests on it.

   D1 established that output was input-limited: six prompt-and-model
   combinations, and not one used the single concrete detail in the profile.
   D2a's hypothesis is that structured input succeeds where free text failed.

   THAT IS A HYPOTHESIS AND THIS IS HOW IT GETS FALSIFIED. Two advisors,
   identical in every respect except their expression profile and who they sell
   to, put through the real model. If the plans come back interchangeable, the
   persona is decorative and the honest thing is to say so rather than to add a
   sixth question.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ENV = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV)) {
  fs.readFileSync(ENV, 'utf8').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
}
delete process.env.OPENAI_STUB;
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const G = require('../api/_lib/gtm-generate.js');

/* The same advisor used for the D1 and D3 comparisons, so the three are
   readable against each other. */
const ADVISOR = {
  first_name: 'Mira', last_name: 'Hall', business: 'Hall & Co Travel',
  host_agency: 'Nexion', market: 'Toronto', public_code: 'DEMO1234'
};
const BASE = {
  positioning: 'I plan slow, unhurried trips for people who have not properly stopped in years.',
  differentiator: 'I only sell places I have been to myself, and I say no a lot.',
  icp: 'Couples in their forties and fifties, usually both working, usually overdue a break.',
  client_examples: 'Two lawyers who had not taken a week off together since 2019. A surgeon and a teacher.',
  specialties: 'Caribbean, slow travel, milestone anniversaries',
  markets: 'Toronto, Hamilton, Oakville',
  instagram: '@hallcotravel', newsletter: 'Substack', website: 'https://hallco.example',
  email_band: '500to2k', social_band: 'under500', client_band: '100to500'
};

const A = Object.assign({}, BASE, {
  expr_primary: 'curator', expr_secondary: 'host',
  traveller_orientation: 'secondary-intentional',
  compass_needs: ['restore', 'reconnect']
});
const B = Object.assign({}, BASE, {
  expr_primary: 'storyteller', expr_secondary: 'commentator',
  traveller_orientation: 'primary',
  compass_needs: ['move', 'explore']
});

/* Details the advisor gave that a good plan ought to be able to use. The D1
   finding was that none of them ever appeared. */
const OWN_DETAILS = ['lawyer', 'surgeon', 'teacher', 'toronto', 'hamilton',
  'oakville', 'anniversar', '2019', 'nexion'];

/* Phrases that mean the plan reverted to categories. */
const FILLER = ['stunning image', 'wellness tip', 'serene', 'beautiful photo',
  'share a quote', 'countdown', 'reminder about booking'];

function show(label, sk) {
  console.log('\n' + '█'.repeat(74));
  console.log('  ' + label);
  console.log('█'.repeat(74));
  console.log('\n  PREMISE: ' + sk.premise + '\n');
  sk.weeks.forEach((w) => {
    console.log('  WEEK ' + w.week + ' — ' + w.theme);
    w.actions.forEach((x) => console.log('    · ' + x.title +
      '   [' + x.channel + '/' + x.assetKind + (x.pattern ? ', ' + x.pattern : '') + ']'));
  });
}

function scan(sk) {
  const text = JSON.stringify(sk).toLowerCase();
  return {
    ownDetails: OWN_DETAILS.filter((d) => text.includes(d)),
    filler: FILLER.filter((f) => text.includes(f)),
    titles: sk.weeks.flatMap((w) => w.actions.map((a) => a.title)),
    channels: [...new Set(sk.weeks.flatMap((w) => w.actions.map((a) => a.channel)))],
    patterns: sk.weeks.flatMap((w) => w.actions.map((a) => a.pattern)).filter(Boolean)
  };
}

(async () => {
  const ra = await G.generateSkeleton(ADVISOR, A, 'foundations');
  const rb = await G.generateSkeleton(ADVISOR, B, 'foundations');
  if (!ra.ok || !rb.ok) {
    console.error('\n  generation failed: ' + (ra.reason || rb.reason) + '\n');
    process.exit(1);
  }

  show('A · CURATOR + HOST · secondary-intentional · Restore + Reconnect', ra.skeleton);
  show('B · STORYTELLER + COMMENTATOR · primary wellness · Move + Explore', rb.skeleton);

  const sa = scan(ra.skeleton), sb = scan(rb.skeleton);
  const overlap = sa.titles.filter((t) => sb.titles.includes(t));

  console.log('\n' + '█'.repeat(74));
  console.log('  DID IT CHANGE ANYTHING?');
  console.log('█'.repeat(74));
  console.log('\n  identical action titles across the two : ' + overlap.length +
    ' of ' + Math.min(sa.titles.length, sb.titles.length) +
    (overlap.length ? '  → ' + JSON.stringify(overlap.slice(0, 3)) : ''));
  console.log('  channels A : ' + sa.channels.join(', '));
  console.log('  channels B : ' + sb.channels.join(', '));
  console.log('  patterns A : ' + [...new Set(sa.patterns)].length + ' distinct');
  console.log('  patterns B : ' + [...new Set(sb.patterns)].length + ' distinct');

  console.log('\n  THE D1 QUESTION — does it use the advisor\'s OWN details?');
  console.log('    A: ' + (sa.ownDetails.join(', ') || 'none'));
  console.log('    B: ' + (sb.ownDetails.join(', ') || 'none'));

  console.log('\n  Filler phrases D1 and D3 both produced:');
  console.log('    A: ' + (sa.filler.join(', ') || 'none'));
  console.log('    B: ' + (sb.filler.join(', ') || 'none'));

  const differ = overlap.length === 0;
  const usesOwn = sa.ownDetails.length > 0 || sb.ownDetails.length > 0;
  console.log('\n  ' + '─'.repeat(70));
  console.log('  Personas produce different plans : ' + (differ ? 'YES' : 'NO — the persona is decorative'));
  console.log('  Input-limitation resolved        : ' + (usesOwn ? 'YES' : 'NO — still not using what the advisor told us'));
  console.log('  ' + '─'.repeat(70) + '\n');
})();
