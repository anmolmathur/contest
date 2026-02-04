import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { certificateTemplates, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { JUDGE_EMAILS } from "@/lib/constants";

// GET all templates
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only judges can access this endpoint
    if (!JUDGE_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const templates = await db.query.certificateTemplates.findMany({
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

// POST create new template
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only judges can create templates
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

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    // Get current user's ID
    const currentUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If this template is set as default, unset any existing default
    if (isDefault) {
      await db
        .update(certificateTemplates)
        .set({ isDefault: false })
        .where(eq(certificateTemplates.isDefault, true));
    }

    const [newTemplate] = await db
      .insert(certificateTemplates)
      .values({
        name,
        isDefault: isDefault || false,
        titleText: titleText || "Certificate of Achievement",
        subtitleText: subtitleText || "This certificate is awarded to",
        eventName: eventName || "AI Vibe Coding Challenge 2024",
        footerText: footerText || null,
        signatureName: signatureName || null,
        signatureTitle: signatureTitle || null,
        primaryLogoUrl: primaryLogoUrl || null,
        secondaryLogoUrl: secondaryLogoUrl || null,
        primaryColor: primaryColor || "#7c3aed",
        secondaryColor: secondaryColor || "#2563eb",
        createdBy: currentUser.id,
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
