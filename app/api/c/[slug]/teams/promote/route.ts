import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests, contestUsers, teams, tracks } from "@/lib/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { canAdminContest, isPlatformAdmin, resolveContest } from "@/lib/contest-auth";

/**
 * Team promotion: copy teams (and their participants) from this contest into
 * another one, e.g. the top teams of a round into a final. Generic — any
 * contest, any organisation. The source contest is never modified and no link
 * is stored: the target gets ordinary, independent teams.
 *
 * Caller must administer BOTH contests (or be a platform admin).
 *
 * GET  /api/c/[slug]/teams/promote
 *   -> { targets: [{ id, slug, name, status, tracks: [{ id, name }] }] }
 *      contests the caller can administer (excluding this one, not archived).
 *
 * POST /api/c/[slug]/teams/promote
 *   Body: { targetSlug: string, teamIds: string[], trackId?: string, approved?: boolean }
 *   -> { promoted: [{ sourceTeamId, teamId, name, members }], skipped: [{ sourceTeamId, name, reason }] }
 *
 * What is copied: team name, leader, and every participant (role, team role,
 * extra roles). Mentors, judges, validators, submissions and scores are not.
 * Track: `trackId` if given, else the target track with the same name as the
 * source team's track, else none (assign it afterwards).
 * A team is skipped (not failed) when a team with that name already exists in
 * the target or any of its members is already on a team there — so re-running
 * a promotion is safe.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const source = await resolveContest(slug);
  if (!source) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (!(await canAdminContest(session.user.id, source.id))) {
    return NextResponse.json({ error: "Only admins can promote teams" }, { status: 403 });
  }

  const all = await db.query.contests.findMany({
    where: and(ne(contests.id, source.id), ne(contests.status, "archived")),
    columns: { id: true, slug: true, name: true, status: true },
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });
  const platformAdmin = await isPlatformAdmin(session.user.id);
  let allowed = all;
  if (!platformAdmin) {
    const mine = await db.query.contestUsers.findMany({
      where: and(eq(contestUsers.userId, session.user.id), eq(contestUsers.role, "admin")),
      columns: { contestId: true },
    });
    const ids = new Set(mine.map((m) => m.contestId));
    allowed = all.filter((c) => ids.has(c.id));
  }
  const trackRows = allowed.length
    ? await db.query.tracks.findMany({
        where: inArray(tracks.contestId, allowed.map((c) => c.id)),
        columns: { id: true, name: true, contestId: true },
        orderBy: (t, { asc }) => [asc(t.sortOrder)],
      })
    : [];
  return NextResponse.json({
    targets: allowed.map((c) => ({
      ...c,
      tracks: trackRows.filter((t) => t.contestId === c.id).map((t) => ({ id: t.id, name: t.name })),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { slug } = await params;
    const source = await resolveContest(slug);
    if (!source) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const targetSlug = typeof body.targetSlug === "string" ? body.targetSlug : "";
    const teamIds: string[] = Array.isArray(body.teamIds)
      ? [...new Set((body.teamIds as unknown[]).filter((x): x is string => typeof x === "string"))]
      : [];
    const trackId = typeof body.trackId === "string" && body.trackId ? body.trackId : null;
    const approved = body.approved !== false;

    if (!targetSlug || teamIds.length === 0) {
      return NextResponse.json({ error: "targetSlug and at least one team are required" }, { status: 400 });
    }
    if (teamIds.length > 500) {
      return NextResponse.json({ error: "Promote at most 500 teams at a time" }, { status: 400 });
    }

    const target = await resolveContest(targetSlug);
    if (!target) return NextResponse.json({ error: "Target contest not found" }, { status: 404 });
    if (target.id === source.id) {
      return NextResponse.json({ error: "Target must be a different contest" }, { status: 400 });
    }
    if (target.status === "completed" || target.status === "archived") {
      return NextResponse.json({ error: "The target contest is closed" }, { status: 409 });
    }
    if (!(await canAdminContest(userId, source.id)) || !(await canAdminContest(userId, target.id))) {
      return NextResponse.json({ error: "You must be an admin of both contests" }, { status: 403 });
    }

    const targetTracks = await db.query.tracks.findMany({
      where: eq(tracks.contestId, target.id),
      columns: { id: true, name: true },
    });
    if (trackId && !targetTracks.some((t) => t.id === trackId)) {
      return NextResponse.json({ error: "That track does not belong to the target contest" }, { status: 400 });
    }

    const sourceTeams = await db.query.teams.findMany({
      where: and(eq(teams.contestId, source.id), inArray(teams.id, teamIds)),
      with: { trackRef: { columns: { name: true } } },
    });
    const sourceMembers = sourceTeams.length
      ? await db.query.contestUsers.findMany({
          where: and(
            eq(contestUsers.contestId, source.id),
            inArray(contestUsers.teamId, sourceTeams.map((t) => t.id)),
          ),
        })
      : [];

    const promoted: Array<{ sourceTeamId: string; teamId: string; name: string; members: number }> = [];
    const skipped: Array<{ sourceTeamId: string; name: string; reason: string }> = [];

    // Order the request as given (e.g. rank order).
    const ordered = teamIds
      .map((id) => sourceTeams.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t);
    for (const id of teamIds) {
      if (!ordered.some((t) => t.id === id)) {
        skipped.push({ sourceTeamId: id, name: "", reason: "Team not found in this contest" });
      }
    }

    for (const st of ordered) {
      const participants = sourceMembers.filter(
        (m) => m.teamId === st.id && m.role !== "mentor" && m.role !== "validator" && m.role !== "judge",
      );
      if (participants.length === 0) {
        skipped.push({ sourceTeamId: st.id, name: st.name, reason: "Team has no participants" });
        continue;
      }

      const sameName = await db.query.teams.findFirst({
        where: and(eq(teams.contestId, target.id), eq(teams.name, st.name)),
        columns: { id: true },
      });
      if (sameName) {
        skipped.push({ sourceTeamId: st.id, name: st.name, reason: "A team with this name already exists in the target" });
        continue;
      }

      const existing = await db.query.contestUsers.findMany({
        where: and(
          eq(contestUsers.contestId, target.id),
          inArray(contestUsers.userId, participants.map((p) => p.userId)),
        ),
      });
      if (existing.some((e) => e.teamId)) {
        skipped.push({ sourceTeamId: st.id, name: st.name, reason: "A member is already on a team in the target" });
        continue;
      }
      if (existing.some((e) => e.role !== "participant")) {
        skipped.push({ sourceTeamId: st.id, name: st.name, reason: "A member holds a non-participant role in the target" });
        continue;
      }

      const destTrackId =
        trackId ?? targetTracks.find((t) => t.name === st.trackRef?.name)?.id ?? null;

      const newTeamId = await db.transaction(async (tx) => {
        const [nt] = await tx
          .insert(teams)
          .values({
            name: st.name,
            contestId: target.id,
            trackId: destTrackId,
            createdBy: userId,
            leaderId: participants.some((p) => p.userId === st.leaderId) ? st.leaderId : participants[0].userId,
            approved,
          })
          .returning({ id: teams.id });

        const existingIds = new Set(existing.map((e) => e.userId));
        for (const p of participants) {
          const values = {
            teamId: nt.id,
            participantRole: p.participantRole,
            extraRoles: p.extraRoles,
          };
          if (existingIds.has(p.userId)) {
            await tx
              .update(contestUsers)
              .set(values)
              .where(and(eq(contestUsers.contestId, target.id), eq(contestUsers.userId, p.userId)));
          } else {
            await tx.insert(contestUsers).values({
              contestId: target.id,
              userId: p.userId,
              role: "participant",
              ...values,
            });
          }
        }
        return nt.id;
      });

      promoted.push({ sourceTeamId: st.id, teamId: newTeamId, name: st.name, members: participants.length });
    }

    return NextResponse.json({ promoted, skipped }, { status: promoted.length ? 201 : 200 });
  } catch (error) {
    console.error("Promote teams error:", error);
    return NextResponse.json({ error: "Failed to promote teams" }, { status: 500 });
  }
}
