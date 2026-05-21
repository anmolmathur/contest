import { NextRequest, NextResponse } from "next/server";
import {
  issueResetTokenForEmail,
  TOKEN_TTL_MINUTES,
  constantTimeDummy,
} from "@/lib/auth/password-reset";
import { sendMail } from "@/lib/notifications/email";
import { passwordResetTemplate } from "@/lib/notifications/templates";

/**
 * POST /api/auth/forgot-password
 *
 * Body: { email: string }
 *
 * Always returns 200 with a generic message — never confirms whether the
 * email is registered. This is deliberate (anti-enumeration). The actual
 * delivery happens out-of-band via email.
 *
 * Rate limiting is enforced at the token-issuing layer (one unused token
 * per user per RESEND_COOLDOWN_SECONDS); we still return the same generic
 * 200 if rate-limited.
 */
export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    if (typeof body?.email !== "string" || !body.email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email" },
        { status: 400 },
      );
    }
    email = body.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Generic success message we always send back. Do NOT vary this by code path.
  const generic = NextResponse.json({
    ok: true,
    message:
      "If that email is registered, a password reset link has been sent. Check your inbox (and spam folder).",
  });

  try {
    const issued = await issueResetTokenForEmail(email);
    if (!issued) {
      // Either email isn't registered, or rate-limited. Keep timing roughly
      // similar to the success path to limit enumeration via response latency.
      await constantTimeDummy();
      return generic;
    }

    const baseUrl =
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? `${req.nextUrl.origin}`;
    const actionUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(issued.raw)}`;

    const tpl = passwordResetTemplate({
      recipientName: issued.userName,
      contestName: "TeamLease EdTech Hackathon",
      actionUrl,
      expiresInMinutes: TOKEN_TTL_MINUTES,
      supportEmail: process.env.SUPPORT_EMAIL ?? null,
    });

    // Email failure must not leak that the address was valid — we already
    // committed the token to the DB. Log and still return the generic 200.
    try {
      await sendMail({
        to: issued.userEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
    } catch (e) {
      console.error("[forgot-password] email send failed for", issued.userEmail, e);
    }
  } catch (e) {
    console.error("[forgot-password] unexpected error:", e);
    // Still return generic 200 — don't tell the world we crashed on this email.
  }

  return generic;
}
