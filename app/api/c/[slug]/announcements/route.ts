import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  const rows = await db.query.announcements.findMany({
    where: eq(announcements.contestId, contest.id),
    orderBy: [desc(announcements.pinned), desc(announcements.publishedAt)],
  });
  return NextResponse.json({ announcements: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (!(await canAdminContest(session.user.id, contest.id)))
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { title, body, pinned } = (await req.json()) as {
    title?: string;
    body?: string;
    pinned?: boolean;
  };
  if (!title || !body) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const [row] = await db
    .insert(announcements)
    .values({
      contestId: contest.id,
      title,
      body,
      pinned: pinned === true,
      createdBy: session.user.id,
    })
    .returning();

  // Fire-and-forget notification dispatch (imported dynamically to keep this
  // route's cold-start lean).
  import("@/lib/notifications/dispatch").then(({ dispatchAnnouncement }) =>
    dispatchAnnouncement(contest.id, row)
  );

  return NextResponse.json({ announcement: row }, { status: 201 });
}
