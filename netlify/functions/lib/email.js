// Sends the "book ready for approval" email via the EmailJS REST API.
// Docs: https://www.emailjs.com/docs/rest-api/send/
export async function sendQaEmail({ toEmail, toName, callName, reviewUrl }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn("EmailJS env vars missing — skipping notification email.");
    return { skipped: true };
  }
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: toEmail || "info@sunvalleypet.com",
        to_name: toName || "Marc",
        dog_name: callName,
        review_url: reviewUrl,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`EmailJS send failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return { sent: true };
}
