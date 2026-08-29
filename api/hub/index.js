/* ============================================================================
   /api/hub — ONE function, every Hub screen
   ----------------------------------------------------------------------------
   WHY THIS IS A ROUTER AND NOT EIGHT FILES

   The Hub first shipped as one serverless function per screen, which is the
   obvious structure and the wrong one here: Vercel's Hobby plan allows twelve
   Serverless Functions per deployment, and the repo went to seventeen. The
   build succeeded and the DEPLOY failed — worth knowing, because a green build
   log is not a deployed site.

   So the screens live in api/_lib/hub-screens/ (a leading underscore keeps a
   directory out of function detection) and this dispatches to them. The
   screens themselves are unchanged: each is still a plain handler that takes
   (req, res).

   The `screen` parameter comes from the rewrites in vercel.json, not from the
   visitor. It is matched against a fixed table, so a hand-typed
   /api/hub?screen=… can only ever reach a screen that already has a public
   route of its own — this widens nothing.

   Adding a screen means: a file in hub-screens/, a line in SCREENS, and a
   rewrite. Function count stays at one.
   ========================================================================== */
'use strict';

const SCREENS = {
  home:     () => require('../_lib/hub-screens/home.js'),
  journeys: () => require('../_lib/hub-screens/journeys.js'),
  journey:  () => require('../_lib/hub-screens/journey.js'),
  design:   () => require('../_lib/hub-screens/design.js'),
  introduce: () => require('../_lib/hub-screens/introduce.js'),
  account:  () => require('../_lib/hub-screens/account.js'),
  campaign: () => require('../_lib/hub-screens/campaign.js'),
  campaignProfile: () => require('../_lib/hub-screens/campaign-profile.js'),
  campaignMore: () => require('../_lib/hub-screens/campaign-more.js'),
  notFound: () => require('../_lib/hub-screens/not-found.js'),
  sweepstakes:       () => require('../_lib/hub-screens/sweepstakes.js'),
  sweepstakesDetail: () => require('../_lib/hub-screens/sweepstakes-detail.js'),
  login:    () => require('../_lib/hub-screens/login.js'),
  register: () => require('../_lib/hub-screens/register.js'),
  forgot:   () => require('../_lib/hub-screens/forgot.js'),
  reset:    () => require('../_lib/hub-screens/reset.js'),
  /* Not guarded by requireAdvisor — it is what requireAdvisor redirects TO. */
  undertaking: () => require('../_lib/hub-screens/undertaking.js'),

  /* PUBLIC on purpose, and the only screen here that is. An advisor asking to
     hear when the Immersion runs may well not have a Hub account, and putting
     a sign-in in front of a waiting list would be charging admission to a
     queue. It writes to its own table and reads nothing. */
  waitlist: () => require('../_lib/hub-screens/waitlist.js'),

  /* Admin. These are ordinary screens in every respect except that their guard
     is requireAdmin rather than requireAdvisor — there is no route-level auth
     here, so each screen's own guard is the only thing protecting it. */
  admin:          () => require('../_lib/hub-screens/admin.js'),
  adminAdvisors:  () => require('../_lib/hub-screens/admin-advisors.js'),
  adminAdvisor:   () => require('../_lib/hub-screens/admin-advisor.js'),
  adminAudit:     () => require('../_lib/hub-screens/admin-audit.js'),
  adminNew:       () => require('../_lib/hub-screens/admin-new.js'),
  adminImport:    () => require('../_lib/hub-screens/admin-import.js'),
  adminSubject:   () => require('../_lib/hub-screens/admin-subject.js'),
  adminWaitlist:  () => require('../_lib/hub-screens/admin-waitlist.js'),
  /* PUBLIC on purpose, like waitlist above it — see the file. The token is
     the whole of the authorisation, and it is 32 random bytes. */
  itinerary:      () => require('../_lib/hub-screens/itinerary.js'),
  /* Unguarded on purpose — see the file. */
  viewasExit:     () => require('../_lib/hub-screens/viewas-exit.js')
};

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const name = String(url.searchParams.get('screen') || 'home');
  const load = Object.prototype.hasOwnProperty.call(SCREENS, name) ? SCREENS[name] : null;

  /* An unrecognised screen is a bad URL, not an error worth a stack trace.
     Send them to the Hub they were trying to reach. */
  if (!load) {
    res.statusCode = 302;
    res.setHeader('Location', '/hub');
    return res.end();
  }

  return load()(req, res);
};
