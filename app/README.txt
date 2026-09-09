NUOVA CUSTOMER APP — STEP 1c (UPI payment)
==========================================

WHAT IS NEW
After the customer fills in their delivery details and taps Place Order,
they now land on a PAYMENT screen:

  • A QR code with the EXACT amount and the order number already in it
  • "Pay ₹___ in my UPI app" — opens GPay / PhonePe / Paytm on the phone
  • The UPI ID with a Copy button
  • "Trouble scanning?" shows your printed PNB bank QR as a fallback
  • "I have paid" — with an optional UTR / reference box
  • "I will pay on delivery"

The WhatsApp order you receive now carries the payment status and the UTR,
so you can match it against your bank. Unpaid orders keep a "Pay now"
button in the customer's Orders tab, so they can come back and pay later.

WHERE THE QR COMES FROM
Your PNB QR was decoded. It contains:
   pa=7350071696m@pnb   pn=SHRI JAGDAMBA INDUSTRY   mc=5099
with the amount field deliberately left blank. The app rebuilds that same
QR on the phone with the amount and order number filled in. The QR is drawn
by the app itself — no internet, no third-party QR service in the payment
path, so it works even on a weak connection.

IMPORTANT — THIS IS NOT A PAYMENT GATEWAY
The app cannot confirm that money actually arrived. "I have paid" is the
customer telling you so. ALWAYS check your PNB account or BHIM app before
dispatching. The UTR the customer enters is what lets you match a payment
to an order quickly.

HOW TO UPDATE THE LIVE APP
1. Unzip. Rename the unzipped folder to  app
2. github.com → NUOVASITE → repo ROOT → Add file → Upload files
3. Drag the  app  folder in. Commit.
4. Close the app fully on your phone and reopen it.
   (Service worker bumped to nuova-v3, so the new build is picked up.)

TESTING THE PAYMENT
Place a small test order — say one 200 ml bottle. On the payment screen,
scan the QR with your own GPay or PhonePe from a SECOND phone. The amount
and the note "Nuova NUV-…" should already be filled in. Do not complete
the payment unless you want to pay yourself.

CHANGING PRICES
index.html →  ▼▼▼ PRICE LIST — EDIT ONLY THIS BLOCK ▼▼▼
Then bump 'nuova-v3' to 'nuova-v4' in sw.js.

STILL PROVISIONAL
Only the 1 litre rates are real. The 100 ml, 200 ml, 500 ml and 5 L rates
are estimates until you send the actual price list.

NEXT
  Step 2 — orders saving into Firebase
  Step 3 — live order status (Placed / Confirmed / Dispatched / Delivered)
