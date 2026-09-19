// Gelato print-order API client. Same proven structure as daybook's
// lib/gelato.js.
//
// ENV VARS REQUIRED: GELATO_API_KEY
const GELATO_BASE = "https://order.gelatoapis.com/v4";

export async function createGelatoOrder({
  orderReferenceId, customerReferenceId, itemReferenceId, productUid, fileUrl, shippingAddress,
}) {
  const res = await fetch(`${GELATO_BASE}/orders`, {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.GELATO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderType: "order",
      orderReferenceId,
      customerReferenceId,
      currency: "USD",
      items: [
        {
          itemReferenceId,
          productUid,
          files: [{ type: "default", url: fileUrl }],
          quantity: 1,
        },
      ],
      shippingAddress,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gelato order creation failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}
