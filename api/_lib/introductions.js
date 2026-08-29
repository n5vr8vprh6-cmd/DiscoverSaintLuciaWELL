/* ============================================================================
   INTRODUCTIONS — handing a pooled Journey to an advisor, warmly
   ----------------------------------------------------------------------------
   A Journey shared without a referral lands on the house account. This is how
   it leaves: a composed three-way introduction, and the Journey moves to the
   advisor so they can actually work it.

   ── WHO MAY RECEIVE ONE ───────────────────────────────────────────────────
   Active advisors who have ACCEPTED THE ADVISOR DATA UNDERTAKING, and nobody
   else. Not a typed email address.

   An address has agreed to nothing. Introducing a traveller to one would put
   their name, phone number and travel plans in front of somebody bound by no
   agreement at all — which is precisely the gap 007 was written to close, and
   it would be reopened by the feature most likely to be used in a hurry.

   It also means a real profile always exists, so the introduction is written
   from facts we hold rather than from anything invented. Same rule the rest of
   this project follows about the island: nothing asserted that is not known.

   A useful side effect: accepting the undertaking is what makes an advisor
   eligible for leads.

   ── WHAT THE EMAIL DOES NOT CARRY ─────────────────────────────────────────
   The traveller's free-text note. They wrote it for the advisor, and the
   advisor gets it in the Hub the moment the Journey moves — but quoting
   somebody's own words about why they need a rest back at them, in an email
   that also goes to a stranger, is not a warm introduction. It is an ambush.
   ========================================================================== */
'use strict';

const { db, esc } = require('./core.js');
const { UNDERTAKING_VERSION } = require('./undertaking.js');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

/* ── Who can be introduced to ─────────────────────────────────────────────
   Scoped to advisors who could actually take this on today. A paused advisor
   is not offered because a paused advisor is not receiving Journeys, and an
   advisor on an older version of the undertaking is not offered because what
   they accepted is not what is in force. */
async function eligibleAdvisors() {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('advisors')
    .select('id, first_name, last_name, email, business, host_agency, market, bio, website, undertaking_version')
    .eq('status', 'active')
    .eq('undertaking_version', UNDERTAKING_VERSION)
    .neq('is_house', true)
    .order('first_name');
  if (error) { console.error('eligibleAdvisors', error); return []; }
  return data || [];
}

async function advisorById(id) {
  const supabase = db();
  if (!supabase || !id) return null;
  const { data } = await supabase
    .from('advisors')
    .select('id, first_name, last_name, email, business, host_agency, market, bio, website, status, undertaking_version, is_house')
    .eq('id', id).maybeSingle();
  if (!data) return null;
  /* Re-checked at the point of use, not just when the list was drawn. A
     paused advisor, or one who has fallen behind the current undertaking,
     must not receive a Journey because a screen was left open. */
  if (data.status !== 'active' || data.is_house) return null;
  if (data.undertaking_version !== UNDERTAKING_VERSION) return null;
  return data;
}

/* ── The default personal line ────────────────────────────────────────────
   Offered as a starting point in an editable field, never sent unseen. Built
   only from what the profile actually holds, so an advisor with an empty
   profile simply gets a shorter introduction rather than an invented one. */
function suggestedLine(advisor, journey) {
  const bits = [];
  if (advisor.business) bits.push(advisor.business);
  if (advisor.market) bits.push('who works with travellers in ' + advisor.market);

  const who = advisor.first_name;
  if (!bits.length) {
    return `${who} is one of our qualified Saint Lucia WELL advisors, and I think ` +
           `they are the right person to help you with this.`;
  }
  return `${who} is one of our qualified Saint Lucia WELL advisors — ${bits.join(', ')} — ` +
         `and I think they are the right person to help you with this.`;
}

/* ── The email ────────────────────────────────────────────────────────────
   Returned as an object so the screen can preview exactly what will be sent
   and the tests can assert the ENVELOPE rather than a rendered template. The
   envelope is the part that carries the design:

     From      journeys@ — it comes from the brand the traveller trusts
     To        the traveller
     Cc        the advisor. THIS is the disclosure, and it is what the consent
               they agreed to covers
     Reply-To  the advisor, so whichever of them replies first reaches the
               other, and no reply lands in a mailbox nobody is watching

   The traveller is told the advisor will be in touch. The burden of the next
   move belongs to the advisor; a person who has just been handed to a stranger
   should not also be handed a task. */
function compose(journey, advisor, personalLine) {
  const from = process.env.NOTIFY_FROM;
  const traveller = `${journey.consumer_first || ''} ${journey.consumer_last || ''}`.trim();
  const first = (journey.consumer_first || '').trim() || 'Hello';
  const advisorName = `${advisor.first_name || ''} ${advisor.last_name || ''}`.trim();

  const villages = (journey.villages || []).filter(Boolean);
  const line = String(personalLine || '').trim() || suggestedLine(advisor, journey);

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#133239">` +
    `<p style="margin:0 0 1.2em">${esc(first)},</p>` +

    `<p style="margin:0 0 1.2em">Thank you for sharing your WELL Journey with us. ` +
    `I would like to introduce you to <strong>${esc(advisorName)}</strong>.</p>` +

    `<p style="margin:0 0 1.2em">${esc(line)}</p>` +

    (villages.length
      ? `<p style="margin:0 0 1.2em">Your answers pointed toward ` +
        `<strong>${esc(villages.slice(0, 2).join(' and '))}</strong>` +
        `${journey.timing ? `, travelling ${esc(String(journey.timing).toLowerCase())}` : ''}. ` +
        `${esc(advisor.first_name)} has the rest of what you told us.</p>`
      : '') +

    `<p style="margin:0 0 1.2em"><strong>${esc(advisor.first_name)} will be in touch with you ` +
    `directly — there is nothing you need to do.</strong> If you would rather reach them first, ` +
    `simply reply to this email and it goes straight to them.</p>` +

    (advisor.website
      ? `<p style="margin:0 0 1.4em"><a href="${esc(advisor.website)}" style="color:#00706F">` +
        `${esc(advisor.website.replace(/^https?:\/\//, ''))}</a></p>`
      : '') +

    `<p style="margin:0 0 1.2em">With warm regards,<br>Discover Saint Lucia WELL</p>` +

    `<hr style="border:0;border-top:1px solid #E5E0D6;margin:1.6em 0">` +
    `<p style="margin:0;color:#5c6b68;font-size:13px">` +
    `${esc(advisorName)} is an independent travel professional and handles your information ` +
    `under their own privacy practices, as set out when you shared your Journey. ` +
    `Discover Saint Lucia WELL is not a travel agency and does not take bookings.</p></div>`;

  return {
    from,
    to: journey.consumer_email,
    cc: advisor.email,
    /* The whole point. A reply from either side reaches the advisor, which is
       what makes this a handoff rather than a forward. */
    replyTo: advisor.email,
    subject: `${traveller || 'Your WELL Journey'}, meet ${advisor.first_name}`,
    html,
    personalLine: line
  };
}

/* ── Send, and hand the Journey over ──────────────────────────────────────
   The email goes FIRST. If it fails, nothing has moved and the team can try
   again — whereas reassigning first and then failing to send would leave a
   Journey sitting in an advisor's Hub that they were never told about, which
   is the worse of the two failures by some distance. */
async function send(journey, advisor, personalLine) {
  const mail = compose(journey, advisor, personalLine);
  if (!mail.from) return { ok: false, error: 'mail_not_configured' };

  try {
    const { Resend } = require('resend');
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: mail.from,
      to: mail.to,
      cc: mail.cc,
      replyTo: mail.replyTo,
      subject: mail.subject,
      html: mail.html
    });
    if (error) throw error;
  } catch (e) {
    console.error('introduction email failed', e);
    return { ok: false, error: 'email_failed' };
  }

  const supabase = db();
  const { error: moveErr } = await supabase
    .from('journey_shares')
    .update({ advisor_id: advisor.id, last_activity_at: new Date().toISOString() })
    .eq('id', journey.id);

  if (moveErr) {
    /* The introduction has been made and cannot be unmade, so this is reported
       rather than rolled back — the team need to know the Hub does not match
       what the traveller was just told. */
    console.error('introduction sent but the Journey did not move', moveErr);
    return { ok: false, error: 'sent_but_not_moved' };
  }

  /* ── THE WORKSPACE MOVES WITH THE JOURNEY ─────────────────────────────────
     journey_consultations and design_sessions denormalise advisor_id, because
     every read of them is scoped by advisor and a row carrying its own owner
     cannot be handed to the wrong one by a join written wrong later.

     The cost of that choice is exactly here. Move the Journey and leave the
     workspace behind, and an introduced Journey arrives with a consultation the
     receiving advisor cannot open while the sending advisor still can — which
     is both a broken feature and a disclosure.

     Best effort, and deliberately after the move: the Journey changing hands is
     the fact that matters, and a design workspace that failed to follow is a
     repairable inconsistency rather than a reason to report the introduction as
     failed. A missing table (migration 022 unapplied) is not an error at all. */
  const MISSING = ['42703', '42P01', 'PGRST204', 'PGRST205'];
  const moved = async (table, column, value) => {
    const { error } = await supabase.from(table)
      .update({ advisor_id: advisor.id })
      .eq(column, value);
    if (error && MISSING.indexOf(String(error.code)) === -1) {
      console.error('introduction moved the Journey but not ' + table, error.code);
    }
  };

  /* Keyed by share_id. */
  for (const table of ['journey_consultations', 'design_sessions', 'journey_itineraries']) {
    await moved(table, 'share_id', journey.id);
  }

  /* JOURNEY_ITINERARIES IS THE ONE THAT MATTERS MOST, and it was the one left
     behind. revokeItinerary() is scoped by advisor in the query, so a Journey
     handed over left the SENDING advisor able to withdraw a live document from
     a client who is now somebody else's — and the receiving advisor unable to.
     Updating advisor_id is allowed on an issued row on purpose: itinerary_frozen()
     freezes the document, the brand, the version and the ids, and deliberately
     not the owner.

     DESIGN_CANDIDATES HAS NO share_id. It hangs off the session, so it needs
     the session ids first — two round trips for an operation that happens once
     per pooled Journey, which is the right trade against a join written wrong.

     DESIGN_GENERATION DELIBERATELY DOES NOT MOVE. It is a cost and rate-limit
     ledger: the calls were made by the sending advisor, on their hour, and
     reassigning them would charge one advisor's usage to another's counter and
     silently throttle somebody who has generated nothing. */
  const { data: sessions } = await supabase
    .from('design_sessions').select('id').eq('share_id', journey.id);
  const ids = (sessions || []).map((s) => s.id);
  if (ids.length) {
    const { error } = await supabase.from('design_candidates')
      .update({ advisor_id: advisor.id })
      .in('session_id', ids);
    if (error && MISSING.indexOf(String(error.code)) === -1) {
      console.error('introduction moved the Journey but not design_candidates', error.code);
    }
  }

  return { ok: true, mail };
}

module.exports = { eligibleAdvisors, advisorById, compose, suggestedLine, send, SITE_ORIGIN };
