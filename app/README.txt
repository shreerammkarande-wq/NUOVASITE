NUOVA — STEP 2: THE TWO APPS ARE NOW LINKED
===========================================
Customer app  →  Firestore "logs"  →  your Order Management app (live)

WHAT IS IN THIS PACKAGE
  app/                  the customer app (upload to your NUOVASITE repo)
  admin-index.html      your Order Management app, updated — see below
  firestore.rules       the security rules to paste into Firebase
  SETUP.txt             the 15-minute setup, in order

DO THE SETUP FIRST (SETUP.txt). If you upload the apps before the Firebase
settings are in place, sign-in will fail and orders will not go through.

PRICES ARE NOW YOUR REAL RATES
The customer app used to quote the old website prices. It now uses the
RETAIL column of CATALOG_RATES from your Order Management app:

              200 ml   500 ml    1 ltr    5 ltr
  Groundnut      105      155      285     1350
  Sunflower      125      180      335     1590
  Safflower      140      205      380     1805
  Coconut        175      255      470        -
  Mustard        115      170      315     1495
  Sesame         155      225      410        -
  Flaxseed       130      185      345        -

You were quoting BELOW these on every single oil. Your website
(nuovashop.com index.html) still carries the old figures — worth fixing.

STILL PROVISIONAL — 100 ml
Your catalogue has no 100 ml rate. Until you send them, the app charges
Coconut 105, Sesame 95, Flaxseed 80 and each pack is marked
provisional:true in the price block. Send the real rates and add matching
'Coconut Oil (100 ml)' style entries to CATALOG_RATES.

CHECK THIS: 'Flaxseed Oil (1 ltr)' in your app is retail 345 / wholesale 345.
Every other oil has a lower wholesale rate. Looks like a typo.

WHAT YOU WILL SEE
A customer order appears in Records within a second or two, tagged with a
teal "App" badge and its payment status. Tax invoice, delivery toggle,
Excel export and the dashboard all work on it exactly like an order you
typed yourself.

CHANGING PRICES FROM NOW ON
Change them in BOTH files, using the same product key:
  1. admin-index.html  → CATALOG_RATES
  2. app/index.html    → the PRICE LIST block
Then bump 'nuova-v4' to 'nuova-v5' in app/sw.js.
