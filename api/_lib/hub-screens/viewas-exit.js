/* ============================================================================
   POST /hub/viewas/exit — stop viewing another advisor's Hub
   ----------------------------------------------------------------------------
   DELIBERATELY UNGUARDED, and that is not an oversight.

   requireAdmin() refuses while view-as is active — you are looking at somebody
   else's Hub, so the admin console is not part of what you can see. If exiting
   depended on that check it would be unreachable from exactly the state it
   exists to leave, and the only way out would be clearing cookies by hand.

   It is safe because clearing this cookie cannot grant anything. The worst a
   stranger can achieve by calling it is to stop a session they are not in from
   viewing a Hub they cannot reach. The session cookie is untouched.

   The audit row is written on a best-effort basis before the cookie goes: if
   the request carries no view-as state there is nothing to record, and the
   redirect still happens.
   ========================================================================== */
'use strict';

const { advisorFor, clearViewAs } = require('../auth.js');
const { audit } = require('../admin-data.js');

module.exports = async function handler(req, res) {
  /* advisorFor still resolves the target while the cookie is set, and carries
     `realAdmin` — which is who the exit belongs to. */
  const effective = await advisorFor(req, res);

  if (effective && effective.viewingAs) {
    await audit(effective.realAdmin, 'view_as_end', {
      subject: {
        id: effective.id, first_name: effective.first_name,
        last_name: effective.last_name, email: effective.email
      }
    });
  }

  clearViewAs(res);
  res.statusCode = 303;
  /* Back to the record they came from, not to the Hub they were borrowing. */
  res.setHeader('Location', effective && effective.viewingAs
    ? `/hub/admin/advisors/${effective.id}`
    : '/hub');
  res.end();
};
