/* ============================================================================
   BRIEF — the advisor's own specifics, in a shape the generator will actually use
   ----------------------------------------------------------------------------
   ── THE FINDING THIS FILE EXISTS BECAUSE OF ────────────────────────────────
   Five approaches have now failed to make generated plans use an advisor's own
   details: three prompt variants, a stronger model, a structured persona, and
   an explicit instruction demanding three specific references. Across all of
   them the same profile field — "Two lawyers who had not taken a week off
   together since 2019" — was never used.

   What DID work, twice, was labelled structured input. The persona changed
   plans measurably the moment it arrived as named fields. The conclusion is
   not that there is too little input; it is that PROSE IS READ AS SCENERY.

   So a brief is not a paragraph about the advisor. It is an INVENTORY of
   individually addressable items — CLIENT 1, MARKET 2, PROOF 3 — and the
   generator is required to cite which one each action came from. That turns
   "please use their specifics" from an instruction nobody can check into a
   field that can be validated against the actual list.

   ── THE FORMAT ────────────────────────────────────────────────────────────
   Sections, then items. Chosen over JSON because an advisor has to paste this
   from another AI's chat window and eyeball whether it looks right, and a
   missing brace in JSON destroys everything while a missing colon here loses
   one line. Forgiving on whitespace, strict on structure.

     ## VOICE
     tone: warm, direct, unhurried
     avoid: exclamation marks, "amazing", industry jargon

     ## CLIENTS
     - who: Two lawyers, both partners at the same firm
       situation: had not taken a week off together since 2019
       wanted: somewhere neither of them had to organise

   ── IT FAILS LOUDLY ───────────────────────────────────────────────────────
   Large paste-backs get truncated, half-copied and reordered. A parser that
   silently accepts three quarters of a brief produces a campaign nobody can
   explain, so this names the section that is missing and refuses.
   ========================================================================== */
'use strict';

/* The sections an advisor's AI must return. `min` is how many items make a
   section worth having — one client vignette is a coincidence, two is a
   pattern the generator can write toward. */
const SECTIONS = [
  { key: 'VOICE',      kind: 'fields', required: true,  min: 2,
    label: 'How they sound',
    fields: ['tone', 'avoid', 'signature'] },
  { key: 'CLIENTS',    kind: 'items',  required: true,  min: 2,
    label: 'Real clients, described',
    fields: ['who', 'situation', 'wanted'] },
  { key: 'MARKETS',    kind: 'list',   required: true,  min: 1,
    label: 'Where their people are' },
  { key: 'OBJECTIONS', kind: 'list',   required: true,  min: 2,
    label: 'What they hear and how they answer it' },
  { key: 'PROOF',      kind: 'list',   required: true,  min: 1,
    label: 'What they can legitimately claim' },
  { key: 'ANGLES',     kind: 'list',   required: false, min: 0,
    label: 'Positioning angles their AI proposed' }
];

const HEADER = /^\s{0,3}#{1,3}\s*([A-Z][A-Z _-]{2,20})\s*$/;

/* ── Parsing ──────────────────────────────────────────────────────────────
   Deliberately tolerant of what a chat window does to text — smart quotes,
   bullet characters, stray indentation, a code fence wrapped round the whole
   thing — and intolerant of a missing section. */
function parse(raw) {
  const text = String(raw || '')
    .replace(/^```[a-z]*\s*/i, '').replace(/\s*```\s*$/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

  if (!text.trim()) {
    return { ok: false, reason: 'empty', missing: SECTIONS.filter((s) => s.required).map((s) => s.key) };
  }

  /* Split into sections by header line. */
  const lines = text.split('\n');
  const found = {};
  let current = null;
  lines.forEach((line) => {
    const h = line.match(HEADER);
    if (h) {
      current = h[1].trim().toUpperCase().replace(/[ _-]+/g, '');
      found[current] = found[current] || [];
      return;
    }
    if (current) found[current].push(line);
  });

  const out = {};
  const missing = [];
  const thin = [];

  SECTIONS.forEach((s) => {
    const body = found[s.key.replace(/[ _-]+/g, '')] || null;
    if (!body) {
      if (s.required) missing.push(s.key);
      return;
    }
    const parsed = s.kind === 'items' ? parseItems(body)
      : s.kind === 'fields' ? parseFields(body)
      : parseList(body);

    const count = s.kind === 'fields' ? Object.keys(parsed).length : parsed.length;
    if (count < s.min) {
      if (s.required) thin.push(`${s.key} (${count} of ${s.min})`);
      return;
    }
    out[s.key] = parsed;
  });

  if (missing.length || thin.length) {
    return { ok: false, reason: missing.length ? 'missing_sections' : 'too_thin', missing, thin };
  }
  return { ok: true, brief: out };
}

/* "- who: x" then indented "situation: y" continues the same item. */
function parseItems(lines) {
  const items = [];
  let cur = null;
  lines.forEach((raw) => {
    const line = raw.replace(/^\s*[•*]\s/, '- ');
    const start = line.match(/^\s{0,4}-\s*(.+)$/);
    const kv = (start ? start[1] : line).match(/^\s*([a-z_ ]{2,20}):\s*(.+)$/i);
    if (start) {
      cur = {};
      items.push(cur);
      if (kv) cur[norm(kv[1])] = kv[2].trim();
      else if (start[1].trim()) cur.who = start[1].trim();
      return;
    }
    if (cur && kv) cur[norm(kv[1])] = kv[2].trim();
  });
  /* An item with nothing in it is a bullet somebody forgot to fill in. */
  return items.filter((i) => Object.keys(i).length);
}

function parseFields(lines) {
  const out = {};
  lines.forEach((line) => {
    const kv = line.match(/^\s*-?\s*([a-z_ ]{2,20}):\s*(.+)$/i);
    if (kv) out[norm(kv[1])] = kv[2].trim();
  });
  return out;
}

function parseList(lines) {
  return lines
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter((l) => l && !/^[-=_]{3,}$/.test(l));
}

const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, '_');

/* ── What reaches the prompt ──────────────────────────────────────────────
   A NUMBERED INVENTORY, because the point of the whole exercise is that each
   item can be pointed at. The generator is told to cite the ones it used, and
   `citations()` below checks that what it cited exists. */
function briefBlock(brief) {
  if (!brief) return '';
  const b = brief;
  const parts = [];

  if (b.VOICE) {
    parts.push('HOW THIS ADVISOR SOUNDS — match it\n' +
      Object.keys(b.VOICE).map((k) => `  ${k}: ${b.VOICE[k]}`).join('\n'));
  }

  const numbered = (key, label, render) => {
    const list = b[key];
    if (!list || !list.length) return;
    parts.push(`${label}\n` + list.map((item, i) =>
      `  ${key} ${i + 1}: ${render(item)}`).join('\n'));
  };

  numbered('CLIENTS', 'REAL CLIENTS OF THEIRS — these are the people to write toward',
    (c) => [c.who, c.situation, c.wanted].filter(Boolean).join(' — '));
  numbered('MARKETS', 'WHERE THEIR PEOPLE ACTUALLY ARE', (m) => m);
  numbered('OBJECTIONS', 'WHAT THEY HEAR, AND HOW THEY ANSWER IT', (o) => o);
  numbered('PROOF', 'WHAT THEY MAY LEGITIMATELY CLAIM', (p) => p);
  if (b.ANGLES) numbered('ANGLES', 'ANGLES THEIR OWN RESEARCH PROPOSED', (a) => a);

  return `THINGS ONLY THIS ADVISOR KNOWS
${parts.join('\n\n')}

USE THESE BY NUMBER. At least three of your actions must each be built on one
specific item above, and each such action must say which in its "uses" field —
for example "CLIENT 2" or "MARKET 1". An action built on nothing from this list
leaves "uses" empty, and there should be few of those.

This is the part no other advisor has. An action that does not touch it could
appear in anyone's plan.`;
}

/* Every citable label, for validating what came back. A model asked to cite
   will occasionally cite CLIENT 7 out of a list of two. */
function citations(brief) {
  if (!brief) return [];
  const out = [];
  ['CLIENTS', 'MARKETS', 'OBJECTIONS', 'PROOF', 'ANGLES'].forEach((k) => {
    (brief[k] || []).forEach((_, i) => out.push(`${k} ${i + 1}`));
  });
  return out;
}

/* Normalises a citation to a real label, or returns null.

   SINGULAR AND PLURAL BOTH RESOLVE. The sections are named CLIENTS and MARKETS,
   but "CLIENT 2" and "MARKET 1" are what a model naturally writes when it means
   one of them — and rejecting those would discard exactly the specificity this
   whole file exists to capture, while looking like the model had failed to
   comply. Tolerant on the way in, strict about whether the item exists. */
function validCitation(brief, raw) {
  const m = String(raw || '').toUpperCase().match(/([A-Z]+)\s*[#:.]?\s*(\d+)/);
  if (!m) return null;

  const n = Number(m[2]);
  const word = m[1];
  const real = citations(brief);

  /* Try it as given, then with an S added, then with one removed. */
  const tries = [word, word + 'S', word.replace(/S$/, '')];
  for (const t of tries) {
    const label = `${t} ${n}`;
    if (real.indexOf(label) !== -1) return label;
  }
  return null;
}

/* THE CITED ITEM, IN FULL, FOR THE ASSET THAT WAS BUILT ON IT.
   The skeleton cites a label; the asset needs the thing itself. Without this
   the copy writer is handed "CLIENTS 2" and no idea who that is — which would
   reproduce the original failure one layer down, and look like it was working
   because the citation was present. */
function citedBlock(brief, uses) {
  const label = validCitation(brief, uses);
  if (!label) return '';

  const [key, n] = label.split(' ');
  const item = (brief[key] || [])[Number(n) - 1];
  if (!item) return '';

  const text = typeof item === 'string' ? item
    : [item.who, item.situation, item.wanted].filter(Boolean).join(' — ');

  return `THIS PIECE IS FOR A SPECIFIC PERSON OR FACT THE ADVISOR GAVE US
${label}: ${text}

Write it to THEM, or about THAT. Do not generalise it back into a category —
naming the particular is the entire reason this piece exists rather than one
any other advisor could have posted.`;
}

/* What the screen says when a paste-back is rejected. Names the section, so an
   advisor can go back to their AI and ask for the missing piece rather than
   starting again. */
function explain(result) {
  if (!result || result.ok) return '';
  if (result.reason === 'empty') return 'Nothing was pasted.';
  if (result.reason === 'missing_sections') {
    return `That brief is missing ${list(result.missing)}. Ask your assistant for the ` +
      `whole thing again — it is easy for a long answer to get cut off when it is copied.`;
  }
  if (result.reason === 'too_thin') {
    return `${list(result.thin)} came back too short to build on. Two client examples and ` +
      `two objections are the minimum that lets a plan say something specific.`;
  }
  return 'That brief could not be read.';
}

const list = (a) => (a || []).length > 1
  ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]
  : String((a || [])[0] || '');

module.exports = { parse, briefBlock, citedBlock, citations, validCitation, explain, SECTIONS };
