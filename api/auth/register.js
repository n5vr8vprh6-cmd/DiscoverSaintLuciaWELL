/* ============================================================================
   POST /api/auth/register — create an advisor account
   ----------------------------------------------------------------------------
   Registration is open and self-serve (Duncan's decision). Anyone may create an
   account and use the Hub.

   RECEIVING JOURNEYS IS GATED, AND THAT IS THE POINT OF `status`.
   A new advisor is created `status = 'pending'`. The consumer result screen and
   /api/share only ever resolve advisors whose status is `active`, so a stranger
   who registers cannot yet have a real person's name, email and phone number
   routed to them. The privacy policy tells consumers their Journey goes to "an
   independent travel advisor", which a reader will hear as a vetted one; open
   registration without this gate would quietly make that untrue.

   Duncan flips status to 'active' in the Supabase dashboard. If he decides the
   beta should be fully open, this is the one line to change.

   Supabase Auth owns the password. It is passed straight through and never
   read, logged, hashed or stored here.
   ========================================================================== */
'use strict';

const { db, json, str, esc, looksLikeEmail, body, methodGuard } = require('../_lib/core.js');
const { anonClient, setSession } = require('../_lib/auth.js');
const { track } = require('../_lib/encharge.js');

module.exports = async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;

  const b = body(req);
  if (!b) return json(res, 400, { error: 'bad_body' });

  /* Same honeypot as the consumer share form. */
  if (str(b.company, 200)) return json(res, 200, { ok: true });

  const first = str(b.firstName, 80);
  const last = str(b.lastName, 80);
  const email = str(b.email, 200).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  const business = str(b.business, 160);

  /* Optional, and the only reason they exist is that an admin has to decide
     whether this is a real travel advisor. `registrationNote` is the fast path:
     "Toronto workshop, June" is someone already known, and the approval queue
     shows it inline for exactly that.

     Capped like everything else that arrives from a keyboard. The note is the
     longest because it is prose, and it is rendered escaped wherever it is
     shown. */
  const hostAgency = str(b.hostAgency, 160);
  const website = str(b.website, 300);
  const registrationNote = str(b.registrationNote, 600);

  if (!first || !last) return json(res, 400, { error: 'name_required' });
  if (!looksLikeEmail(email)) return json(res, 400, { error: 'email_invalid' });
  /* A floor, not a policy. Supabase enforces its own minimum; this exists so
     the message comes back in our voice rather than as a provider error. */
  if (password.length < 10) return json(res, 400, { error: 'password_too_short' });

  const auth = anonClient();
  const supabase = db();
  if (!auth || !supabase) return json(res, 503, { error: 'not_configured' });

  try {
    /* An address that already has an account must not be confirmable from the
       outside — answering "that email is taken" turns this endpoint into a way
       to test whether a given advisor is registered. Supabase's signUp is
       already designed for this and does not disclose it either. */
    const { data, error } = await auth.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: (process.env.SITE_ORIGIN || 'https://www.discoversaintluciawell.com') + '/hub/login',
        data: { first_name: first, last_name: last }
      }
    });
    if (error) {
      const m = String(error.message || '').toLowerCase();
      const code = String(error.code || '');
      const status = Number(error.status || 0);

      if (m.includes('password')) return json(res, 400, { error: 'password_weak' });

      /* ONLY the already-registered case is answered success-shaped. An earlier
         version masked every error that way, which meant a genuine failure —
         Supabase's built-in email hitting its send limit — looked to the person
         registering exactly like success, and they waited for a verification
         email that was never sent. Non-disclosure is worth protecting; silently
         swallowing outages is not. */
      if (code === 'user_already_exists' || m.includes('already registered')) {
        return json(res, 200, { ok: true, verify: true });
      }

      /* The failure we actually hit in testing, and the one most likely in a
         beta: Supabase's built-in mailer allows only a few messages an hour.
         Configuring custom SMTP (Resend, which this project already uses) is
         the fix; until then the person needs to be told to try again rather
         than left waiting. */
      if (status === 429 || code === 'over_email_send_rate_limit') {
        console.error('register blocked: verification email rate limit — configure custom SMTP in Supabase');
        return json(res, 503, { error: 'email_unavailable' });
      }

      console.error('register failed', error);
      return json(res, 500, { error: 'register_failed' });
    }

    const user = data && data.user;
    if (user) {
      /* One advisor row per auth user. `onConflict` makes a repeated
         registration idempotent rather than producing a duplicate identity —
         spec §21 asks explicitly whether there is one advisor model or several
         competing records, and the answer must stay "one". */
      const existing = await supabase
        .from('advisors').select('id').eq('auth_user_id', user.id).maybeSingle();

      if (!existing.data) {
        const slug = await uniqueSlug(supabase);
        const { data: created, error: insErr } = await supabase.from('advisors').insert({
          auth_user_id: user.id,
          slug,
          first_name: first,
          last_name: last,
          email,
          business: business || null,
          host_agency: hostAgency || null,
          website: website || null,
          registration_note: registrationNote || null,
          status: 'pending',
          onboarding_state: 'profile'
        }).select().single();
        if (insErr) throw insErr;

        /* Onboarding starts here. Awaited rather than fired and forgotten: a
           serverless function is killed once it responds, so an un-awaited
           call is a call that may never leave. It is bounded by its own
           timeout and cannot fail this request — see api/_lib/encharge.js. */
        await track('advisor_registered', created, {
          hasNote: !!created.registration_note,
          hasHostAgency: !!created.host_agency
        });
      }
    }

    /* If the project does not require email confirmation, Supabase returns a
       session and we sign them straight in. If it does, there is no session
       and the client shows "check your email". Both are correct; which one
       happens is a Supabase project setting, not something to hard-code. */
    if (data && data.session) {
      setSession(res, data.session);
      return json(res, 200, { ok: true, signedIn: true });
    }
    return json(res, 200, { ok: true, verify: true });
  } catch (e) {
    console.error('register failed', e);
    return json(res, 500, { error: 'register_failed' });
  }
};

/* ── The internal slug ────────────────────────────────────────────────────
   RANDOM, NOT DERIVED FROM THE NAME.

   The column only still exists because deployed V1.2 links resolve through it,
   and public links have used the opaque `public_code` since V2. But it was
   being minted as `first-last`, which quietly reintroduced exactly what V2 §6
   forbids: a guessable, name-bearing identifier that resolves. Anyone could
   try /well/jane-smith and learn whether that advisor exists here — and every
   advisor's identifier was predictable from their name alone.

   Nothing generates a link from the slug, so it has no reason to be readable.
   64 bits of randomness makes it unguessable and collisions negligible; the
   retry loop is there because "negligible" is not "impossible", and a
   duplicate would fail the unique constraint at insert time. */
async function uniqueSlug(supabase) {
  const crypto = require('crypto');
  for (let n = 0; n < 5; n++) {
    /* Leading letter so the value is never mistaken for a number, and a fixed
       prefix so these are recognisable as generated rather than legacy. */
    const candidate = 'adv-' + crypto.randomBytes(8).toString('hex');
    const { data } = await supabase.from('advisors').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
  }
  /* Five collisions on a 64-bit value means something is wrong with the RNG,
     not with luck. Fall through to something certainly unique rather than
     failing the registration. */
  return 'adv-' + crypto.randomBytes(8).toString('hex') + '-' + Date.now().toString(36);
}
