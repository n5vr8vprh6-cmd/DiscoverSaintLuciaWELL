/* ============================================================================
   QR TEST — proves the hand-rolled encoder in js/hub.js produces a real QR code
   ----------------------------------------------------------------------------
   js/hub.js carries about 120 lines of QR encoder so the Hub does not load a
   third-party script onto a page displaying a consumer's contact details. That
   is only the right trade if the encoder is correct, and "it looks like a QR
   code" is not evidence: a wrong mask or a transposed format bit produces
   something that looks perfect and scans as nothing.

   WHY THIS IS NOT A STRAIGHT COMPARISON AGAINST A REFERENCE ENCODER
   The obvious test — generate the same payload with Python's `segno` and diff
   the matrices — cannot pass, and the reason is worth recording because it
   cost an hour. segno's write_padding_bits does

       buff.extend([0] * (8 - (length % 8)))

   with no guard for an already-aligned stream, so when `length % 8 == 0` it
   appends a whole zero codeword. In byte mode the stream is 4 + 8 + 8n + 4
   bits, which is ALWAYS aligned, so segno always emits one spurious 0x00
   before the pad codewords. Harmless — a decoder reads the length and stops —
   but it means the two matrices differ by design from the first pad codeword
   onward. Ours follows ISO/IEC 18004 §7.4.10 exactly.

   SO THE TEST PROVES FOUR THINGS INSTEAD, WHICH TOGETHER ARE STRONGER:

     1. Structure — every function-pattern and format-information module is
        identical to segno's. This is the part that must match bit for bit, and
        it covers finders, separators, timing, alignment, the dark module and
        both copies of the format info (which encode EC level and mask).

     2. Round trip — an independent reader in this file walks the matrix,
        un-masks it and parses the header, and must recover the exact input.
        This validates placement order, the mask, and the reserved map.

     3. The reader is itself validated against segno — the same reader must
        recover the text from segno's matrix too. Without this, step 2 would
        only prove that our encoder and our reader share a convention.

     4. Reed–Solomon — the recovered codeword stream is syndrome-checked with
        Horner evaluation, a different algorithm from the polynomial division
        the encoder uses, so a bug in the encoder's arithmetic cannot hide.

     node tools/qr-test.js

   Run this whenever the encoder is touched.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HUB = path.join(__dirname, '..', 'js', 'hub.js');

/* Pull the encoder straight out of the shipped file rather than keeping a copy
   here — a test against a duplicate proves nothing about what deploys. */
function loadEncoder() {
  const src = fs.readFileSync(HUB, 'utf8');
  const start = src.indexOf('QR-MATRIX-START');
  const end = src.indexOf('QR-MATRIX-END');
  if (start < 0 || end < 0) throw new Error('qr-test: markers not found in js/hub.js');
  /* The end marker sits inside a comment, so cut back to the function's closing
     brace — otherwise the extracted text ends with a dangling comment opener. */
  const body = src.slice(src.indexOf('function qrMatrix', start), src.lastIndexOf('}', end) + 1);
  // eslint-disable-next-line no-new-func
  return new Function(body + '\nreturn qrMatrix;')();
}

function reference(text) {
  const py = `
import sys, segno
q = segno.make(sys.argv[1], error='L', mask=0, mode='byte', boost_error=False, micro=False)
print(q.version)
for row in q.matrix:
    print(''.join('1' if b else '0' for b in row))
`;
  const out = execFileSync('py', ['-c', py, text], { encoding: 'utf8' }).trim().split(/\r?\n/);
  return { version: Number(out[0]), rows: out.slice(1).map((r) => r.split('').map(Number)) };
}

/* ── An independent reader ────────────────────────────────────────────────
   Written from the specification rather than from the encoder, and proved
   against segno's output before it is trusted with ours. */
function reservedMap(size) {
  const version = (size - 17) / 4;
  const map = [];
  for (let r = 0; r < size; r++) map.push(new Array(size).fill(false));
  const mark = (r, c) => { if (r >= 0 && r < size && c >= 0 && c < size) map[r][c] = true; };
  const finder = (r, c) => { for (let a = -1; a <= 7; a++) for (let b = -1; b <= 7; b++) mark(r + a, c + b); };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let t = 8; t < size - 8; t++) { mark(6, t); mark(t, 6); }
  if (version > 1) {
    const ac = size - 7;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) mark(ac + a, ac + b);
  }
  for (let f = 0; f < 9; f++) { mark(8, f); mark(f, 8); }
  for (let f = 0; f < 8; f++) { mark(8, size - 1 - f); mark(size - 1 - f, 8); }
  return map;
}

function readCodewords(matrix) {
  const size = matrix.length;
  const reserved = reservedMap(size);
  const bits = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const row = up ? size - 1 - step : step;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (reserved[row][cc]) continue;
        let b = matrix[row][cc];
        if ((row + cc) % 2 === 0) b ^= 1;        /* mask 0 */
        bits.push(b);
      }
    }
    up = !up;
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    words.push(b);
  }
  return words;
}

/* Parse the byte-mode header and pull the payload back out. */
function decodeText(words) {
  const bits = [];
  words.forEach((w) => { for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1); });
  const take = (n, at) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[at + i]; return v; };
  if (take(4, 0) !== 4) throw new Error('not byte mode');
  const len = take(8, 4);
  let out = '';
  for (let i = 0; i < len; i++) out += String.fromCharCode(take(8, 12 + i * 8));
  return out;
}

/* Horner evaluation at alpha^0 … alpha^(ec-1). Zero for a valid codeword. */
function syndromes(words, ec) {
  const EXP = new Array(512), LOG = new Array(256);
  for (let e = 0, x = 1; e < 255; e++) { EXP[e] = x; LOG[x] = e; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let e = 255; e < 512; e++) EXP[e] = EXP[e - 255];
  const mul = (a, b) => (a && b) ? EXP[(LOG[a] + LOG[b]) % 255] : 0;

  const out = [];
  for (let i = 0; i < ec; i++) {
    const a = EXP[i % 255];
    let acc = 0;
    words.forEach((w) => { acc = mul(acc, a) ^ w; });
    out.push(acc);
  }
  return out;
}

/* EC codewords per version at level L, mirroring the encoder's own table. */
const EC_AT_L = { 1: 7, 2: 10, 3: 15, 4: 20, 5: 26 };

const CASES = [
  'https://discoversaintluciawell.com/well/8K4PX7',
  'https://discoversaintluciawell.com/well/ABCDEF?to=journey',
  'https://discoversaintluciawell.com/well/8K4PX7?to=eclipse',
  'HELLO',
  'A'
];

const qrMatrix = loadEncoder();
let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  if (ok) { pass++; console.log(`  ok    ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? '\n        ' + detail : ''}`); }
};

for (const text of CASES) {
  const short = text.length > 44 ? text.slice(0, 41) + '…' : text;
  let ours, ref;
  try {
    ours = qrMatrix(text);
    ref = reference(text);
  } catch (e) {
    check(`${short} — generated`, false, e.message);
    continue;
  }

  /* 1. Structure */
  check(`${short} — version ${ref.version}, ${ours.length}×${ours.length}`,
    ours.length === ref.rows.length,
    `size ${ours.length} vs reference ${ref.rows.length}`);
  if (ours.length !== ref.rows.length) continue;

  const reserved = reservedMap(ours.length);
  let structDiff = 0;
  for (let y = 0; y < ours.length; y++) {
    for (let x = 0; x < ours.length; x++) {
      if (reserved[y][x] && ours[y][x] !== ref.rows[y][x]) structDiff++;
    }
  }
  check(`${short} — function patterns and format bits match the reference`,
    structDiff === 0, `${structDiff} structural modules differ`);

  /* 3. The reader, proved against third-party output first. */
  let refText = null;
  try { refText = decodeText(readCodewords(ref.rows)); } catch (e) { /* reported below */ }
  check(`${short} — reader recovers the reference's own payload`,
    refText === text, `reader read ${JSON.stringify(refText)}`);

  /* 2. Round trip through ours. */
  const words = readCodewords(ours);
  let mine = null;
  try { mine = decodeText(words); } catch (e) { /* reported below */ }
  check(`${short} — round-trips through our matrix`,
    mine === text, `read back ${JSON.stringify(mine)}`);

  /* 4. Reed–Solomon */
  const ec = EC_AT_L[ref.version];
  const syn = syndromes(words, ec);
  check(`${short} — Reed–Solomon syndromes are zero`,
    syn.every((v) => v === 0), `syndromes ${syn.join(' ')}`);
}

/* A payload past version 5 must throw rather than draw something unscannable. */
try {
  qrMatrix('x'.repeat(200));
  check('over-long payload is refused', false, 'it returned a matrix instead of throwing');
} catch (e) {
  check('over-long payload is refused', true);
}

console.log(`\n${pass}/${pass + fail} QR checks passed.`);
process.exit(fail ? 1 : 0);
