/* ============================================================================
   /accessibility — ACCESSIBILITY STATEMENT
   ----------------------------------------------------------------------------
   Specific, because a generic statement is worthless. Everything claimed here
   is something actually implemented and verifiable in the repo:

     · progressive enhancement — every page is complete with JavaScript off;
       the Journey Finder ships as a full six-village explainer (README,
       "Progressive enhancement")
     · prefers-reduced-motion — the motion ladder's third rung creates no
       observers at all; the Finder skips its shaping sequence entirely
     · contrast measured from RENDERED PIXELS, not computed CSS — the hero
       scrim holds >=5.03:1 under the headline across every frame of the
       cinemagraph, not just the poster
     · the Finder's options are real radio inputs, so they work with a keyboard
       and a screen reader; focus moves deliberately between questions
     · the WELL Compass keeps a text legend in the accessibility tree for
       screen-reader users even where it is visually hidden

   AND THE LIMITATIONS ARE REAL ONES. No formal audit has been done. Saying so
   is the difference between a statement and a claim.
   ========================================================================== */
'use strict';

module.exports = {
  key: 'accessibility',
  path: '/accessibility',
  layout: 'destination',
  surface: 'consumer',
  title: 'Accessibility — Discover Saint Lucia WELL',
  description: 'How Discover Saint Lucia WELL is built to be usable: keyboard access, reduced motion, contrast, and what still needs work.',
  ogTitle: 'Accessibility',

  sections: [
    {
      type: 'pageHeader',
      eyebrow: 'Discover Saint Lucia WELL',
      headline: 'Accessibility.',
      lead: 'What this site does to stay usable, what it has not solved yet, and how to tell us when it fails you.'
    },

    {
      type: 'prose',
      id: 'accessibility',
      updated: '12 August 2026',
      blocks: [
        {
          title: 'Our position',
          body: [
            'This site should be usable if you navigate by keyboard, use a screen reader, need larger text, or find movement on screen uncomfortable. We build for that from the start rather than retrofitting it.',
            'We aim at the WCAG 2.2 AA standard. We have <strong>not</strong> had an independent audit, so we describe this as our target rather than a certified result.'
          ]
        },

        {
          title: 'It works without JavaScript',
          body: [
            'Every page is complete before any script runs. If JavaScript is blocked, fails or simply has not loaded yet, you get the whole page — including the Journey Finder, which becomes a full written guide to the six wellness villages with working links to everything it would otherwise have recommended.',
            'Nothing on this site is hidden behind an animation that has to succeed before you can read the content.'
          ]
        },

        {
          title: 'If movement is a problem',
          body: [
            'Turn on “reduce motion” in your operating system and this site listens to it. Parallax, scroll effects and reveal animations do not run — not merely shortened, but not created at all. The Journey Finder skips its transition and goes straight to your result. Video loops stand down to still photographs.',
            'Video on this site is always silent, always decorative, and never plays with sound.'
          ]
        },

        {
          title: 'Keyboard and screen reader',
          rows: [
            { term: 'Skip link', def: 'The first thing you reach on any page jumps you past the header to the content.' },
            { term: 'Focus is visible', def: 'Whatever you are on has a visible ring. We have not removed focus outlines anywhere.' },
            { term: 'The Journey Finder', def: 'The answers are real radio buttons — arrow keys move between them, space selects. When a new question appears, focus moves to it so you are not stranded on a question that has gone.' },
            { term: 'The WELL Compass', def: 'The circular diagram carries a written description of all eight directions in the accessibility tree, so it reads as a list rather than as an image you cannot interrogate.' },
            { term: 'Images', def: 'Photographs that carry meaning have descriptions. Purely decorative ones are marked as decorative so they are skipped rather than announced.' }
          ]
        },

        {
          title: 'Contrast and text',
          body: [
            'Text contrast is checked against the pixels that actually appear on screen, not against the colour values in the stylesheet — including text over photographs and over moving video, where the brightness underneath changes as the loop plays.',
            'Text is set in relative units and responds to your browser’s text-size setting. Nothing prevents zooming.'
          ]
        },

        {
          title: 'Where we fall short',
          body: [
            'We would rather list these than let you discover them:'
          ],
          list: [
            'No independent accessibility audit has been carried out. Everything here is our own testing.',
            'The printed brochure and slide versions of this material are not accessible documents. If you need the content in another format, ask us and we will send it as accessible text.',
            'Some pages embed booking and registration tools operated by other companies. We do not control their accessibility.',
            'The photography is central to how this site explains the island. We describe it in words where it carries meaning, but a text-only reading of this site is a thinner experience than we would like.'
          ]
        },

        {
          title: 'Tell us when it fails',
          body: [
            'If something on this site blocks you, we want to know — it is a defect, and we will treat it as one.',
            'Write to <a href="mailto:concierge@discoversaintluciawell.com">concierge@discoversaintluciawell.com</a>, and tell us the page and what happened. If you need something on this site in a different format, ask and we will get it to you.'
          ]
        }
      ]
    }
  ]
};
