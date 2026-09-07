# nuovashop

Static site for Nuova cold pressed oils, plus the WhatsApp order relay.

    index.html        the entire website — photos, styles and Message Centre, one file
    api/order.js      serverless function that relays an order to WhatsApp

## Deploy

Push to GitHub, import the repo in Vercel. No build step, no framework —
Vercel serves `index.html` at `/` and `api/order.js` at `/api/order`.

## Turning the WhatsApp relay on

1. Set these in Vercel → Settings → Environment Variables (all environments):

       WHATSAPP_TOKEN     permanent token from the Meta system user
       PHONE_NUMBER_ID    Phone number ID from Meta's API Setup page

2. In `index.html`, find `var MC_ENDPOINT = "";` near the bottom and set it to:

       var MC_ENDPOINT = "/api/order";

3. Redeploy.

Until both are done the Message Centre falls back to opening WhatsApp on the
customer's phone, so the site keeps taking orders throughout.

## Changing prices or pack sizes

Everything is in the `OILS` object near the bottom of `index.html`, and in the
product cards above it. Nothing is generated at build time.
