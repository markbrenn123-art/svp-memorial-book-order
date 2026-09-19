// Creates a Stripe Checkout Session for a memorial book order.
//
// CORRECTED ARCHITECTURE: stays LOCAL (same-origin, no CORS) for the
// browser-facing upload/checkout steps, but routes everything downstream
// through daybook's ALREADY-BUILT, ALREADY-WORKING shared system —
// webhook, approval, PDF generation, Gelato submission, and admin
// visibility — via the book-types.js registry ("life-well-loved" entry).
//
// KEY INSIGHT: the CORS problem from earlier only affects
// browser-initiated fetch() calls. Stripe's webhook is server-to-server
// — Stripe's own servers calling ours — and was NEVER subject to CORS
// at all. Same for the success_url redirect: a full page navigation is
// not a fetch/XHR call, so it isn't CORS-restricted either. This means
// memorial never needed its own webhook, approval page, or admin —
// only the two truly browser-initiated pieces (photo upload, checkout
// creation) needed to stay same-origin.
//
// This means memorial orders will now show up automatically in
// dogbook.sunvalleypet.com/admin.html — no separate admin needed.
//
// Env vars required: STRIPE_SECRET_KEY, PRICE_SOFTCOVER, PRICE_HARDCOVER,
//   DAYBOOK_SITE_URL (daybook's own domain, for the shared approve.html
//   redirect — separate from this site's own SITE_URL, used only for
//   the cancel_url so a canceled checkout returns to THIS site's
//   homepage, not daybook's).
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
      // bookType tells daybook's ALREADY-BUILT shared webhook and
      // approve-order-background.js to route this order through the
      // registry's "life-well-loved" config — same mechanism the
      // preview-admin.html tool already proved works for this product.
      // field3 is the registry's generic name for this product's third
      // field (years together) — mapped here so the shared backend's
      // existing field3 handling picks it up correctly.
      metadata: {
        photoId, photoId2: photoId2 || "", callName, fancyName: fancyName || "",
        field3: yearsTogether || "", pronoun, format, orderId,
        bookType: "life-well-loved",
      },
      // Points at DAYBOOK's approve.html — the shared, already-working
      // approval page — not this site's own (nonexistent) one. This is
      // a full page navigation, not a fetch call, so it's not affected
      // by CORS at all.
      success_url: `${process.env.DAYBOOK_SITE_URL}/approve.html?order=${orderId}`,
      // Cancel returns to THIS site's own homepage, not daybook's.
      cancel_url: `${process.env.SITE_URL || "https://memorial.sunvalleypet.com"}/`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    const msg = e && e.message ? String(e.message).slice(0, 200) : "Checkout failed";
    return Response.json({ error: msg }, { status: 500 });
  }
};
