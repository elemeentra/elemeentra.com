import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { loadGeneralSettings } from "@/lib/settings";
import { sendMail, escapeHtml } from "@/lib/mailer";
import { verifyHcaptcha } from "@/lib/hcaptcha";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(150),
  email: z.string().trim().email("Please enter a valid email").max(150),
  phone: z.string().trim().max(50).optional().default(""),
  service_interested: z.string().trim().max(150).optional().default(""),
  message: z.string().trim().min(10, "Message is too short").max(5000),
  website: z.string().optional().default(""), // honeypot — real users never fill this
  captcha: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!checkRateLimit(`contact:${ip}`, 5, 10 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const d = parsed.data;

    // Honeypot tripped: pretend success so bots learn nothing.
    if (d.website) return NextResponse.json({ success: true });
    if (!(await verifyHcaptcha(d.captcha))) {
      return NextResponse.json({ error: "Captcha verification failed. Please try again." }, { status: 400 });
    }

    await execute(
      `INSERT INTO contact_messages (name, email, phone, service_interested, message, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.name, d.email, d.phone || null, d.service_interested || null, d.message, ip.slice(0, 64)]
    );

    // Email notification (best effort — never fails the request).
    const settings = await loadGeneralSettings().catch(() => null);
    const to = settings?.contact_email || process.env.SMTP_USER;
    if (to) {
      void sendMail({
        to,
        replyTo: d.email,
        subject: `New enquiry from ${d.name}`,
        html: `<h2>New contact form message</h2>
          <p><b>Name:</b> ${escapeHtml(d.name)}<br>
          <b>Email:</b> ${escapeHtml(d.email)}<br>
          <b>Phone:</b> ${escapeHtml(d.phone || "—")}<br>
          <b>Service:</b> ${escapeHtml(d.service_interested || "—")}</p>
          <p style="white-space:pre-wrap">${escapeHtml(d.message)}</p>`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[contact]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
