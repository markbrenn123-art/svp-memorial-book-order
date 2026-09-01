// Stores the customer's photo in Netlify Blobs, returns a photoId
// referenced later by the Stripe webhook + generation job.
//
// Built from the daybook site's FINAL, fixed version — includes two
// fixes learned the hard way there:
//   1. Uses the Web-standard global crypto.randomUUID() instead of
//      importing from "node:crypto" — that import caused a silent
//      module-load failure (raw 502, no code ever ran) on this exact
//      Netlify runtime.
//   2. Breadcrumb diagnostics included from the start — bypasses
//      Netlify's own log viewer (proven unreliable), writes progress
//      markers to Blobs storage checkable via check-upload-debug.js.
import { getStore } from "@netlify/blobs";

async function breadcrumb(step, extra) {
  try {
    const debugStore = getStore("upload-debug");
    await debugStore.setJSON("latest", { step, time: new Date().toISOString(), ...extra });
  } catch (e) { /* never let debug logging itself crash the function */ }
}

export default async (req) => {
  await breadcrumb("1_invoked", { method: req.method });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    await breadcrumb("2_about_to_parse_json");
    const body = await req.json();
    await breadcrumb("3_json_parsed", { keys: Object.keys(body) });
    const { filename, data } = body;
    if (!data) {
      await breadcrumb("3_NO_DATA_FIELD");
      return Response.json({ error: "No photo data received" }, { status: 400 });
    }
    await breadcrumb("4_data_length", { chars: data.length });
    if (data.length > 6 * 1024 * 1024) {
      await breadcrumb("4_REJECTED_TOO_LARGE", { chars: data.length });
      return Response.json({ error: "Photo too large — please use a smaller photo" }, { status: 400 });
    }
    const commaIdx = data.indexOf(",");
    if (commaIdx === -1) {
      await breadcrumb("5_NOT_A_DATA_URL");
      return Response.json({ error: "Photo data was not in the expected format" }, { status: 400 });
    }
    const base64 = data.slice(commaIdx + 1);
    await breadcrumb("5_base64_extracted", { base64Length: base64.length });
    const photoId = crypto.randomUUID();
    await breadcrumb("6_photoId_generated", { photoId });
    const buffer = Buffer.from(base64, "base64");
    await breadcrumb("7_buffer_created", { bufferBytes: buffer.length });
    const store = getStore("customer-photos");
    await breadcrumb("8_store_obtained");
    await store.set(photoId, buffer, {
      metadata: { filename: filename || "photo", uploadedAt: new Date().toISOString() },
    });
    await breadcrumb("9_COMPLETE", { photoId });
    return Response.json({ photoId });
  } catch (e) {
    await breadcrumb("FAILED", { error: e && e.message, stack: (e && e.stack || "").slice(0, 400) });
    console.error("upload-photo: CAUGHT ERROR:", e && e.message, e && e.stack);
    const msg = e && e.message ? String(e.message).slice(0, 200) : "Upload failed";
    return Response.json({ error: msg }, { status: 500 });
  }
};
