/* ============================================================================
   CRITIQUE — score the draft against the playbook, rewrite it once
   ----------------------------------------------------------------------------
   The difference between copy a model produced and copy somebody would publish
   is usually one edit: the hook is buried, the adjectives are doing the work,
   the ask is too big. A model will make that edit reliably when it is asked to
   — and will almost never make it unprompted, because the first draft already
   satisfied the instruction it was given.

   So: generate, then hand the draft back with this channel's own `converts` and
   `kills` and ask for one pass. Two small calls, both well inside the ten
   second ceiling.

   ── IT CANNOT MAKE THINGS WORSE ────────────────────────────────────────────
   Every failure path returns `ok:false` and the caller keeps the original
   draft. An unparseable response, a timeout, a rewrite that came back empty or
   absurdly long — all of them leave the copy exactly as it was. The only
   outcomes available to this file are "better" and "unchanged".

   ── THE SCORE IS NOT FOR THE ADVISOR ───────────────────────────────────────
   It exists so tests and cost measurement can tell whether the pass is doing
   anything. It is never rendered. A visible score invites an advisor to argue
   with the number instead of reading the copy, and the number is the least
   trustworthy thing on the page.

   ── IT MAY NOT ADD FACTS ───────────────────────────────────────────────────
   The rewrite runs before claims.js, not instead of it, and the checker sees
   the final text either way. But a critique pass that invents a property to
   make a caption more concrete is a critique pass that manufactures work for
   the blocker, so it is told plainly: sharpen what is there, add nothing.
   ========================================================================== */
'use strict';

const { chat } = require('./openai.js');

const SYSTEM = `You are a direct-response editor. You improve marketing copy by
cutting, sharpening and reordering what is already there. You do not add facts,
places, claims or credentials. You return JSON and nothing else.`;

/* Long enough to matter, short enough that a rewrite cannot balloon into a
   different piece of copy. */
const MAX_GROWTH = 1.6;

function prompt(o) {
  const p = o.playbook || {};
  const bullets = (arr) => (arr || []).map((s) => '  - ' + s).join('\n');

  return `Edit this ${o.kind || 'copy'} for ${o.channel || 'social'}. One pass.

THE DRAFT
"""
${o.body}
"""

WHAT MAKES THIS CHANNEL WORK:
${bullets(p.converts) || '  - be specific, be short, ask for one thing'}

WHAT KILLS IT:
${bullets(p.kills) || '  - stacked adjectives, brochure voice, three asks'}
${p.lengths ? `\nLENGTH: ${p.lengths.ideal}, never past ${p.lengths.max} ${p.lengths.unit}.` : ''}

RULES FOR THE EDIT
1. ADD NOTHING. No new place, property, statistic, credential, price or claim.
   If the draft is vague, cut the vagueness — do not invent a detail to replace it.
2. Keep every {{WELL_LINK}} token exactly as it appears. Do not add one that
   was not there and do not remove one that was.
3. No health claims, ever, in either direction — nothing about treating,
   curing, reducing, relieving or improving anything about a person.
4. Keep the writer's voice. You are editing them, not replacing them.
5. If the draft is already good, say so and return it unchanged. That is a
   real answer, not a failure.

SCORE IT HONESTLY, 0-10, on whether a real person in this audience would stop
and read it. Most competent-but-generic copy is a 5.

RETURN EXACTLY THIS JSON, no prose, no code fence:
{"score": 0, "worst": "the single biggest problem, in a few words", "rewrite": "the edited copy"}`;
}

async function improve(o) {
  const original = String(o && o.body || '');
  if (!original.trim()) return { ok: false, reason: 'empty_input' };

  const r = await chat({
    system: SYSTEM,
    user: prompt(o),
    maxTokens: 900,
    /* Lower than generation. This is an edit, not an invention, and
       temperature here buys nothing but drift. */
    temperature: 0.3,
    stub: JSON.stringify({ score: 7, worst: 'stub', rewrite: original })
  });

  if (!r.ok) return { ok: false, reason: r.reason, ms: r.ms, usage: r.usage };

  const parsed = parse(r.text);
  if (!parsed) return { ok: false, reason: 'unparseable', ms: r.ms, usage: r.usage };

  const rewrite = String(parsed.rewrite || '').trim();

  /* ── The guards, each one a way this could quietly damage the copy ────── */

  if (!rewrite) {
    return { ok: false, reason: 'empty_rewrite', score: parsed.score, ms: r.ms, usage: r.usage };
  }

  /* A rewrite that is much longer is not an edit, it is a different piece. */
  if (rewrite.length > original.length * MAX_GROWTH) {
    return { ok: false, reason: 'grew_too_much', score: parsed.score, ms: r.ms, usage: r.usage };
  }

  /* THE LINK TOKEN MUST SURVIVE. Losing it silently produces a caption with no
     way for anybody to reach the advisor, which is the one thing every asset in
     this product exists to carry. Gaining one is equally wrong: it would put a
     link somewhere the plan never intended. */
  if (count(original, '{{WELL_LINK}}') !== count(rewrite, '{{WELL_LINK}}')) {
    return { ok: false, reason: 'link_token_changed', score: parsed.score, ms: r.ms, usage: r.usage };
  }

  return {
    ok: true,
    body: rewrite,
    score: typeof parsed.score === 'number' ? parsed.score : null,
    worst: String(parsed.worst || '').slice(0, 200),
    changed: rewrite !== original,
    ms: r.ms,
    usage: r.usage
  };
}

function count(s, needle) {
  return String(s).split(needle).length - 1;
}

/* Same defensive shape as gtm-generate's parser — models fence JSON however
   firmly you ask them not to. */
function parse(text) {
  const t = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch (_) { /* fall through */ }
  const i = t.indexOf('{');
  const j = t.lastIndexOf('}');
  if (i >= 0 && j > i) {
    try { return JSON.parse(t.slice(i, j + 1)); } catch (_) { /* give up */ }
  }
  return null;
}

module.exports = { improve, MAX_GROWTH };
