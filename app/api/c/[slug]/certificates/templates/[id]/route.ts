import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { certificateTemplates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";

// PUT update template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

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

    const existingTemplate = await db.query.certificateTemplates.findFirst({
      where: eq(certificateTemplates.id, id),
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
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

    // If setting as default, unset other defaults for this contest
    if (isDefault && !existingTemplate.isDefault) {
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

    const [updatedTemplate] = await db
      .update(certificateTemplates)
      .set({
        name: name ?? existingTemplate.name,
        isDefault: isDefault ?? existingTemplate.isDefault,
        titleText: titleText ?? existingTemplate.titleText,
        subtitleText: subtitleText ?? existingTemplate.subtitleText,
        eventName: eventName ?? existingTemplate.eventName,
        footerText: footerText !== undefined ? footerText : existingTemplate.footerText,
        signatureName: signatureName !== undefined ? signatureName : existingTemplate.signatureName,
        signatureTitle: signatureTitle !== undefined ? signatureTitle : existingTemplate.signatureTitle,
        primaryLogoUrl: primaryLogoUrl !== undefined ? primaryLogoUrl : existingTemplate.primaryLogoUrl,
        secondaryLogoUrl: secondaryLogoUrl !== undefined ? secondaryLogoUrl : existingTemplate.secondaryLogoUrl,
        primaryColor: primaryColor ?? existingTemplate.primaryColor,
        secondaryColor: secondaryColor ?? existingTemplate.secondaryColor,
        updatedAt: new Date(),
      })
      .where(eq(certificateTemplates.id, id))
      .returning();

    return NextResponse.json({ template: updatedTemplate }, { status: 200 });
  } catch (error) {
    console.error("Update template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

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

    const existingTemplate = await db.query.certificateTemplates.findFirst({
      where: eq(certificateTemplates.id, id),
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await db
      .delete(certificateTemplates)
      .where(eq(certificateTemplates.id, id));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
