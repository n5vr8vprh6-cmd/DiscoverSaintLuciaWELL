/* ============================================================================
   POST /api/visit — record a campaign visit, or a Finder completion
   ----------------------------------------------------------------------------
   Two events, one endpoint, because they are the same shape and the same
   privacy position: `visit` (an advisor's link brought someone here) and
   `finder_complete` (a Journey was finished).

   NEITHER EVENT CARRIES ANSWERS OR ANYTHING IDENTIFYING. The session id is
   random and browser-scoped; the IP is not stored at all. `finder_complete`
   deliberately records *that* a Journey finished and nothing about what it
   said — see db/schema.sql for why, and /privacy for the promise it keeps.

   Fire-and-forget from the browser: the caller never waits on it and never
   shows an error, so a failure here can slow nothing down and break nothing.
   ========================================================================== */
'use strict';

const { db, json, str, body, methodGuard } = require('./_lib/core.js');
const { resolveAdvisor } = require('./_lib/advisors.js');

const SOURCES = ['email', 'social', 'event', 'referral', 'partner', 'direct', 'other'];

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const b = body(req);
  if (!b) return json(res, 400, { error: 'bad_body' });

  const kind = str(b.kind, 24) === 'finder_complete' ? 'finder_complete' : 'visit';
  const ref = str(b.advisor, 120);
  const sessionId = str(b.session, 64);

  /* An advisor reference is the only thing that makes these events worth
     writing. Unattributed traffic is already counted by the host; duplicating
     it here would be a second analytics system for no gain. */
  if (!ref) return json(res, 204, {});

  const supabase = db();
  if (!supabase) return json(res, 204, {});

  try {
    /* Either a public code or a legacy slug — see _lib/advisors.js. */
    const advisor = await resolveAdvisor(supabase, ref, 'id');
    /* Unknown reference: accept and drop. A typo in a printed QR code should
       not produce an error the visitor could ever notice. */
    if (!advisor) return json(res, 204, {});

    if (kind === 'finder_complete') {
      await supabase.from('finder_completions').insert({
        advisor_id: advisor.id,
        session_id: sessionId || null
      });
    } else {
      const rawSource = str(b.source, 40).toLowerCase();
      await supabase.from('campaign_visits').insert({
        advisor_id: advisor.id,
        source: SOURCES.includes(rawSource) ? rawSource : 'other',
        session_id: sessionId || null,
        path: str(b.path, 300) || null,
        referrer: str(b.referrer, 300) || null
      });
    }
    return json(res, 204, {});
  } catch (e) {
    console.error('visit insert failed', e);
    /* Still 204. Analytics must never surface as a problem to a visitor. */
    return json(res, 204, {});
  }
};
