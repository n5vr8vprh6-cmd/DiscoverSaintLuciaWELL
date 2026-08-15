/* ============================================================================
   ENCHARGE — advisor lifecycle events
   ----------------------------------------------------------------------------
   Onboarding only. Encharge learns that an advisor registered, was activated,
   or received their first Journey; the sequences that follow are written in
   Encharge, not here, so the copy stays where Duncan can edit it.

   WHAT DOES NOT GO THROUGH HERE, AND WHY IT MATTERS
   The Journey notification — "somebody shared their Journey with you" — stays
   on Resend. It is transactional and time-critical, and routing it through a
   marketing platform would make it suppressible: an advisor who unsubscribes
   from onboarding emails must still be told a real person is waiting for a
   reply. That split is the whole reason this file is scoped to three events.

   NO CONSUMER DATA IS EVER SENT. Encharge sees advisors. The people who share
   Journeys never agreed to be marketed to by us, and the only event that
   mentions a Journey at all sends a count, not a person.

   Ingest API, verified against the live docs:
     POST https://ingest.encharge.io/v1/   header: X-Encharge-Token
     identify -> { name: 'identify', user: { email, … } }
     event    -> { name: '<Event>',  user: { email }, properties: { … } }
   Identify and event are separate calls; one request cannot do both.
   ========================================================================== */
'use strict';

const ENDPOINT = 'https://ingest.encharge.io/v1/';
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

/* Long enough for a normal round trip, short enough that a hung marketing
   platform cannot hold up a registration. */
const TIMEOUT_MS = 2500;

/* ── The one thing every caller relies on ─────────────────────────────────
   This never throws and never rejects. Registration, approval and sharing a
   Journey must all succeed whether or not Encharge is reachable — an advisor's
   account is real regardless of whether a marketing platform heard about it.

   Absent ENCHARGE_TOKEN it no-ops silently, which is how every other
   integration in this project degrades and what makes the code safe to deploy
   before the account exists. */
async function post(payload) {
  const token = process.env.ENCHARGE_TOKEN;
  if (!token) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'X-Encharge-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) {
      console.error('encharge ' + payload.name + ' -> ' + res.status + ' ' +
        (await res.text().catch(() => '')).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    /* An abort here is the timeout doing its job, not an incident. */
    console.error('encharge ' + payload.name + ' failed: ' + (e.name === 'AbortError' ? 'timed out' : e.message));
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/* The fields an onboarding sequence can actually use: who they are, what their
   link is, and where they are in the process. `registrationNote` is included
   because it is what makes a workshop attendee segmentable — the same signal
   that lets an admin approve them on sight. */
function fields(advisor) {
  return {
    email: String(advisor.email || '').toLowerCase(),
    userId: advisor.id,
    firstName: advisor.first_name || '',
    lastName: advisor.last_name || '',
    business: advisor.business || '',
    hostAgency: advisor.host_agency || '',
    website: advisor.website || '',
    market: advisor.market || '',
    advisorStatus: advisor.status || '',
    publicCode: advisor.public_code || '',
    wellLink: advisor.public_code ? `${SITE_ORIGIN}/well/${advisor.public_code}` : '',
    registrationNote: advisor.registration_note || ''
  };
}

/* Create or update the person. Encharge upserts on email. */
async function identify(advisor) {
  if (!advisor || !advisor.email) return false;
  return post({ name: 'identify', user: fields(advisor) });
}

/* Fire a named event. Identify first so the sequence has something to
   personalise with even on the very first event of an advisor's life. */
async function track(event, advisor, properties) {
  if (!advisor || !advisor.email) return false;
  await identify(advisor);
  return post({
    name: event,
    user: { email: String(advisor.email).toLowerCase(), userId: advisor.id },
    properties: properties || {}
  });
}

module.exports = { identify, track };
