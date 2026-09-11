{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww25060\viewh14940\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /* \uc0\u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \
   SHRI JAGDAMBA INDUSTRY \'97 confirm a card / netbanking / wallet payment\
   POST /api/rzp-verify\
   body: \{ orderNo, razorpay_order_id, razorpay_payment_id, razorpay_signature \}\
\
   Called by the Nuova app the moment Razorpay Checkout reports success.\
   It is the browser telling us it paid, so it is checked twice:\
\
     1. The signature. HMAC-SHA256 of "<rzp_order_id>|<rzp_payment_id>"\
        keyed with our secret must equal the signature Razorpay handed the\
        browser. Only Razorpay and we know that secret, so a forged callback\
        cannot produce a matching signature.\
\
     2. Razorpay itself. We then ask Razorpay's own API what that payment\
        actually is, and require status 'captured', the right order id and\
        the exact amount from Firestore. This is the check that really\
        matters: even if step 1 were somehow wrong, nobody can make\
        Razorpay's servers report a captured payment that never happened.\
\
   Only after BOTH pass do we write paymentVerified \'97 which is the same\
   flag Smita sets by hand for UPI. A gateway payment simply verifies\
   itself, which is the whole reason for adding cards.\
   \uc0\u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552  */\
\
const crypto = require('crypto');\
const admin  = require('firebase-admin');\
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
/* Constant-time compare. A plain === leaks, through how long it takes to\
   fail, roughly how much of the signature was right \'97 which is enough to\
   guess one byte at a time given sufficient attempts. */\
function safeEqual(a, b) \{\
  const ba = Buffer.from(String(a), 'utf8');\
  const bb = Buffer.from(String(b), 'utf8');\
  if (ba.length !== bb.length) return false;\
  return crypto.timingSafeEqual(ba, bb);\
\}\
\
function checkSignature(rzpOrderId, rzpPaymentId, signature, secret) \{\
  const expected = crypto.createHmac('sha256', secret)\
                         .update(rzpOrderId + '|' + rzpPaymentId)\
                         .digest('hex');\
  return safeEqual(expected, signature);\
\}\
\
module.exports = async (req, res) => \{\
  if (req.method !== 'POST') \{\
    res.setHeader('Allow', 'POST');\
    return res.status(405).json(\{ error: 'Use POST' \});\
  \}\
\
  const keyId     = process.env.RAZORPAY_KEY_ID;\
  const keySecret = process.env.RAZORPAY_KEY_SECRET;\
  if (!keyId || !keySecret) \{\
    return res.status(503).json(\{ error: 'gateway_not_configured' \});\
  \}\
\
  try \{\
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || \{\});\
    const orderNo   = String(body.orderNo || '').trim();\
    const rzpOrder  = String(body.razorpay_order_id || '').trim();\
    const rzpPay    = String(body.razorpay_payment_id || '').trim();\
    const signature = String(body.razorpay_signature || '').trim();\
\
    if (!orderNo || !rzpOrder || !rzpPay || !signature) \{\
      return res.status(400).json(\{ error: 'missing_fields' \});\
    \}\
\
    // \uc0\u9472 \u9472  check 1: the signature \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
    if (!checkSignature(rzpOrder, rzpPay, signature, keySecret)) \{\
      console.warn('Signature mismatch for', orderNo, rzpPay);\
      return res.status(400).json(\{ error: 'bad_signature' \});\
    \}\
\
    const snap = await db().collection('logs').doc(orderNo).get();\
    if (!snap.exists) return res.status(404).json(\{ error: 'order_not_found' \});\
    const order = snap.data();\
\
    if (order.paymentVerified === true) \{\
      return res.status(200).json(\{ ok: true, alreadyVerified: true \});\
    \}\
\
    // The Razorpay order we created for this record, and no other.\
    if (order.rzpOrderId && order.rzpOrderId !== rzpOrder) \{\
      console.warn('Order id mismatch', orderNo, order.rzpOrderId, rzpOrder);\
      return res.status(400).json(\{ error: 'order_mismatch' \});\
    \}\
\
    // \uc0\u9472 \u9472  check 2: ask Razorpay what actually happened \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');\
    const payRes = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(rzpPay), \{\
      headers: \{ 'Authorization': 'Basic ' + auth \}\
    \});\
    const pay = await payRes.json();\
\
    if (!payRes.ok || !pay.id) \{\
      console.error('Could not read payment from Razorpay', payRes.status, pay);\
      return res.status(502).json(\{ error: 'gateway_unreachable' \});\
    \}\
\
    const expectedPaise = Math.round(Number(order.totalAmount) * 100);\
\
    if (pay.status !== 'captured') \{\
      return res.status(409).json(\{ error: 'not_captured', status: pay.status \});\
    \}\
    if (pay.order_id !== rzpOrder) \{\
      return res.status(400).json(\{ error: 'order_mismatch' \});\
    \}\
    if (Number(pay.amount) !== expectedPaise) \{\
      console.warn('Amount mismatch', orderNo, pay.amount, expectedPaise);\
      return res.status(400).json(\{ error: 'amount_mismatch' \});\
    \}\
\
    // \uc0\u9472 \u9472  both checks passed: this money is real \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
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
                           : rzpPay,\
      paymentAt:         new Date((pay.created_at || Math.floor(Date.now() / 1000)) * 1000).toISOString(),\
      paymentVerified:   true,\
      paymentVerifiedBy: 'Razorpay (automatic)',\
      paymentVerifiedAt: new Date().toISOString(),\
      rzpPaymentId:      pay.id,\
      rzpFeePaise:       typeof pay.fee === 'number' ? pay.fee : null\
    \});\
\
    return res.status(200).json(\{ ok: true, method: method \});\
\
  \} catch (err) \{\
    console.error('rzp-verify failed', err);\
    return res.status(500).json(\{ error: 'server_error' \});\
  \}\
\};}