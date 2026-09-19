// Serves one generated image (e.g. IMG-00, the cover) for a given order.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order");
  const imgId = url.searchParams.get("img");
  if (!orderId || !imgId) return new Response("Missing order or img param", { status: 400 });

  const bookStore = getStore("generated-books");
  const entry = await bookStore.getWithMetadata(`${orderId}/${imgId}`, { type: "arrayBuffer" });
  if (!entry) return new Response("Image not found", { status: 404 });

  return new Response(entry.data, {
    headers: {
      "Content-Type": entry.metadata?.mimeType || "image/jpeg",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
};
