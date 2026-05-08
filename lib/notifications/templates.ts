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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
