/* ============================================================================
   HUB DATA — reads for the advisor surfaces
   ----------------------------------------------------------------------------
   Every query here is scoped by advisor_id in the query itself, on top of the
   RLS policies. Belt and braces on purpose: RLS is the guarantee, but a read
   that forgets its scope should return nothing rather than rely on the
   database to save it.

   Reads go through the service role because the Hub is server-rendered — there
   is no user JWT in the request to Supabase. The scoping is therefore OURS to
   get right, which is why the advisor id is threaded explicitly through every
   function rather than read from somewhere ambient.
   ========================================================================== */
'use strict';

const { db } = require('./core.js');
const { WINDOW_ORDER } = require('./hub-render.js');

const SHARE_FIELDS =
  'id, consumer_first, consumer_last, consumer_email, consumer_phone, ' +
  'timing, travel_window, context, answers, villages, stage, source, ' +
  /* A column missing from this string is `undefined` on every Hub screen, so a
     badge keyed off it would simply never render — silently, and looking
     exactly like "nobody has entered". */
  'sweepstakes_id, created_at, last_activity_at, notified_at';

async function journeysFor(advisorId, { limit = 200 } = {}) {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('journey_shares')
    .select(SHARE_FIELDS)
    .eq('advisor_id', advisorId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('journeysFor', error); return []; }
  return data || [];
}

async function journeyById(advisorId, id) {
  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('journey_shares')
    .select(SHARE_FIELDS)
    /* Both conditions. Asking for an id you do not own returns nothing rather
       than someone else's Journey. */
    .eq('advisor_id', advisorId)
    .eq('id', id)
    .maybeSingle();
  if (error) { console.error('journeyById', error); return null; }
  return data;
}

async function notesFor(advisorId, shareId) {
  const supabase = db();
  if (!supabase) return [];
  const { data } = await supabase
    .from('advisor_notes')
    .select('id, body, created_at')
    .eq('advisor_id', advisorId)
    .eq('share_id', shareId)
    .order('created_at', { ascending: false });
  return data || [];
}

/* The funnel the dashboard shows: visits -> completions -> shares. Counts
   only; no answers, nothing identifying. */
async function funnelFor(advisorId) {
  const supabase = db();
  if (!supabase) return { visits: 0, completions: 0, shares: 0 };
  const count = async (table) => {
    const { count: n } = await supabase
      .from(table).select('id', { count: 'exact', head: true }).eq('advisor_id', advisorId);
    return n || 0;
  };
  const [visits, completions, shares] = await Promise.all([
    count('campaign_visits'), count('finder_completions'), count('journey_shares')
  ]);
  return { visits, completions, shares };
}

/* ── Needs Attention ──────────────────────────────────────────────────────
   V2 §11 is explicit that this must not be "sort by departure date". A person
   who shared today and has not been contacted matters more than someone
   travelling sooner who was answered last week.

   The score is deliberately simple and readable rather than clever: newness
   and being un-contacted dominate, travel proximity nudges, and anything
   already settled drops out entirely. */
function attentionScore(j) {
  if (j.stage === 'booked' || j.stage === 'closed') return -1;

  let score = 0;
  const ageDays = (Date.now() - new Date(j.created_at).getTime()) / 86400000;

  if (j.stage === 'new') score += 100;                    /* nobody has replied yet */
  if (ageDays < 2) score += 40;                           /* just arrived */
  else if (ageDays < 7) score += 20;

  /* Waiting a long time in an early stage is the worst state to be in. */
  if (j.stage === 'new' && ageDays > 3) score += 30;

  const w = WINDOW_ORDER[j.travel_window];
  if (w !== undefined) score += Math.max(0, 25 - w * 5);

  if (j.stage === 'contacted') score += 15;
  if (j.stage === 'discovery' || j.stage === 'planning') score += 5;

  return score;
}

function needsAttention(list) {
  return list
    .map((j) => ({ j, s: attentionScore(j) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || new Date(b.j.created_at) - new Date(a.j.created_at))
    .map((x) => x.j);
}

/* ── Writes ───────────────────────────────────────────────────────────────
   Both writes carry the advisor id in the WHERE clause for the same reason the
   reads do, and both return a boolean rather than throwing: a failed stage
   change should re-render the page with the old stage, not 500 at someone who
   is mid-call. */
async function setStage(advisorId, shareId, stage) {
  const supabase = db();
  if (!supabase) return false;
  const { error } = await supabase
    .from('journey_shares')
    .update({ stage, last_activity_at: new Date().toISOString() })
    .eq('advisor_id', advisorId)
    .eq('id', shareId);
  if (error) { console.error('setStage', error); return false; }
  return true;
}

async function addNote(advisorId, shareId, text) {
  const supabase = db();
  if (!supabase) return false;
  const { error } = await supabase
    .from('advisor_notes')
    .insert({ advisor_id: advisorId, share_id: shareId, body: text });
  if (error) { console.error('addNote', error); return false; }
  /* A note IS activity. Recording it here keeps "last activity" honest without
     the advisor having to also change the stage. */
  await supabase
    .from('journey_shares')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('advisor_id', advisorId)
    .eq('id', shareId);
  return true;
}

/* How many people are waiting for a first reply. `new` is the stage that means
   nobody has answered them yet — see attentionScore, where it is worth more
   than everything else combined.

   A head count rather than journeysFor(): the campaign screen needs the number
   and nothing else, and pulling 200 rows to call .length on them would put a
   consumer's name and email into a request that has no use for either.

   Returns null, not 0, when it cannot tell. The campaign screen renders
   nothing on null and a real sentence on a number — "0 people are waiting"
   would otherwise be indistinguishable from a broken query. */
async function waitingCount(advisorId) {
  const supabase = db();
  if (!supabase || !advisorId) return null;
  const { count, error } = await supabase
    .from('journey_shares')
    .select('id', { count: 'exact', head: true })
    .eq('advisor_id', advisorId)
    .eq('stage', 'new');
  if (error) { console.error('waitingCount', error); return null; }
  return count || 0;
}

module.exports = {
  journeysFor, journeyById, notesFor, funnelFor,
  needsAttention, attentionScore, setStage, addNote, waitingCount
};
