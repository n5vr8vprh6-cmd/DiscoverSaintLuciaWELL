/* ============================================================================
   SUBJECT DATA — everything held about one person, and the ways to act on it
   ----------------------------------------------------------------------------
   The Privacy Policy §14 offers access, correction, erasure and portability.
   Until now nothing in this system could do any of them, or even FIND one
   person's records: tools/db.js --purge-test deliberately refuses real rows, so
   the only route was hand-editing Supabase. That is exactly the situation the
   admin console was built to remove for advisor approval, and a rights request
   carries a legal clock — 30 days under PIPEDA, one month under UK/EU GDPR.

   THIS FILE IS UNSCOPED, like admin-data.js and for the same reason. Nothing
   here checks permission; it has no request. The guard is requireAdmin(), in
   the screen, in one place.

   ── WHY THE AUDIT ROW HOLDS A HASH ───────────────────────────────────────
   Erasing somebody's data and then writing their name and email into the audit
   log recreates the thing that was just erased, in a table nobody thinks of as
   holding personal data. So `subjectKey()` is what goes in the record.

   It is still answerable. When that person writes back asking "did you actually
   delete it?", hashing the address they give you reproduces the same key and
   finds the entry. The record proves what was done without keeping what it was
   done to — which is the whole point of an erasure record.

   The salt is IP_HASH_SALT with a domain separator, so a subject key and an IP
   hash of the same string never collide and one can never be used to probe the
   other. Reusing the secret is deliberate: a second secret is a second thing to
   configure, lose, and rotate out of step.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { db } = require('./core.js');

/* ── The key that stands in for an address ───────────────────────────────── */
function subjectKey(email) {
  const salt = process.env.IP_HASH_SALT;
  const norm = String(email || '').trim().toLowerCase();
  if (!salt || !norm) return null;
  return crypto.createHmac('sha256', salt).update('subject:' + norm).digest('hex');
}

/* ── Find ────────────────────────────────────────────────────────────────
   Exact match on a lowercased address, because that is how api/share.js:60
   stores it. Deliberately NOT a partial or fuzzy match: a rights request is
   about one identified person, and a search that returns everyone at a domain
   is a search that discloses other people's data to answer one person's
   question.

   Advisor accounts are searched too. A data subject does not know or care how
   we split our tables — they ask what we hold about them, and if they happen to
   be an advisor the answer includes their account. */
async function findSubject(email) {
  const supabase = db();
  const norm = String(email || '').trim().toLowerCase();
  if (!supabase || !norm) return null;

  const [shares, advisor, waiting] = await Promise.all([
    supabase.from('journey_shares')
      .select('id, created_at, advisor_id, answers, villages, consumer_first, consumer_last, ' +
              'consumer_email, consumer_phone, timing, travel_window, context, stage, ' +
              'consent_at, consent_text, source, session_id, notified_at, ip_hash')
      .eq('consumer_email', norm)
      .order('created_at', { ascending: false }),
    supabase.from('advisors')
      .select('id, first_name, last_name, email, business, status, role, public_code, created_at')
      .eq('email', norm)
      .maybeSingle(),
    /* Added with migration 018. A store of personal data this module does not
       know about is a store that survives an erasure request while this screen
       reports success — which is worse than having no screen, because it turns
       a person's request into a false assurance. Every future table lands here
       in the same change that creates it. */
    supabase.from('immersion_waitlist')
      .select('id, created_at, first_name, last_name, email, phone, company, host_agency, source')
      .ilike('email', norm)
  ]);

  if (shares.error) { console.error('findSubject shares', shares.error); return null; }
  /* 42P01 = migration 018 has not been run on this environment. Not fatal to
     the lookup, but it must be loud: a silent empty result here reads exactly
     like "we hold nothing", which is the one answer that must never be
     guessed. */
  if (waiting.error && (waiting.error.code === '42P01' || waiting.error.code === 'PGRST205')) {
    console.error('findSubject: immersion_waitlist is missing — run db/migrations/018.');
  } else if (waiting.error) {
    console.error('findSubject waitlist', waiting.error);
  }

  const rows = shares.data || [];

  /* Who received each Journey. Resolved here rather than in the screen so the
     export carries it too — "which advisor has my details" is one of the first
     questions a real request asks, and the id alone does not answer it. */
  const ids = [...new Set(rows.map((r) => r.advisor_id).filter(Boolean))];
  let byId = {};
  if (ids.length) {
    const { data } = await supabase.from('advisors')
      .select('id, first_name, last_name, email, business').in('id', ids);
    (data || []).forEach((a) => { byId[a.id] = a; });
  }

  /* The advisor's own notes about this person are personal data ABOUT THEM,
     written by somebody else. They belong in an access response for the same
     reason they are destroyed by an erasure. */
  let notes = [];
  if (rows.length) {
    const { data } = await supabase.from('advisor_notes')
      .select('id, share_id, advisor_id, body, created_at')
      .in('share_id', rows.map((r) => r.id))
      .order('created_at', { ascending: false });
    notes = data || [];
  }

  /* The consultation is a record ABOUT this person — what an advisor
     understood them to want — and the itineraries are documents that were
     issued to them. Both are personal data, both cascade from journey_shares,
     and both must appear here or the subject-rights screen reports a complete
     picture it does not have. A missing table means migration 022 has not run,
     which is an empty list rather than an error. */
  let consultations = [];
  let itineraries = [];
  if (rows.length) {
    const ids = rows.map((r) => r.id);
    const c = await supabase.from('journey_consultations')
      .select('id, share_id, advisor_id, created_at, updated_at, trigger, uncertainty, readiness, party, orientation, budget, nights, constraints, current_states, desired_states, village_weights, compass_weights, continuum_floor, continuum_ceiling')
      .in('share_id', ids);
    consultations = c.data || [];

    const i = await supabase.from('journey_itineraries')
      .select('id, share_id, advisor_id, version, issued_at, revoked_at, share_expires_at, view_count, last_viewed_at, document')
      .in('share_id', ids).not('issued_at', 'is', null)
      .order('version', { ascending: true });
    itineraries = i.data || [];
  }

  return {
    email: norm,
    key: subjectKey(norm),
    consultations,
    itineraries,
    journeys: rows.map((r) => Object.assign({}, r, {
      advisor: r.advisor_id ? (byId[r.advisor_id] || null) : null,
      notes: notes.filter((n) => n.share_id === r.id)
    })),
    advisorAccount: advisor.data || null,
    waitlist: (waiting.error ? [] : (waiting.data || [])),
    /* Held for rate limiting only, never the address itself, and not reversible
       — but it IS derived from them, so an honest access response says so
       rather than quietly omitting it. */
    ipHashHeld: rows.some((r) => r.ip_hash)
  };
}

/* ── Access response ─────────────────────────────────────────────────────
   Portability under §14 means a machine-readable copy, so this is JSON rather
   than a rendering of the screen. It carries `consent_text` verbatim, which is
   the answer to the question a person most often actually means when they ask
   what you hold: not "what fields" but "what did I agree to". */
function accessExport(found) {
  return {
    subject: found.email,
    generated_at: new Date().toISOString(),
    controller: 'Empowerment Human Performance Ltd.',
    contact: 'concierge@discoversaintluciawell.com',

    journeys: found.journeys.map((j) => ({
      shared_at: j.created_at,
      shared_with: j.advisor
        ? { name: `${j.advisor.first_name} ${j.advisor.last_name}`.trim(), business: j.advisor.business || null }
        : null,
      advisor_was_notified_at: j.notified_at,
      you_told_us: {
        first_name: j.consumer_first,
        last_name: j.consumer_last,
        email: j.consumer_email,
        phone: j.consumer_phone,
        travel_timing: j.timing,
        travel_window: j.travel_window,
        in_your_own_words: j.context
      },
      your_journey_finder_answers: j.answers,
      /* Codes, because that is genuinely all that is stored — the consultation
         table carries no prose about anybody. Saying so plainly is more honest
         than translating them into sentences we then have to stand behind. */
      what_your_advisor_recorded_about_what_you_wanted:
        (found.consultations || []).filter((c) => c.share_id === j.id).map((c) => ({
          recorded_at: c.updated_at || c.created_at,
          moving_away_from: c.current_states,
          moving_toward: c.desired_states,
          why_now: c.trigger,
          what_was_uncertain: c.uncertainty,
          how_ready: c.readiness,
          travelling_as: c.party,
          how_they_relate_to_wellness: c.orientation,
          budget_band: c.budget,
          nights: c.nights,
          constraints: c.constraints,
          places_it_pointed_to: c.village_weights,
          directions_it_pointed_to: c.compass_weights,
          depth_discussed: [c.continuum_floor, c.continuum_ceiling].filter(Boolean)
        })),
      itineraries_issued_to_you:
        (found.itineraries || []).filter((i) => i.share_id === j.id).map((i) => ({
          version: i.version,
          issued_at: i.issued_at,
          withdrawn_at: i.revoked_at,
          link_expires_at: i.share_expires_at,
          times_opened: i.view_count,
          last_opened_at: i.last_viewed_at,
          the_document: i.document
        })),
      villages_it_pointed_to: j.villages,
      consent: { given_at: j.consent_at, you_agreed_to: j.consent_text },
      how_the_advisor_has_worked_it: j.stage,
      notes_the_advisor_wrote: j.notes.map((n) => ({ written_at: n.created_at, note: n.body }))
    })),

    advisor_account: found.advisorAccount ? {
      registered_at: found.advisorAccount.created_at,
      name: `${found.advisorAccount.first_name} ${found.advisorAccount.last_name}`.trim(),
      business: found.advisorAccount.business,
      status: found.advisorAccount.status
    } : null,

    also_held: found.ipHashHeld
      ? ['A one-way salted hash of the IP address you submitted from, used only to rate-limit ' +
         'the public form. It cannot be turned back into an address.']
      : [],

    not_held_here: [
      'The notification email sent to your travel advisor at the time you shared. That message ' +
      'is in their mailbox and is not something we can delete from here — see the covering note.'
    ]
  };
}

/* ── Correction ──────────────────────────────────────────────────────────
   An allow-list, not a patch, following api/_lib/hub-screens/account.js:100.
   Notably absent: consent_text, consent_at, answers, stage. Correcting a
   contact detail is a right; editing what somebody consented to, or what they
   answered, is falsifying a record. */
async function correctSubject(email, patch) {
  const supabase = db();
  const norm = String(email || '').trim().toLowerCase();
  if (!supabase || !norm) return { ok: false, error: 'not_configured' };

  const allowed = {};
  ['consumer_first', 'consumer_last', 'consumer_email', 'consumer_phone'].forEach((k) => {
    if (typeof patch[k] === 'string' && patch[k].trim()) allowed[k] = patch[k].trim();
  });
  if (allowed.consumer_email) allowed.consumer_email = allowed.consumer_email.toLowerCase();
  if (!Object.keys(allowed).length) return { ok: false, error: 'nothing_to_change' };

  const { data, error } = await supabase
    .from('journey_shares').update(allowed).eq('consumer_email', norm).select('id');
  if (error) { console.error('correctSubject', error); return { ok: false, error: 'failed' }; }
  return { ok: true, rows: (data || []).length, fields: Object.keys(allowed) };
}

/* ── Erasure ─────────────────────────────────────────────────────────────
   advisor_notes.share_id is ON DELETE CASCADE (002-hub.sql:99), so an advisor's
   notes about this person go with their Journeys. That cascade is the
   difference between erasure and the appearance of erasure, so it is asserted
   by tools/subject-test.js against real rows rather than trusted from the
   schema.

   Counted before the delete, because after it there is nothing left to count —
   and the number is what the person gets told. */
async function eraseSubject(email) {
  const supabase = db();
  const norm = String(email || '').trim().toLowerCase();
  if (!supabase || !norm) return { ok: false, error: 'not_configured' };

  const { data: rows } = await supabase
    .from('journey_shares').select('id, advisor_id').eq('consumer_email', norm);

  /* Deleted FIRST and counted separately, because somebody may be on the
     waiting list without ever having completed the Finder — in which case
     `rows` is empty and the old code returned 'nothing_held' while a row with
     their name, email and phone number sat in another table. */
  const { data: waitRows } = await supabase
    .from('immersion_waitlist').select('id').ilike('email', norm);
  let waitlistRemoved = 0;
  if (waitRows && waitRows.length) {
    const { error: wErr } = await supabase
      .from('immersion_waitlist').delete().in('id', waitRows.map((w) => w.id));
    if (wErr) { console.error('eraseSubject waitlist', wErr); return { ok: false, error: 'failed' }; }
    waitlistRemoved = waitRows.length;
  }

  if (!rows || !rows.length) {
    return waitlistRemoved
      ? { ok: true, journeys: 0, notes: 0, orphans: 0, advisors: 0, waitlist: waitlistRemoved }
      : { ok: false, error: 'nothing_held' };
  }

  const { data: notes } = await supabase
    .from('advisor_notes').select('id').in('share_id', rows.map((r) => r.id));

  /* Same reasoning as the notes above: read the ids BEFORE the delete so the
     cascade can be checked afterwards against rows we know existed. */
  const { data: consults } = await supabase
    .from('journey_consultations').select('id').in('share_id', rows.map((r) => r.id));
  const { data: itins } = await supabase
    .from('journey_itineraries').select('id').in('share_id', rows.map((r) => r.id));

  const { error } = await supabase.from('journey_shares').delete().eq('consumer_email', norm);
  if (error) { console.error('eraseSubject', error); return { ok: false, error: 'failed' }; }

  /* Prove the cascade fired on this actual deletion rather than reporting a
     success the schema was assumed to deliver. If notes survived their parent
     row, the erasure is incomplete and whoever ran it must know NOW, not when
     the person asks again. */
  let orphans = 0;
  if (notes && notes.length) {
    const { data: left } = await supabase
      .from('advisor_notes').select('id').in('id', notes.map((n) => n.id));
    orphans = (left || []).length;
  }
  /* A design workspace that outlives its Journey is an erasure that reported
     success and left a record of what somebody wanted behind it. Counted into
     the same number, because "orphans" is the one figure whoever ran this reads. */
  for (const [table, before] of [['journey_consultations', consults], ['journey_itineraries', itins]]) {
    if (!before || !before.length) continue;
    const { data: left } = await supabase.from(table).select('id').in('id', before.map((r) => r.id));
    orphans += (left || []).length;
  }

  return {
    ok: true,
    journeys: rows.length,
    notes: (notes || []).length,
    consultations: (consults || []).length,
    itineraries: (itins || []).length,
    orphans,
    advisors: [...new Set(rows.map((r) => r.advisor_id).filter(Boolean))].length,
    waitlist: waitlistRemoved
  };
}

module.exports = { subjectKey, findSubject, accessExport, correctSubject, eraseSubject };
