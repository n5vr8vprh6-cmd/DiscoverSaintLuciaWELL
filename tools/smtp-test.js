/* ============================================================================
   smtp-test.js — talk to Resend's SMTP server the way Supabase does
   ----------------------------------------------------------------------------
   Supabase reports only "Error sending confirmation email", which is true and
   useless: it covers a wrong port, a wrong username, a rejected credential and
   a TLS failure equally. Rather than keep changing settings and re-testing, this
   performs the same SMTP conversation Supabase performs and prints the server's
   own reply at every step.

   Never prints the API key. The AUTH exchange is base64 by protocol, and the
   encoded value is masked in the transcript.

   Run:  node tools/smtp-test.js [port]     default 587
   ========================================================================== */
'use strict';

const fs = require('fs');
const net = require('net');
const tls = require('tls');
const path = require('path');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
  const t = l.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});

const HOST = 'smtp.resend.com';
const PORT = Number(process.argv[2] || 587);
const USER = 'resend';
const PASS = env.RESEND_API_KEY;

if (!PASS) { console.error('  RESEND_API_KEY missing from .env'); process.exit(1); }

/* Anything that looks like the key, or its base64, is replaced before printing. */
const b64pass = Buffer.from(PASS).toString('base64');
const scrub = (s) => String(s).split(PASS).join('«key»').split(b64pass).join('«key-b64»');

/* `speakFirst` matters: on a fresh connection the server greets you and you
   reply, but immediately after a STARTTLS upgrade there is NO greeting — the
   server is waiting for EHLO. Waiting for data that never arrives is what made
   the first version of this look like a network timeout. */
function converse(socket, steps, speakFirst) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let i = 0;
    const transcript = [];

    socket.setEncoding('utf8');
    socket.on('error', reject);

    if (speakFirst) {
      const first = steps[i++];
      transcript.push({ dir: 'C', text: scrub(first) });
      socket.write(first + '\r\n');
    }

    socket.on('data', (chunk) => {
      buffer += chunk;
      /* An SMTP reply ends with "NNN " (space, not hyphen) on its last line. */
      if (!/^\d{3} [^\n]*\r?\n$/m.test(buffer.split(/\r?\n/).filter(Boolean).pop() + '\n')) return;

      const reply = buffer.trim();
      buffer = '';
      transcript.push({ dir: 'S', text: reply });
      const code = Number(reply.slice(0, 3));

      if (i >= steps.length || code >= 400) return resolve({ transcript, code, reply });

      const step = steps[i++];
      if (step === '__STARTTLS_UPGRADE__') return resolve({ transcript, upgrade: true });
      transcript.push({ dir: 'C', text: scrub(step) });
      socket.write(step + '\r\n');
    });
  });
}

(async () => {
  console.log(`\n  ${HOST}:${PORT}  user="${USER}"  password=«Resend API key»\n`);

  const socket = net.connect(PORT, HOST);
  socket.setTimeout(15000, () => { console.error('  timed out connecting'); process.exit(1); });

  let r = await converse(socket, ['EHLO discoversaintluciawell.com', 'STARTTLS', '__STARTTLS_UPGRADE__']);
  r.transcript.forEach((l) => console.log(`  ${l.dir}: ${l.text.split('\n')[0]}${l.text.includes('\n') ? ' …' : ''}`));

  if (!r.upgrade) {
    console.log(`\n  Stopped before TLS. Server said ${r.code}.`);
    console.log('  A 5xx here usually means the port is wrong for this server.\n');
    process.exit(1);
  }

  const secure = tls.connect({ socket, servername: HOST });
  await new Promise((res, rej) => { secure.once('secureConnect', res); secure.once('error', rej); });
  console.log('  --- TLS established ---');

  socket.setTimeout(0);                 /* the TLS socket owns the conversation now */
  secure.setTimeout(15000, () => {
    console.error('  timed out waiting for the AUTH reply');
    process.exit(1);
  });
  r = await converse(secure, [
    'EHLO discoversaintluciawell.com',
    'AUTH LOGIN',
    Buffer.from(USER).toString('base64'),
    b64pass
  ], true);
  r.transcript.forEach((l) => console.log(`  ${l.dir}: ${l.text.split('\n')[0]}${l.text.includes('\n') ? ' …' : ''}`));

  console.log('');
  if (r.code === 235) {
    console.log('  AUTHENTICATED. Host, port, username and password are all correct.\n');

    /* The remaining candidate: Resend refuses a MAIL FROM on a domain it does
       not hold. Supabase's default sender is on a supabase.io address, and if
       the SMTP settings were saved without changing it, every send is rejected
       here — which surfaces as exactly the generic error Supabase reports.
       MAIL FROM / RCPT TO is enough to find out; no DATA, so nothing is sent. */
    const senders = [
      (env.NOTIFY_FROM.match(/<([^>]+)>/) || [null, env.NOTIFY_FROM])[1],
      'noreply@mail.app.supabase.io'
    ];
    for (const from of senders) {
      const probe = await converse(secure, [
        `MAIL FROM:<${from}>`,
        'RCPT TO:<duncan.so@phinklife.org>',
        'RSET'
      ], true);
      const ok = probe.code < 400;
      console.log(`  sender ${from.padEnd(36)} ${ok ? 'ACCEPTED' : 'REJECTED — ' + probe.reply.split('\n')[0]}`);
    }
    console.log('\n  Whichever sender is REJECTED above must not be the one in');
    console.log('  Supabase -> Authentication -> SMTP Settings -> Sender email.\n');
  } else {
    console.log(`  AUTH failed with ${r.code}.`);
    console.log('  535 = username or password rejected. Username must be the literal word');
    console.log('  "resend", and the password the Resend API key with sending access.\n');
  }
  try { secure.end('QUIT\r\n'); } catch (e) {}
  process.exit(r.code === 235 ? 0 : 1);
})().catch((e) => { console.error('  ' + e.message); process.exit(1); });
