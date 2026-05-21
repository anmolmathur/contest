import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamPitches } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveContest, canReadContest, isContestMember } from "@/lib/contest-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (!(await canReadContest(session.user.id, contest.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.query.teamPitches.findMany({
    where: and(eq(teamPitches.contestId, contest.id), eq(teamPitches.visible, true)),
    orderBy: [desc(teamPitches.createdAt)],
    with: { user: { columns: { id: true, name: true, email: true, department: true } } },
  });

  return NextResponse.json({ pitches: rows });
}

/** Create-or-update my pitch for this contest. Only participants (or admins) can pitch. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (!(await isContestMember(session.user.id, contest.id)))
    return NextResponse.json({ error: "Join the contest before pitching" }, { status: 403 });

  const body = await req.json();
  const {
    title,
    bioMarkdown,
    skills,
    heroMediaUrl,
    videoUrl,
    imageUrls,
    lookingForRoles,
    visible,
  } = body as {
    title?: string;
    bioMarkdown?: string;
    skills?: string[];
    heroMediaUrl?: string;
    videoUrl?: string;
    imageUrls?: string[];
    lookingForRoles?: string[];
    visible?: boolean;
  };

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const existing = await db.query.teamPitches.findFirst({
    where: and(eq(teamPitches.contestId, contest.id), eq(teamPitches.userId, session.user.id)),
  });

  if (existing) {
    const [row] = await db
      .update(teamPitches)
      .set({
        title,
        bioMarkdown: bioMarkdown ?? null,
        skills: skills ?? [],
        heroMediaUrl: heroMediaUrl ?? null,
        videoUrl: videoUrl ?? null,
        imageUrls: imageUrls ?? [],
        lookingForRoles: lookingForRoles ?? [],
        visible: visible !== false,
        updatedAt: new Date(),
      })
      .where(eq(teamPitches.id, existing.id))
      .returning();
    return NextResponse.json({ pitch: row });
  }

  const [row] = await db
    .insert(teamPitches)
    .values({
      contestId: contest.id,
      userId: session.user.id,
      title,
      bioMarkdown: bioMarkdown ?? null,
      skills: skills ?? [],
      heroMediaUrl: heroMediaUrl ?? null,
      videoUrl: videoUrl ?? null,
      imageUrls: imageUrls ?? [],
      lookingForRoles: lookingForRoles ?? [],
      visible: visible !== false,
    })
    .returning();

  return NextResponse.json({ pitch: row }, { status: 201 });
}
