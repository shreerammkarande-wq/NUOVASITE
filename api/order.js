/**
 * Nuova order relay — Vercel Serverless Function
 * ---------------------------------------------------------------------------
 * The Message Centre on the site POSTs an order to /api/order. This function
 * forwards it to WhatsApp using Meta's WhatsApp Business Cloud API.
 *
 *   Sender    : the number registered to the WhatsApp Business Platform
 *   Recipient : +91 97637 28630   (ordinary WhatsApp, where the order lands)
 *
 * No secrets in this file. Set these in Vercel → Project → Settings →
 * Environment Variables:
 *
 *   WHATSAPP_TOKEN    the permanent token from the Meta system user
 *   PHONE_NUMBER_ID   the Phone number ID from Meta's API Setup page
 *
 * Because the page and this function share an origin, there is no CORS to
 * configure. Nothing else to wire up.
 * ---------------------------------------------------------------------------
 */

const ORDER_RECIPIENT = "919763728630";
const GRAPH_VERSION   = "v21.0";
const TEMPLATE_NAME   = "nuova_new_order";
const TEMPLATE_LANG   = "en";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  if (!body) return res.status(400).json({ ok: false, error: "bad json" });

  // Honeypot — real customers never fill this hidden field.
  if (body.company) return res.status(200).json({ ok: true });

  const oil   = clean(body.oil, 60);
  const pack  = clean(body.pack, 60);
  const name  = clean(body.name, 60);
  const phone = clean(body.phone, 20).replace(/\D/g, "");
  const place = clean(body.place, 120);
  const note  = clean(body.note, 300) || "-";

  if (!name)             return res.status(400).json({ ok: false, error: "name required" });
  if (phone.length < 10) return res.status(400).json({ ok: false, error: "phone required" });
  if (!oil && note === "-") return res.status(400).json({ ok: false, error: "empty order" });

  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    // Not configured yet — tell the page so it falls back to opening WhatsApp.
    return res.status(503).json({ ok: false, error: "relay not configured" });
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: ORDER_RECIPIENT,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: oil   || "Enquiry" },
          { type: "text", text: pack  || "-" },
          { type: "text", text: name },
          { type: "text", text: phone },
          { type: "text", text: place || "-" },
          { type: "text", text: note },
        ],
      }],
    },
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.WHATSAPP_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const meta = await r.json();
    if (!r.ok) {
      console.error("meta refused:", JSON.stringify(meta));
      return res.status(502).json({ ok: false, error: "whatsapp refused the message" });
    }
    const id = meta.messages && meta.messages[0] && meta.messages[0].id;
    console.log("order relayed:", id, name, phone);
    return res.status(200).json({ ok: true, id: id || null });
  } catch (e) {
    console.error("send failed:", String(e));
    return res.status(502).json({ ok: false, error: "could not reach whatsapp" });
  }
}

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}
