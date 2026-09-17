// Creates a Stripe Checkout Session for a memorial book order.
//
// Mirrors dogbook.sunvalleypet.com's proven, working create-checkout.js
// structure exactly — same-origin call, no CORS needed. This site is
// dedicated to one product, so unlike the shared-backend version, there's
// no bookType parameter to look up — pricing env vars use the same
// simple PRICE_HARDCOVER/PRICE_SOFTCOVER names daybook uses, just scoped
// to THIS Netlify project's own env vars. Makes this file a genuine,
// repeatable template: a future product site (SuperMom, employee book,
// etc.) copies this same structure with its own PRICE_* env vars.
//
// Env vars required: STRIPE_SECRET_KEY, PRICE_SOFTCOVER, PRICE_HARDCOVER,
//   SITE_URL
import Stripe from "stripe";
import { randomUUID } from "node:crypto";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const { photoId, photoId2, callName, fancyName, yearsTogether, pronoun, format } = await req.json();

    if (!photoId || !/^[A-Za-z][A-Za-z '\-]{1,11}$/.test(callName || ""))
      return Response.json({ error: "Invalid order details" }, { status: 400 });
    if ((fancyName || "").length > 40 || !["he", "she", "they"].includes(pronoun))
      return Response.json({ error: "Invalid order details" }, { status: 400 });

    const price = format === "hardcover" ? process.env.PRICE_HARDCOVER : process.env.PRICE_SOFTCOVER;
    if (!price) {
      return Response.json({ error: `Price not configured for ${format} — check PRICE_${format.toUpperCase()} env var` }, { status: 500 });
    }

    const shippingCents = parseInt(process.env.SHIPPING_RATE_CENTS || "699", 10);
    const orderId = randomUUID();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: shippingCents, currency: "usd" },
          display_name: "USPS Shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 5 },
            maximum: { unit: "business_day", value: 10 },
          },
        },
      }],
      metadata: {
        photoId, photoId2: photoId2 || "", callName, fancyName: fancyName || "",
        yearsTogether: yearsTogether || "", pronoun, format, orderId,
      },
      success_url: `${process.env.SITE_URL}/approve.html?order=${orderId}`,
      cancel_url: `${process.env.SITE_URL}/`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    const msg = e && e.message ? String(e.message).slice(0, 200) : "Checkout failed";
    return Response.json({ error: msg }, { status: 500 });
  }
};
