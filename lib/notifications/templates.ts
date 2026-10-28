/**
 * Minimal HTML email templates. Kept plain for portability — if React Email
 * is later adopted, swap these out without touching the dispatch layer.
 */

type BaseCtx = {
  recipientName?: string | null;
  contestName: string;
  actionUrl?: string;
  supportEmail?: string | null;
};

function wrap(title: string, bodyHtml: string, ctx: BaseCtx): string {
  const action = ctx.actionUrl
    ? `<p style="margin:24px 0;"><a href="${ctx.actionUrl}" style="background:#7c3aed;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Open ${ctx.contestName}</a></p>`
    : "";
  const support = ctx.supportEmail
    ? `<p style="color:#64748b;font-size:12px;">Questions? Contact <a href="mailto:${ctx.supportEmail}">${ctx.supportEmail}</a></p>`
    : "";
  return `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:32px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 12px 0;font-size:20px;color:#0f172a;">${title}</h1>
      ${bodyHtml}
      ${action}
      ${support}
    </div>
  </body>
</html>`;
}

export type AnnouncementCtx = BaseCtx & { title: string; body: string };
export function announcementTemplate(ctx: AnnouncementCtx) {
  return {
    subject: `[${ctx.contestName}] ${ctx.title}`,
    html: wrap(
      ctx.title,
      `<p>Hi ${ctx.recipientName ?? "there"},</p>
       <p>${escapeHtml(ctx.body).replace(/\n/g, "<br/>")}</p>`,
      ctx
    ),
    text: `${ctx.title}\n\n${ctx.body}\n\n${ctx.actionUrl ?? ""}`,
  };
}

export type TeamInviteCtx = BaseCtx & { teamName: string; inviterName: string };
export function teamInviteTemplate(ctx: TeamInviteCtx) {
  return {
    subject: `${ctx.inviterName} invited you to join "${ctx.teamName}"`,
    html: wrap(
      "You've been invited to a team",
      `<p>${escapeHtml(ctx.inviterName)} invited you to join <b>${escapeHtml(ctx.teamName)}</b> in ${escapeHtml(ctx.contestName)}.</p>`,
      ctx
    ),
    text: `${ctx.inviterName} invited you to join "${ctx.teamName}" in ${ctx.contestName}.`,
  };
}

export type PhaseStartedCtx = BaseCtx & { phaseName: string; phaseNumber: number };
export function phaseStartedTemplate(ctx: PhaseStartedCtx) {
  return {
    subject: `[${ctx.contestName}] Phase ${ctx.phaseNumber}: ${ctx.phaseName} has started`,
    html: wrap(
      `Phase ${ctx.phaseNumber} has started`,
      `<p>${escapeHtml(ctx.phaseName)} is now active. Check the phase page for deliverables and deadlines.</p>`,
      ctx
    ),
    text: `Phase ${ctx.phaseNumber}: ${ctx.phaseName} has started.`,
  };
}

export type PasswordResetCtx = Omit<BaseCtx, "contestName"> & {
  contestName: string;
  expiresInMinutes: number;
};
export function passwordResetTemplate(ctx: PasswordResetCtx) {
  const safeUrl = ctx.actionUrl ?? "#";
  return {
    subject: `Reset your ${ctx.contestName} password`,
    html: wrap(
      "Reset your password",
      `<p>Hi ${escapeHtml(ctx.recipientName ?? "there")},</p>
       <p>We received a request to reset the password on your ${escapeHtml(ctx.contestName)} account.</p>
       <p>Click the button below to choose a new password. This link expires in <b>${ctx.expiresInMinutes} minutes</b> and can only be used once.</p>
       <p style="margin:24px 0;"><a href="${safeUrl}" style="background:#7c3aed;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a></p>
       <p style="font-size:12px;color:#64748b;">If the button doesn't work, paste this link into your browser:<br/>
       <span style="word-break:break-all;">${safeUrl}</span></p>
       <p style="font-size:12px;color:#64748b;">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
      { ...ctx, actionUrl: undefined }, // suppress the default wrap CTA; we render our own button above
    ),
    text:
      `Reset your ${ctx.contestName} password\n\n` +
      `Open this link within ${ctx.expiresInMinutes} minutes to choose a new password:\n${safeUrl}\n\n` +
      `If you didn't request this, ignore this email — your password won't change.\n`,
  };
}

export type ScoresPublishedCtx = BaseCtx & { phaseNumber: number };
export function scoresPublishedTemplate(ctx: ScoresPublishedCtx) {
  return {
    subject: `[${ctx.contestName}] Scores for phase ${ctx.phaseNumber} are available`,
    html: wrap(
      "Your scores are in",
      `<p>Phase ${ctx.phaseNumber} scores have been published. View the leaderboard to see where you stand.</p>`,
      ctx
    ),
    text: `Phase ${ctx.phaseNumber} scores are now available.`,
  };
}

export type RegistrationConfirmedCtx = BaseCtx & { teamWord: string };
export function registrationConfirmedTemplate(ctx: RegistrationConfirmedCtx) {
  const team = ctx.teamWord.toLowerCase();
  return {
    subject: `You're registered for ${ctx.contestName}`,
    html: wrap(
      "Registration confirmed",
      `<p>Hi ${escapeHtml(ctx.recipientName ?? "there")},</p>
       <p>You're now registered for <b>${escapeHtml(ctx.contestName)}</b>.</p>
       <p>Next step: create a ${escapeHtml(team)} or accept an invitation to join one from your dashboard.</p>`,
      ctx
    ),
    text:
      `You're now registered for ${ctx.contestName}.\n\n` +
      `Next step: create a ${team} or accept an invitation to join one.\n${ctx.actionUrl ?? ""}`,
  };
}

export type TeamJoinedCtx = BaseCtx & { teamName: string; teamWord: string; created: boolean };
export function teamJoinedTemplate(ctx: TeamJoinedCtx) {
  const team = ctx.teamWord.toLowerCase();
  const line = ctx.created
    ? `Your ${escapeHtml(team)} <b>${escapeHtml(ctx.teamName)}</b> has been created in ${escapeHtml(ctx.contestName)}. You are its leader and can now invite members.`
    : `You've joined the ${escapeHtml(team)} <b>${escapeHtml(ctx.teamName)}</b> in ${escapeHtml(ctx.contestName)}.`;
  return {
    subject: ctx.created
      ? `[${ctx.contestName}] ${ctx.teamWord} "${ctx.teamName}" created`
      : `[${ctx.contestName}] You've joined "${ctx.teamName}"`,
    html: wrap(
      ctx.created ? `${ctx.teamWord} registered` : `You've joined a ${team}`,
      `<p>Hi ${escapeHtml(ctx.recipientName ?? "there")},</p><p>${line}</p>`,
      ctx
    ),
    text: ctx.created
      ? `Your ${team} "${ctx.teamName}" has been created in ${ctx.contestName}. You are its leader.\n${ctx.actionUrl ?? ""}`
      : `You've joined the ${team} "${ctx.teamName}" in ${ctx.contestName}.\n${ctx.actionUrl ?? ""}`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
