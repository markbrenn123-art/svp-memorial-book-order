// Lists orders by status for admin.html. Password-protected.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const suppliedPassword = req.headers.get("x-admin-password");
  if (!process.env.ADMIN_PASSWORD || suppliedPassword !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || "ready_for_manual_review";

  const bookStore = getStore("generated-books");
  const { blobs } = await bookStore.list({ prefix: "" });

  const orderJsonKeys = blobs
    .map((b) => b.key)
    .filter((k) => k.endsWith("/order.json"));

  const orders = await Promise.all(
    orderJsonKeys.map((key) => bookStore.get(key, { type: "json" }).catch(() => null))
  );

  const held = orders
    .filter((o) => o && o.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return Response.json({
    held,
    statusFilter,
  }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
};
