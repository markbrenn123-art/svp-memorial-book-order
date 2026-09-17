// STRIPE WEBHOOK (Background Function) — memorial book, standalone.
// On payment success, generates ONLY the cover illustration and emails
// the customer a link to approve it. The remaining 15 images + PDF only
// happen after the CUSTOMER approves.
//
// Fully standalone — writes to THIS site's own Blobs storage, not the
// shared daybook backend. Includes the photoId2 fix discovered earlier
// today (the second/young reference photo needs to be explicitly
// fetched and saved — it isn't automatic).
//
// SETUP: Stripe Dashboard -> Developers -> Webhooks -> Add endpoint
//   URL:    https://memorial.sunvalleypet.com/.netlify/functions/stripe-webhook-background
//   Event:  checkout.session.completed
//   Copy the "Signing secret" (whsec_...) into Netlify env var STRIPE_WEBHOOK_SECRET
//
// ENV VARS REQUIRED: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GEMINI_API_KEY,
//                     SITE_URL, (optional) EMAILJS_*
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { IMAGES, buildPrompt } from "./lib/prompts.js";
import { generateImageWithRetry } from "./lib/nanobanana.js";
import { sendQaEmail } from "./lib/email.js";

export default async (req) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("Ignored (not a completed checkout)", { status: 200 });
  }

  const session = event.data.object;
  const { photoId, photoId2, callName, fancyName, yearsTogether, pronoun, format, orderId } = session.metadata || {};
  if (!orderId) {
    console.error("Webhook received a session with no orderId in metadata. Skipping.");
    return new Response("Missing orderId in session metadata", { status: 200 });
  }

  console.log(`Order ${orderId}: fetching photo(s), generating COVER ONLY for "${callName}" (${format})`);

  try {
    const photoStore = getStore("customer-photos");
    const photoBuf = await photoStore.get(photoId, { type: "arrayBuffer" });
    if (!photoBuf) throw new Error(`Photo ${photoId} not found in storage`);
    const referencePhoto = {
      data: Buffer.from(photoBuf).toString("base64"),
      mimeType: "image/jpeg",
    };

    const coverDef = IMAGES.find((i) => i.id === "IMG-00");
    const coverPrompt = buildPrompt(coverDef.scene).replaceAll("the dog", callName || "the dog");
    const coverResult = await generateImageWithRetry(coverPrompt, referencePhoto);

    const bookStore = getStore("generated-books");
    await bookStore.set(`${orderId}/_reference.jpg`, Buffer.from(referencePhoto.data, "base64"), {
      metadata: { mimeType: referencePhoto.mimeType },
    });

    // FIXED (discovered earlier today): the second/young reference photo
    // must be explicitly fetched and saved — it's not automatic.
    if (photoId2) {
      const photo2Buf = await photoStore.get(photoId2, { type: "arrayBuffer" }).catch(() => null);
      if (photo2Buf) {
        await bookStore.set(`${orderId}/_reference2.jpg`, Buffer.from(photo2Buf), {
          metadata: { mimeType: "image/jpeg" },
        });
      } else {
        console.error(`Order ${orderId}: photoId2 (${photoId2}) provided but not found — proceeding without it.`);
      }
    }

    await bookStore.set(`${orderId}/IMG-00`, Buffer.from(coverResult.data, "base64"), {
      metadata: { mimeType: coverResult.mimeType },
    });

    const shippingDetails = session.collected_information?.shipping_details || session.shipping_details;

    await bookStore.setJSON(`${orderId}/order.json`, {
      orderId,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
      callName,
      fancyName,
      yearsTogether: yearsTogether || "",
      hasSecondPhoto: !!photoId2,
      pronoun,
      format,
      customerEmail: session.customer_details?.email,
      shippingAddress: shippingDetails?.address,
      customerName: shippingDetails?.name || session.customer_details?.name,
      status: "pending_cover_approval",
      coverRetryCount: 0,
      createdAt: new Date().toISOString(),
    });

    console.log(`Order ${orderId}: cover generated, awaiting customer approval`);

    const approveUrl = `${process.env.SITE_URL}/approve.html?order=${orderId}`;
    await sendQaEmail({
      toEmail: session.customer_details?.email,
      toName: shippingDetails?.name || "there",
      callName,
      reviewUrl: approveUrl,
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(`Order ${orderId} FAILED at cover generation:`, err.message);
    return new Response("Error logged", { status: 200 });
  }
};
