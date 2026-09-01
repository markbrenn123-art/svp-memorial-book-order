// Reads back the latest upload-photo breadcrumb — see the matching
// breadcrumb writes in upload-photo.js. Same proven pattern from the
// daybook site.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const debugStore = getStore("upload-debug");
  const latest = await debugStore.get("latest", { type: "json" }).catch(() => null);
  if (!latest) {
    return Response.json({
      message: "No upload attempts recorded yet since this diagnostic was deployed.",
    });
  }
  return Response.json(latest, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
};
