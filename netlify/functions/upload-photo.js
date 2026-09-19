// Stores the customer's photo — but in DAYBOOK's storage, not this
// site's own, since the shared webhook (running on daybook) needs to
// find it there. Netlify Blobs are per-site, so this can't be solved by
// writing locally.
//
// FIX: the browser still only ever talks to THIS site's own function
// (same-origin, no CORS at all) — but this function then forwards the
// photo to daybook's own upload-photo.js via a SERVER-TO-SERVER call.
// Server-to-server requests are never subject to CORS (that's a
// browser-only restriction), so this sidesteps the unresolved CORS
// mystery from earlier entirely, while still landing the photo where
// the shared webhook actually needs it.
//
// ENV VAR REQUIRED: DAYBOOK_SITE_URL
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await req.json();
    const daybookUrl = process.env.DAYBOOK_SITE_URL;
    if (!daybookUrl) {
      return Response.json({ error: "DAYBOOK_SITE_URL not configured" }, { status: 500 });
    }

    const res = await fetch(`${daybookUrl}/.netlify/functions/upload-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error || `Upload failed (${res.status})` }, { status: res.status });
    }
    return Response.json(data); // { photoId }
  } catch (e) {
    const msg = e && e.message ? String(e.message).slice(0, 200) : "Upload failed";
    return Response.json({ error: msg }, { status: 500 });
  }
};
