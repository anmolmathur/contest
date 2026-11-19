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

export type TeamDetails = {
  name: string;
  trackName: string | null;
  members: {
    name: string | null;
    email: string;
    isLeader: boolean;
    roles: string[];
    memberIdentifier: string | null;
  }[];
};

export type TeamJoinedCtx = BaseCtx & {
  teamName: string;
  teamWord: string;
  trackWord?: string;
  /** Label of the optional per-person ID (Enrollment Number, Employee ID). */
  memberIdLabel?: string;
  created: boolean;
  /** Set when a teammate put this person on the team. */
  addedByName?: string | null;
  /** Set for an account with no password yet: single-use link to choose one. */
  setPasswordUrl?: string;
  /** Full roster; omitted if it could not be loaded (the email still goes out). */
  team?: TeamDetails | null;
  signIn?: { url: string; email: string; hasPassword: boolean; googleSso: boolean };
};

const cell = "padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;vertical-align:top;";
const head = "padding:6px 8px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#475569;text-align:left;";

function teamDetailsHtml(ctx: TeamJoinedCtx): string {
  const team = ctx.team;
  if (!team) return "";
  const trackWord = ctx.trackWord ?? "Track";
  const idLabel = ctx.memberIdLabel ?? "ID";
  const showId = team.members.some((m) => m.memberIdentifier);
  const rows = team.members
    .map(
      (m) => `<tr>
        <td style="${cell}"><b>${escapeHtml(m.name || m.email)}</b>${m.isLeader ? ' <span style="color:#7c3aed;font-size:11px;">(Leader)</span>' : ""}<br/><span style="color:#64748b;font-size:12px;">${escapeHtml(m.email)}</span></td>
        <td style="${cell}">${m.roles.length ? escapeHtml(m.roles.join(", ")) : '<span style="color:#94a3b8;">Not chosen yet</span>'}</td>
        ${showId ? `<td style="${cell}">${m.memberIdentifier ? escapeHtml(m.memberIdentifier) : "—"}</td>` : ""}
      </tr>`,
    )
    .join("");
  return `
    <h2 style="margin:24px 0 8px 0;font-size:16px;color:#0f172a;">Your ${escapeHtml(ctx.teamWord.toLowerCase())}</h2>
    <table role="presentation" style="border-collapse:collapse;font-size:13px;margin-bottom:8px;">
      <tr><td style="padding:2px 12px 2px 0;color:#64748b;">${escapeHtml(ctx.teamWord)} name</td><td style="padding:2px 0;"><b>${escapeHtml(team.name)}</b></td></tr>
      ${team.trackName ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b;">${escapeHtml(trackWord)}</td><td style="padding:2px 0;">${escapeHtml(team.trackName)}</td></tr>` : ""}
      <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Members</td><td style="padding:2px 0;">${team.members.length}</td></tr>
    </table>
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr><th style="${head}">Member</th><th style="${head}">Role</th>${showId ? `<th style="${head}">${escapeHtml(idLabel)}</th>` : ""}</tr>
      ${rows}
    </table>`;
}

function signInHtml(ctx: TeamJoinedCtx): string {
  const si = ctx.signIn;
  if (!si) return "";
  let how: string;
  if (ctx.setPasswordUrl) {
    how = `<p style="margin:8px 0;"><b>First, set your password:</b> <a href="${escapeHtml(ctx.setPasswordUrl)}">Set your password</a>. This link works once and for 7 days; after that, use "Forgot password" on the sign-in page.</p>`;
  } else if (si.hasPassword) {
    how = `<p style="margin:8px 0;">Use your existing password. Forgot it? Use "Forgot password" on the sign-in page.</p>`;
  } else {
    how = `<p style="margin:8px 0;">You have not set a password yet. Use "Forgot password" on the sign-in page to choose one${si.googleSso ? ", or sign in with Google if this is a Google account" : ""}.</p>`;
  }
  return `
    <div style="margin:24px 0 0 0;padding:14px 16px;background:#f1f5f9;border-radius:8px;">
      <h2 style="margin:0 0 8px 0;font-size:16px;color:#0f172a;">How to sign in</h2>
      <p style="margin:4px 0;">Sign-in page: <a href="${escapeHtml(si.url)}">${escapeHtml(si.url)}</a></p>
      <p style="margin:4px 0;">Email (your username): <b>${escapeHtml(si.email)}</b></p>
      ${how}
    </div>`;
}

function teamDetailsText(ctx: TeamJoinedCtx): string {
  const team = ctx.team;
  if (!team) return "";
  const idLabel = ctx.memberIdLabel ?? "ID";
  const lines = [
    "",
    `Your ${ctx.teamWord.toLowerCase()}: ${team.name}`,
    ...(team.trackName ? [`${ctx.trackWord ?? "Track"}: ${team.trackName}`] : []),
    `Members (${team.members.length}):`,
    ...team.members.map(
      (m) =>
        `- ${m.name || m.email}${m.isLeader ? " (Leader)" : ""} <${m.email}> | Role: ${m.roles.join(", ") || "not chosen yet"}${m.memberIdentifier ? ` | ${idLabel}: ${m.memberIdentifier}` : ""}`,
    ),
  ];
  return lines.join("\n") + "\n";
}

function signInText(ctx: TeamJoinedCtx): string {
  const si = ctx.signIn;
  if (!si) return "";
  const how = ctx.setPasswordUrl
    ? `Set your password first (link works once, for 7 days): ${ctx.setPasswordUrl}`
    : si.hasPassword
      ? `Use your existing password (or "Forgot password" on the sign-in page).`
      : `No password yet: use "Forgot password" on the sign-in page to choose one${si.googleSso ? ", or sign in with Google" : ""}.`;
  return `\nHow to sign in\nSign-in page: ${si.url}\nEmail (your username): ${si.email}\n${how}\n`;
}

export function teamJoinedTemplate(ctx: TeamJoinedCtx) {
  const team = ctx.teamWord.toLowerCase();
  const line = ctx.created
    ? `Your ${escapeHtml(team)} <b>${escapeHtml(ctx.teamName)}</b> has been created in ${escapeHtml(ctx.contestName)}. You are its leader and can now add members.`
    : ctx.addedByName
      ? `${escapeHtml(ctx.addedByName)} added you to the ${escapeHtml(team)} <b>${escapeHtml(ctx.teamName)}</b> in ${escapeHtml(ctx.contestName)}.`
      : `You've joined the ${escapeHtml(team)} <b>${escapeHtml(ctx.teamName)}</b> in ${escapeHtml(ctx.contestName)}.`;
  const firstLine = ctx.created
    ? `Your ${team} "${ctx.teamName}" has been created in ${ctx.contestName}. You are its leader.`
    : ctx.addedByName
      ? `${ctx.addedByName} added you to the ${team} "${ctx.teamName}" in ${ctx.contestName}.`
      : `You've joined the ${team} "${ctx.teamName}" in ${ctx.contestName}.`;
  // Without sign-in details (legacy callers) keep the old set-password paragraph.
  const legacySetPassword =
    !ctx.signIn && ctx.setPasswordUrl
      ? `<p>An account has been created for you. <a href="${escapeHtml(ctx.setPasswordUrl)}">Set your password</a> to sign in. This link works for 7 days; after that, use "Forgot password" on the sign-in page.</p>`
      : "";
  return {
    subject: ctx.created
      ? `[${ctx.contestName}] ${ctx.teamWord} "${ctx.teamName}" created`
      : `[${ctx.contestName}] You've joined "${ctx.teamName}"`,
    html: wrap(
      ctx.created ? `${ctx.teamWord} registered` : `You've joined a ${team}`,
      `<p>Hi ${escapeHtml(ctx.recipientName ?? "there")},</p><p>${line}</p>${legacySetPassword}${teamDetailsHtml(ctx)}${signInHtml(ctx)}`,
      ctx
    ),
    text:
      `${firstLine}\n` +
      teamDetailsText(ctx) +
      signInText(ctx) +
      (!ctx.signIn && ctx.setPasswordUrl ? `Set your password (link works for 7 days): ${ctx.setPasswordUrl}\n` : "") +
      `\n${ctx.actionUrl ?? ""}`,
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
