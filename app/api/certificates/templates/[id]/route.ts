import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { certificateTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { JUDGE_EMAILS } from "@/lib/constants";

// GET single template
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!JUDGE_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const template = await db.query.certificateTemplates.findFirst({
      where: eq(certificateTemplates.id, id),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template }, { status: 200 });
  } catch (error) {
    console.error("Get template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT update template
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!JUDGE_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
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

    // Check if template exists
    const existingTemplate = await db.query.certificateTemplates.findFirst({
      where: eq(certificateTemplates.id, id),
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existingTemplate.isDefault) {
      await db
        .update(certificateTemplates)
        .set({ isDefault: false })
        .where(eq(certificateTemplates.isDefault, true));
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!JUDGE_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if template exists
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
