{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww25060\viewh14940\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /* \uc0\u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \
   SHRI JAGDAMBA INDUSTRY \'97 a very small Firestore client\
   Used by rzp-order.js, rzp-verify.js and rzp-webhook.js, which sit\
   beside it in this same folder.\
\
   WHY THIS EXISTS INSTEAD OF firebase-admin\
\
   The official SDK is an npm package, which means the endpoints only work\
   if the host actually installed it. On a static site with no build step\
   that is not guaranteed, and when it is missing the failure is horrible:\
   require() throws while the file is still loading, so the function dies\
   before it can run one line and every request returns a bare 500 with\
   nothing useful in it.\
\
   Firestore has a plain REST API, and Node can sign the Google service\
   account token with its own built-in crypto. So this file depends on\
   nothing at all. Nothing to install, nothing to keep in step, nothing\
   that can be missing at three in the morning.\
\
   It does exactly two things \'97 read one document, update some fields of\
   one document \'97 because that is all the payment endpoints need.\
   \uc0\u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552 \u9552  */\
\
const crypto = require('crypto');\
\
const TOKEN_URL = 'https://oauth2.googleapis.com/token';\
const API       = 'https://firestore.googleapis.com/v1';\
const SCOPE     = 'https://www.googleapis.com/auth/datastore';\
\
/* Read the service account out of the environment. Deliberately called\
   lazily rather than at module load, so a missing or malformed value is a\
   clean error from the handler instead of a dead function. */\
function serviceAccount() \{\
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;\
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');\
\
  let sa;\
  try \{\
    sa = JSON.parse(raw);\
  \} catch (e) \{\
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON \'97 paste the whole file contents');\
  \}\
  if (!sa.client_email || !sa.private_key || !sa.project_id) \{\
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing client_email, private_key or project_id');\
  \}\
  // Pasted into a settings box, the newlines usually arrive escaped.\
  sa.private_key = String(sa.private_key).replace(/\\\\n/g, '\\n');\
  return sa;\
\}\
\
function b64url(input) \{\
  return Buffer.from(input).toString('base64')\
    .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');\
\}\
\
/* Google access tokens last an hour. A warm function can be reused many\
   times in that hour, so the token is cached and re-minted a minute early\
   rather than fetched on every single request. */\
let cachedToken = null;   // \{ token, expires \}\
\
async function accessToken(sa) \{\
  const now = Math.floor(Date.now() / 1000);\
  if (cachedToken && cachedToken.expires > now + 60) return cachedToken.token;\
\
  const header = b64url(JSON.stringify(\{ alg: 'RS256', typ: 'JWT' \}));\
  const claim  = b64url(JSON.stringify(\{\
    iss:   sa.client_email,\
    scope: SCOPE,\
    aud:   TOKEN_URL,\
    exp:   now + 3600,\
    iat:   now\
  \}));\
\
  const unsigned = header + '.' + claim;\
  let signature;\
  try \{\
    signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);\
  \} catch (e) \{\
    throw new Error('Could not sign with the service account private key \'97 ' + e.message);\
  \}\
  const jwt = unsigned + '.' + b64url(signature);\
\
  const res = await fetch(TOKEN_URL, \{\
    method:  'POST',\
    headers: \{ 'Content-Type': 'application/x-www-form-urlencoded' \},\
    body:    'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +\
             '&assertion=' + encodeURIComponent(jwt)\
  \});\
  const body = await res.json().catch(() => (\{\}));\
  if (!res.ok || !body.access_token) \{\
    throw new Error('Google refused the service account: ' +\
                    (body.error_description || body.error || res.status));\
  \}\
\
  cachedToken = \{ token: body.access_token, expires: now + (body.expires_in || 3600) \};\
  return cachedToken.token;\
\}\
\
/* \uc0\u9472 \u9472  Firestore's typed value format \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
   Firestore does not store plain JSON. Every value is wrapped in a tag\
   saying what it is, so these two functions translate in each direction. */\
\
function encode(v) \{\
  if (v === null || v === undefined)  return \{ nullValue: null \};\
  if (typeof v === 'boolean')         return \{ booleanValue: v \};\
  if (typeof v === 'number') \{\
    if (!isFinite(v)) return \{ nullValue: null \};\
    return Number.isInteger(v) ? \{ integerValue: String(v) \} : \{ doubleValue: v \};\
  \}\
  if (typeof v === 'string')          return \{ stringValue: v \};\
  if (Array.isArray(v))               return \{ arrayValue: \{ values: v.map(encode) \} \};\
  if (typeof v === 'object') \{\
    const fields = \{\};\
    Object.keys(v).forEach(k => \{ fields[k] = encode(v[k]); \});\
    return \{ mapValue: \{ fields: fields \} \};\
  \}\
  return \{ stringValue: String(v) \};\
\}\
\
function decode(v) \{\
  if (!v || typeof v !== 'object')     return null;\
  if ('nullValue'      in v)           return null;\
  if ('booleanValue'   in v)           return v.booleanValue;\
  if ('integerValue'   in v)           return Number(v.integerValue);\
  if ('doubleValue'    in v)           return Number(v.doubleValue);\
  if ('stringValue'    in v)           return v.stringValue;\
  if ('timestampValue' in v)           return v.timestampValue;\
  if ('arrayValue'     in v)           return (v.arrayValue.values || []).map(decode);\
  if ('mapValue'       in v)           return decodeFields(v.mapValue.fields || \{\});\
  return null;\
\}\
\
function decodeFields(fields) \{\
  const out = \{\};\
  Object.keys(fields).forEach(k => \{ out[k] = decode(fields[k]); \});\
  return out;\
\}\
\
function docUrl(sa, path) \{\
  return API + '/projects/' + sa.project_id + '/databases/(default)/documents/' + path;\
\}\
\
/* Read one document. Returns a plain object, or null when it is not there \'97\
   a missing order is an ordinary outcome here, not an exception. */\
async function getDoc(path) \{\
  const sa  = serviceAccount();\
  const tok = await accessToken(sa);\
\
  const res = await fetch(docUrl(sa, path), \{ headers: \{ Authorization: 'Bearer ' + tok \} \});\
  if (res.status === 404) return null;\
\
  const body = await res.json().catch(() => (\{\}));\
  if (!res.ok) throw new Error('Firestore read failed: ' + ((body.error && body.error.message) || res.status));\
\
  return decodeFields(body.fields || \{\});\
\}\
\
/* Update only the named fields, leaving the rest of the document alone.\
   The update mask is what makes this a merge rather than an overwrite \'97\
   without it, a PATCH would wipe every field not mentioned. */\
async function updateDoc(path, patch) \{\
  const sa  = serviceAccount();\
  const tok = await accessToken(sa);\
\
  const keys = Object.keys(patch);\
  if (!keys.length) return true;\
\
  const mask   = keys.map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');\
  const fields = \{\};\
  keys.forEach(k => \{ fields[k] = encode(patch[k]); \});\
\
  const res = await fetch(docUrl(sa, path) + '?' + mask, \{\
    method:  'PATCH',\
    headers: \{ Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' \},\
    body:    JSON.stringify(\{ fields: fields \})\
  \});\
\
  const body = await res.json().catch(() => (\{\}));\
  if (!res.ok) throw new Error('Firestore write failed: ' + ((body.error && body.error.message) || res.status));\
  return true;\
\}\
\
/* This file lives in api/, so the host will also expose it as a URL. It is\
   a helper, not an endpoint, and it holds no secrets \'97 but a bare crash on\
   a public address is untidy, so the default export is a handler that\
   simply says there is nothing here. The helpers hang off it as named\
   properties, which is how the three endpoints reach them. */\
module.exports = function notAnEndpoint(req, res) \{\
  return res.status(404).json(\{ error: 'not_found' \});\
\};\
\
module.exports.getDoc         = getDoc;\
module.exports.updateDoc      = updateDoc;\
module.exports.serviceAccount = serviceAccount;\
module.exports.encode         = encode;\
module.exports.decode         = decode;\
module.exports.decodeFields   = decodeFields;}