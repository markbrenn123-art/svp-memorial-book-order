// APPROVE ORDER (Background Function — up to 15 min runtime).
// Fires when the customer clicks "Approve" on approve.html.
// Generates the remaining 15 images (using the aging-arc second photo
// where the story calls for it), builds the PDF, and holds for Marc's
// manual review — this product line hasn't earned auto-ship trust yet
// (matches the same pattern used for every new product this session).
//
// Gelato submission is NOT included yet — that's wired up via admin.html,
// which doesn't exist for this site yet either. This function stops at
// "ready_for_manual_review" so the PDF is at least viewable/approvable.
//
// ENV VARS REQUIRED (in addition to the webhook's): none beyond what's
// already set for cover generation (GEMINI_API_KEY, SITE_URL, etc.)
import { getStore } from "@netlify/blobs";
import { IMAGES, buildPrompt } from "./lib/prompts.js";
import { generateImageWithRetry } from "./lib/nanobanana.js";
import { buildBookPdf } from "./lib/pdf-builder.js";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { orderId } = await req.json();
  if (!orderId) return Response.json({ error: "Missing orderId" }, { status: 400 });

  const bookStore = getStore("generated-books");
  const order = await bookStore.get(`${orderId}/order.json`, { type: "json" });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const PROCESSABLE_STATUSES = ["pending_cover_approval", "cover_approved_retry", "generating_remaining", "pending_qa", "error"];
  if (!PROCESSABLE_STATUSES.includes(order.status)) {
    return Response.json({ ok: true, note: "Order already past approval stage", status: order.status });
  }

  console.log(`Order ${orderId}: approved. Generating remaining images...`);
  await bookStore.setJSON(`${orderId}/order.json`, { ...order, status: "generating_remaining" });

  try {
    const images = {};
    for (const img of IMAGES) {
      const buf = await bookStore.get(`${orderId}/${img.id}`, { type: "arrayBuffer" }).catch(() => null);
      if (buf) images[img.id] = Buffer.from(buf);
    }
    const remaining = IMAGES.filter((i) => !images[i.id]);
    console.log(`Order ${orderId}: ${Object.keys(images).length}/${IMAGES.length} already exist, generating ${remaining.length} more.`);

    let referencePhoto = null;
    let referencePhoto2 = null;
    if (remaining.length > 0) {
      const refBuf = await bookStore.get(`${orderId}/_reference.jpg`, { type: "arrayBuffer" });
      if (!refBuf) throw new Error(`Reference photo missing for order ${orderId}`);
      referencePhoto = { data: Buffer.from(refBuf).toString("base64"), mimeType: "image/jpeg" };
      const refBuf2 = await bookStore.get(`${orderId}/_reference2.jpg`, { type: "arrayBuffer" }).catch(() => null);
      if (refBuf2) referencePhoto2 = { data: Buffer.from(refBuf2).toString("base64"), mimeType: "image/jpeg" };
    }

    const failures = [];
    const BATCH = 4;
    for (let i = 0; i < remaining.length; i += BATCH) {
      const batch = remaining.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async (img) => {
          const prompt = buildPrompt(img.scene).replaceAll("the dog", order.callName || "the dog");
          // BUG FIX: this used to check img.referencePhoto, but the scene
          // objects in lib/prompts.js define the property as "photoRef"
          // (matching this comment, which was already correct) — the
          // mismatched property name meant this check was always
          // undefined === "young", i.e. always false, so every image
          // silently fell back to the primary photo regardless of scene.
          // photoRef: "young" uses the second/aging-arc photo when one
          // was provided, falling back to the primary photo otherwise.
          const photoForThisImage = (img.photoRef === "young" && referencePhoto2) ? referencePhoto2 : referencePhoto;
          const result = await generateImageWithRetry(prompt, photoForThisImage);
          return { id: img.id, result };
        })
      );
      for (let idx = 0; idx < settled.length; idx++) {
        const s = settled[idx];
        if (s.status === "fulfilled") {
          const buf = Buffer.from(s.value.result.data, "base64");
          images[s.value.id] = buf;
          try {
            await bookStore.set(`${orderId}/${s.value.id}`, buf, { metadata: { mimeType: s.value.result.mimeType } });
          } catch (saveErr) {
            console.error(`Order ${orderId}: failed to persist ${s.value.id}:`, saveErr.message);
          }
        } else {
          failures.push({ id: batch[idx].id, error: s.reason?.message || "unknown" });
          console.error(`Image ${batch[idx].id} failed:`, s.reason?.message);
        }
      }
    }

    console.log(`Order ${orderId}: ${Object.keys(images).length}/${IMAGES.length} images ready, ${failures.length} failed`);
    console.log(`Order ${orderId}: assembling PDF...`);

    const pdfBytes = await buildBookPdf({
      callName: order.callName,
      yearsTogether: order.yearsTogether,
      pronoun: order.pronoun,
      format: order.format,
      images,
    });

    await bookStore.set(`${orderId}/book.pdf`, pdfBytes, { metadata: { mimeType: "application/pdf" } });
    console.log(`Order ${orderId}: PDF built (${pdfBytes.length} bytes)`);

    await bookStore.setJSON(`${orderId}/order.json`, {
      ...order, status: "ready_for_manual_review", imagesFailed: failures,
    });

    return Response.json({ ok: true, status: "ready_for_manual_review" });
  } catch (err) {
    console.error(`Order ${orderId} FAILED during approval processing:`, err.message);
    await bookStore.setJSON(`${orderId}/order.json`, { ...order, status: "error", errorMessage: err.message });
    return Response.json({ error: err.message }, { status: 500 });
  }
};
