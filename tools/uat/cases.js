/* ============================================================================
   UAT CASES — the source of truth for the regression tracker
   ----------------------------------------------------------------------------
   Every case carries a `why`. That is not decoration: this pass exists partly
   so Duncan learns the system from the front end, and a checklist that only
   says WHAT to click teaches nothing. One sentence, what breaks in the real
   world if the case fails.

   ── THE GUARDS ARE THE POINT ──────────────────────────────────────────────
   Most of this product's value is in behaviour that is invisible when it
   works: the claims checker, the consent notes, view-as write refusal, the
   claims ladder, when Foundations may be mentioned, the build gate. Those
   fail silently and look fine when broken, and nobody thinks to test them.
   They are group G, they are mostly P1, and they are the cases most worth the
   time.

   ── PRIORITY ──────────────────────────────────────────────────────────────
   1  smoke — if these fail nothing else is worth testing (~35 cases, under an hour)
   2  the main pass
   3  edges worth knowing about, not worth blocking on

   Edit this file, then `node tools/uat/build-uat.js`. Results already recorded
   survive, keyed by case id.
   ========================================================================== */
'use strict';

const SITE = 'https://www.discoversaintluciawell.com';

/* ── THE TWO TEST ADVISOR ADDRESSES, IN ONE PLACE ────────────────────────
   Change these two lines and rebuild; every case follows.

   SUBADDRESSING WORKS. Purelymail enables it by default on custom domains.
   The first attempt at these addresses failed on 17 Aug and it was tempting to
   blame the + — but the domain was publishing two MX records at EQUAL
   priority at the time, Purelymail and an AWS SES inbound endpoint, so senders
   picked one at random and roughly half of everything was dropped. The +uat1
   message almost certainly landed on SES.

   One send to each address, against a coin flip, could never have told those
   two explanations apart. The fix was the MX priority, not the address. */
const UAT1 = 'concierge+uat1@discoversaintluciawell.com';
const UAT2 = 'concierge+uat2@discoversaintluciawell.com';

const ROLES = [
  { key: 'setup',    label: 'Setup',        note: 'Do these first or half the pass is meaningless.' },
  { key: 'consumer', label: 'Consumer',     note: 'A traveller who has never heard of us. Use a second browser or a private window with no Hub session.' },
  { key: 'advisor',  label: 'Travel advisor', note: 'The Hub. The largest group, and the one Duncan has seen least of.' },
  { key: 'admin',    label: 'Admin',        note: 'The console. Destructive actions live here.' },
  { key: 'guard',    label: 'Guards',       note: 'The negative tests. These look fine when broken, which is exactly why they are written down.' },
  { key: 'cross',    label: 'Cross-cutting', note: 'Layout, accessibility and hygiene across the whole thing.' },
  { key: 'teardown', label: 'Teardown',     note: 'Testing on production creates real rows. This removes them.' }
];

const CASES = [

/* ══ SETUP ═══════════════════════════════════════════════════════════════ */
{ id: 'S-01', role: 'setup', priority: 1, area: 'Before you start',
  title: 'Run migration 017',
  steps: ['Open the Supabase SQL editor',
          'Paste db/migrations/017-plan-builds.sql and run it',
          'Read the notices and the final SELECT'],
  expect: 'has_plan_builds 1, has_ledger 1, has_functions 2, and three NOTICEs confirming grants. No WARNING.',
  why: 'D7 shipped but is inert without it. Until this runs, every build-pack case is testing the old gate rather than the new one.' },

{ id: 'S-02', role: 'setup', priority: 1, area: 'Before you start',
  title: 'Confirm the ThriveCart wiring is still live',
  steps: ['POST anything to /api/hook — curl, or the browser console',
          'Check .env still holds all three THRIVECART_ values'],
  expect: 'A 200 with reason "unauthorised". NOT "not_configured", which would mean the secret never reached Vercel.',
  why: 'This was wired and proven on 17 Aug against real ThriveCart payloads. It is here so a broken redeploy or a cleared environment variable is caught before four other cases fail mysteriously.' },

{ id: 'S-03', role: 'setup', priority: 1, area: 'Before you start',
  title: 'Fix the split MX before trusting any email case',
  steps: ['Look up the MX records for discoversaintluciawell.com',
          'Decide whether the AWS SES inbound endpoint is deliberate',
          'If not, remove it. If it is, give the two records DIFFERENT priorities'],
  expect: 'One clear primary. Not two records both at preference 10.',
  why: 'Equal priority means senders choose at random, so roughly half of everything sent to this domain goes to Purelymail and half to inbound-smtp.us-east-1.amazonaws.com. If SES has no receipt rule for these addresses that half is dropped — which would mean advisor replies to journeys@ are already being lost, quietly, in production. This surfaced from a failed UAT case and matters far more than the UAT case did.' },

{ id: 'S-04', role: 'setup', priority: 1, area: 'Before you start',
  title: 'Prove both test addresses actually receive mail',
  needs: ['S-03 done, and give the 4-hour MX TTL time to expire'],
  steps: [`Send an ordinary email to ${UAT1}`,
          `Send one to ${UAT2}`,
          'Send to each a SECOND time, from a different provider if you can'],
  expect: 'All four arrive in the concierge inbox.',
  why: 'Purelymail enables subaddressing by default, so these should work — they failed on 17 Aug only because the domain was answering with two MX records at equal priority and half of everything was being dropped. Two sends each because one send against a routing fault proves nothing, which is the mistake that first sent us hunting the wrong cause.' },

{ id: 'S-05', role: 'setup', priority: 1, area: 'Before you start',
  title: 'Create two test advisor accounts',
  needs: ['S-04 confirmed'],
  steps: [`Register ${UAT1} — this one stays Registered`,
          `Register ${UAT2} — this one gets Foundations later`,
          'Approve both from /hub/admin/advisors'],
  expect: 'Both go to pending, both approve cleanly, and both can then sign in. NO approval email — see below.',
  why: 'One address per role, both greppable at teardown. Approval sends NO email from this system: it fires an Encharge event called advisor_activated, and the "you are live" message is meant to come from an Encharge flow that has not been built yet. Expect silence here. A-08 is the case that actually tests deliverability, because password reset is one of only two things that go through Resend.' },

{ id: 'S-06', role: 'setup', priority: 2, area: 'Before you start',
  title: 'Check the Encharge events are arriving',
  steps: ['Open Encharge and find the two advisors just registered',
          'Look for the events advisor_registered and advisor_activated'],
  expect: 'Both events present against both people, with the right properties.',
  why: 'The Hub fires these and never checks anybody received them. If the token is stale or the events are silently rejected, the entire onboarding sequence is dead and nothing in the product would ever say so — which is exactly what "no approval email" looked like today.' },

{ id: 'S-07', role: 'setup', priority: 1, area: 'Before you start',
  title: 'Grant Foundations to the second test advisor',
  steps: [`Open /hub/admin/advisors, choose ${UAT2}`,
          'Use the foundations_set action'],
  expect: 'Their record shows a Foundations date.',
  why: 'Half the guards are about what changes at that rung — unlimited builds, a different claims ladder, no Foundations note. Without a trained account they cannot be tested.' },

{ id: 'S-08', role: 'setup', priority: 2, area: 'Before you start',
  title: 'Note the starting row counts',
  steps: ['In Supabase, count rows in advisors, journey_shares, gtm_plan, campaign_visits'],
  expect: 'Four numbers written down.',
  why: 'Teardown is only verifiable against a before. Without this you are guessing whether the database came back to where it started.' },

{ id: 'S-09', role: 'setup', priority: 2, area: 'Before you start',
  title: 'Have a WELL link and a second browser ready',
  steps: [`Copy the WELL link from /hub for ${UAT1}`,
          'Open a private window or a different browser for the consumer role'],
  expect: 'Two independent sessions, one signed in and one not.',
  why: 'Consumer cases must run with no Hub session. Testing them in the signed-in window silently exercises a different code path.' },

/* ══ CONSUMER ════════════════════════════════════════════════════════════ */
{ id: 'C-01', role: 'consumer', priority: 1, area: 'Public pages',
  title: 'The home page loads and the hero reads correctly',
  steps: [`Open ${SITE}/ in the consumer browser at about 2000px wide`],
  expect: 'Hero fold is complete and legible, nothing overlaps, no console errors.',
  why: 'Duncan reviews on a ~2000px screen and this is the first thing anyone sees. clamp() values that look right at 1400px can break here.' },

{ id: 'C-02', role: 'consumer', priority: 1, area: 'Public pages',
  title: 'The Journey page loads and the Finder starts',
  steps: ['Open /journey', 'Scroll to the Finder and start it'],
  expect: 'Question 1 appears; the ambient video plays or degrades quietly.',
  why: 'This is the conversion surface — every WELL link and QR code in the product points at it.' },

{ id: 'C-03', role: 'consumer', priority: 2, area: 'Public pages',
  title: 'The remaining public pages load clean',
  steps: ['Visit /explore, /about, /eclipse in turn'],
  expect: 'Each renders fully with no console errors and no broken images.',
  why: 'These carry the destination story. A broken one is invisible to us and obvious to a traveller.' },

{ id: 'C-04', role: 'consumer', priority: 2, area: 'Public pages',
  title: 'The advisor-facing public pages load clean',
  steps: ['Visit /advisors, /advisors/intro, /advisors/foundations, /advisors/immersion, /advisors/hub, /advisors/data-undertaking'],
  expect: 'All six render; /foundations redirects to /advisors/foundations.',
  why: 'These are the recruitment funnel. The redirect is in vercel.json and is the sort of thing that breaks unnoticed.' },

{ id: 'C-22', role: 'consumer', priority: 1, area: 'Public pages',
  title: 'Both Foundations buy buttons reach a live checkout',
  steps: ['Open /advisors/foundations',
          'Press Enroll on the Standard card, and again in the final CTA',
          'Press Get VIP in both places too'],
  expect: 'All four open a ThriveCart checkout in a new tab, Standard at 97 and VIP at ,497 — matching the prices on our page.',
  why: 'All four pointed at #enroll until 17 Aug, which scrolled to a block whose own buttons linked to themselves. There was no way to buy Foundations at all. Prices are checked against the cart because two numbers in two systems drift, and the one an advisor is charged is the one that matters.' },

{ id: 'C-23', role: 'consumer', priority: 2, area: 'Public pages',
  title: 'The recruitment pages describe the product that exists',
  steps: ['Open /advisors/hub and read the What is in it list',
          'Open /advisors and read the Activate step',
          'Search both pages for "in development"'],
  expect: 'Four things listed on the Hub page including the 30-day campaign; the campaign named in Activate; the only in-development claim left is the advisor designation.',
  why: 'Both pages said campaign creative was still being built for weeks after it shipped, so the site described a smaller product than it has to the people deciding whether to sign up. Stale claims decay in both directions and the flattering direction is the one nobody checks.' },

{ id: 'C-05', role: 'consumer', priority: 2, area: 'Public pages',
  title: 'The policy pages load and are current',
  steps: ['Visit /privacy, /terms, /accessibility'],
  expect: 'All three render and read as current — retention stated, contact route present.',
  why: 'These are the pages that matter if anybody ever complains, and they are the last ones anyone looks at.' },

{ id: 'C-06', role: 'consumer', priority: 1, area: 'Journey Finder',
  title: 'All six questions answer and advance',
  steps: ['Start the Finder', 'Answer intention, place, companions, orientation, pace, recognition'],
  expect: 'Each question advances cleanly; progress is visible; the result appears at the end.',
  why: 'Six questions is the whole consumer product. One that will not advance ends every journey at that point.' },

{ id: 'C-07', role: 'consumer', priority: 2, area: 'Journey Finder',
  title: 'Going back preserves earlier answers',
  steps: ['Answer three questions', 'Go back twice', 'Change an answer and go forward'],
  expect: 'Earlier answers are still selected; the changed one is respected.',
  why: 'People reconsider. A finder that forgets on Back makes them start again, and most will not.' },

{ id: 'C-08', role: 'consumer', priority: 1, area: 'Journey Finder',
  title: 'The result names villages and reads as written for you',
  steps: ['Complete the Finder', 'Read the result carefully'],
  expect: 'Villages are named, the copy reflects the answers given, nothing reads as a placeholder.',
  why: 'This is the moment the product either feels personal or feels like a quiz. It is also what the advisor is later asked to follow up on.' },

{ id: 'C-09', role: 'consumer', priority: 2, area: 'Journey Finder',
  title: 'Answering differently produces a different result',
  steps: ['Run the Finder twice with materially different answers, especially place and orientation'],
  expect: 'The two results differ in villages and in register.',
  why: 'If the result barely moves, the six questions are decoration and the whole premise is false.' },

{ id: 'C-10', role: 'consumer', priority: 2, area: 'Journey Finder',
  title: 'The wellness orientation changes the register, not just the content',
  steps: ['Run once as wellness-first', 'Run again as sceptical or incidental'],
  expect: 'The sceptical run does not require the traveller to adopt wellness as an identity.',
  why: 'F1 added this deliberately. Marketing WELL to somebody who does not call themselves a wellness traveller is most of the addressable market.' },

{ id: 'C-11', role: 'consumer', priority: 1, area: 'Sharing',
  title: 'The result link restores the same result',
  steps: ['Complete the Finder', 'Copy the URL including the #r= hash',
          'Open it in a fresh private window'],
  expect: 'The same result renders immediately, without replaying the questions.',
  why: 'The hash is the whole sharing mechanism. If it does not restore, every shared link lands on a blank quiz.' },

{ id: 'C-12', role: 'consumer', priority: 1, area: 'Sharing',
  title: 'The share panel asks for consent before the email',
  steps: ['On a result, open the share/contact panel'],
  expect: 'A consent line is visible before or beside the email field, and nothing is pre-ticked.',
  why: 'Consent is captured here or the advisor inherits a CASL liability for every message they later send.' },

{ id: 'C-13', role: 'consumer', priority: 1, area: 'Sharing',
  title: 'Sharing with a specific advisor reaches that advisor',
  needs: [`The WELL link for ${UAT1}`],
  steps: ['Open the WELL link', 'Complete the Finder', 'Share the result, first name ZZTest'],
  expect: `The Journey appears under ${UAT1} at /hub/journeys, not under anybody else.`,
  why: 'Attribution is the product. A Journey landing on the wrong advisor is worse than losing it.' },

{ id: 'C-14', role: 'consumer', priority: 2, area: 'Sharing',
  title: 'Sharing with no advisor goes to the house account',
  steps: ['Open /journey directly, with no WELL link and no advisor parameter',
          'Complete and share as ZZTest'],
  expect: 'The Journey is captured against the house account rather than lost.',
  why: 'Organic traffic has no advisor attached. Without the house account those people fall on the floor.' },

{ id: 'C-15', role: 'consumer', priority: 2, area: 'Sharing',
  title: 'The confirmation says only what is true',
  steps: ['Complete a share', 'Read the confirmation message'],
  expect: 'It does not promise a reply within a timeframe nobody has committed to, and does not claim the data is shared more widely than it is.',
  why: 'This copy was corrected once already for saying "share with our network". A confirmation that overpromises is the first broken promise.' },

{ id: 'C-16', role: 'consumer', priority: 1, area: 'WELL link',
  title: 'A WELL link resolves and records a visit',
  needs: [`The WELL link for ${UAT1}`],
  steps: ['Open the WELL link in a private window', 'Note the time',
          `Check /hub as ${UAT1}`],
  expect: 'It lands on the Journey page and the visit count increases.',
  why: 'Visits are the first number in the funnel and the input to the whole loop-back report.' },

{ id: 'C-17', role: 'consumer', priority: 3, area: 'WELL link',
  title: 'An unknown WELL code fails gracefully',
  steps: ['Open /well/NOTACODE'],
  expect: 'A sensible page, not a stack trace and not a blank screen.',
  why: 'Codes get mistyped off printed QR cards, and this is the first thing a stranger would see.' },

{ id: 'C-18', role: 'consumer', priority: 2, area: 'Sweepstakes',
  title: 'The sweepstakes link opens the entry path',
  needs: ['An open sweepstakes and its code'],
  steps: ['Open /well/<code>/<sweeps>'],
  expect: 'The prize-draw variant renders with its own consent and rules.',
  why: 'A prize draw has legal requirements a normal share does not. If the variant does not render, entries are being taken without them.' },

{ id: 'C-19', role: 'consumer', priority: 2, area: 'Sweepstakes',
  title: 'The entry confirmation is truthful',
  steps: ['Complete an entry as ZZTest', 'Read the confirmation'],
  expect: 'It confirms entry without implying odds, a win, or a prize that is not on offer.',
  why: 'Prize-draw copy is the most regulated text in the product, and it is judged on what an entrant perceives.' },

{ id: 'C-20', role: 'consumer', priority: 2, area: 'Sweepstakes',
  title: 'A second entry by the same person is refused',
  steps: ['Try to enter the same draw twice with the same email'],
  expect: 'The second attempt is refused clearly, not silently duplicated.',
  why: 'One entry per person is a published rule. Silently accepting a second one makes the draw unfair and the rules untrue.' },

{ id: 'C-21', role: 'consumer', priority: 3, area: 'Journey Finder',
  title: 'The Finder works on a phone',
  steps: ['Complete the whole Finder on an actual phone at portrait width'],
  expect: 'Every option is tappable, nothing is clipped, the result is readable.',
  why: 'Most of this traffic will arrive from a QR code, which means a phone, in a venue, one-handed.' },

/* ══ ADVISOR ═════════════════════════════════════════════════════════════ */
{ id: 'A-01', role: 'advisor', priority: 1, area: 'Registration',
  title: 'Registration accepts a complete application',
  steps: ['Open /hub/register', 'Fill first name, last name, email, business, host agency, website, "Have we met?", password',
          'Accept the undertaking and submit'],
  expect: 'A pending confirmation, and the account appears in the admin queue.',
  why: 'This is the front door for every advisor. It also collects what an admin needs to judge whether they are real.' },

{ id: 'A-02', role: 'advisor', priority: 2, area: 'Registration',
  title: 'Registration refuses a duplicate email',
  steps: [`Register again with ${UAT1}`],
  expect: 'A clear refusal, and no second account is created.',
  why: 'Two accounts on one email splits their Journeys across records neither of them can see whole.' },

{ id: 'A-03', role: 'advisor', priority: 2, area: 'Registration',
  title: 'A weak password is refused',
  steps: ['Try to register with a very short password'],
  expect: 'Refused before submission, with the requirement stated.',
  why: 'These accounts hold other people\'s names, emails and travel plans.' },

{ id: 'A-04', role: 'advisor', priority: 2, area: 'Registration',
  title: 'The undertaking must be accepted',
  steps: ['Try to submit without accepting the data undertaking'],
  expect: 'Submission is blocked.',
  why: 'The undertaking is the legal basis on which an advisor is handed consumer data. Optional consent is not consent.' },

{ id: 'A-05', role: 'advisor', priority: 1, area: 'Registration',
  title: 'A pending advisor cannot use the Hub yet',
  steps: ['Sign in as a registered-but-unapproved account'],
  expect: 'A pending state that explains what happens next — not a broken Hub and not full access.',
  why: 'Approval is the only human check that an advisor is real. If pending accounts get in, the check is decorative.' },

{ id: 'A-06', role: 'advisor', priority: 1, area: 'Sign in',
  title: 'Sign in works and lands on the Hub',
  steps: ['Open /hub/login', `Sign in as ${UAT1}`],
  expect: 'Lands on /hub with their name shown.',
  why: 'Everything else in this group depends on it.' },

{ id: 'A-07', role: 'advisor', priority: 2, area: 'Sign in',
  title: 'A wrong password is refused without leaking anything',
  steps: ['Sign in with the right email and a wrong password'],
  expect: 'A refusal that does not reveal whether the email exists.',
  why: 'A message that distinguishes "no such account" from "wrong password" hands over a list of who is registered.' },

{ id: 'A-08', role: 'advisor', priority: 2, area: 'Sign in',
  title: 'Forgot password sends a working reset',
  steps: [`Use /hub/forgot for ${UAT1}`, 'Open the email', 'Set a new password'],
  expect: 'The email arrives, the link works once, the new password signs in.',
  why: 'Advisors will forget. A broken reset is a support burden that arrives one person at a time.' },

{ id: 'A-09', role: 'advisor', priority: 3, area: 'Sign in',
  title: 'A used or stale reset link is refused',
  steps: ['Use the same reset link a second time'],
  expect: 'Refused, with a route to request a new one.',
  why: 'A reset link that keeps working is a permanent key sitting in an inbox.' },

{ id: 'A-10', role: 'advisor', priority: 2, area: 'Sign in',
  title: 'Sign out ends the session',
  steps: ['Sign out', 'Press Back', 'Try /hub/journeys directly'],
  expect: 'Both land on the login screen.',
  why: 'Advisors work on shared and borrowed machines.' },

{ id: 'A-50', role: 'advisor', priority: 2, area: 'Hub home',
  title: 'The prominent Copy button actually copies',
  steps: ['Open /hub as an advisor with no visits yet',
          'Press the gold "Copy your WELL link" button under Next',
          'Paste somewhere'],
  expect: 'The link is on the clipboard and the button says Copied. It does not scroll you to a second Copy button.',
  why: 'It used to be an anchor to the input holding the link, so you pressed copy twice to copy once. Nothing errored and no test could catch it — valid markup, working anchor, reachable link, and a button whose label promised something it did not do. Found in UAT on 17 Aug.' },

{ id: 'A-11', role: 'advisor', priority: 1, area: 'Hub home',
  title: 'The Hub home shows the WELL link and the funnel',
  steps: ['Open /hub'],
  expect: 'Their WELL link, a QR code, and counts for visits, Journeys started and shared.',
  why: 'This is the page that answers "is any of this working". It is also where they get the link they actually share.' },

{ id: 'A-12', role: 'advisor', priority: 2, area: 'Hub home',
  title: 'The QR code downloads and scans',
  steps: ['Download the QR code', 'Scan it with a phone'],
  expect: 'It resolves to their WELL link.',
  why: 'These get printed on cards and put on tables. A QR that does not scan fails silently and expensively.' },

{ id: 'A-13', role: 'advisor', priority: 1, area: 'Journeys',
  title: 'A shared Journey appears with the traveller\'s answers',
  needs: ['C-13 completed'],
  steps: [`Open /hub/journeys as ${UAT1}`, 'Open the ZZTest Journey'],
  expect: 'Their name, contact details, timing and the answers they gave.',
  why: 'This is what the advisor actually sells from. Missing answers make the follow-up generic.' },

{ id: 'A-14', role: 'advisor', priority: 2, area: 'Journeys',
  title: 'The list puts the ones needing attention first',
  steps: ['With several Journeys at different stages, open /hub/journeys'],
  expect: 'New and un-contacted ones sort above settled ones.',
  why: 'An advisor opens this between other work. The ordering is the product deciding what deserves their next ten minutes.' },

{ id: 'A-15', role: 'advisor', priority: 2, area: 'Journeys',
  title: 'Stage changes save and persist',
  steps: ['Change a Journey through New, Contacted, Discovery, Planning, Booked',
          'Reload after each'],
  expect: 'Each stage sticks.',
  why: 'The stage drives the attention ordering. If it does not save, the list stops being useful within a week.' },

{ id: 'A-16', role: 'advisor', priority: 2, area: 'Journeys',
  title: 'Notes save against the right Journey',
  steps: ['Add a note', 'Reload', 'Open a different Journey'],
  expect: 'The note is on the first Journey and nowhere else.',
  why: 'A note leaking onto another traveller\'s record is a privacy failure that looks like a UI bug.' },

{ id: 'A-17', role: 'advisor', priority: 2, area: 'Journeys',
  title: 'The empty state reads well',
  steps: ['Sign in as an advisor with no Journeys yet'],
  expect: 'It explains how to get one rather than showing an empty table.',
  why: 'Every advisor starts here, and it is the moment they decide whether this is worth their attention.' },

{ id: 'A-18', role: 'advisor', priority: 2, area: 'Journeys',
  title: 'The introduce flow composes a sensible message',
  steps: ['Open a Journey', 'Start the introduce flow', 'Read the suggested line'],
  expect: 'It reflects that traveller\'s answers and is editable before anything is sent.',
  why: 'It goes out under the advisor\'s name. A generic or wrong introduction costs them the client.' },

{ id: 'A-19', role: 'advisor', priority: 1, area: 'Campaign · intake',
  title: 'The campaign screen loads with no plan',
  steps: [`Open /hub/campaign as ${UAT1}`],
  expect: 'A build section, a readiness percentage, the copy-paste prompt and the intake form, all open.',
  why: 'With no plan this screen IS the intake. If the form were folded away here there would be nothing to do.' },

{ id: 'A-20', role: 'advisor', priority: 1, area: 'Campaign · intake',
  title: 'Intake fields save independently',
  steps: ['Fill positioning and ideal client only', 'Save', 'Reload'],
  expect: 'Both persist; the empty fields are still empty and nothing was required.',
  why: 'Every field is optional by design. A form that demands everything is a form nobody finishes.' },

{ id: 'A-21', role: 'advisor', priority: 2, area: 'Campaign · intake',
  title: 'The copy-paste prompt copies and is usable',
  steps: ['Copy the prompt', 'Paste it into ChatGPT or Claude', 'Read what comes back'],
  expect: 'It produces answers worth pasting into the form.',
  why: 'This is the whole answer to the blank-textarea problem, and it costs us nothing. If the prompt is weak, the intake stays empty.' },

{ id: 'A-22', role: 'advisor', priority: 2, area: 'Campaign · intake',
  title: 'Readiness moves as fields are filled',
  steps: ['Note the percentage', 'Fill three more fields', 'Reload'],
  expect: 'The percentage rises and the "still needed" list shrinks.',
  why: 'It is the only signal telling an advisor whether a plan is worth building yet.' },

{ id: 'A-23', role: 'advisor', priority: 1, area: 'Campaign · persona',
  title: 'The five persona questions run start to finish',
  steps: ['Open /hub/campaign/profile', 'Answer all five'],
  expect: 'Each advances; the reveal appears at the end.',
  why: 'The persona is what lifts a plan above six one-line fields. It is also under two minutes, which is the only reason anyone finishes it.' },

{ id: 'A-24', role: 'advisor', priority: 2, area: 'Campaign · persona',
  title: 'No question asks the advisor what they are',
  steps: ['Read all five questions carefully'],
  expect: 'Every question asks what they have done or what happened — none asks them to pick a personality type.',
  why: 'Self-described type is the weakest evidence there is. This is the constraint most likely to erode because typology quizzes are more fun.' },

{ id: 'A-25', role: 'advisor', priority: 2, area: 'Campaign · persona',
  title: 'Leaving and returning resumes where it stopped',
  steps: ['Answer two questions', 'Navigate away', 'Return to /hub/campaign/profile'],
  expect: 'It resumes at question three, not question one.',
  why: 'People are interrupted. Restarting a five-question flow is how it becomes a zero-question flow.' },

{ id: 'A-26', role: 'advisor', priority: 2, area: 'Campaign · persona',
  title: 'The reveal reads as a starting point and can be corrected',
  steps: ['Reach the reveal', 'Read it', 'Change it to something else and save'],
  expect: 'It reads as a read rather than a verdict, and the correction saves.',
  why: 'A correction is stronger evidence than the five answers that produced it, and the generator weights it higher.' },

{ id: 'A-27', role: 'advisor', priority: 3, area: 'Campaign · brief',
  title: 'A complete brief pastes back and parses',
  steps: ['Run the brief prompt in your own AI', 'Paste the fenced block back'],
  expect: 'It reports what it found — voice, clients, markets, objections, proof, angles.',
  why: 'The brief is the ceiling on how specific a campaign can get. Everything above it is structure; this is the only source of real detail.' },

{ id: 'A-28', role: 'advisor', priority: 3, area: 'Campaign · brief',
  title: 'A truncated brief fails loudly',
  steps: ['Paste only the first half of a brief'],
  expect: 'It names what is missing rather than accepting three quarters of it.',
  why: 'Long paste-backs get cut off constantly. Silent acceptance means a plan built on a fragment while claiming otherwise.' },

{ id: 'A-29', role: 'advisor', priority: 1, area: 'Campaign · plan',
  title: 'Building a plan works end to end',
  steps: ['With readiness sufficient, press Build my 30-day plan', 'Watch the overlay', 'Wait for it to finish'],
  expect: 'The overlay narrates progress and a four-week plan appears with copy written.',
  why: 'This is the feature. It also costs real money per run, so a failure here is expensive as well as embarrassing.' },

{ id: 'A-30', role: 'advisor', priority: 1, area: 'Campaign · plan',
  title: 'This week leads and the other weeks are one click away',
  steps: ['Look at the plan without scrolling far'],
  expect: 'The current week is open; the other weeks sit behind "What is coming" and "Already behind you".',
  why: 'Four weeks at once is around forty paragraphs, and the Monday-morning effect of that is paralysis rather than diligence.' },

{ id: 'A-31', role: 'advisor', priority: 2, area: 'Campaign · plan',
  title: 'The folded weeks open and are complete',
  steps: ['Open both folds'],
  expect: 'Every week and every asset is there, fully written.',
  why: 'Hidden must mean hidden, not missing. If a fold is empty the plan is a quarter of what it claims.' },

{ id: 'A-32', role: 'advisor', priority: 2, area: 'Campaign · plan',
  title: 'The plan reflects the capacity answer',
  steps: ['Compare a plan built at low capacity with one at high capacity'],
  expect: 'The smaller capacity produces materially fewer actions.',
  why: 'Promising a fixed count regardless of what somebody can do is how a plan becomes a source of guilt instead of a tool.' },

{ id: 'A-33', role: 'advisor', priority: 1, area: 'Campaign · assets',
  title: 'Copy puts the text on the clipboard',
  steps: ['Press Copy on a caption', 'Paste it somewhere'],
  expect: 'The full text, with the WELL link substituted rather than a token like {{WELL_LINK}}.',
  why: 'The token leaked into a rendered page once already. An advisor pasting {{WELL_LINK}} into Instagram is the worst possible failure.' },

{ id: 'A-34', role: 'advisor', priority: 2, area: 'Campaign · assets',
  title: 'Edit, then Revert, restores the original',
  steps: ['Edit a piece of copy and save', 'Confirm it shows as edited', 'Press Revert'],
  expect: 'The original returns without regenerating or spending anything.',
  why: 'Revert must restore, not re-ask the model. A revert that regenerates gives back different words and charges for them.' },

{ id: 'A-35', role: 'advisor', priority: 2, area: 'Campaign · assets',
  title: 'Regenerate rewrites one piece and leaves the rest alone',
  steps: ['Regenerate a single asset', 'Check the others'],
  expect: 'Only that piece changed.',
  why: 'Generation is per asset so one failure cannot take the plan with it. This confirms that isolation from the front.' },

{ id: 'A-36', role: 'advisor', priority: 2, area: 'Campaign · assets',
  title: 'Another angle rewrites from a different starting point',
  steps: ['Open "Try another angle"', 'Choose a different angle'],
  expect: 'Noticeably different copy doing the same job, and it does not cost a build.',
  why: 'This is the pressure valve for "I do not like this one" that does not cost anybody money.' },

{ id: 'A-37', role: 'advisor', priority: 1, area: 'Campaign · assets',
  title: '"Make it yours" carries the shot list',
  steps: ['On an Instagram or Facebook action, open "Make it yours"'],
  expect: 'A shot described in a sentence, a frame ratio and pixel size, a light note, a keep-out list, and a no-picture fallback.',
  why: 'An advisor with a caption and no picture posts nothing. Until D6 the plan said nothing at all about the image.' },

{ id: 'A-38', role: 'advisor', priority: 2, area: 'Campaign · assets',
  title: 'The shot is something they could photograph this week',
  steps: ['Read several shot lists across weeks'],
  expect: 'Every one is shootable at home with a phone — no Saint Lucia, no models, no studio.',
  why: 'Most advisors have never been. A brief asking for the destination produces either nothing or a lifted image.' },

{ id: 'A-39', role: 'advisor', priority: 2, area: 'Campaign · assets',
  title: 'Personalization and the busy-week fallback appear',
  steps: ['Open "Make it yours" on several assets'],
  expect: 'A "where to put yourself in it" note and an "if this week gets away from you" note.',
  why: 'These were generated and stored since D4 and rendered nowhere until D6 — worth confirming they now actually reach a person.' },

{ id: 'A-40', role: 'advisor', priority: 1, area: 'Campaign · report',
  title: 'A brand-new plan shows no report at all',
  steps: ['Immediately after building, look for "What happened"'],
  expect: 'No report section.',
  why: '"0 visits, 0 Journeys" in week one reports on a campaign nobody has had time to run and reads as a verdict on them.' },

{ id: 'A-41', role: 'advisor', priority: 2, area: 'Campaign · report',
  title: 'After real traffic the report appears and reads plainly',
  needs: ['C-16 completed so there are visits'],
  steps: ['Open a WELL link a few times', 'Return to /hub/campaign'],
  expect: 'A "What happened" section with real counts in plain sentences, no percentages on tiny numbers.',
  why: 'This is the only place in the product that tells an advisor whether any of it worked.' },

{ id: 'A-42', role: 'advisor', priority: 2, area: 'Campaign · report',
  title: 'Somebody waiting for a reply is surfaced above the plan',
  needs: ['At least one Journey at stage New'],
  steps: ['Open /hub/campaign'],
  expect: 'A line saying somebody is waiting, above this week\'s actions, linking to /hub/journeys.',
  why: 'A campaign that keeps posting while the replies pile up has failed at the only thing it was for.' },

{ id: 'A-43', role: 'advisor', priority: 2, area: 'Campaign · plan',
  title: 'The confidence strip names what the plan was built from',
  steps: ['Find the "Built from:" line'],
  expect: 'It lists the real inputs and what was missing, and matches what you actually filled in.',
  why: 'It is the honest surface. A strip claiming an input the generator never received would make the one truthful thing dishonest.' },

{ id: 'A-44', role: 'advisor', priority: 2, area: 'Campaign · plan',
  title: 'The rights note appears once, not on every asset',
  steps: ['Scan the whole plan for the note about shot lists rather than pictures'],
  expect: 'Exactly once.',
  why: 'A warning repeated nine times is wallpaper and stops being read on the second one.' },

{ id: 'A-45', role: 'advisor', priority: 2, area: 'Campaign · profile fold',
  title: 'With a plan, the profile folds away',
  steps: ['With a plan on screen, look below it'],
  expect: 'The readiness, prompt and intake sit behind one summary showing the readiness percentage.',
  why: 'With a plan the advisor came to use a kit. Four open cards and eleven fields underneath bury it.' },

{ id: 'A-46', role: 'advisor', priority: 2, area: 'Account',
  title: 'Profile changes save',
  steps: ['Open /hub/account', 'Change the business name and save', 'Reload'],
  expect: 'The change persists and shows in the header where relevant.',
  why: 'This name ends up in campaign copy published under their name.' },

{ id: 'A-47', role: 'advisor', priority: 2, area: 'Account',
  title: 'The data undertaking is readable and its state is shown',
  steps: ['Open /hub/undertaking'],
  expect: 'The current version, whether they have accepted it and when.',
  why: 'It is the basis on which they hold other people\'s data. "I never agreed to that" needs an answer with a date on it.' },

{ id: 'A-48', role: 'advisor', priority: 3, area: 'Sweepstakes',
  title: 'An advisor sees their own entries only',
  needs: ['C-19 completed'],
  steps: ['Open /hub/sweepstakes and a draw'],
  expect: 'Their entries, with counts, and nobody else\'s.',
  why: 'Entries are personal data belonging to people who entered through one advisor.' },

{ id: 'A-49', role: 'advisor', priority: 3, area: 'Sweepstakes',
  title: 'The entry export downloads and opens',
  steps: ['Export entries', 'Open the file'],
  expect: 'A readable file with the expected rows.',
  why: 'A draw has to be administrable outside the product when it comes time to actually pick somebody.' },

/* ══ ADMIN ═══════════════════════════════════════════════════════════════ */
{ id: 'D-01', role: 'admin', priority: 1, area: 'Console',
  title: 'The admin console is reachable only by an admin',
  steps: [`Open /hub/admin as ${UAT1} (not an admin)`],
  expect: 'Refused or redirected — not rendered.',
  why: 'The console can delete people and grant training. It is the highest-value target in the product.' },

{ id: 'D-02', role: 'admin', priority: 1, area: 'Console',
  title: 'The dashboard shows the queue and the numbers',
  steps: ['Open /hub/admin as an admin'],
  expect: 'Pending applications and system counts.',
  why: 'This is where Duncan will actually live when advisors start arriving.' },

{ id: 'D-03', role: 'admin', priority: 1, area: 'Advisors',
  title: 'Approving an advisor activates them and emails them',
  steps: ['Open /hub/admin/advisors', 'Approve a pending account'],
  expect: 'Status active, an audit entry, and an advisor_activated event in Encharge. NO email from us — that flow does not exist yet.',
  why: 'Approval is the moment their link starts working, and the email is what tells them so.' },

{ id: 'D-04', role: 'admin', priority: 2, area: 'Advisors',
  title: 'Pause and unpause work',
  steps: ['Pause an advisor', 'Check their Hub access', 'Unpause'],
  expect: 'Access stops and returns; both are audited.',
  why: 'The reversible lever. Without it the only options are leave alone or delete.' },

{ id: 'D-05', role: 'admin', priority: 2, area: 'Advisors',
  title: 'Lock and unlock work',
  steps: ['Lock an account', 'Try to sign in as them', 'Unlock'],
  expect: 'Sign-in refused while locked.',
  why: 'This is the response to a compromised account, and it needs to be immediate.' },

{ id: 'D-06', role: 'admin', priority: 2, area: 'Advisors',
  title: 'Setting and clearing Foundations changes what they may claim',
  steps: [`Use foundations_set on ${UAT2}`, 'Check their campaign screen', 'Then foundations_clear'],
  expect: 'The claims ladder follows the date in both directions.',
  why: 'The ladder governs what their published copy may say about their qualifications. It has to follow the record exactly.' },

{ id: 'D-07', role: 'admin', priority: 2, area: 'Advisors',
  title: 'Promote and demote change admin rights',
  steps: ['Promote a test account', 'Confirm console access', 'Demote'],
  expect: 'Rights granted and removed, both audited.',
  why: 'Admin rights are the keys to everything else in this group.' },

{ id: 'D-08', role: 'admin', priority: 2, area: 'Advisors',
  title: 'An admin cannot act on their own account',
  steps: ['Try to pause, lock or demote yourself'],
  expect: 'Refused.',
  why: 'Locking yourself out of the console has no recovery path short of SQL.' },

{ id: 'D-09', role: 'admin', priority: 3, area: 'Advisors',
  title: 'The house account can be set and cleared, including on yourself',
  steps: ['Set the house flag', 'Confirm unattributed Journeys land there', 'Clear it'],
  expect: 'Both work; self-action is allowed here specifically.',
  why: 'The account most likely to hold the lead pool is the one the person configuring it is signed into.' },

{ id: 'D-10', role: 'admin', priority: 2, area: 'People',
  title: 'Creating an advisor by hand works',
  steps: ['Open /hub/admin/advisors/new', 'Create one'],
  expect: 'It appears in the list, active or pending as chosen.',
  why: 'Advisors get recruited in person and at events, not only through the form.' },

{ id: 'D-11', role: 'admin', priority: 2, area: 'People',
  title: 'A valid CSV imports',
  steps: ['Open /hub/admin/import', 'Import a small valid CSV'],
  expect: 'Rows created, with a summary of what happened.',
  why: 'This is how a cohort arrives after a training event.' },

{ id: 'D-12', role: 'admin', priority: 2, area: 'People',
  title: 'A malformed CSV is refused with a reason',
  steps: ['Import a file with a missing column and a bad email'],
  expect: 'It names the problem rows rather than half-importing.',
  why: 'A partial import is worse than a refused one — you cannot tell what landed without checking every row.' },

{ id: 'D-13', role: 'admin', priority: 3, area: 'People',
  title: 'Duplicate rows in an import are handled',
  steps: ['Import a CSV containing an email that already exists'],
  expect: 'Skipped or reported, never silently duplicated.',
  why: 'Cohort lists overlap constantly.' },

{ id: 'D-14', role: 'admin', priority: 1, area: 'View-as',
  title: 'View-as shows their Hub with a banner',
  steps: ['From an advisor\'s admin page, start view-as', 'Open /hub'],
  expect: 'Their Hub, with an unmistakable banner saying whose it is.',
  why: 'Support means seeing what they see. Not knowing you are in somebody else\'s account is how mistakes get made under their name.' },

{ id: 'D-15', role: 'admin', priority: 1, area: 'View-as',
  title: 'View-as masks personal data until revealed',
  steps: ['While viewing as, open a Journey'],
  expect: 'Contact details masked, with a deliberate reveal.',
  why: 'Support rarely needs the traveller\'s email. Masking by default means their data is seen on purpose, not by accident.' },

{ id: 'D-16', role: 'admin', priority: 2, area: 'View-as',
  title: 'Revealing masked data is audited',
  steps: ['Reveal something', 'Check /hub/admin/audit'],
  expect: 'An entry naming who revealed what and when.',
  why: 'The audit trail is what makes the reveal defensible rather than a quiet look at somebody\'s private information.' },

{ id: 'D-17', role: 'admin', priority: 2, area: 'View-as',
  title: 'Exiting view-as returns to the admin',
  steps: ['Use /hub/viewas/exit'],
  expect: 'Back to the admin\'s own Hub.',
  why: 'A view-as you cannot leave is a session you keep working in without noticing.' },

{ id: 'D-18', role: 'admin', priority: 2, area: 'Audit',
  title: 'The audit log records the session\'s actions',
  steps: ['Open /hub/admin/audit after doing the cases above'],
  expect: 'Approve, pause, promote, reveal and delete all present with actor and time.',
  why: 'Everything destructive in this product is defensible only because of this log.' },

{ id: 'D-19', role: 'admin', priority: 2, area: 'Subject rights',
  title: 'A person can be found by email',
  steps: ['Open /hub/admin/subject', 'Search a ZZTest email'],
  expect: 'Their records across the system.',
  why: 'A subject-access request has a legal clock on it. Finding somebody has to be one search, not an investigation.' },

{ id: 'D-20', role: 'admin', priority: 2, area: 'Subject rights',
  title: 'Their data exports',
  steps: ['Export what is held about a ZZTest person'],
  expect: 'A readable file containing what is actually held.',
  why: 'This is the deliverable a subject-access request asks for.' },

{ id: 'D-21', role: 'admin', priority: 1, area: 'Subject rights',
  title: 'Deleting a person removes them everywhere',
  steps: ['Delete a ZZTest person', 'Search again', 'Check the advisor\'s Journeys'],
  expect: 'Gone from both, with an audit entry.',
  why: 'A deletion that leaves rows behind is a promise broken to somebody who asked to be forgotten.' },

{ id: 'D-22', role: 'admin', priority: 2, area: 'Advisors',
  title: 'Deleting an advisor offers transfer or erase',
  steps: ['Open the delete section on a test advisor'],
  expect: 'A choice between transferring their Journeys and erasing them, with the impact stated and a confirmation for erase.',
  why: 'Deleting an advisor should never silently decide the fate of the travellers who trusted them.' },

{ id: 'D-23', role: 'admin', priority: 3, area: 'Retention',
  title: 'The retention position is visible',
  steps: ['Find where retention is stated in the console and on /privacy'],
  expect: 'Both say the same thing.',
  why: 'A stated retention period we do not honour, or two places saying different things, is worse than saying nothing.' },

/* ══ GUARDS ══════════════════════════════════════════════════════════════ */
{ id: 'G-01', role: 'guard', priority: 1, area: 'Claims',
  title: 'A serious health claim disables the Copy button',
  steps: ['Edit a caption to say something like "this retreat cures anxiety"', 'Save'],
  expect: 'A warning above the text and Copy disabled — not a dialog, not just a red border.',
  why: 'Health claims are judged on what a consumer perceives. This is the last thing between a wrong sentence and a published post under the advisor\'s name.' },

{ id: 'G-02', role: 'guard', priority: 1, area: 'Claims',
  title: 'Removing the claim re-enables Copy',
  steps: ['Edit the sentence out', 'Save'],
  expect: 'The warning clears and Copy works again.',
  why: 'A block that cannot be cleared teaches people to work around the tool instead of fixing the copy.' },

{ id: 'G-03', role: 'guard', priority: 2, area: 'Claims',
  title: 'Milder wording warns without blocking',
  steps: ['Use softer but still claim-like wording'],
  expect: 'A note, and Copy still available.',
  why: 'If everything blocks, nothing is read. Severity has to mean something.' },

{ id: 'G-04', role: 'guard', priority: 1, area: 'Consent',
  title: 'The consent warning appears on direct messages only',
  steps: ['Compare a text/DM/email asset with a public caption'],
  expect: 'The CASL/TCPA note on the first three and not on the caption.',
  why: 'The penalties land on the sender — the advisor. A warning on every block is wallpaper; on the right blocks it is protection.' },

{ id: 'G-05', role: 'guard', priority: 1, area: 'Claims ladder',
  title: 'A registered advisor is described as Registered',
  steps: [`As ${UAT1}, read "What you may say about yourself"`],
  expect: 'Registered — not Foundations, not trained.',
  why: 'Describing yourself as trained when you are not is a claim about a qualification, published under their name.' },

{ id: 'G-06', role: 'guard', priority: 1, area: 'Foundations timing',
  title: 'Foundations is not pitched before there is a result',
  steps: ['As an advisor with a plan but zero visits, read the whole campaign screen'],
  expect: 'No Foundations call to action anywhere. Factual explanations of why copy says what it says are fine; a pitch is not.',
  why: 'Before a result there is no argument, only a pitch — and somebody sold to before being helped discounts everything after it. This is the guard most likely to erode, because moving it earlier will always look like it converts better.' },

{ id: 'G-07', role: 'guard', priority: 2, area: 'Foundations timing',
  title: 'After a real result the note appears, in engine terms',
  needs: ['Real visits recorded'],
  steps: ['Read the note under "What happened"'],
  expect: 'It describes what Foundations produces that the engine reads — not "transform your marketing".',
  why: 'Concrete and checkable beats aspirational, and advisors have heard the aspirational version from everyone.' },

{ id: 'G-08', role: 'guard', priority: 1, area: 'Tone',
  title: 'No padlock language anywhere',
  steps: ['Search the campaign screens for "unlock", "premium", "upgrade", "locked"'],
  expect: 'None of it.',
  why: 'That vocabulary frames the product as withholding something it has chosen not to give. It got written once already and was caught by a test looking for the words.' },

{ id: 'G-09', role: 'guard', priority: 1, area: 'Images',
  title: 'Every shot list carries the keep-out list',
  steps: ['Open "Make it yours" on several visual assets'],
  expect: 'All three every time — consent, other people\'s photographs, and anything that reads as medical.',
  why: 'The claims checker reads text and cannot read a photograph. This list is the only control this product has over a claim made by a picture.' },

{ id: 'G-10', role: 'guard', priority: 2, area: 'Images',
  title: 'No image is offered for download anywhere',
  steps: ['Look for any download button or attached image in the plan'],
  expect: 'None. Only instructions, and a note explaining why.',
  why: 'An AI Saint Lucia is a photograph of a place that does not exist, and our property photography is not ours to give away.' },

{ id: 'G-11', role: 'guard', priority: 1, area: 'Build gate',
  title: 'The balance counts down and blocks at zero',
  needs: ['Migration 017 applied'],
  steps: ['Note the balance', 'Build a plan', 'Check it decreased by exactly one', 'Exhaust it'],
  expect: 'At zero, building is refused with the $9 pack offered; editing and angles still work.',
  why: 'One plan must cost exactly one build. Two plans for one build gives the product away; two builds for one plan overcharges somebody.' },

{ id: 'G-12', role: 'guard', priority: 1, area: 'Build gate',
  title: 'A Foundations advisor is unlimited and shown no meter',
  needs: ['Migration 017 applied', `${UAT2} with Foundations`],
  steps: [`Build several plans as ${UAT2}`, 'Check plan_builds in Supabase before and after'],
  expect: 'Never refused, and the number never moves.',
  why: 'Not "spent and ignored" — the number must not change, or somebody later reads a balance that has been counting down against a person who is not being counted.' },

{ id: 'G-13', role: 'guard', priority: 2, area: 'Build gate',
  title: 'A failed generation does not cost a build',
  steps: ['Note the balance', 'Cause a build to fail if you can (disconnect mid-build)', 'Check the balance'],
  expect: 'Unchanged.',
  why: 'Charging for something that produced nothing is the fastest way to lose an advisor\'s trust in a paid feature.' },

{ id: 'G-14', role: 'guard', priority: 2, area: 'Webhook',
  title: 'The webhook refuses without the right secret',
  steps: ['POST to /api/hook with no secret, then with a wrong one, then with ?k=wrong'],
  expect: 'All three return 200 with reason "unauthorised", granted 0, and no row in purchase_events.',
  why: 'It answers 200 so ThriveCart can validate the URL at all — failing closed means granting nothing, not failing the request. The uniform reply also tells somebody probing it nothing about whether they guessed. Nothing is recorded, or anyone could fill the ledger.' },

{ id: 'G-15', role: 'guard', priority: 2, area: 'Webhook',
  title: 'A real purchase adds three, and a replay adds nothing',
  needs: ['ThriveCart configured'],
  steps: ['Take the product OUT of test mode', 'Make a real $9 purchase', 'Check the balance and purchase_events', 'Have ThriveCart resend the webhook'],
  expect: 'Balance +3 once. The replay is recorded as a replay and adds nothing.',
  why: 'Providers retry precisely when the first attempt worked and the response was lost. Without this, every lost response doubles somebody\'s purchase.' },

{ id: 'G-16', role: 'guard', priority: 2, area: 'Webhook',
  title: 'A purchase of something else grants no builds',
  steps: ['Check purchase_events after any non-build-pack purchase'],
  expect: 'Recorded with a note and a delta of zero.',
  why: 'More than one thing sells through ThriveCart. A Foundations sale must not quietly hand out build packs — and must not vanish either.' },

{ id: 'G-21', role: 'guard', priority: 1, area: 'Webhook',
  title: 'A sandbox order grants nothing',
  steps: ['With the product in test mode, complete a sandbox purchase',
          'Check the advisor\'s plan_builds and purchase_events'],
  expect: 'A row recorded with a note and a delta of 0. The balance does not move.',
  why: 'The first successful test purchase granted three real builds on an order where no money moved — ThriveCart said mode:"test" in a payload of 77 fields and nothing looked. A product\'s checkout URL keeps working while it sits in test mode, so anyone who found it could mint build packs for free.' },

{ id: 'G-22', role: 'guard', priority: 2, area: 'Webhook',
  title: 'The shared secret is never stored',
  steps: ['After any webhook arrives, open its row in purchase_events',
          'Look at raw.thrivecart_secret'],
  expect: '"[redacted]". Search the whole row for the live secret and find nothing.',
  why: 'The raw body is kept so a disputed payment can be reconstructed, and it carries the credential that authenticates the webhook. Stored in plaintext it would sit in the table most likely to be opened — and exported — while investigating a payment.' },

{ id: 'G-17', role: 'guard', priority: 1, area: 'Access',
  title: 'Signed out, every Hub route redirects to login',
  steps: ['Signed out, try /hub, /hub/journeys, /hub/campaign, /hub/account, /hub/admin'],
  expect: 'All redirect to login, and after signing in you land where you were going.',
  why: 'These pages hold other people\'s personal data. The return-to behaviour is what stops people bookmarking the login page instead.' },

{ id: 'G-18', role: 'guard', priority: 1, area: 'View-as',
  title: 'Nothing can be written while viewing as somebody',
  steps: ['While in view-as, try to save the intake, change a stage and add a note'],
  expect: 'Every write refused, with an explanation.',
  why: 'Typing an advisor\'s positioning for them puts words in their mouth that a campaign then publishes under their name.' },

{ id: 'G-19', role: 'guard', priority: 2, area: 'View-as',
  title: 'A campaign cannot be generated while viewing as somebody',
  steps: ['While in view-as, try to build a plan'],
  expect: 'Refused with a reason.',
  why: 'Same principle, with a bill attached — and the output would be warranted as theirs.' },

{ id: 'G-20', role: 'guard', priority: 3, area: 'Rate limits',
  title: 'Rapid repeated plan builds are throttled',
  steps: ['Try to build several plans in quick succession'],
  expect: 'A "give it a minute" refusal rather than unbounded generation.',
  why: 'The only thing standing between a stuck button and a large OpenAI bill.' },

/* ══ CROSS-CUTTING ═══════════════════════════════════════════════════════ */
{ id: 'X-01', role: 'cross', priority: 1, area: 'Layout',
  title: 'The Hub works at 380px',
  steps: ['At 380px wide, walk /hub, /hub/journeys, /hub/campaign and the persona capture'],
  expect: 'No horizontal scrolling, no clipped controls, no text smaller than it should be.',
  why: 'Advisors check this between other work, on a phone. Two rendering bugs this month were invisible at desktop width.' },

{ id: 'X-02', role: 'cross', priority: 2, area: 'Layout',
  title: 'Everything holds at 2000px',
  steps: ['Walk the same screens plus the public pages at about 2000px'],
  expect: 'No stranded content, no line lengths that become unreadable.',
  why: 'This is the width Duncan actually reviews on, so it is the width everything gets judged at.' },

{ id: 'X-03', role: 'cross', priority: 2, area: 'Accessibility',
  title: 'The whole Finder is keyboard-operable',
  steps: ['Complete the Finder using only Tab, arrows and Enter'],
  expect: 'Focus is always visible and never trapped.',
  why: 'We publish an accessibility statement. It should be true.' },

{ id: 'X-04', role: 'cross', priority: 2, area: 'Accessibility',
  title: 'Disclosures are reachable without a mouse',
  steps: ['Tab to "Make it yours" and the week folds and open them with the keyboard'],
  expect: 'They open, and focus moves into the revealed content.',
  why: 'They are native <details> precisely so this works for free — worth confirming it actually does.' },

{ id: 'X-05', role: 'cross', priority: 3, area: 'Accessibility',
  title: 'Reduced motion is respected',
  steps: ['Turn on reduce-motion in the OS', 'Reload the home page and the Finder'],
  expect: 'Ambient motion stops or softens; nothing becomes unusable.',
  why: 'For some people motion is not a preference, it is nausea.' },

{ id: 'X-06', role: 'cross', priority: 2, area: 'Hygiene',
  title: 'No console errors anywhere',
  steps: ['With the console open, walk the consumer flow and the Hub'],
  expect: 'No red.',
  why: 'The first error trains you to ignore the console, and the second one is the one that mattered.' },

{ id: 'X-07', role: 'cross', priority: 3, area: 'Hygiene',
  title: 'Nothing is fetched from a third-party domain',
  steps: ['Open the network tab and reload the home page'],
  expect: 'Fonts and assets come from our own domain.',
  why: 'The typefaces were self-hosted deliberately. A stray external request is a privacy leak and a dependency.' },

{ id: 'X-08', role: 'cross', priority: 3, area: 'Hygiene',
  title: 'A missing page behaves',
  steps: ['Open /this-does-not-exist'],
  expect: 'A sensible page with a way back.',
  why: 'Printed links get mistyped, and old links outlive the pages they pointed at.' },

{ id: 'X-09', role: 'cross', priority: 2, area: 'Brand',
  title: 'The colours are right',
  steps: ['Check ink, teal, gold and coral against the brand values across several screens'],
  expect: 'They match, and gold text on light backgrounds uses the contrast-safe token.',
  why: 'Duncan is colour-sensitive and gold-on-cream is the pairing that fails contrast quietly.' },

{ id: 'X-10', role: 'cross', priority: 3, area: 'Hygiene',
  title: 'The campaign screen survives a slow connection',
  steps: ['Throttle to slow 3G', 'Build a plan'],
  expect: 'The overlay keeps saying what is happening; nothing looks hung.',
  why: 'Generation takes about a minute. On a slow connection the difference between "working" and "broken" is entirely what the screen says.' },

/* ══ TEARDOWN ════════════════════════════════════════════════════════════ */
{ id: 'T-01', role: 'teardown', priority: 1, area: 'Cleanup',
  title: 'Delete every ZZTest person through the subject-rights screen',
  steps: ['Open /hub/admin/subject', 'Find and delete each ZZTest person'],
  expect: 'None remain, and each deletion is audited.',
  why: 'Using the real feature to clean up tests the feature. It also means test data is removed the same way a real request would be honoured.' },

{ id: 'T-02', role: 'teardown', priority: 1, area: 'Cleanup',
  title: 'Delete the test advisors',
  steps: ['For each concierge+uat account, use delete and choose erase',
          'Confirm the impact statement matches what you created'],
  expect: 'Accounts gone, Journeys handled as chosen.',
  why: 'Test advisors left active are real accounts with working WELL links pointing at nobody.' },

{ id: 'T-03', role: 'teardown', priority: 2, area: 'Cleanup',
  title: 'Remove campaign rows the screens do not reach',
  steps: ['In Supabase, delete from gtm_asset, gtm_plan, gtm_profile and campaign_visits for the test advisor ids'],
  expect: 'No orphaned rows.',
  why: 'These are not personal data, so nothing prompts you to remove them — they just quietly skew every count from here on.' },

{ id: 'T-04', role: 'teardown', priority: 2, area: 'Cleanup',
  title: 'Clear test purchase events',
  needs: ['G-15 attempted'],
  steps: ['Delete test rows from purchase_events'],
  expect: 'Only real purchases remain.',
  why: 'This table is the ledger anyone will reach for when money is disputed. Test rows in it are a trap for later.' },

{ id: 'T-05', role: 'teardown', priority: 1, area: 'Cleanup',
  title: 'The counts are back where they started',
  needs: ['S-08 recorded'],
  steps: ['Re-count advisors, journey_shares, gtm_plan and campaign_visits'],
  expect: 'Back to the S-08 numbers, allowing for anything real that arrived during the day.',
  why: 'This is the only way to know the cleanup actually worked. This project has already had to purge six test Journeys once.' },

{ id: 'T-06', role: 'teardown', priority: 2, area: 'Cleanup',
  title: 'Export the results and send them over',
  steps: ['Press Export in this tracker', 'Paste the markdown into the conversation'],
  expect: 'Every failure and suggestion captured.',
  why: 'The suggestions are the most valuable output of the day, and they are the easiest thing to lose.' }

];

module.exports = { CASES, ROLES, SITE };
