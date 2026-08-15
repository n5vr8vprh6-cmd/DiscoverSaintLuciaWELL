/* ============================================================================
   SWEEPSTAKES — an advisor's prize draws, and the entries that belong to them
   ----------------------------------------------------------------------------
   THE PLATFORM IS NOT THE SPONSOR. Nothing here stores a prize, a rule, an
   eligibility condition or a piece of campaign copy. Those belong to the
   advisor and live off this system entirely. What this file knows is: which
   draws exist, whose they are, whether they are open, and which Journey shares
   came in through them.

   SCOPED BY ADVISOR, BY CONSTRUCTION — like hub-data.js and for the same
   reason. Every function that reads or writes a draw takes an advisorId and
   filters on it, so one advisor's screen can never render another's entrants
   even if an id is guessed. The one exception is resolveForEntry(), which is
   reached by the public share endpoint and therefore looks a draw up by its
   code alone; it returns the advisor it belongs to rather than trusting one.
   ========================================================================== */
'use strict';

const { db } = require('./core.js');

const OPEN = 'open';
const CLOSED = 'closed';

/* Names are the advisor's own reference, shown to nobody else. Capped so a
   paste accident cannot fill a column. */
const NAME_MAX = 80;

/* ── Public: resolve a code at entry time ─────────────────────────────────
   Called by api/share.js on an unauthenticated request, so it takes nothing on
   trust. Returns null for unknown, closed, or belonging-to-a-different-advisor
   — every one of which means "this is not an entry", never an error. Somebody
   sharing their Journey must never be blocked because a campaign ended.

   The advisorId argument is the advisor the share is ALREADY attributed to. A
   draw code that resolves to somebody else is ignored rather than allowed to
   move the lead: a link cannot reassign ownership by carrying a second code. */
async function resolveForEntry(supabase, code, advisorId) {
  const c = String(code || '').trim().toUpperCase();
  if (!supabase || !c || !advisorId) return null;

  const { data, error } = await supabase
    .from('sweepstakes')
    .select('id, advisor_id, name, status')
    .eq('code', c)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== OPEN) return null;
  if (data.advisor_id !== advisorId) return null;
  return data;
}

/* ── Have they entered this one already? ─────────────────────────────────
   One entry per email per draw. Sharing again is fine and the advisor still
   receives it; it is simply not a second ticket.

   THIS CHECK IS NOT THE GUARANTEE. Two submissions arriving close together can
   both pass it before either insert lands — a check-then-act race, easily
   produced by a double-click. The unique index in 009-one-entry.sql is what
   actually holds, and api/share.js retries without the flag when it fires.
   This exists so the ordinary case never reaches the constraint at all, and so
   the person can be told they are already in rather than told nothing.

   Returns true on a database error as well, deliberately: if we cannot tell,
   the safe answer is "do not add another entry" — an unentered share is a
   recoverable disappointment, a duplicate ticket is a rigged draw. */
async function alreadyEntered(supabase, sweepsId, email) {
  const who = String(email || '').trim().toLowerCase();
  if (!supabase || !sweepsId || !who) return false;
  const { count, error } = await supabase
    .from('journey_shares')
    .select('id', { count: 'exact', head: true })
    .eq('sweepstakes_id', sweepsId)
    .eq('consumer_email', who);
  if (error) { console.error('alreadyEntered', error); return true; }
  return (count || 0) > 0;
}

/* Used by api/well.js, which needs to know only whether the second path
   segment is a real draw belonging to this advisor — including a CLOSED one,
   because a closed draw's link still has to work as an ordinary advisor link
   rather than 404ing a printed QR code. */
async function resolveForLink(supabase, code, advisorId) {
  const c = String(code || '').trim().toUpperCase();
  if (!supabase || !c || !advisorId) return null;
  /* `code` is selected so the caller can forward the CANONICAL value rather
     than whatever case was typed — the same rule api/well.js already applies to
     the advisor reference, so the whole funnel agrees on one identifier. */
  const { data } = await supabase
    .from('sweepstakes')
    .select('id, advisor_id, name, code, status')
    .eq('code', c)
    .eq('advisor_id', advisorId)
    .maybeSingle();
  return data || null;
}

/* ── The advisor's own draws ──────────────────────────────────────────────── */
async function listFor(advisorId) {
  const supabase = db();
  if (!supabase || !advisorId) return [];

  const [draws, entries] = await Promise.all([
    supabase.from('sweepstakes')
      .select('id, name, code, status, closes_at, created_at, closed_at')
      .eq('advisor_id', advisorId)
      .order('created_at', { ascending: false }),
    /* Counted in one pass rather than a query per draw. An advisor has a
       handful of campaigns, not thousands, and the alternative is N round
       trips for a number shown in a list. */
    supabase.from('journey_shares')
      .select('sweepstakes_id')
      .eq('advisor_id', advisorId)
      .not('sweepstakes_id', 'is', null)
  ]);

  if (draws.error) { console.error('listFor', draws.error); return []; }

  const tally = (entries.data || []).reduce((acc, r) => {
    acc[r.sweepstakes_id] = (acc[r.sweepstakes_id] || 0) + 1;
    return acc;
  }, {});

  /* ── Open first, then most-recently-closed ───────────────────────────────
     Sorted here rather than in the query because "open before closed, and then
     by a DIFFERENT date column" is not one ORDER BY, and the rows are already
     in hand — an advisor has a handful of campaigns, not thousands.

     Open draws are what the page is for: you came to copy a link. Closed ones
     are an archive, and the useful order for an archive is what finished most
     recently. Falling back to created_at guards a row closed before closed_at
     existed, which would otherwise sort as if it were the oldest. */
  const when = (d) => new Date(d.closed_at || d.created_at).getTime();

  return (draws.data || [])
    .map((d) => Object.assign({}, d, { entries: tally[d.id] || 0 }))
    .sort((a, b) => {
      const aOpen = a.status === OPEN, bOpen = b.status === OPEN;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      if (aOpen) return new Date(b.created_at) - new Date(a.created_at);
      return when(b) - when(a);
    });
}

/* One draw, scoped. Returns null rather than throwing when it belongs to
   somebody else — the screen renders "no such draw", which is the truth from
   where that advisor is standing and discloses nothing. */
async function byId(advisorId, id) {
  const supabase = db();
  if (!supabase || !advisorId || !id) return null;
  const { data } = await supabase
    .from('sweepstakes')
    .select('id, advisor_id, name, code, status, closes_at, created_at, closed_at')
    .eq('id', id)
    .eq('advisor_id', advisorId)
    .maybeSingle();
  return data || null;
}

/* The entrants. Deliberately the same shape the Journeys list already uses, so
   an entrant is recognisably the same person in both places. */
async function entrantsFor(advisorId, sweepsId) {
  const supabase = db();
  if (!supabase || !advisorId || !sweepsId) return [];
  const { data, error } = await supabase
    .from('journey_shares')
    .select('id, consumer_first, consumer_last, consumer_email, consumer_phone, ' +
            'timing, travel_window, villages, stage, created_at')
    /* BOTH filters. The advisor scope is not redundant: without it, a guessed
       sweepstakes id would return somebody else's entrants. */
    .eq('advisor_id', advisorId)
    .eq('sweepstakes_id', sweepsId)
    .order('created_at', { ascending: true });
  if (error) { console.error('entrantsFor', error); return []; }
  return data || [];
}

/* ── Writes ──────────────────────────────────────────────────────────────── */
async function create(advisorId, name) {
  const supabase = db();
  if (!supabase || !advisorId) return { ok: false, error: 'not_configured' };
  const n = String(name || '').trim().slice(0, NAME_MAX);
  if (!n) return { ok: false, error: 'name_required' };

  /* `code` is omitted so the 008 trigger generates it. Passing one from here
     would be a second source of codes that could drift from the alphabet. */
  const { data, error } = await supabase
    .from('sweepstakes')
    .insert({ advisor_id: advisorId, name: n })
    .select('id, name, code, status')
    .single();

  if (error) {
    console.error('create sweepstakes — is migration 008 applied?', error);
    return { ok: false, error: 'failed' };
  }
  return { ok: true, sweepstakes: data };
}

async function rename(advisorId, id, name) {
  const supabase = db();
  if (!supabase) return { ok: false, error: 'not_configured' };
  const n = String(name || '').trim().slice(0, NAME_MAX);
  if (!n) return { ok: false, error: 'name_required' };
  const { data, error } = await supabase
    .from('sweepstakes').update({ name: n })
    .eq('id', id).eq('advisor_id', advisorId)
    .select('id').maybeSingle();
  if (error) { console.error('rename', error); return { ok: false, error: 'failed' }; }
  if (!data) return { ok: false, error: 'not_found' };
  return { ok: true };
}

/* Closing is reversible and destroys nothing. Entries already recorded keep
   their sweepstakes_id, which is what makes the entrant list stable after the
   draw closes — the list an advisor exports must not change because they
   pressed Close. */
async function setStatus(advisorId, id, status) {
  const supabase = db();
  if (!supabase) return { ok: false, error: 'not_configured' };
  if (status !== OPEN && status !== CLOSED) return { ok: false, error: 'bad_status' };
  const { data, error } = await supabase
    .from('sweepstakes')
    .update({ status, closed_at: status === CLOSED ? new Date().toISOString() : null })
    .eq('id', id).eq('advisor_id', advisorId)
    .select('id').maybeSingle();
  if (error) { console.error('setStatus', error); return { ok: false, error: 'failed' }; }
  if (!data) return { ok: false, error: 'not_found' };
  return { ok: true };
}

/* Deletion is offered only for an empty draw. A draw with entries is the only
   record that those people entered anything, and ON DELETE SET NULL would
   quietly orphan them — leaving their Journeys intact but unable to say where
   they came from. Closing is what an advisor actually wants. */
async function remove(advisorId, id) {
  const supabase = db();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const { count } = await supabase
    .from('journey_shares').select('id', { count: 'exact', head: true })
    .eq('advisor_id', advisorId).eq('sweepstakes_id', id);
  if ((count || 0) > 0) return { ok: false, error: 'has_entries' };

  const { data, error } = await supabase
    .from('sweepstakes').delete()
    .eq('id', id).eq('advisor_id', advisorId)
    .select('id').maybeSingle();
  if (error) { console.error('remove', error); return { ok: false, error: 'failed' }; }
  if (!data) return { ok: false, error: 'not_found' };
  return { ok: true };
}

/* ── Export ──────────────────────────────────────────────────────────────
   The advisor runs their own randomiser, so this is the whole draw mechanism:
   get the list out cleanly and get out of the way.

   Quoting is unconditional. A name with a comma, a note with a newline, or an
   address someone typed a quote into all break a naive join, and the file that
   breaks is the one somebody is about to pick a winner from. */
function toCsv(rows) {
  const cell = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  const head = ['Entered', 'First name', 'Last name', 'Email', 'Phone',
                'Travel timing', 'Villages', 'Stage'];
  const body = rows.map((r) => [
    new Date(r.created_at).toISOString().slice(0, 10),
    r.consumer_first, r.consumer_last, r.consumer_email, r.consumer_phone,
    r.timing, (r.villages || []).join(' · '), r.stage
  ].map(cell).join(','));

  /* CRLF and a UTF-8 BOM: Excel on Windows is where these files are opened,
     and without the BOM it renders accented village names as mojibake. */
  return '﻿' + [head.map(cell).join(',')].concat(body).join('\r\n') + '\r\n';
}

module.exports = {
  OPEN, CLOSED, NAME_MAX,
  resolveForEntry, resolveForLink, alreadyEntered,
  listFor, byId, entrantsFor,
  create, rename, setStatus, remove,
  toCsv
};
