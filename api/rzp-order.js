{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww25060\viewh14940\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /* \uc0\u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \
   SHRI JAGDAMBA INDUSTRY \'97 create a Razorpay order\
   POST /api/rzp-order   body: \{ "orderNo": "NV-2601" \}\
\
   The one rule this file exists to enforce:\
\
     THE AMOUNT COMES FROM FIRESTORE, NEVER FROM THE BROWSER.\
\
   If we trusted the browser's number, anyone could open the console and\
   pay \uc0\u8377 1 for a \u8377 570 basket, and the payment would be perfectly genuine \'97\
   signature valid, money captured, nothing to detect. So the request body\
   carries only the order number. The price is looked up server-side from\
   the order the customer already placed.\
\
   Returns \{ keyId, orderId, amount, currency, name, prefill \} \'97 note that\
   keyId is returned rather than baked into the app, so the published HTML\
   carries nothing account-specific and a key rotation needs no redeploy.\
\
   Environment variables (Vercel \uc0\u8594  Settings \u8594  Environment Variables):\
     RAZORPAY_KEY_ID            rzp_live_xxxxxxxxxxxx\
     RAZORPAY_KEY_SECRET        the secret \'97 never in the repo, never in chat\
     FIREBASE_SERVICE_ACCOUNT   the whole service-account JSON, one line\
   \uc0\u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552  */\
\
/* No npm packages at all \'97 see sji-firestore.js for why that matters. */\
const fs = require('./sji-firestore.js');\
\
module.exports = async (req, res) => \{\
  const keyId     = process.env.RAZORPAY_KEY_ID;\
  const keySecret = process.env.RAZORPAY_KEY_SECRET;\
\
  /* A GET is the app asking "are cards switched on?" before it decides\
     whether to show the button. It creates nothing and reveals nothing \'97\
     just yes or no \'97 so the shop can ship before the keys exist and start\
     offering cards the moment they do, with no redeploy. */\
  if (req.method === 'GET') \{\
    res.setHeader('Cache-Control', 'public, max-age=300');\
    return res.status(200).json(\{ configured: !!(keyId && keySecret) \});\
  \}\
\
  if (req.method !== 'POST') \{\
    res.setHeader('Allow', 'GET, POST');\
    return res.status(405).json(\{ error: 'Use POST' \});\
  \}\
\
  /* Not configured yet is a normal state, not a crash. The app asks this\
     endpoint whether cards are available and quietly shows UPI only when\
     the answer is no \'97 so the shop keeps working before the keys are in. */\
  if (!keyId || !keySecret) \{\
    return res.status(503).json(\{ error: 'gateway_not_configured' \});\
  \}\
\
  try \{\
    const body    = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || \{\});\
    const orderNo = String(body.orderNo || '').trim();\
\
    if (!/^[A-Za-z0-9\\-_]\{3,40\}$/.test(orderNo)) \{\
      return res.status(400).json(\{ error: 'bad_order_number' \});\
    \}\
\
    const order = await fs.getDoc('logs/' + orderNo);\
    if (!order) return res.status(404).json(\{ error: 'order_not_found' \});\
\
    if (order.type !== 'order' || order.source !== 'app') \{\
      return res.status(400).json(\{ error: 'not_an_app_order' \});\
    \}\
    if (order.paymentVerified === true) \{\
      return res.status(409).json(\{ error: 'already_paid' \});\
    \}\
\
    // The authoritative figure. Rupees in Firestore, paise at Razorpay.\
    const rupees = Number(order.totalAmount);\
    if (!(rupees > 0) || rupees > 500000) \{\
      return res.status(400).json(\{ error: 'bad_amount' \});\
    \}\
    const paise = Math.round(rupees * 100);\
\
    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');\
\
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', \{\
      method: 'POST',\
      headers: \{\
        'Authorization': 'Basic ' + auth,\
        'Content-Type': 'application/json'\
      \},\
      body: JSON.stringify(\{\
        amount:   paise,\
        currency: 'INR',\
        receipt:  orderNo.slice(0, 40),\
        notes: \{\
          orderNo:  orderNo,\
          customer: String(order.customer || '').slice(0, 80),\
          phone:    String(order.phone || '').slice(0, 15)\
        \}\
      \})\
    \});\
\
    const rzp = await rzpRes.json();\
\
    if (!rzpRes.ok || !rzp.id) \{\
      console.error('Razorpay order create failed', rzpRes.status, rzp);\
      return res.status(502).json(\{\
        error: 'gateway_error',\
        detail: (rzp && rzp.error && rzp.error.description) || 'Razorpay refused the order'\
      \});\
    \}\
\
    // Remember which Razorpay order belongs to which of ours, so the\
    // webhook can cross-check it later rather than trusting the notes alone.\
    await fs.updateDoc('logs/' + orderNo, \{\
      rzpOrderId: rzp.id,\
      rzpOrderAt: new Date().toISOString()\
    \});\
\
    return res.status(200).json(\{\
      keyId:    keyId,             // public by design \'97 safe in the browser\
      orderId:  rzp.id,\
      amount:   paise,\
      currency: 'INR',\
      name:     'Shri Jagdamba Industry',\
      prefill: \{\
        name:    order.customer || '',\
        contact: order.phone || ''\
      \}\
    \});\
\
  \} catch (err) \{\
    console.error('rzp-order failed', err);\
    const msg = String((err && err.message) || '');\
    /* A setup mistake should say so rather than hiding behind a bare 500.\
       These messages name the missing setting, never any key material. */\
    if (/FIREBASE_SERVICE_ACCOUNT|service account|Firestore (read|write)/i.test(msg)) \{\
      return res.status(503).json(\{ error: 'firebase_not_configured', detail: msg \});\
    \}\
    return res.status(500).json(\{ error: 'server_error' \});\
  \}\
\};}