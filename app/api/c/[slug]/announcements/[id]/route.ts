import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

async function adminGuard(slug: string, userId: string) {
  const contest = await resolveContest(slug);
  if (!contest) return { error: NextResponse.json({ error: "Contest not found" }, { status: 404 }) };
  if (!(await canAdminContest(userId, contest.id)))
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  return { contest };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const guard = await adminGuard(slug, session.user.id);
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.body === "string") updates.body = body.body;
  if (typeof body.pinned === "boolean") updates.pinned = body.pinned;

  const [row] = await db
    .update(announcements)
    .set(updates)
    .where(and(eq(announcements.id, id), eq(announcements.contestId, guard.contest.id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  return NextResponse.json({ announcement: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const guard = await adminGuard(slug, session.user.id);
  if ("error" in guard) return guard.error;

  await db
    .delete(announcements)
    .where(and(eq(announcements.id, id), eq(announcements.contestId, guard.contest.id)));

  return NextResponse.json({ ok: true });
}
