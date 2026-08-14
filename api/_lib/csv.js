/* ============================================================================
   CSV — a small, correct parser
   ----------------------------------------------------------------------------
   WHY NOT .xlsx: parsing it means a zip + XML library running on files uploaded
   by a browser, in a project whose entire runtime dependency list is two
   packages. Excel writes CSV in two clicks. That is the trade, and it is
   deliberate rather than an omission.

   WHY NOT split(','): because `"Smith, Jane"` is one field, and a naive split
   turns it into two. Here that does not produce a parse error — it produces a
   person whose surname is ` Jane"` and whose email is somebody else's, created
   silently and then emailed a login link. A wrong row is worse than a rejected
   file.

   So this handles the three things that actually appear in exported CSV:
     · quoted fields containing commas
     · quoted fields containing newlines
     · escaped quotes inside quoted fields ("" per RFC 4180)

   It does not handle: alternative delimiters, comments, or multi-character
   quotes. Nothing exports those by default.
   ========================================================================== */
'use strict';

/* Returns an array of rows, each an array of strings. */
function parse(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let started = false;   /* has this field begun? distinguishes "" from empty  */

  /* Strip a UTF-8 BOM. Excel writes one, and without this the first header
     becomes "﻿email" and never matches a column name. */
  const s = String(text || '').replace(/^﻿/, '');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }   /* escaped quote */
        else quoted = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"' && !started) { quoted = true; started = true; continue; }
    if (c === ',') { row.push(field); field = ''; started = false; continue; }

    if (c === '\r') continue;                          /* CRLF — handled at \n */
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = []; field = ''; started = false;
      continue;
    }

    field += c;
    started = true;
  }

  /* A file not ending in a newline still has a last row. */
  if (started || field || row.length) { row.push(field); rows.push(row); }

  /* Drop rows that are entirely empty — a trailing blank line is not a person. */
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

/* Rows to objects, keyed by a normalised header. Accepts the headings a person
   would actually type — "Host agency", "host_agency" and "hostAgency" all reach
   the same field — because rejecting a file over a capital letter helps nobody. */
function toObjects(text, aliases) {
  const rows = parse(text);
  if (!rows.length) return { headers: [], rows: [] };

  const norm = (h) => String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const headers = rows[0].map((h) => {
    const key = norm(h);
    return (aliases && aliases[key]) || key;
  });

  return {
    headers,
    rows: rows.slice(1).map((cells) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = String(cells[i] == null ? '' : cells[i]).trim(); });
      return o;
    })
  };
}

module.exports = { parse, toObjects };
