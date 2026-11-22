// Optional: set RESEND_API_KEY and EMAIL_FROM to enable; otherwise a silent no-op (in-app notifications still work).
export async function sendEmail(to: string | null | undefined, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  }).catch(() => {}); // email is best-effort; never fail the action
}
