import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { certificateTemplates, users } from "@/lib/db/schema";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";

// GET templates for this contest (contest-specific + platform-wide)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get templates that belong to this contest OR are platform-wide (contestId is null)
    const templates = await db.query.certificateTemplates.findMany({
      where: or(
        eq(certificateTemplates.contestId, contest.id),
        isNull(certificateTemplates.contestId)
      ),
      orderBy: [desc(certificateTemplates.createdAt)],
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ templates }, { status: 200 });
  } catch (error) {
    console.error("Get templates error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST create new template for this contest
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      isDefault,
      titleText,
      subtitleText,
      eventName,
      footerText,
      signatureName,
      signatureTitle,
      primaryLogoUrl,
      secondaryLogoUrl,
      primaryColor,
      secondaryColor,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    // If this template is set as default, unset existing defaults for this contest
    if (isDefault) {
      await db
        .update(certificateTemplates)
        .set({ isDefault: false })
        .where(
          and(
            eq(certificateTemplates.contestId, contest.id),
            eq(certificateTemplates.isDefault, true)
          )
        );
    }

    const [newTemplate] = await db
      .insert(certificateTemplates)
      .values({
        name,
        isDefault: isDefault || false,
        contestId: contest.id, // Scoped to this contest
        titleText: titleText || "Certificate of Achievement",
        subtitleText: subtitleText || "This certificate is awarded to",
        eventName: eventName || contest.name,
        footerText: footerText || null,
        signatureName: signatureName || null,
        signatureTitle: signatureTitle || null,
        primaryLogoUrl: primaryLogoUrl || null,
        secondaryLogoUrl: secondaryLogoUrl || null,
        primaryColor: primaryColor || "#7c3aed",
        secondaryColor: secondaryColor || "#2563eb",
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ template: newTemplate }, { status: 201 });
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
