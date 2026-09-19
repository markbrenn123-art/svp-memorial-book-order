// Returns an order's current status/details as JSON. Read by approve.html
// (polling) and admin.html.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order");
  if (!orderId) return Response.json({ error: "Missing order id" }, { status: 400 });

  const bookStore = getStore("generated-books");
  const order = await bookStore.get(`${orderId}/order.json`, { type: "json" });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  return Response.json(order, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
};
