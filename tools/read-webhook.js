/* ============================================================================
   read-webhook.js — what ThriveCart actually sent us
   ----------------------------------------------------------------------------
     node tools/read-webhook.js

   api/hook.js stores the whole raw body of every webhook that arrives,
   including the ones it refuses to act on. That was written so a payment is
   never lost; it is also how you find out what to put in
   THRIVECART_BUILDPACK_ID without guessing which field ThriveCart calls the
   product.

   THE ORDER THAT WORKS:
     1. Set THRIVECART_SECRET only, and leave THRIVECART_BUILDPACK_ID unset.
     2. Point ThriveCart's webhook at /api/hook and make a test purchase.
     3. The hook refuses to grant anything — it cannot identify the product —
        but it RECORDS the event with the full payload.
     4. Run this. It prints the payload and the fields that look like a
        product id.
     5. Put the right one in THRIVECART_BUILDPACK_ID and redeploy.

   Failing closed is what makes this safe: an unidentified product grants
   nothing, so a wrong guess costs a note in the ledger rather than free builds.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
  const t = l.trim(); if (!t || t.startsWith('#')) return;
  const i = t.indexOf('='); if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});

const { createClient } = require(path.join(ROOT, 'node_modules/@supabase/supabase-js'));
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

/* The names api/hook.js already looks under, in the order it tries them. */
const PRODUCT_KEYS = ['product_id', 'base_product', 'product', 'item_id'];
const EMAIL_KEYS = ['customer[email]', 'customer_email', 'email', 'buyer_email'];
const EVENT_KEYS = ['event_id', 'order_id', 'invoice_id', 'id', 'transaction_id'];

function flatten(obj, prefix, out) {
  out = out || {};
  Object.keys(obj || {}).forEach((k) => {
    const key = prefix ? prefix + '[' + k + ']' : k;
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  });
  return out;
}

(async () => {
  const { data, error } = await db
    .from('purchase_events')
    .select('provider, event_id, kind, email, builds_delta, note, raw, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    if (['42P01', 'PGRST205'].indexOf(String(error.code)) !== -1) {
      console.error('\n  purchase_events does not exist — migration 017 has not been applied.\n');
    } else console.error('\n  ' + error.message + '\n');
    process.exit(1);
  }

  if (!data || !data.length) {
    console.log('\n  Nothing has arrived at /api/hook yet.\n');
    console.log('  If you have already made a test purchase, the likeliest causes are:');
    console.log('    · THRIVECART_SECRET is unset on Vercel — the hook returns 503 and records nothing');
    console.log('    · the secret does not match — 401, and nothing is recorded');
    console.log('    · the webhook URL is wrong. It should be exactly:');
    console.log('        https://www.discoversaintluciawell.com/api/hook\n');
    return;
  }

  console.log('\n  ' + data.length + ' most recent webhook(s), newest first\n');

  data.forEach((r, i) => {
    console.log('  ' + '─'.repeat(66));
    console.log('  ' + (i + 1) + '. ' + r.created_at);
    console.log('     kind      ' + r.kind);
    console.log('     event id  ' + r.event_id);
    console.log('     email     ' + (r.email || '—'));
    console.log('     granted   ' + r.builds_delta + ' build(s)');
    if (r.note) console.log('     note      ' + r.note);

    const flat = flatten(r.raw || {});
    const keys = Object.keys(flat);

    if (!keys.length) { console.log('\n     (no raw body stored)\n'); return; }

    const show = (label, names) => {
      const hits = names.filter((n) => flat[n] !== undefined && flat[n] !== '');
      console.log('\n     ' + label);
      if (!hits.length) { console.log('       none of ' + names.join(', ') + ' were present'); return; }
      hits.forEach((n) => console.log('       ' + n.padEnd(22) + ' = ' + JSON.stringify(flat[n])));
    };

    show('PRODUCT — put the right one in THRIVECART_BUILDPACK_ID', PRODUCT_KEYS);
    show('EVENT ID — what makes a replay safe', EVENT_KEYS);
    show('EMAIL — matched against advisors.email', EMAIL_KEYS);

    /* Anything else that smells like a product, in case ThriveCart uses a name
       api/hook.js does not look under yet. If the right value shows up here
       rather than above, the pick list in api/hook.js needs that name adding. */
    const extra = keys.filter((k) => /product|item|plan|sku/i.test(k) && PRODUCT_KEYS.indexOf(k) === -1);
    if (extra.length) {
      console.log('\n     OTHER PRODUCT-LIKE FIELDS (api/hook.js does not read these yet)');
      extra.forEach((k) => console.log('       ' + k.padEnd(22) + ' = ' + JSON.stringify(flat[k])));
    }

    console.log('\n     every field that arrived (' + keys.length + '):');
    console.log('       ' + keys.join(', '));
    console.log('');
  });

  console.log('  ' + '─'.repeat(66));
  console.log('  Full payload of the newest:\n');
  console.log(JSON.stringify(data[0].raw, null, 2).split('\n').map((l) => '    ' + l).join('\n'));
  console.log('');
})();
