// STRIPE WEBHOOK (Background Function) — memorial book, standalone.
// On payment success, generates ONLY the cover illustration and emails
// the customer a link to approve it.
//
// BREADCRUMB DIAGNOSTICS ADDED: same pattern proven valuable on daybook
// — writes a "latest step reached" record to Blobs at every major step,
// readable via check-webhook-debug.js, bypassing Netlify's own
// unreliable log viewer.
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
  const debugStore = getStore("webhook-debug");
  async function breadcrumb(step, extra) {
    try {
      await debugStore.setJSON("latest", { step, time: new Date().toISOString(), ...extra });
    } catch (e) { /* debug logging itself must never crash the real function */ }
  }

  await breadcrumb("1_invoked");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  await breadcrumb("2_got_raw_body", {
    bodyLength: rawBody.length,
    hasSignatureHeader: !!sig,
    hasWebhookSecretEnvVar: !!process.env.STRIPE_WEBHOOK_SECRET,
  });

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    await breadcrumb("3_signature_verified", { eventType: event.type });
  } catch (err) {
    await breadcrumb("3_SIGNATURE_VERIFICATION_FAILED", { error: err.message });
    console.error("Webhook signature verification failed:", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    await breadcrumb("4_ignored_wrong_event_type", { eventType: event.type });
    return new Response("Ignored (not a completed checkout)", { status: 200 });
  }

  const session = event.data.object;
  const { photoId, photoId2, callName, fancyName, yearsTogether, pronoun, format, orderId } = session.metadata || {};
  await breadcrumb("4_parsed_metadata", { hasOrderId: !!orderId, hasPhotoId: !!photoId, hasPhotoId2: !!photoId2, callName, format });

  if (!orderId) {
    await breadcrumb("4_MISSING_ORDER_ID", { metadataKeys: Object.keys(session.metadata || {}) });
    console.error("Webhook received a session with no orderId in metadata. Skipping.");
    return new Response("Missing orderId in session metadata", { status: 200 });
  }

  console.log(`Order ${orderId}: fetching photo(s), generating COVER ONLY for "${callName}" (${format})`);

  try {
    await breadcrumb("5_fetching_photo", { orderId, photoId });
    const photoStore = getStore("customer-photos");
    const photoBuf = await photoStore.get(photoId, { type: "arrayBuffer" });
    if (!photoBuf) throw new Error(`Photo ${photoId} not found in storage`);
    await breadcrumb("6_photo_fetched", { orderId, photoBytes: photoBuf.byteLength });

    const referencePhoto = {
      data: Buffer.from(photoBuf).toString("base64"),
      mimeType: "image/jpeg",
    };

    const coverDef = IMAGES.find((i) => i.id === "IMG-00");
    const coverPrompt = buildPrompt(coverDef.scene).replaceAll("the dog", callName || "the dog");

    await breadcrumb("7_calling_nb2", { orderId });
    const coverResult = await generateImageWithRetry(coverPrompt, referencePhoto);
    await breadcrumb("8_nb2_succeeded", { orderId });

    const bookStore = getStore("generated-books");
    await bookStore.set(`${orderId}/_reference.jpg`, Buffer.from(referencePhoto.data, "base64"), {
      metadata: { mimeType: referencePhoto.mimeType },
    });

    if (photoId2) {
      await breadcrumb("8b_fetching_photo2", { orderId, photoId2 });
      const photo2Buf = await photoStore.get(photoId2, { type: "arrayBuffer" }).catch(() => null);
      if (photo2Buf) {
        await bookStore.set(`${orderId}/_reference2.jpg`, Buffer.from(photo2Buf), { metadata: { mimeType: "image/jpeg" } });
        await breadcrumb("8c_photo2_saved", { orderId });
      } else {
        await breadcrumb("8c_PHOTO2_NOT_FOUND", { orderId, photoId2 });
      }
    }

    await bookStore.set(`${orderId}/IMG-00`, Buffer.from(coverResult.data, "base64"), {
      metadata: { mimeType: coverResult.mimeType },
    });
    await breadcrumb("9_images_saved", { orderId });

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
    await breadcrumb("10_order_json_saved", { orderId });

    console.log(`Order ${orderId}: cover generated, awaiting customer approval`);

    const approveUrl = `${process.env.SITE_URL}/approve.html?order=${orderId}`;
    await sendQaEmail({
      toEmail: session.customer_details?.email,
      toName: shippingDetails?.name || "there",
      callName,
      reviewUrl: approveUrl,
    });
    await breadcrumb("11_COMPLETE", { orderId });

    return new Response("OK", { status: 200 });
  } catch (err) {
    await breadcrumb("FAILED", { orderId, error: err.message, stack: err.stack?.slice(0, 500) });
    console.error(`Order ${orderId} FAILED at cover generation:`, err.message);
    return new Response("Error logged", { status: 200 });
  }
};
