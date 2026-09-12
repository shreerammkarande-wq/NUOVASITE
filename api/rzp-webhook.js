/* ═══════════════════════════════════════════════════════════════════════
   SHRI JAGDAMBA INDUSTRY — Razorpay webhook (the safety net)
   POST /api/rzp-webhook

   rzp-verify.js handles the normal case: the customer pays, the browser
   comes back, we confirm. This file covers the case it cannot — the
   customer's phone loses signal, the app is swiped away, the battery dies
   at exactly the wrong second. The money is captured but no browser ever
   returns to tell us. Razorpay calls this endpoint instead, and the order
   gets marked paid anyway.

   Anyone on the internet can POST here, so nothing in the request is
   believed. Two independent gates:

     1. The webhook signature — HMAC-SHA256 of the raw body keyed with the
        webhook secret. Checked whenever the raw body is available.

     2. Razorpay's own API — we take only the payment id from the request
        and ask Razorpay what that payment is. A forged request cannot make
        Razorpay report a captured payment, and the API is scoped to our
        account, so no other merchant's payment is even reachable.

   Gate 2 is the one that carries the weight. Gate 1 rejects junk cheaply.

   Set up in Razorpay → Settings → Webhooks:
     URL     https://www.nuovashop.com/api/rzp-webhook
     Events  payment.captured
     Secret  the same string you put in RAZORPAY_WEBHOOK_SECRET
   ═══════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
/* The Firestore helper is loaded INSIDE the handler, not here.

   A require at the top of the file runs while the module is still loading.
   If it fails for any reason — file not uploaded, typo in the name — the
   whole function dies before one line of this code executes, and the host
   can only report a bare "This Serverless Function has crashed" with no
   line and no reason. Deferring it turns that into a sentence you can
   read, and leaves the GET readiness probe working regardless. */
let _fs = null;
function firestore() {
  if (!_fs) _fs = require('./sji-firestore.js');
  return _fs;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* Get the body as raw text if we still can, otherwise fall back to
   whatever the runtime already parsed. Returns { text, json }. */
async function readBody(req) {
  if (typeof req.rawBody === 'string') {
    return { text: req.rawBody, json: safeParse(req.rawBody) };
  }
  if (Buffer.isBuffer(req.rawBody)) {
    const t = req.rawBody.toString('utf8');
    return { text: t, json: safeParse(t) };
  }
  if (req.readable) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const t = Buffer.concat(chunks).toString('utf8');
    return { text: t, json: safeParse(t) };
  }
  if (typeof req.body === 'string') {
    return { text: req.body, json: safeParse(req.body) };
  }
  return { text: null, json: req.body || null };
}

function safeParse(t) {
  try { return JSON.parse(t); } catch (e) { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }

  const keyId         = process.env.RAZORPAY_KEY_ID;
  const keySecret     = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!keyId || !keySecret) {
    return res.status(503).json({ error: 'gateway_not_configured' });
  }

  try {
    const { text, json } = await readBody(req);

    // ── gate 1: the webhook signature, when the raw bytes survived ──────
    if (webhookSecret && text) {
      const sent = req.headers['x-razorpay-signature'];
      const expected = crypto.createHmac('sha256', webhookSecret)
                             .update(text)
                             .digest('hex');
      if (!sent || !safeEqual(expected, sent)) {
        console.warn('Webhook signature rejected');
        return res.status(400).json({ error: 'bad_signature' });
      }
    }

    const entity = json && json.payload && json.payload.payment && json.payload.payment.entity;
    const rzpPay = entity && entity.id;
    if (!rzpPay) {
      // Not a payment event we care about. 200 so Razorpay stops retrying.
      return res.status(200).json({ ok: true, ignored: true });
    }

    // ── gate 2: ask Razorpay what this payment really is ────────────────
    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const payRes = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(rzpPay), {
      headers: { 'Authorization': 'Basic ' + auth }
    });
    const pay = await payRes.json();

    if (!payRes.ok || !pay.id) {
      console.error('Webhook: payment not readable', payRes.status, pay);
      // 500 so Razorpay retries — this may just be a blip on their side.
      return res.status(500).json({ error: 'gateway_unreachable' });
    }

    if (pay.status !== 'captured') {
      return res.status(200).json({ ok: true, ignored: true, status: pay.status });
    }

    const orderNo = pay.notes && pay.notes.orderNo;
    if (!orderNo) {
      console.warn('Captured payment with no orderNo note', pay.id);
      return res.status(200).json({ ok: true, ignored: true });
    }

    const docPath = 'logs/' + String(orderNo);
    const order = await firestore().getDoc(docPath);
    if (!order) {
      console.warn('Webhook: no such order', orderNo);
      return res.status(200).json({ ok: true, ignored: true });
    }
    if (order.paymentVerified === true) {
      return res.status(200).json({ ok: true, alreadyVerified: true });
    }

    const expectedPaise = Math.round(Number(order.totalAmount) * 100);
    if (Number(pay.amount) !== expectedPaise) {
      /* Deliberately NOT marked paid. A short payment is a real thing that
         needs a person to look at it, not a flag flipped automatically. */
      console.warn('Webhook amount mismatch', orderNo, pay.amount, expectedPaise);
      await firestore().updateDoc(docPath, {
        paymentStatus: 'Amount mismatch — check manually',
        rzpPaymentId:  pay.id
      });
      return res.status(200).json({ ok: true, flagged: 'amount_mismatch' });
    }

    const method = pay.method === 'card'
      ? ('Card' + (pay.card && pay.card.network ? ' (' + pay.card.network + ')' : ''))
      : pay.method === 'netbanking' ? ('Netbanking' + (pay.bank ? ' (' + pay.bank + ')' : ''))
      : pay.method === 'wallet'     ? ('Wallet' + (pay.wallet ? ' (' + pay.wallet + ')' : ''))
      : pay.method === 'upi'        ? 'UPI (gateway)'
      : String(pay.method || 'Razorpay');

    await firestore().updateDoc(docPath, {
      paymentMethod:     method,
      paymentStatus:     'Paid',
      paymentUtr:        pay.acquirer_data && (pay.acquirer_data.rrn || pay.acquirer_data.upi_transaction_id)
                           ? String(pay.acquirer_data.rrn || pay.acquirer_data.upi_transaction_id)
                           : pay.id,
      paymentAt:         new Date((pay.created_at || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      paymentVerified:   true,
      paymentVerifiedBy: 'Razorpay (webhook)',
      paymentVerifiedAt: new Date().toISOString(),
      rzpPaymentId:      pay.id,
      rzpFeePaise:       typeof pay.fee === 'number' ? pay.fee : null
    });

    return res.status(200).json({ ok: true, orderNo: orderNo });

  } catch (err) {
    console.error('rzp-webhook failed', err);
    /* 500 makes Razorpay retry rather than drop a real payment — which is
       exactly what we want if the fault is a misconfiguration at our end
       that we are about to fix. The detail names the missing setting and
       never any key material. */
    const msg = String((err && err.message) || '');
    if (/Cannot find module/i.test(msg)) {
      return res.status(500).json({
        error: 'helper_missing',
        detail: 'sji-firestore.js is not in the api folder next to this file'
      });
    }
    if (/FIREBASE_SERVICE_ACCOUNT|service account|Firestore (read|write)/i.test(msg)) {
      return res.status(500).json({ error: 'firebase_not_configured', detail: msg });
    }
    return res.status(500).json({ error: 'server_error' });
  }
};

/* Ask the host not to consume the request body, so the signature can be
   checked against the exact bytes Razorpay signed. Re-serialising parsed
   JSON does not work — key order and spacing would differ and the
   signature would never match.

   This MUST come after the assignment above. Setting it first would work
   for about one second and then be silently wiped, because assigning to
   module.exports replaces the whole object, property and all. The code
   would look correct and the config would simply not exist. */
module.exports.config = { api: { bodyParser: false } };
