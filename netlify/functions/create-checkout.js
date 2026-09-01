// Creates a Stripe Checkout Session for a memorial book order.
// Mirrors the daybook site's proven create-checkout.js pattern, with
// two additions specific to this product: an optional second photoId
// (for the puppy-to-golden-years aging arc) and an optional
// yearsTogether field, both carried through in the session metadata for
// the webhook to pick up after payment.
//
// IMPORTANT: do NOT import anything from "node:crypto" in any function
// on this site — that exact import caused a silent module-load failure
// (raw 502, no code ever ran) on the daybook site's Netlify runtime,
// and cost a very long debugging session to find. Use the Web-standard
// global crypto.randomUUID() instead (no import needed) — used below.
//
// ENV VARS REQUIRED: STRIPE_SECRET_KEY, PRICE_SOFTCOVER, PRICE_HARDCOVER,
//                     SITE_URL
import Stripe from "stripe";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { photoId, photoId2, callName, fancyName, yearsTogether, pronoun, format } = await req.json();

    if (!photoId) return Response.json({ error: "Missing photoId" }, { status: 400 });
    if (!callName) return Response.json({ error: "Missing callName" }, { status: 400 });
    if (format !== "softcover" && format !== "hardcover") {
      return Response.json({ error: "format must be softcover or hardcover" }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceId = format === "hardcover" ? process.env.PRICE_HARDCOVER : process.env.PRICE_SOFTCOVER;
    if (!priceId) {
      return Response.json({ error: `Price not configured for ${format} — check PRICE_${format.toUpperCase()} env var` }, { status: 500 });
    }

    const orderId = crypto.randomUUID();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      allow_promotion_codes: true,
      success_url: `${process.env.SITE_URL}/approve.html?order=${orderId}`,
      cancel_url: `${process.env.SITE_URL}/#order`,
      metadata: {
        orderId,
        photoId,
        photoId2: photoId2 || "",
        callName,
        fancyName: fancyName || "",
        yearsTogether: yearsTogether || "",
        pronoun: pronoun || "he",
        format,
      },
    });

    return Response.json({ url: session.url, orderId });
  } catch (err) {
    console.error("create-checkout error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
