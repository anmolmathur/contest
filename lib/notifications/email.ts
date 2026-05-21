/**
 * Email driver. Supports two modes:
 *
 *   SMTP mode (production): uses nodemailer with env-var SMTP config.
 *     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, SMTP_FROM
 *
 *   Mock mode (local dev): logs every outbound email to stdout and appends
 *     a JSON entry to `/tmp/contest-outbox.log`. No actual delivery.
 *     Triggered when SMTP_HOST is missing OR EMAIL_DRIVER=mock.
 *
 * Usage: `await sendMail({ to, subject, html, text, replyTo? })`
 */

import fs from "node:fs/promises";
import path from "node:path";

export type MailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromOverride?: string; // for per-contest branding
};

const MOCK_OUTBOX = process.env.MOCK_OUTBOX_PATH ?? "/tmp/contest-outbox.log";

function isMock(): boolean {
  return !process.env.SMTP_HOST || process.env.EMAIL_DRIVER === "mock";
}

async function sendMockMail(input: MailInput): Promise<{ id: string; driver: "mock" }> {
  const entry = {
    at: new Date().toISOString(),
    driver: "mock",
    from: input.fromOverride ?? process.env.SMTP_FROM ?? "noreply@localhost",
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
    replyTo: input.replyTo,
    textPreview: input.text?.slice(0, 200) ?? input.html.replace(/<[^>]*>/g, "").slice(0, 200),
  };
  const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[email:mock] ${id} → ${entry.to.join(", ")}: "${entry.subject}"`);
  try {
    await fs.mkdir(path.dirname(MOCK_OUTBOX), { recursive: true });
    await fs.appendFile(MOCK_OUTBOX, JSON.stringify({ id, ...entry }) + "\n");
  } catch (e) {
    console.warn("[email:mock] failed to append outbox:", e);
  }
  return { id, driver: "mock" };
}

async function sendSmtpMail(input: MailInput): Promise<{ id: string; driver: "smtp" }> {
  // Dynamic import so nodemailer is only loaded when configured.
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  const info = await transporter.sendMail({
    from: input.fromOverride ?? process.env.SMTP_FROM,
    to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
  return { id: info.messageId, driver: "smtp" };
}

export async function sendMail(input: MailInput): Promise<{ id: string; driver: "smtp" | "mock" }> {
  try {
    if (isMock()) return sendMockMail(input);
    return await sendSmtpMail(input);
  } catch (e) {
    console.error("[email] send failed:", e);
    throw e;
  }
}
