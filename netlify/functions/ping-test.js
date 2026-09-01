// Minimal test function — no imports beyond the runtime itself. If this
// doesn't work, the problem isn't inside any specific function's code —
// it's something broader about how functions are running on this site.
export default async (req) => {
  return Response.json({ ok: true, message: "ping-test reached successfully", time: new Date().toISOString() });
};
