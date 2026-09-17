// Stores the customer's photo in Netlify Blobs, returns a photoId
// referenced later by the Stripe webhook + generation job.
//
// Mirrors dogbook.sunvalleypet.com's proven, working version exactly —
// same-origin call from this site's own order form, no CORS needed at
// all (CORS only applies to cross-origin browser requests).
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { filename, data } = await req.json(); // data = dataURL (base64)
    if (!data || data.length > 22 * 1024 * 1024) {
      return Response.json({ error: "Photo missing or too large" }, { status: 400 });
    }
    const base64 = data.split(",")[1];
    const photoId = randomUUID();
    const store = getStore("customer-photos");
    await store.set(photoId, Buffer.from(base64, "base64"), {
      metadata: { filename: filename || "photo", uploadedAt: new Date().toISOString() },
    });
    return Response.json({ photoId });
  } catch (e) {
    const msg = e && e.message ? String(e.message).slice(0, 200) : "Upload failed";
    return Response.json({ error: msg }, { status: 500 });
  }
};
