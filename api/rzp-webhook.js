{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww25060\viewh14940\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /* \uc0\u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \
   SHRI JAGDAMBA INDUSTRY \'97 Razorpay webhook (the safety net)\
   POST /api/rzp-webhook\
\
   rzp-verify.js handles the normal case: the customer pays, the browser\
   comes back, we confirm. This file covers the case it cannot \'97 the\
   customer's phone loses signal, the app is swiped away, the battery dies\
   at exactly the wrong second. The money is captured but no browser ever\
   returns to tell us. Razorpay calls this endpoint instead, and the order\
   gets marked paid anyway.\
\
   Anyone on the internet can POST here, so nothing in the request is\
   believed. Two independent gates:\
\
     1. The webhook signature \'97 HMAC-SHA256 of the raw body keyed with the\
        webhook secret. Checked whenever the raw body is available.\
\
     2. Razorpay's own API \'97 we take only the payment id from the request\
        and ask Razorpay what that payment is. A forged request cannot make\
        Razorpay report a captured payment, and the API is scoped to our\
        account, so no other merchant's payment is even reachable.\
\
   Gate 2 is the one that carries the weight. Gate 1 rejects junk cheaply.\
\
   Set up in Razorpay \uc0\u8594  Settings \u8594  Webhooks:\
     URL     https://www.nuovashop.com/api/rzp-webhook\
     Events  payment.captured\
     Secret  the same string you put in RAZORPAY_WEBHOOK_SECRET\
   \uc0\u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552  */\
\
const crypto = require('crypto');\
const admin  = require('firebase-admin');\
\
/* Ask Vercel not to eat the body, so the signature can be checked against\
   the exact bytes Razorpay signed. Re-serialising parsed JSON does not\
   work \'97 key order and spacing would differ and the signature would fail. */\
module.exports.config = \{ api: \{ bodyParser: false \} \};\
\
function db() \{\
  if (!admin.apps.length) \{\
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;\
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');\
    const sa = JSON.parse(raw);\
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\\\n/g, '\\n');\
    admin.initializeApp(\{ credential: admin.credential.cert(sa) \});\
  \}\
  return admin.firestore();\
\}\
\
function safeEqual(a, b) \{\
  const ba = Buffer.from(String(a), 'utf8');\
  const bb = Buffer.from(String(b), 'utf8');\
  if (ba.length !== bb.length) return false;\
  return crypto.timingSafeEqual(ba, bb);\
\}\
\
/* Get the body as raw text if we still can, otherwise fall back to\
   whatever the runtime already parsed. Returns \{ text, json \}. */\
async function readBody(req) \{\
  if (typeof req.rawBody === 'string') \{\
    return \{ text: req.rawBody, json: safeParse(req.rawBody) \};\
  \}\
  if (Buffer.isBuffer(req.rawBody)) \{\
    const t = req.rawBody.toString('utf8');\
    return \{ text: t, json: safeParse(t) \};\
  \}\
  if (req.readable) \{\
    const chunks = [];\
    for await (const c of req) chunks.push(c);\
    const t = Buffer.concat(chunks).toString('utf8');\
    return \{ text: t, json: safeParse(t) \};\
  \}\
  if (typeof req.body === 'string') \{\
    return \{ text: req.body, json: safeParse(req.body) \};\
  \}\
  return \{ text: null, json: req.body || null \};\
\}\
\
function safeParse(t) \{\
  try \{ return JSON.parse(t); \} catch (e) \{ return null; \}\
\}\
\
module.exports = async (req, res) => \{\
  if (req.method !== 'POST') \{\
    res.setHeader('Allow', 'POST');\
    return res.status(405).json(\{ error: 'Use POST' \});\
  \}\
\
  const keyId         = process.env.RAZORPAY_KEY_ID;\
  const keySecret     = process.env.RAZORPAY_KEY_SECRET;\
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;\
\
  if (!keyId || !keySecret) \{\
    return res.status(503).json(\{ error: 'gateway_not_configured' \});\
  \}\
\
  try \{\
    const \{ text, json \} = await readBody(req);\
\
    // \uc0\u9472 \u9472  gate 1: the webhook signature, when the raw bytes survived \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
    if (webhookSecret && text) \{\
      const sent = req.headers['x-razorpay-signature'];\
      const expected = crypto.createHmac('sha256', webhookSecret)\
                             .update(text)\
                             .digest('hex');\
      if (!sent || !safeEqual(expected, sent)) \{\
        console.warn('Webhook signature rejected');\
        return res.status(400).json(\{ error: 'bad_signature' \});\
      \}\
    \}\
\
    const entity = json && json.payload && json.payload.payment && json.payload.payment.entity;\
    const rzpPay = entity && entity.id;\
    if (!rzpPay) \{\
      // Not a payment event we care about. 200 so Razorpay stops retrying.\
      return res.status(200).json(\{ ok: true, ignored: true \});\
    \}\
\
    // \uc0\u9472 \u9472  gate 2: ask Razorpay what this payment really is \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');\
    const payRes = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(rzpPay), \{\
      headers: \{ 'Authorization': 'Basic ' + auth \}\
    \});\
    const pay = await payRes.json();\
\
    if (!payRes.ok || !pay.id) \{\
      console.error('Webhook: payment not readable', payRes.status, pay);\
      // 500 so Razorpay retries \'97 this may just be a blip on their side.\
      return res.status(500).json(\{ error: 'gateway_unreachable' \});\
    \}\
\
    if (pay.status !== 'captured') \{\
      return res.status(200).json(\{ ok: true, ignored: true, status: pay.status \});\
    \}\
\
    const orderNo = pay.notes && pay.notes.orderNo;\
    if (!orderNo) \{\
      console.warn('Captured payment with no orderNo note', pay.id);\
      return res.status(200).json(\{ ok: true, ignored: true \});\
    \}\
\
    const snap = await db().collection('logs').doc(String(orderNo)).get();\
    if (!snap.exists) \{\
      console.warn('Webhook: no such order', orderNo);\
      return res.status(200).json(\{ ok: true, ignored: true \});\
    \}\
\
    const order = snap.data();\
    if (order.paymentVerified === true) \{\
      return res.status(200).json(\{ ok: true, alreadyVerified: true \});\
    \}\
\
    const expectedPaise = Math.round(Number(order.totalAmount) * 100);\
    if (Number(pay.amount) !== expectedPaise) \{\
      /* Deliberately NOT marked paid. A short payment is a real thing that\
         needs a person to look at it, not a flag flipped automatically. */\
      console.warn('Webhook amount mismatch', orderNo, pay.amount, expectedPaise);\
      await snap.ref.update(\{\
        paymentStatus: 'Amount mismatch \'97 check manually',\
        rzpPaymentId:  pay.id\
      \});\
      return res.status(200).json(\{ ok: true, flagged: 'amount_mismatch' \});\
    \}\
\
    const method = pay.method === 'card'\
      ? ('Card' + (pay.card && pay.card.network ? ' (' + pay.card.network + ')' : ''))\
      : pay.method === 'netbanking' ? ('Netbanking' + (pay.bank ? ' (' + pay.bank + ')' : ''))\
      : pay.method === 'wallet'     ? ('Wallet' + (pay.wallet ? ' (' + pay.wallet + ')' : ''))\
      : pay.method === 'upi'        ? 'UPI (gateway)'\
      : String(pay.method || 'Razorpay');\
\
    await snap.ref.update(\{\
      paymentMethod:     method,\
      paymentStatus:     'Paid',\
      paymentUtr:        pay.acquirer_data && (pay.acquirer_data.rrn || pay.acquirer_data.upi_transaction_id)\
                           ? String(pay.acquirer_data.rrn || pay.acquirer_data.upi_transaction_id)\
                           : pay.id,\
      paymentAt:         new Date((pay.created_at || Math.floor(Date.now() / 1000)) * 1000).toISOString(),\
      paymentVerified:   true,\
      paymentVerifiedBy: 'Razorpay (webhook)',\
      paymentVerifiedAt: new Date().toISOString(),\
      rzpPaymentId:      pay.id,\
      rzpFeePaise:       typeof pay.fee === 'number' ? pay.fee : null\
    \});\
\
    return res.status(200).json(\{ ok: true, orderNo: orderNo \});\
\
  \} catch (err) \{\
    console.error('rzp-webhook failed', err);\
    // 500 makes Razorpay retry rather than drop a real payment.\
    return res.status(500).json(\{ error: 'server_error' \});\
  \}\
\};}