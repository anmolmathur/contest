import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, submissions, teams } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { canAdminContest, resolveContest } from "@/lib/contest-auth";
import { resolveSettings, type SubmissionField } from "@/lib/contest-config";
import { resolveSubmissionFields, submissionHeadline, submissionValues } from "@/lib/submission-fields";
import type { ShowcaseEntry, ShowcaseLink, ShowcasePayload } from "@/lib/live-types";
import { withFullRosters } from "@/lib/multi-team";

export const dynamic = "force-dynamic";

/** Full card text is sent; the card clamps it and offers "Read more". */
const SHOWCASE_TEXT_MAX = 5000;

/** File fields that are safe to expose publicly (decks, prototypes, videos). */
const PUBLIC_FILE_KEYS = new Set(["pitchDeck", "finalDeck", "prototypeUrl", "demoUrl", "pitchVideoUrl", "demoVideoUrl"]);

function isPublicField(f: SubmissionField): boolean {
  if (f.type === "url" || f.type === "urlList") return true;
  return (f.type === "file" || f.type === "fileList") && PUBLIC_FILE_KEYS.has(f.key);
}

function firstName(name: string | null | undefined): string | null {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const settings = resolveSettings(contest.settings);
    let preview = false;
    if (!settings.showcaseEnabled || contest.status === "draft") {
      const session = await auth();
      const isAdmin = session?.user?.id ? await canAdminContest(session.user.id, contest.id) : false;
      if (!isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
      preview = true;
    }

    const fields = resolveSubmissionFields(contest.submissionFields);
    const publicFields = fields.filter(isPublicField);

    const teamRows = await withFullRosters(contest, await db.query.teams.findMany({
      where: and(eq(teams.contestId, contest.id), eq(teams.approved, true)),
      with: {
        trackRef: { columns: { name: true } },
        problem: { columns: { title: true, description: true } },
        contestMembers: {
          where: and(eq(contestUsers.contestId, contest.id), eq(contestUsers.role, "participant")),
          with: { user: { columns: { name: true } } },
        },
      },
    }));

    const ids = teamRows.map((t) => t.id);
    const subs = ids.length ? await db.query.submissions.findMany({ where: inArray(submissions.teamId, ids) }) : [];
    const subsByTeam = new Map<string, typeof subs>();
    for (const s of subs) {
      const list = subsByTeam.get(s.teamId) ?? [];
      list.push(s);
      subsByTeam.set(s.teamId, list);
    }

    const entries: ShowcaseEntry[] = teamRows.map((t) => {
      // Latest round first — its headline/links win over earlier rounds.
      const list = (subsByTeam.get(t.id) ?? []).sort((a, b) => b.phase - a.phase);
      let headline = "";
      const links = new Map<string, ShowcaseLink>();
      for (const s of list) {
        const values = submissionValues(s as unknown as Record<string, unknown>);
        if (!headline) headline = submissionHeadline(fields, values, SHOWCASE_TEXT_MAX);
        for (const f of publicFields) {
          if (links.has(f.key)) continue;
          const v = values[f.key];
          const url = Array.isArray(v) ? v.find((x) => x && x.trim()) : v;
          if (typeof url === "string" && /^(https?:\/\/|\/)/i.test(url.trim())) {
            links.set(f.key, { key: f.key, label: f.label.replace(/\s*\(optional\)\s*$/i, ""), url: url.trim() });
          }
        }
      }
      // No submission text yet: fall back to the crew's assigned Problem Bank problem.
      let problemTitle: string | null = null;
      if (!headline && t.problem) {
        problemTitle = t.problem.title;
        headline = (t.problem.description ?? "").trim().slice(0, SHOWCASE_TEXT_MAX);
      }
      const members = t.contestMembers
        .filter((m) => m.role === "participant")
        .map((m) => firstName(m.user?.name))
        .filter((n): n is string => !!n);
      return {
        teamId: t.id,
        name: t.name,
        track: t.trackRef?.name ?? t.track ?? null,
        members,
        headline,
        problemTitle,
        publicLinks: publicFields.map((f) => links.get(f.key)).filter((l): l is ShowcaseLink => !!l),
      };
    });
    entries.sort((a, b) => (a.track ?? "").localeCompare(b.track ?? "") || a.name.localeCompare(b.name));

    const payload: ShowcasePayload = { contest: { name: contest.name, slug: contest.slug }, teams: entries, preview };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Showcase GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
