// Serves the assembled book PDF for a given order.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order");
  if (!orderId) return new Response("Missing order id", { status: 400 });

  const bookStore = getStore("generated-books");
  const pdfBytes = await bookStore.get(`${orderId}/book.pdf`, { type: "arrayBuffer" });
  if (!pdfBytes) return new Response("PDF not found — has this order been approved yet?", { status: 404 });

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
};
