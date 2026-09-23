import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests, submissions, teams } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { canAdminContest, resolveContest } from "@/lib/contest-auth";
import { dispatchScoresPublished } from "@/lib/notifications/dispatch";

/**
 * POST /api/c/[slug]/results/publish  { published: boolean }
 *
 * Contest admins (and platform admins) flip `settings.resultsPublished`.
 * Other settings keys are preserved. On an unpublished -> published
 * transition, teams that submitted something are notified (best effort —
 * a notification failure never fails the request).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    if (!(await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined))) {
      return NextResponse.json({ error: "Only contest admins can publish results" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { published?: unknown };
    if (typeof body.published !== "boolean") {
      return NextResponse.json({ error: "published (boolean) is required" }, { status: 400 });
    }
    const published = body.published;

    const current =
      contest.settings && typeof contest.settings === "object"
        ? (contest.settings as Record<string, unknown>)
        : {};
    const wasPublished = current.resultsPublished === true;
    const settings = { ...current, resultsPublished: published };

    await db
      .update(contests)
      .set({ settings, updatedAt: new Date() })
      .where(eq(contests.id, contest.id));

    let notified = false;
    if (published && !wasPublished) {
      try {
        const contestTeams = await db.query.teams.findMany({
          where: eq(teams.contestId, contest.id),
          columns: { id: true },
        });
        const teamIds = contestTeams.map((t) => t.id);
        if (teamIds.length > 0) {
          const subs = await db.query.submissions.findMany({
            where: inArray(submissions.teamId, teamIds),
            columns: { teamId: true, phase: true },
          });
          const submittedTeamIds = [...new Set(subs.map((s) => s.teamId))];
          const latestPhase = subs.reduce((m, s) => Math.max(m, s.phase), 0);
          if (submittedTeamIds.length > 0 && latestPhase > 0) {
            // Fire-and-forget: emails can be slow and must not block or fail the toggle.
            void dispatchScoresPublished({
              contestId: contest.id,
              phaseNumber: latestPhase,
              teamIds: submittedTeamIds,
            }).catch((e) => console.error("[results/publish] notification dispatch failed:", e));
            notified = true;
          }
        }
      } catch (e) {
        console.error("[results/publish] failed to prepare notifications:", e);
      }
    }

    return NextResponse.json({ ok: true, settings, notified });
  } catch (error) {
    console.error("Error publishing results:", error);
    return NextResponse.json({ error: "Failed to update results" }, { status: 500 });
  }
}
