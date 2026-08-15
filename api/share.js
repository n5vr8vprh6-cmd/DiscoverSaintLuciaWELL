/* ============================================================================
   POST /api/share — a consumer explicitly shares their Journey with an advisor
   ----------------------------------------------------------------------------
   The only endpoint that stores personal data, and the only one that sends
   mail. It is public and unauthenticated, because the person using it is a
   member of the public who has just finished a quiz — which makes it the
   abuse surface of the whole system.

   FOUR GUARDS, IN ORDER OF WHAT THEY STOP:
     1. honeypot        — the cheap bots, which fill every field they find
     2. rate limit      — the same origin submitting repeatedly
     3. length caps     — a single request writing megabytes to the database
     4. escaping        — consumer input arriving at the advisor as markup

   Guard 4 is the one that matters most. This email is read by a real person in
   a real mail client, and every value in it came from a stranger's keyboard.

   ON WHAT THE EMAIL CARRIES
   Brief §11 says to avoid dumping all responses into the email and to deep
   link to the Journey detail screen instead. Through Phase 1 that was not
   possible — there was no such screen, so the email was the delivery mechanism
   and carried the whole briefing. The Hub now exists, and the email has been
   trimmed to a summary plus a link, as the brief always intended.
   ========================================================================== */
'use strict';

const {
  db, json, str, esc, looksLikeEmail, ipHash, body, methodGuard
} = require('./_lib/core.js');
const { activeAdvisor } = require('./_lib/advisors.js');
const { track } = require('./_lib/encharge.js');

/* Deliberately generous. A real person sharing a Journey submits once; this
   only has to stop a script, not inconvenience a household or an office
   behind one address. */
const RATE_LIMIT = { max: 5, windowMinutes: 60 };

/* Absolute, because this goes in an email. Overridable so a preview deploy
   links to itself rather than sending a tester to production. */
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com';

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const b = body(req);
  if (!b) return json(res, 400, { error: 'bad_body' });

  /* GUARD 1 — honeypot. A field no human sees and no human fills. Answer 200
     so a bot cannot tell it was caught and try something else. */
  if (str(b.company, 200)) return json(res, 200, { ok: true });

  /* Consent is not a checkbox we can infer. Without it, nothing is stored. */
  const consentText = str(b.consentText, 600);
  if (b.consent !== true || !consentText) {
    return json(res, 400, { error: 'consent_required' });
  }

  const first = str(b.firstName, 80);
  const last = str(b.lastName, 80);
  const email = str(b.email, 200).toLowerCase();
  if (!first || !last) return json(res, 400, { error: 'name_required' });
  if (!looksLikeEmail(email)) return json(res, 400, { error: 'email_invalid' });

  const phone = str(b.phone, 40);
  const timing = str(b.timing, 120);
  const travelWindow = normaliseWindow(str(b.travelWindow, 20), timing);
  const context = str(b.context, 1200);
  const advisorRef = str(b.advisor, 120);
  const sessionId = str(b.session, 64);
  const source = str(b.source, 40).toLowerCase() || null;

  const answers = (b.answers && typeof b.answers === 'object') ? {
    intention: str(b.answers.intention, 40),
    companions: str(b.answers.companions, 40),
    pace: str(b.answers.pace, 40),
    recognition: str(b.answers.recognition, 40)
  } : {};
  const villages = Array.isArray(b.villages)
    ? b.villages.slice(0, 6).map((v) => str(v, 80)).filter(Boolean)
    : [];

  const supabase = db();
  if (!supabase) return json(res, 503, { error: 'not_configured' });

  try {
    /* GUARD 2 — rate limit. Counted in the database rather than in memory
       because each request may be a different serverless instance, so an
       in-process counter would be reset by the platform constantly. */
    const hash = ipHash(req);
    if (hash) {
      const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60000).toISOString();
      const { count } = await supabase
        .from('journey_shares')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', hash)
        .gte('created_at', since);
      if ((count || 0) >= RATE_LIMIT.max) {
        return json(res, 429, { error: 'rate_limited' });
      }
    }

    /* Resolve the advisor. An unknown or paused reference is NOT an error —
       the share still gets recorded, unattributed, so a person who raised
       their hand is never dropped because a link was stale. */
    const advisor = advisorRef ? await activeAdvisor(supabase, advisorRef) : null;

    const { data: share, error } = await supabase
      .from('journey_shares')
      .insert({
        advisor_id: advisor ? advisor.id : null,
        answers,
        villages,
        consumer_first: first,
        consumer_last: last,
        consumer_email: email,
        consumer_phone: phone || null,
        timing: timing || null,
        travel_window: travelWindow,
        context: context || null,
        consent_text: consentText,
        source,
        session_id: sessionId || null,
        ip_hash: hash
      })
      .select('id')
      .single();
    if (error) throw error;

    /* The record is safe. Email is best-effort from here: if it fails the
       share is still captured and recoverable, so the consumer is never told
       their submission failed when it did not. */
    let notified = false;
    if (advisor) {
      /* ── The advisor's first Journey ─────────────────────────────────────
         Fired once, ever, per advisor: the count is taken AFTER the insert, so
         "1" means this one was the first. Counting before would race two
         simultaneous shares into two "first Journey" emails.

         NO CONSUMER DATA GOES WITH IT. Encharge is told that an advisor
         received their first Journey, not who sent it — the person who shared
         it agreed to reach one travel advisor, not to enter a marketing
         platform. */
      const { count } = await supabase
        .from('journey_shares')
        .select('id', { count: 'exact', head: true })
        .eq('advisor_id', advisor.id);
      if (count === 1) {
        const { data: full } = await supabase
          .from('advisors')
          .select('id, first_name, last_name, email, business, host_agency, website, market, status, public_code, registration_note')
          .eq('id', advisor.id).maybeSingle();
        if (full) await track('advisor_first_journey', full, {});
      }

      notified = await notifyAdvisor({
        advisor, first, last, email, phone, timing, context, villages, answers,
        shareId: share.id
      });
      if (notified) {
        await supabase
          .from('journey_shares')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', share.id);
      }
    }

    return json(res, 200, { ok: true, notified });
  } catch (e) {
    console.error('share failed', e);
    return json(res, 500, { error: 'share_failed' });
  }
};

/* ── Travel window ────────────────────────────────────────────────────────
   The client sends a normalised bucket. This trusts it only if it is one we
   defined, and otherwise falls back to reading the prose — which is what a
   cached copy of the old Finder still sends.

   The fallback deliberately mirrors db/migrations/002-hub.sql, INCLUDING its
   conservatism: the legacy "Within 3 months" becomes `31-90d`, never `30d`.
   Promoting it would invent urgency the consumer never expressed and put them
   at the top of an advisor's list on the strength of a guess. */
const WINDOWS = ['30d', '31-90d', '3-6mo', '6-12mo', '12mo+', 'exploring'];

function normaliseWindow(value, timing) {
  if (WINDOWS.includes(value)) return value;
  const t = String(timing || '').toLowerCase();
  if (!t) return 'exploring';
  if (/next month|30 day|within a month/.test(t)) return '30d';
  if (/within 3|1–3|1-3/.test(t)) return '31-90d';
  if (/3.{0,2}6/.test(t)) return '3-6mo';
  if (/6.{0,3}12/.test(t)) return '6-12mo';
  if (/more than a year|year away/.test(t)) return '12mo+';
  return 'exploring';
}

/* ── The advisor email ───────────────────────────────────────────────────── */
async function notifyAdvisor(d) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!key || !from) return false;

  const name = `${d.first} ${d.last}`;
  const link = `${SITE_ORIGIN}/hub/journeys/${d.shareId}`;

  /* SUMMARY AND A LINK — not the whole Journey.
     Now that the Hub exists this email is a notification, as brief §11 always
     intended. Three practical reasons the answers no longer travel in it:
     an inbox is the least private place this data could sit; the briefing on
     the Journey screen is a far better read than a table of codes; and the
     advisor ends up in the place where they can actually record what happened
     next. Contact details stay, because "reply from your phone at the school
     gate" is the behaviour we want to keep. */
  const rows = [
    ['Email', d.email],
    ['Phone', d.phone],
    ['Travel timing', d.timing]
  ].filter(([, v]) => v);

  /* GUARD 4 — every interpolated value is escaped. `esc()` is applied here,
     at the point of assembly, rather than trusted from the caller. */
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#133239">` +
    `<p style="margin:0 0 1.2em">${esc(d.advisor.first_name)},</p>` +
    `<p style="margin:0 0 1.2em"><strong>${esc(name)}</strong> completed the WELL Journey Finder ` +
    `through your campaign link and chose to share the result with you.</p>` +
    `<table cellpadding="0" cellspacing="0" style="margin:0 0 1.4em">` +
    rows.map(([k, v]) =>
      `<tr><td style="padding:4px 18px 4px 0;color:#5c6b68">${esc(k)}</td>` +
      `<td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`).join('') +
    `</table>` +
    `<p style="margin:0 0 1.4em">` +
    `<a href="${esc(link)}" style="display:inline-block;background:#E89A12;color:#133239;` +
    `text-decoration:none;font-weight:600;padding:11px 20px;border-radius:2px">Open their Journey</a></p>` +
    `<p style="margin:0 0 1.2em;color:#5c6b68">` +
    `What they asked for, what to ask them, and somewhere to keep your notes` +
    `${d.context ? ' — including the note they wrote in their own words' : ''}.</p>` +
    `<p style="margin:0 0 1.2em">Replying to this email goes straight to them.</p>` +
    `<p style="margin:0;color:#5c6b68;font-size:13px">They shared this deliberately, ` +
    `having been told you would receive it. Their Journey is a starting point for a ` +
    `conversation, not a booking.</p></div>`;

  try {
    const { Resend } = require('resend');
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from,
      to: d.advisor.email,
      /* Reply goes to the consumer, so the advisor can simply hit reply and be
         talking to the person — the single biggest reduction in friction
         available in this whole loop. */
      replyTo: d.email,
      subject: `${name} shared their WELL Journey with you`,
      html
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('advisor notification failed', e);
    return false;
  }
}

/* Exported for tools/hub-test.js. The travel-window mapping decides who sits at
   the top of an advisor's list, so it is worth testing directly rather than
   only through a live request. */
module.exports.normaliseWindow = normaliseWindow;
