/**
 * Notification dispatcher.
 *
 * Single entry point: `notify(userId, event, payload)`. Writes an in-app
 * notification row AND (respecting per-user prefs) queues an email. Email
 * failures do NOT prevent the in-app write.
 *
 * There are a few convenience helpers for the most common events:
 * `dispatchAnnouncement`, `dispatchTeamInvite`, `dispatchPhaseStarted`,
 * `dispatchScoresPublished`, `dispatchRegistrationConfirmed`, `dispatchTeamJoined`.
 */

import { db } from "@/lib/db";
import { contestUrl } from "@/lib/urls";
import { contestTerm } from "@/lib/api-input";
import {
  notifications,
  users,
  contestUsers,
  contests as contestsT,
  announcements,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendMail } from "./email";
import {
  announcementTemplate,
  teamInviteTemplate,
  phaseStartedTemplate,
  scoresPublishedTemplate,
  registrationConfirmedTemplate,
  teamJoinedTemplate,
  type AnnouncementCtx,
  type TeamInviteCtx,
  type PhaseStartedCtx,
  type ScoresPublishedCtx,
  type RegistrationConfirmedCtx,
  type TeamJoinedCtx,
} from "./templates";

export type NotificationType =
  | "announcement"
  | "team_invite"
  | "team_approved"
  | "phase_started"
  | "submission_received"
  | "scores_published"
  | "registration_confirmed"
  | "team_joined";

type NotificationInput = {
  userId: string;
  contestId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  actionUrl?: string;
};

export async function notify(input: NotificationInput): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: input.userId,
      contestId: input.contestId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      actionUrl: input.actionUrl ?? null,
    });
  } catch (e) {
    console.error("[notify] in-app insert failed:", e);
  }
}

/**
 * Resolve per-user preferences + default-on policy.
 */
function shouldEmail(
  prefs: Record<string, unknown> | null,
  type: NotificationType,
): boolean {
  const p = (prefs ?? {}) as { email?: Record<string, boolean> };
  const explicit = p.email?.[type];
  if (typeof explicit === "boolean") return explicit;
  // Default: email on for important events, off for noisy ones.
  return type !== "submission_received";
}

async function resolveContestCtx(contestId: string) {
  const contest = await db.query.contests.findFirst({
    where: eq(contestsT.id, contestId),
  });
  if (!contest) return null;
  return {
    id: contest.id,
    name: contest.name,
    supportEmail: contest.supportEmail ?? null,
    actionUrl: contestUrl(contest, "/dashboard"),
    teamWord: contestTerm(contest, "team"),
  };
}

// --- Convenience dispatchers ------------------------------------------------

export async function dispatchAnnouncement(
  contestId: string,
  ann: typeof announcements.$inferSelect,
): Promise<void> {
  const ctx = await resolveContestCtx(contestId);
  if (!ctx) return;

  const recipients = await db.query.contestUsers.findMany({
    where: eq(contestUsers.contestId, contestId),
    with: { user: true },
  });

  await Promise.all(
    recipients.map(async (r) => {
      if (!r.user) return;
      await notify({
        userId: r.user.id,
        contestId,
        type: "announcement",
        title: ann.title,
        body: ann.body,
        actionUrl: ctx.actionUrl,
      });
      if (shouldEmail(r.user.notificationPrefs as Record<string, unknown> | null, "announcement")) {
        const tpl = announcementTemplate({
          recipientName: r.user.name,
          contestName: ctx.name,
          actionUrl: ctx.actionUrl,
          supportEmail: ctx.supportEmail,
          title: ann.title,
          body: ann.body,
        } satisfies AnnouncementCtx);
        await sendMail({ to: r.user.email, ...tpl }).catch((e) =>
          console.warn("[notify] email failed for", r.user?.email, e),
        );
      }
    }),
  );
}

export async function dispatchTeamInvite(args: {
  contestId: string;
  inviteeUserId: string;
  teamName: string;
  inviterName: string;
}) {
  const ctx = await resolveContestCtx(args.contestId);
  if (!ctx) return;

  const invitee = await db.query.users.findFirst({ where: eq(users.id, args.inviteeUserId) });
  if (!invitee) return;

  await notify({
    userId: invitee.id,
    contestId: args.contestId,
    type: "team_invite",
    title: `${args.inviterName} invited you to "${args.teamName}"`,
    actionUrl: ctx.actionUrl,
  });

  if (shouldEmail(invitee.notificationPrefs as Record<string, unknown> | null, "team_invite")) {
    const tpl = teamInviteTemplate({
      recipientName: invitee.name,
      contestName: ctx.name,
      actionUrl: ctx.actionUrl,
      supportEmail: ctx.supportEmail,
      teamName: args.teamName,
      inviterName: args.inviterName,
    } satisfies TeamInviteCtx);
    await sendMail({ to: invitee.email, ...tpl }).catch(() => {});
  }
}

export async function dispatchPhaseStarted(args: {
  contestId: string;
  phaseNumber: number;
  phaseName: string;
}) {
  const ctx = await resolveContestCtx(args.contestId);
  if (!ctx) return;

  const memberLinks = await db.query.contestUsers.findMany({
    where: eq(contestUsers.contestId, args.contestId),
    with: { user: true },
  });
  await Promise.all(
    memberLinks.map(async (m) => {
      if (!m.user) return;
      await notify({
        userId: m.user.id,
        contestId: args.contestId,
        type: "phase_started",
        title: `Phase ${args.phaseNumber} — ${args.phaseName}`,
        actionUrl: ctx.actionUrl,
      });
      if (shouldEmail(m.user.notificationPrefs as Record<string, unknown> | null, "phase_started")) {
        const tpl = phaseStartedTemplate({
          recipientName: m.user.name,
          contestName: ctx.name,
          actionUrl: ctx.actionUrl,
          supportEmail: ctx.supportEmail,
          phaseName: args.phaseName,
          phaseNumber: args.phaseNumber,
        } satisfies PhaseStartedCtx);
        await sendMail({ to: m.user.email, ...tpl }).catch(() => {});
      }
    }),
  );
}

export async function dispatchScoresPublished(args: {
  contestId: string;
  phaseNumber: number;
  teamIds: string[];
}) {
  if (args.teamIds.length === 0) return;
  const ctx = await resolveContestCtx(args.contestId);
  if (!ctx) return;

  const links = await db.query.contestUsers.findMany({
    where: and(
      eq(contestUsers.contestId, args.contestId),
      inArray(contestUsers.teamId, args.teamIds),
    ),
    with: { user: true },
  });
  await Promise.all(
    links.map(async (l) => {
      if (!l.user) return;
      await notify({
        userId: l.user.id,
        contestId: args.contestId,
        type: "scores_published",
        title: `Scores for phase ${args.phaseNumber} are published`,
        actionUrl: ctx.actionUrl,
      });
      if (shouldEmail(l.user.notificationPrefs as Record<string, unknown> | null, "scores_published")) {
        const tpl = scoresPublishedTemplate({
          recipientName: l.user.name,
          contestName: ctx.name,
          actionUrl: ctx.actionUrl,
          supportEmail: ctx.supportEmail,
          phaseNumber: args.phaseNumber,
        } satisfies ScoresPublishedCtx);
        await sendMail({ to: l.user.email, ...tpl }).catch(() => {});
      }
    }),
  );
}

/** Confirmation to a participant who has just enrolled in a contest. */
export async function dispatchRegistrationConfirmed(args: { contestId: string; userId: string }) {
  const ctx = await resolveContestCtx(args.contestId);
  if (!ctx) return;

  const user = await db.query.users.findFirst({ where: eq(users.id, args.userId) });
  if (!user) return;

  await notify({
    userId: user.id,
    contestId: args.contestId,
    type: "registration_confirmed",
    title: `You're registered for ${ctx.name}`,
    actionUrl: ctx.actionUrl,
  });

  if (shouldEmail(user.notificationPrefs as Record<string, unknown> | null, "registration_confirmed")) {
    const tpl = registrationConfirmedTemplate({
      recipientName: user.name,
      contestName: ctx.name,
      actionUrl: ctx.actionUrl,
      supportEmail: ctx.supportEmail,
      teamWord: ctx.teamWord,
    } satisfies RegistrationConfirmedCtx);
    await sendMail({ to: user.email, ...tpl }).catch((e) =>
      console.warn("[notify] registration email failed for", user.email, e),
    );
  }
}

/**
 * Confirmation to a user who has just created a team (`created: true`) or
 * joined one via add-member / an accepted invitation or request.
 */
export async function dispatchTeamJoined(args: {
  contestId: string;
  userId: string;
  teamName: string;
  created: boolean;
}) {
  const ctx = await resolveContestCtx(args.contestId);
  if (!ctx) return;

  const user = await db.query.users.findFirst({ where: eq(users.id, args.userId) });
  if (!user) return;

  await notify({
    userId: user.id,
    contestId: args.contestId,
    type: "team_joined",
    title: args.created
      ? `${ctx.teamWord} "${args.teamName}" created`
      : `You've joined "${args.teamName}"`,
    actionUrl: ctx.actionUrl,
  });

  if (shouldEmail(user.notificationPrefs as Record<string, unknown> | null, "team_joined")) {
    const tpl = teamJoinedTemplate({
      recipientName: user.name,
      contestName: ctx.name,
      actionUrl: ctx.actionUrl,
      supportEmail: ctx.supportEmail,
      teamName: args.teamName,
      teamWord: ctx.teamWord,
      created: args.created,
    } satisfies TeamJoinedCtx);
    await sendMail({ to: user.email, ...tpl }).catch((e) =>
      console.warn("[notify] team email failed for", user.email, e),
    );
  }
}
