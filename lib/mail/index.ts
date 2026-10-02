import "server-only";

/**
 * Outbound email.
 *
 * MAIL_TRANSPORT:
 *  - "resend": the Resend HTTPS API (needs RESEND_API_KEY and MAIL_FROM with a
 *    domain verified in Resend). No SDK: one fetch call.
 *  - "console": print the message to the server log (development/testing only;
 *    refused in production because reset links are secrets)
 *  - "none" or unset: "console" in development, disabled otherwise
 *
 * Logs never contain recipients, links or tokens — only the HTTP status on failure.
 */
type Transport = "resend" | "console" | "none";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

function transport(): Transport {
  const configured = process.env.MAIL_TRANSPORT;
  if (configured === "resend") {
    return process.env.RESEND_API_KEY && process.env.MAIL_FROM ? "resend" : "none";
  }
  // The console transport writes reset links (secrets) to the log: never in production.
  if (process.env.NODE_ENV === "production") return "none";
  if (configured === "console") return "console";
  if (configured === "none") return "none";
  return process.env.NODE_ENV === "development" ? "console" : "none";
}

export function isMailAvailable(): boolean {
  return transport() !== "none";
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export function passwordResetEmail(resetUrl: string) {
  const subject = "Reset your SkillForge AI password";
  const text = [
    "Someone (hopefully you) asked to reset the password for your SkillForge AI account.",
    "",
    `Reset your password: ${resetUrl}`,
    "",
    "The link expires in 1 hour and can be used once. If you didn't ask for this, ignore this email — your password stays the same.",
  ].join("\n");
  const url = escapeHtml(resetUrl);
  const html = `<p>Someone (hopefully you) asked to reset the password for your SkillForge AI account.</p>
<p><a href="${url}">Reset your password</a></p>
<p>Or paste this link into your browser:<br>${url}</p>
<p>The link expires in 1 hour and can be used once. If you didn't ask for this, ignore this email — your password stays the same.</p>`;
  return { subject, text, html };
}

async function sendWithResend(
  to: string,
  message: { subject: string; text: string; html: string },
) {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], ...message }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[mail] resend: send failed with HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[mail] resend: send failed (${(error as Error).name})`);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const message = passwordResetEmail(resetUrl);
  switch (transport()) {
    case "resend":
      return sendWithResend(to, message);
    case "console":
      console.info(`[mail:console] Password reset for ${to}: ${resetUrl}`);
      return true;
    case "none":
      return false;
  }
}
