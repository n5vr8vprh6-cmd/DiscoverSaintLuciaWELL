/* ============================================================================
   THE WEBINAR DEMO ADVISOR
   ----------------------------------------------------------------------------
   Duncan demos the Hub live in the intro webinars (decided 23 Oct 2026). His
   real Hub holds real people, and the README rule is never to show one, so
   the demo runs on its own account holding fictional sample clients.

   HOW IT STAYS HARMLESS, without a migration or a new column:

     · STATUS 'paused'. activeAdvisor() and /well/<code> only ever resolve
       `active` advisors, so a webinar attendee who scans the QR on screen
       lands on the site unattributed, and anything they share goes to the
       house account — never into a demo pool nobody reads. That guard
       already exists and is already tested; the demo leans on it rather than
       adding a second one.
     · THE MARKER is the slug: `demo-<16 hex>`. Ordinary advisors get
       `adv-<16 hex>` and fixtures `seed-<16 hex>` (tools/seed-advisors.js), so
       the three can never be confused, and the marker is visible in admin.

   What the marker changes is DISPLAY only: the Hub shows the demo as the
   working account it is standing in for (no "being confirmed" notice), and
   says "Sample data" in the header so a recording never passes the figures
   off as anyone's real results. Nothing that routes a consumer reads it.

   tools/seed-demo.js creates the sample data for an account carrying the
   marker, and refuses any account that does not.
   ========================================================================== */
'use strict';

const DEMO_SLUG = /^demo-[0-9a-f]{16}$/;

/* lib/layouts.js carries a one-line copy of this test (lib/ never requires
   api/). tools/hub-shell-test.js asserts the two agree. */
const isDemo = (advisor) => !!advisor && DEMO_SLUG.test(advisor.slug || '');

/* Is this account live for consumers, as far as the Hub's DISPLAY goes. */
const showsAsActive = (advisor) => !!advisor && (advisor.status === 'active' || isDemo(advisor));

module.exports = { DEMO_SLUG, isDemo, showsAsActive };
