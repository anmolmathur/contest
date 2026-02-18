import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { certificateTemplates, users, teams, tracks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";
import ReactPDF from "@react-pdf/renderer";
import { CertificateDocument } from "@/components/certificates/CertificatePDF";

interface Prize {
  rank: number;
  label: string;
  amount?: number | null;
  color: string;
}

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

    // Only judges/admins can generate certificates
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
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

    // Get team details and verify it belongs to this contest
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, teamId), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found in this contest" },
        { status: 404 }
      );
    }

    // Get track name
    let trackName = team.track || "";
    if (team.trackId) {
      const track = await db.query.tracks.findFirst({
        where: eq(tracks.id, team.trackId),
        columns: { name: true },
      });
      if (track) trackName = track.name;
    }

    // Get template: prefer contest-scoped, then specified, then default
    let template = null;
    if (templateId) {
      template = await db.query.certificateTemplates.findFirst({
        where: eq(certificateTemplates.id, templateId),
      });
    }

    if (!template) {
      // Try contest-specific default
      template = await db.query.certificateTemplates.findFirst({
        where: and(
          eq(certificateTemplates.contestId, contest.id),
          eq(certificateTemplates.isDefault, true)
        ),
      });
    }

    if (!template) {
      // Try platform-wide default
      template = await db.query.certificateTemplates.findFirst({
        where: eq(certificateTemplates.isDefault, true),
      });
    }

    // Fallback to default values using contest name
    const templateData = template || {
      titleText: "Certificate of Achievement",
      subtitleText: "This certificate is awarded to",
      eventName: contest.name,
      footerText: null,
      signatureName: null,
      signatureTitle: null,
      primaryLogoUrl: null,
      secondaryLogoUrl: null,
      primaryColor: "#7c3aed",
      secondaryColor: "#2563eb",
    };

    // Get rank label from contest prizes config
    const prizes = (contest.prizes as Prize[]) || [];
    const rankLabel = prizes[rank - 1]?.label || `${rank}th Place`;

    // Generate PDF
    const pdfStream = await ReactPDF.renderToStream(
      CertificateDocument({
        memberName: member.name || "Participant",
        teamName: team.name,
        track: trackName,
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
