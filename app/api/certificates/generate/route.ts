import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { certificateTemplates, users, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { JUDGE_EMAILS, PRIZES } from "@/lib/constants";
import ReactPDF from "@react-pdf/renderer";
import { CertificateDocument } from "@/components/certificates/CertificatePDF";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!JUDGE_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { memberId, teamId, rank, templateId } = body;

    if (!memberId || !teamId || rank === undefined) {
      return NextResponse.json(
        { error: "memberId, teamId, and rank are required" },
        { status: 400 }
      );
    }

    // Get member details
    const member = await db.query.users.findFirst({
      where: eq(users.id, memberId),
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get team details
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get template (use specified or default or fallback)
    let template = null;
    if (templateId) {
      template = await db.query.certificateTemplates.findFirst({
        where: eq(certificateTemplates.id, templateId),
      });
    }

    if (!template) {
      // Try to get default template
      template = await db.query.certificateTemplates.findFirst({
        where: eq(certificateTemplates.isDefault, true),
      });
    }

    // Fallback to default values if no template exists
    const templateData = template || {
      titleText: "Certificate of Achievement",
      subtitleText: "This certificate is awarded to",
      eventName: "AI Vibe Coding Challenge 2024",
      footerText: null,
      signatureName: null,
      signatureTitle: null,
      primaryLogoUrl: null,
      secondaryLogoUrl: null,
      primaryColor: "#7c3aed",
      secondaryColor: "#2563eb",
    };

    // Get rank label
    const rankLabel = PRIZES[rank - 1]?.rank || `${rank}th Place`;

    // Generate PDF
    const pdfStream = await ReactPDF.renderToStream(
      CertificateDocument({
        memberName: member.name || "Participant",
        teamName: team.name,
        track: team.track,
        rank,
        rankLabel,
        template: templateData,
      })
    );

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of pdfStream) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${member.name?.replace(/\s+/g, "-") || "participant"}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Generate certificate error:", error);
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 }
    );
  }
}
