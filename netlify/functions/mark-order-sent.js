// Submits an approved order to Gelato for real printing. Password-protected.
//
// ENV VARS REQUIRED: GELATO_API_KEY, GELATO_PRODUCT_UID_SOFTCOVER,
//   GELATO_PRODUCT_UID_HARDCOVER, SITE_URL
import { getStore } from "@netlify/blobs";
import { createGelatoOrder } from "./lib/gelato.js";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const suppliedPassword = req.headers.get("x-admin-password");
  if (!process.env.ADMIN_PASSWORD || suppliedPassword !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await req.json();
  if (!orderId) return Response.json({ error: "Missing orderId" }, { status: 400 });

  const bookStore = getStore("generated-books");
  const order = await bookStore.get(`${orderId}/order.json`, { type: "json" });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const productUid = order.format === "hardcover"
    ? process.env.GELATO_PRODUCT_UID_HARDCOVER
    : process.env.GELATO_PRODUCT_UID_SOFTCOVER;

  if (!productUid || !process.env.GELATO_API_KEY) {
    return Response.json({ error: "Gelato not configured — check GELATO_API_KEY / GELATO_PRODUCT_UID_* env vars" }, { status: 500 });
  }

  const pdfUrl = `${process.env.SITE_URL}/.netlify/functions/get-pdf?order=${orderId}`;
  const addr = order.shippingAddress || {};
  const [firstName, ...lastRest] = (order.customerName || "Customer").split(" ");

  try {
    const gelatoResult = await createGelatoOrder({
      orderReferenceId: orderId,
      customerReferenceId: order.customerEmail || orderId,
      itemReferenceId: `${orderId}-book`,
      productUid,
      fileUrl: pdfUrl,
      shippingAddress: {
        firstName: firstName || "Customer",
        lastName: lastRest.join(" ") || "-",
        addressLine1: addr.line1 || "",
        addressLine2: addr.line2 || "",
        city: addr.city || "",
        state: addr.state || "",
        postCode: addr.postal_code || "",
        country: addr.country || "US",
        email: order.customerEmail || "",
      },
    });

    await bookStore.setJSON(`${orderId}/order.json`, {
      ...order,
      status: "sent_to_print",
      gelatoOrderId: gelatoResult.id || gelatoResult.orderReferenceId,
      sentToPrintAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, gelatoOrderId: gelatoResult.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
