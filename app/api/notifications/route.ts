import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100);

  const where = unreadOnly
    ? and(eq(notifications.userId, session.user.id), isNull(notifications.readAt))
    : eq(notifications.userId, session.user.id);

  const rows = await db.query.notifications.findMany({
    where,
    orderBy: [desc(notifications.createdAt)],
    limit,
  });

  return NextResponse.json({ notifications: rows });
}

/** Mark all unread notifications for this user as read. */
export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));

  return NextResponse.json({ ok: true });
}
