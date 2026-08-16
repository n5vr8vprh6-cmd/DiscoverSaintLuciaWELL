/* ============================================================================
   IMAGE BRIEF — what to photograph, and why we do not hand you a picture
   ----------------------------------------------------------------------------
   Every social asset needs an image and the plan has never said a word about
   one. An advisor with a written caption and no picture posts nothing.

   ── WHY NO PICTURES ARE SHIPPED ───────────────────────────────────────────
   Three separate reasons, and any one of them is enough:

   1. GENERATED IMAGES OF SAINT LUCIA INVENT SAINT LUCIA. A model asked for a
      Pitons sunset produces a mountain that is not the Pitons, on a coast that
      does not exist, and posting it as a destination photograph is a false
      claim about a real place. The Strategist Bible is blunt about it:
      generative imagery must never be presented as documentary proof of a
      destination, property, practitioner, client result or cultural practice.

   2. OUR OWN PROPERTY PHOTOGRAPHY IS NOT OURS TO GIVE. content/properties-media.js
      records where each image came from — the properties' own sites. Our terms
      already tell advisors they may not republish substantial parts of this
      site as their own; shipping them a download button would be us doing the
      thing we forbid.

   3. A STOCK BEACH IS THE SAME LIE AS A GENERATED ONE if it is captioned as
      Saint Lucia.

   ── SO THE BRIEF IS SHOT WHERE THE ADVISOR IS ─────────────────────────────
   The move that makes this work: most advisors have never been to Saint Lucia
   and cannot photograph it. Briefs that ask for the destination produce either
   nothing or a lifted image.

   So every brief here is about the CLIENT'S LIFE AND THE FEELING, not the
   place — a made bed, two cups nobody has cleared, trainers by a door. All of
   it is shootable in Toronto on a Tuesday with a phone. It sidesteps the
   rights problem instead of managing it, and it is better marketing anyway:
   the reason somebody books is what they want to feel, and a stock sunset says
   nothing a thousand other posts have not.

   ── AND NO FACES ──────────────────────────────────────────────────────────
   Every shot is framed to crop faces out. That is not an aesthetic tic. A
   recognisable client in a marketing photograph needs their permission, and
   an advisor who does not know that finds out the hard way.

   ── THE RISK NOBODY ELSE IN THIS CODEBASE CAN SEE ─────────────────────────
   claims.js reads text. It cannot read a photograph, and A PICTURE MAKES
   CLAIMS. A treatment table shot like a clinic, a practitioner in what reads
   as medical dress, a before-and-after pairing — each asserts a health outcome
   as loudly as a sentence would, and none of it reaches the checker. Health
   claims are judged on what a consumer perceives, not what was intended.

   So the "keep out of frame" list is a real control, not decoration, and it is
   the only control this product has over that entire class of risk.

   ── DETERMINISTIC, LIKE THE CHECKER ───────────────────────────────────────
   No model call. It costs nothing, adds no latency to a generation already
   under a function timeout, cannot invent a property, and can be read once by
   a human and then trusted. A generated shot list would be a fourth way to
   invent Saint Lucia.
   ========================================================================== */
'use strict';

/* Kinds that a picture actually accompanies. An email gets a header image at
   most and most clients block it; SMS and DM get nothing. */
const VISUAL_CHANNELS = {
  instagram: 1, facebook: 1, tiktok: 1, linkedin: 1, youtube: 1
};

function isVisual(action) {
  if (!action) return false;
  const kind = action.assetKind;
  if (kind === 'none') return false;
  return Boolean(VISUAL_CHANNELS[String(action.channel || '').toLowerCase()]);
}

/* ── Frames ───────────────────────────────────────────────────────────────
   Ratios an advisor can actually set on a phone, with the one thing about
   each surface that ruins a good picture if nobody mentions it. */
const FRAMES = {
  instagram: { ratio: '4:5', px: '1080 × 1350',
    note: 'Vertical. Keep the top and bottom of the frame quiet — the app puts your handle over one and the caption over the other.' },
  facebook: { ratio: '4:5', px: '1080 × 1350',
    note: 'Vertical fills more of a phone screen than a square does.' },
  tiktok: { ratio: '9:16', px: '1080 × 1920',
    note: 'Full vertical. The right-hand third carries the buttons, so nothing that matters goes there.' },
  linkedin: { ratio: '1.91:1', px: '1200 × 627',
    note: 'Wide, and it renders small in the feed. One subject only — anything busy turns to mush.' },
  youtube: { ratio: '16:9', px: '1280 × 720',
    note: 'If this is a thumbnail, it will be seen at the size of a postage stamp. One shape, high contrast.' }
};

/* ── The shots ────────────────────────────────────────────────────────────
   Two per Compass need so a four-week plan does not ask for the same
   photograph four times. Every one is shootable at home, in daylight, with a
   phone, and every one crops the face out.

   They are written as instructions to a person, not as prompts to a model. */
const SHOTS = {
  restore: [
    'An unmade bed in late-morning light, one corner of the sheet still turned back. Nobody in it.',
    'A phone face-down on a table next to a cup of coffee that has gone cold.'
  ],
  reconnect: [
    'Two cups on a table, one half-drunk, the chairs pulled closer than a restaurant would set them. Nobody in frame.',
    'Two pairs of shoes by a door, one kicked off at an angle.'
  ],
  move: [
    'Trainers by the door with the laces still tied from last time.',
    'A towel over a shoulder, cropped at the neck. No face, no gym.'
  ],
  nourish: [
    'A plate halfway through a meal, cutlery put down — the picture of somebody who stopped to talk.',
    'Hands passing a dish across a table, cropped at the wrists.'
  ],
  explore: [
    'A door standing open onto somewhere brighter than the room you are shooting from.',
    'A phone with the map open on a table by a window, keys beside it.'
  ],
  reflect: [
    'A notebook open with half a page written, the pen put down.',
    'A window doing all the work. No subject at all — just the light coming in.'
  ],
  celebrate: [
    'Two glasses touching, cropped tight. No faces.',
    'A table after the meal: plates pushed back, candles still going.'
  ],
  return: [
    'A packed bag by a door that nobody has picked up yet.',
    'A passport and a boarding pass on a counter, half in shadow.'
  ]
};

/* The honest default when we know nothing about their clients' needs. */
const GENERIC = [
  'One ordinary object that means a trip is coming — a bag half packed, a calendar with a week blocked out.',
  'A window, a table, morning light. Nothing staged, nothing in it that needs explaining.'
];

/* ── Light ────────────────────────────────────────────────────────────────
   Keyed to how the audience is disposed toward wellness, because the register
   of a photograph is what tells a sceptic they are being sold to. */
const LIGHT = {
  primary: 'Early and soft, from one side. Overcast is fine — flat light reads as calm.',
  'secondary-intentional': 'Late afternoon. Warm, but stop short of a golden-hour postcard.',
  'secondary-casual': 'Ordinary daylight. It should look like a Tuesday, not like a shoot.',
  sceptical: 'Plain daylight and no styling at all. Anything that looks art-directed reads as an advert, and this audience is already braced for one.'
};
const LIGHT_DEFAULT = 'Daylight, indirect. Turn the ceiling light off — mixed light is what makes a phone photo look cheap.';

/* ── What must not be in frame ────────────────────────────────────────────
   The first three are constant because the risk is constant. See the header:
   this list is the only control this product has over claims made by a
   picture, and claims.js cannot see one. */
const AVOID_ALWAYS = [
  'Anybody recognisable who has not said yes in writing. A client in a marketing photograph is a person with a say in it.',
  'Photographs of Saint Lucia you did not take. Property and tourism-board images belong to whoever made them, and a stock beach captioned as Saint Lucia is a false claim about a real place — the same one an AI-generated Pitons would be.',
  'Anything that reads as medical: treatment tables shot like a clinic, clinical dress, supplements, needles, before-and-after pairs. A picture makes a health claim as loudly as a sentence does, and this is the one place nothing checks it for you.'
];

/* ── The brief ────────────────────────────────────────────────────────────
   Deterministic in the action, so the same plan renders the same brief every
   time and two assets in one week do not ask for the same photograph. */
function imageBrief(action, profile) {
  if (!isVisual(action)) return null;

  const p = profile || {};
  const channel = String(action.channel || '').toLowerCase();
  const needs = [].concat(p.compass_needs || []).filter(Boolean);

  /* Rotate through the advisor's needs across the plan, then through the two
     variants, so week 1 and week 3 do not ask for the same picture. */
  const seq = (Number(action.week) || 1) * 3 + (Number(action.position) || 1);
  const need = needs.length ? needs[seq % needs.length] : null;
  const pool = (need && SHOTS[need]) || GENERIC;

  const avoid = AVOID_ALWAYS.slice();
  if (channel === 'linkedin') {
    avoid.push('Stock photography of people in suits. It is the visual equivalent of "excited to announce".');
  }
  if (channel === 'tiktok' || channel === 'youtube') {
    avoid.push('A still image held for the whole clip. If it does not move, it does not belong on this surface.');
  }

  return {
    shot: pool[seq % pool.length],
    need: need || null,
    frame: FRAMES[channel] || null,
    light: LIGHT[p.traveller_orientation] || LIGHT_DEFAULT,
    avoid,
    /* The busy-week version, in the spirit of the Asset Card's fallback. */
    instead: 'No picture you are happy with? Put one line of the caption on a plain ' +
      'background in your own colours and post that. A text card in your voice beats ' +
      'a stock photograph of somebody else\'s holiday, and it beats not posting.'
  };
}

/* Said once per plan rather than once per asset, because a warning repeated
   nine times is wallpaper and stops being read on the second one. */
const RIGHTS_NOTE =
  'These are shot lists, not pictures. We do not hand out images of Saint Lucia: ' +
  'the photography on this site came from the properties\' own sites and is not ours ' +
  'to give away, and an AI-generated Saint Lucia is a picture of a place that does not ' +
  'exist. Everything below is shootable where you are, on a phone, in an afternoon — ' +
  'and a real picture of the feeling you are selling outperforms a stock sunset anyway. ' +
  'When you want genuine destination imagery, ask the property or the tourism board; ' +
  'they usually say yes to an advisor who is selling them.';

module.exports = { imageBrief, isVisual, RIGHTS_NOTE, SHOTS, FRAMES, AVOID_ALWAYS };
