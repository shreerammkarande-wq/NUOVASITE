NUOVA CUSTOMER APP — STEP 1
===========================

WHAT THIS IS
An installable web app (PWA) for your customers. It works on Android and
iPhone, costs nothing, and needs no app store.

FILES
  index.html              the whole app
  manifest.webmanifest    makes it installable (name, icon, colours)
  sw.js                   offline cache — the app opens without internet
  icons/                  app icons for the home screen
  img/                    your bottle photos, taken from nuovashop.com

HOW TO PUT IT LIVE
1. In your existing "nuovashop" GitHub repo, create a folder called  app
2. Upload every file and folder from this package into it, keeping the
   folder structure exactly as it is.
3. Commit. Vercel deploys automatically.
4. Open  https://www.nuovashop.com/app/  on your phone.

HOW A CUSTOMER INSTALLS IT
  Android (Chrome) : a black bar appears at the bottom — tap INSTALL.
  iPhone  (Safari) : tap the Share button, then "Add to Home Screen".
Either way they get a Nuova icon on their home screen.

CHANGING PRICES
Open index.html and look for the block marked
     ▼▼▼ PRICE LIST — EDIT ONLY THIS BLOCK ▼▼▼
Every rate is there in plain numbers. Change them, save, upload.
Then open sw.js and change  'nuova-v1'  to  'nuova-v2'  so every
customer's phone picks up the new prices.

IMPORTANT — THE PACK PRICES ARE PROVISIONAL
Only the 1 litre rates are real (taken from your website). The 100 ml,
200 ml, 500 ml and 5 L rates are estimates. Send the real rate list and
they will be corrected.

WHAT IS NOT DONE YET
  Step 2 — orders saving into Firebase
  Step 3 — live order status (Placed / Confirmed / Dispatched / Delivered)
  Step 4 — UPI payment at checkout
  Step 5 — publishing and install testing on both phones
