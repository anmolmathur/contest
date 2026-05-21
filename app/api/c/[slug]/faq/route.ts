import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

type FaqEntry = { question: string; answer: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  return NextResponse.json({ faq: (contest.faqConfig as FaqEntry[]) ?? [] });
}

/** Replace the entire FAQ array (simplest possible UX). */
export async function PUT(
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

  const body = await req.json();
  if (!Array.isArray(body.faq)) {
    return NextResponse.json({ error: "faq must be an array" }, { status: 400 });
  }
  const faq: FaqEntry[] = body.faq.map((e: unknown) => {
    const x = e as Partial<FaqEntry>;
    if (typeof x?.question !== "string" || typeof x?.answer !== "string") {
      throw new Error("invalid faq entry");
    }
    return { question: x.question.trim(), answer: x.answer.trim() };
  });

  await db
    .update(contests)
    .set({ faqConfig: faq, updatedAt: new Date() })
    .where(eq(contests.id, contest.id));

  return NextResponse.json({ faq });
}
