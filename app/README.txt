NUOVA CUSTOMER APP — STEP 1b (iPhone support)
=============================================

WHAT CHANGED SINCE THE FIRST UPLOAD
  • iPhone launch screens — no more white flash when the app opens
  • An "Add to Home Screen" walkthrough for Safari, with the real icons
  • WhatsApp now opens correctly from inside an installed iPhone app
  • The order confirmation is never navigated away from
  • Bottom bar gets out of the way when the iPhone keyboard is up
  • Warning when opened inside Instagram / Facebook, where installing fails
  • Install bar no longer covers the products or the sheet
  • New folder: splash/

HOW TO UPDATE THE LIVE APP
1. Unzip this package. Rename the unzipped folder to  app
2. github.com → NUOVASITE repo → at the ROOT (not inside a folder)
   → Add file → Upload files
3. Drag the  app  folder in. GitHub will overwrite the changed files
   and add the new splash/ folder.
4. Commit. Vercel redeploys in under a minute.
5. On your phone, close the app fully and reopen it. The service worker
   version was bumped to nuova-v2, so the new build is picked up.

TESTING ON AN IPHONE
  • Open https://www.nuovashop.com/app/ in SAFARI (not Chrome — on iPhone
    only Safari can install a home-screen app)
  • A black bar appears: tap HOW for the walkthrough
  • Share → Add to Home Screen → Add
  • Open the Nuova icon. You should see the teal launch screen, then the
    app full screen with no address bar.

CHANGING PRICES
Open index.html, find the block marked
     ▼▼▼ PRICE LIST — EDIT ONLY THIS BLOCK ▼▼▼
Change the numbers, save, upload. Then open sw.js and change
'nuova-v2' to 'nuova-v3' so every phone picks up the new rates.

STILL PROVISIONAL
Only the 1 litre rates are real. The 100 ml, 200 ml, 500 ml and 5 L rates
are estimates until you send the actual price list.

NEXT STEPS
  Step 2 — orders saving into Firebase
  Step 3 — live order status (Placed / Confirmed / Dispatched / Delivered)
  Step 4 — UPI payment at checkout
