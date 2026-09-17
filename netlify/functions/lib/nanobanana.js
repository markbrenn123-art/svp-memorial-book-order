// Nano Banana 2 (Gemini image generation) client — generates one image
// from a text prompt + a reference photo, with retry on transient
// failures.
//
// ENV VAR REQUIRED: GEMINI_API_KEY
const MODEL = "gemini-2.5-flash-image-preview";
const MAX_RETRIES = 3;

async function generateImage(prompt, referencePhoto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const parts = [{ text: prompt }];
  if (referencePhoto) {
    parts.push({
      inline_data: { mime_type: referencePhoto.mimeType, data: referencePhoto.data },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { imageConfig: { aspectRatio: "1:1" } },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const imagePart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) {
    throw new Error("Gemini response contained no image data");
  }

  return { data: inline.data, mimeType: inline.mimeType || inline.mime_type || "image/jpeg" };
}

export async function generateImageWithRetry(prompt, referencePhoto, retries = MAX_RETRIES) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await generateImage(prompt, referencePhoto);
    } catch (err) {
      lastErr = err;
      console.error(`generateImageWithRetry: attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastErr;
}
