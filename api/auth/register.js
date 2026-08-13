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
        emailRedirectTo: (process.env.SITE_ORIGIN || 'https://discoversaintluciawell.com') + '/hub/login',
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
        const slug = await uniqueSlug(supabase, first, last);
        const { error: insErr } = await supabase.from('advisors').insert({
          auth_user_id: user.id,
          slug,
          first_name: first,
          last_name: last,
          email,
          business: business || null,
          status: 'pending',
          onboarding_state: 'profile'
        });
        if (insErr) throw insErr;
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

/* The slug is now internal — public links use the opaque code — but it stays
   unique because deployed V1.2 links resolve through it. */
async function uniqueSlug(supabase, first, last) {
  const base = (first + '-' + last).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'advisor';
  for (let n = 0; n < 40; n++) {
    const candidate = n ? `${base}-${n + 1}` : base;
    const { data } = await supabase.from('advisors').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return base + '-' + Date.now().toString(36);
}
