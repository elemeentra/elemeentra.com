import "server-only";
import nodemailer from "nodemailer";

/**
 * Thin Nodemailer wrapper. Reads SMTP_* from the environment (already present
 * in .env.local). If SMTP is not configured, sending is skipped silently so a
 * missing mail server never breaks a form submission.
 */
function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendMail(opts: {
  to: string; subject: string; html: string; replyTo?: string;
}): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: `"Elemeentra" <${process.env.SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    return true;
  } catch (err) {
    console.error("[mailer] send failed:", err);
    return false;
  }
}
