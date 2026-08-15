/* ============================================================================
   MASKING — what staff see when looking at somebody else's Hub
   ----------------------------------------------------------------------------
   A Journey holds a real person's name, email, phone and what they said about
   their own wellbeing. They agreed to share that with ONE named travel advisor.
   Staff looking at that advisor's Hub for support are a different audience, and
   almost every support question — "my pipeline looks wrong", "the count is
   off", "this Journey will not move stage" — is answerable without ever seeing
   who the consumer is.

   So by default it is masked, and revealing is a deliberate, audited act rather
   than the resting state.

   MASKING HAPPENS ON A COPY. The row is never mutated, because the same object
   may be counted or sorted elsewhere in the same request and a mutated name
   would quietly change what those did.
   ========================================================================== */
'use strict';

/* Keeps the shape recognisable without disclosing it: enough to tell two
   Journeys apart on a list, not enough to contact anyone. */
function maskName(first, last) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  return {
    first: f ? f[0] + '—' : 'Someone',
    last: l ? l[0] + '—' : ''
  };
}

function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at < 1) return '—';
  /* The domain stays: "is this a gmail address or their agency's" is a real
     support question, and the domain identifies nobody on its own. */
  return s[0] + '•••@' + s.slice(at + 1);
}

function maskPhone(phone) {
  const s = String(phone || '').replace(/\s+/g, '');
  if (!s) return '';
  return '•••' + s.slice(-3);
}

/* A masked copy of one Journey. `on` is false for an advisor looking at their
   own Hub — the ordinary case — so this is safe to call unconditionally. */
function maskJourney(j, on) {
  if (!on || !j) return j;
  const n = maskName(j.consumer_first, j.consumer_last);
  return Object.assign({}, j, {
    consumer_first: n.first,
    consumer_last: n.last,
    consumer_email: maskEmail(j.consumer_email),
    consumer_phone: maskPhone(j.consumer_phone),
    /* Free text is withheld entirely rather than masked. It is the one field
       where somebody describes their own circumstances in their own words, and
       there is no partial version of that which is both useful and safe. */
    context: j.context ? '[hidden while viewing as another advisor]' : j.context,
    masked: true
  });
}

const maskJourneys = (list, on) => (on ? (list || []).map((j) => maskJourney(j, on)) : list);

module.exports = { maskJourney, maskJourneys, maskName, maskEmail, maskPhone };
