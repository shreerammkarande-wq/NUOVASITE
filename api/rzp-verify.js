/* ═══════════════════════════════════════════════════════════════════════
   SHRI JAGDAMBA INDUSTRY — confirm a card / netbanking / wallet payment
   POST /api/rzp-verify
   body: { orderNo, razorpay_order_id, razorpay_payment_id, razorpay_signature }

   Called by the Nuova app the moment Razorpay Checkout reports success.
   It is the browser telling us it paid, so it is checked twice:

     1. The signature. HMAC-SHA256 of "<rzp_order_id>|<rzp_payment_id>"
        keyed with our secret must equal the signature Razorpay handed the
        browser. Only Razorpay and we know that secret, so a forged callback
        cannot produce a matching signature.

     2. Razorpay itself. We then ask Razorpay's own API what that payment
        actually is, and require status 'captured', the right order id and
        the exact amount from Firestore. This is the check that really
        matters: even if step 1 were somehow wrong, nobody can make
        Razorpay's servers report a captured payment that never happened.

   Only after BOTH pass do we write paymentVerified — which is the same
   flag Smita sets by hand for UPI. A gateway payment simply verifies
   itself, which is the whole reason for adding cards.
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


/* Constant-time compare. A plain === leaks, through how long it takes to
   fail, roughly how much of the signature was right — which is enough to
   guess one byte at a time given sufficient attempts. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function checkSignature(rzpOrderId, rzpPaymentId, signature, secret) {
  const expected = crypto.createHmac('sha256', secret)
                         .update(rzpOrderId + '|' + rzpPaymentId)
                         .digest('hex');
  return safeEqual(expected, signature);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }

  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(503).json({ error: 'gateway_not_configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const orderNo   = String(body.orderNo || '').trim();
    const rzpOrder  = String(body.razorpay_order_id || '').trim();
    const rzpPay    = String(body.razorpay_payment_id || '').trim();
    const signature = String(body.razorpay_signature || '').trim();

    if (!orderNo || !rzpOrder || !rzpPay || !signature) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // ── check 1: the signature ──────────────────────────────────────────
    if (!checkSignature(rzpOrder, rzpPay, signature, keySecret)) {
      console.warn('Signature mismatch for', orderNo, rzpPay);
      return res.status(400).json({ error: 'bad_signature' });
    }

    const order = await firestore().getDoc('logs/' + orderNo);
    if (!order) return res.status(404).json({ error: 'order_not_found' });

    if (order.paymentVerified === true) {
      return res.status(200).json({ ok: true, alreadyVerified: true });
    }

    // The Razorpay order we created for this record, and no other.
    if (order.rzpOrderId && order.rzpOrderId !== rzpOrder) {
      console.warn('Order id mismatch', orderNo, order.rzpOrderId, rzpOrder);
      return res.status(400).json({ error: 'order_mismatch' });
    }

    // ── check 2: ask Razorpay what actually happened ────────────────────
    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const payRes = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(rzpPay), {
      headers: { 'Authorization': 'Basic ' + auth }
    });
    const pay = await payRes.json();

    if (!payRes.ok || !pay.id) {
      console.error('Could not read payment from Razorpay', payRes.status, pay);
      return res.status(502).json({ error: 'gateway_unreachable' });
    }

    const expectedPaise = Math.round(Number(order.totalAmount) * 100);

    if (pay.status !== 'captured') {
      return res.status(409).json({ error: 'not_captured', status: pay.status });
    }
    if (pay.order_id !== rzpOrder) {
      return res.status(400).json({ error: 'order_mismatch' });
    }
    if (Number(pay.amount) !== expectedPaise) {
      console.warn('Amount mismatch', orderNo, pay.amount, expectedPaise);
      return res.status(400).json({ error: 'amount_mismatch' });
    }

    // ── both checks passed: this money is real ──────────────────────────
    const method = pay.method === 'card'
      ? ('Card' + (pay.card && pay.card.network ? ' (' + pay.card.network + ')' : ''))
      : pay.method === 'netbanking' ? ('Netbanking' + (pay.bank ? ' (' + pay.bank + ')' : ''))
      : pay.method === 'wallet'     ? ('Wallet' + (pay.wallet ? ' (' + pay.wallet + ')' : ''))
      : pay.method === 'upi'        ? 'UPI (gateway)'
      : String(pay.method || 'Razorpay');

    await firestore().updateDoc('logs/' + orderNo, {
      paymentMethod:     method,
      paymentStatus:     'Paid',
      paymentUtr:        pay.acquirer_data && (pay.acquirer_data.rrn || pay.acquirer_data.upi_transaction_id)
                           ? String(pay.acquirer_data.rrn || pay.acquirer_data.upi_transaction_id)
                           : rzpPay,
      paymentAt:         new Date((pay.created_at || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      paymentVerified:   true,
      paymentVerifiedBy: 'Razorpay (automatic)',
      paymentVerifiedAt: new Date().toISOString(),
      rzpPaymentId:      pay.id,
      rzpFeePaise:       typeof pay.fee === 'number' ? pay.fee : null
    });

    return res.status(200).json({ ok: true, method: method });

  } catch (err) {
    console.error('rzp-verify failed', err);
    const msg = String((err && err.message) || '');
    /* A setup mistake should say so rather than hiding behind a bare 500.
       These messages name the missing setting, never any key material. */
    if (/Cannot find module/i.test(msg)) {
      return res.status(500).json({
        error: 'helper_missing',
        detail: 'sji-firestore.js is not in the api folder next to this file'
      });
    }
    if (/FIREBASE_SERVICE_ACCOUNT|service account|Firestore (read|write)/i.test(msg)) {
      return res.status(503).json({ error: 'firebase_not_configured', detail: msg });
    }
    return res.status(500).json({ error: 'server_error' });
  }
};
