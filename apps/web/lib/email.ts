import nodemailer from "nodemailer";

// Gmail's own SMTP relay, not a transactional-email API (Resend/SendGrid) —
// deliberately chosen because it can send to ANY recipient immediately using
// just a real Google account + an app password, with no domain to buy or
// verify. Personal Gmail accounts cap out around ~500 sends/day, which is
// far more than this feature needs.
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendInviteEmail(params: {
  to: string;
  documentTitle: string;
  inviterName: string;
  role: "editor" | "viewer";
  documentUrl: string;
}) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[email] GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping invite email to", params.to);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Local-First Docs" <${process.env.GMAIL_USER}>`,
      to: params.to,
      subject: `${params.inviterName} shared "${params.documentTitle}" with you`,
      html: `
        <p>${escapeHtml(params.inviterName)} invited you to ${params.role === "editor" ? "edit" : "view"} the document "${escapeHtml(params.documentTitle)}".</p>
        <p><a href="${params.documentUrl}">Open the document</a></p>
        <p style="color:#666;font-size:13px">Sign in with the same email address (${escapeHtml(params.to)}) to get access. If you don't have an account yet, signing in for the first time will activate it automatically.</p>
      `,
    });
  } catch (error) {
    // Never fail the invite request over email delivery — the access grant
    // (or pending-invite row) already succeeded in the database, which is
    // the part that actually matters.
    console.error("[email] failed to send invite email:", error);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
