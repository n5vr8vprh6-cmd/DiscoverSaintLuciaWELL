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

   ON THE EMAIL CONTAINING EVERYTHING
   Brief §11 says to avoid dumping all responses into the email and to deep
   link to the Journey detail screen instead. That is right — once that screen
   exists. In Phase 1 there is no Hub, so the email IS the delivery mechanism
   and has to carry enough for the advisor to pick up the phone. When the Hub
   lands, this trims back to a summary plus a link, as the brief intends.
   ========================================================================== */
'use strict';

const {
  db, json, str, esc, looksLikeEmail, ipHash, body, methodGuard
} = require('./_lib/core.js');

/* Deliberately generous. A real person sharing a Journey submits once; this
   only has to stop a script, not inconvenience a household or an office
   behind one address. */
const RATE_LIMIT = { max: 5, windowMinutes: 60 };

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
  const context = str(b.context, 1200);
  const slug = str(b.advisor, 120);
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

    /* Resolve the advisor. An unknown or paused slug is NOT an error — the
       share still gets recorded, unattributed, so a person who raised their
       hand is never dropped because a link was stale. */
    let advisor = null;
    if (slug) {
      const { data } = await supabase
        .from('advisors')
        .select('id, first_name, last_name, email, status')
        .eq('slug', slug)
        .maybeSingle();
      if (data && data.status === 'active') advisor = data;
    }

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
      notified = await notifyAdvisor({
        advisor, first, last, email, phone, timing, context, villages, answers
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

/* ── The advisor email ───────────────────────────────────────────────────── */
async function notifyAdvisor(d) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!key || !from) return false;

  const name = `${d.first} ${d.last}`;
  const rows = [
    ['Email', d.email],
    ['Phone', d.phone],
    ['Travel timing', d.timing],
    ['Journey points toward', d.villages.join(' · ')],
    ['They began with', d.answers.intention]
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
    (d.context
      ? `<p style="margin:0 0 0.4em;color:#5c6b68">In their own words</p>` +
        `<blockquote style="margin:0 0 1.4em;padding:0 0 0 14px;border-left:2px solid #E89A12">` +
        `${esc(d.context)}</blockquote>`
      : '') +
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
