// Reads back the latest stripe-webhook-background breadcrumb.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const debugStore = getStore("webhook-debug");
  const latest = await debugStore.get("latest", { type: "json" }).catch(() => null);
  if (!latest) {
    return Response.json({ message: "No webhook attempts recorded yet since this diagnostic was deployed." });
  }
  return Response.json(latest, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
};
