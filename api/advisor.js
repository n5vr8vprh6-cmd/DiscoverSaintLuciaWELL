/* ============================================================================
   GET /api/advisor?slug=… — resolve a campaign reference to a display name
   ----------------------------------------------------------------------------
   Lets the Journey Finder result say "Share your WELL Journey with Diana"
   rather than "with an advisor" (brief §10).

   RETURNS A FIRST NAME AND NOTHING ELSE. Not the email, not the business, not
   the id. Slugs travel in public marketing links so they are guessable by
   design; that is fine as long as guessing one reveals only what the link
   itself already announces — that this advisor exists and is called Diana.

   A paused or unknown advisor resolves to `{ advisor: null }`, and the result
   screen falls back to the unattributed CTA. It is deliberately not a 404: the
   caller does not need to distinguish "no such advisor" from "not offering
   right now", and a 404 would invite enumeration to tell them apart.
   ========================================================================== */
'use strict';

const { db, json, str, methodGuard } = require('./_lib/core.js');
const { activeAdvisor } = require('./_lib/advisors.js');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'GET')) return;

  /* `slug` is the parameter name V1.2 shipped and the Finder still sends. It
     now carries either identifier — see _lib/advisors.js. Renaming it would
     break a deployed client for no gain. */
  const ref = str((req.query && req.query.slug) || '', 120);
  if (!ref) return json(res, 400, { error: 'slug_required' });

  const supabase = db();
  /* No backend configured yet — the site is static and must keep working. */
  if (!supabase) return json(res, 200, { advisor: null });

  try {
    const data = await activeAdvisor(supabase, ref, 'first_name, status');
    return json(res, 200, { advisor: data ? { firstName: data.first_name } : null });
  } catch (e) {
    /* A lookup failure must never break the result screen. The visitor gets
       the unattributed CTA, which is a complete experience on its own. */
    console.error('advisor lookup failed', e);
    return json(res, 200, { advisor: null });
  }
};
