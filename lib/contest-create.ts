/**
 * Server-side contest creation from a contest-type preset. Used by
 * POST /api/contests, the AI setup assistant and the seed scripts, so all
 * three produce identical contests.
 */
import { db } from "@/lib/db";
import { contests, problemStatements, tracks } from "@/lib/db/schema";
import { getPreset, type ContestAward, type PresetProblem } from "@/lib/contest-types";
import { isContestType, type ContestType } from "@/lib/contest-config";

export type ContestOverrides = Partial<{
  description: string | null;
  status: "draft" | "active" | "completed" | "archived";
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  bannerImageUrl: string | null;
  rulesContent: string | null;
  eligibilityRules: string | null;
  teamStructureRules: string | null;
  deliverableRules: string | null;
  scoringCriteria: unknown;
  phaseConfig: unknown;
  prizes: unknown;
  roleConfig: unknown;
  submissionFields: unknown;
  scoringScale: unknown;
  terminology: unknown;
  settings: unknown;
  agenda: unknown;
  speakers: unknown;
  faqConfig: unknown;
  brandingConfig: unknown;
  supportEmail: string | null;
  maxTeams: number;
  maxApprovedTeams: number;
  maxTeamMembers: number;
  startDate: Date | null;
  endDate: Date | null;
  registrationDeadline: Date | null;
  tracks: Array<{ name: string; description?: string | null; icon?: string | null }>;
  awards: ContestAward[];
  problemBank: PresetProblem[];
}>;

export async function createContestFromPreset(input: {
  type: ContestType | string;
  name: string;
  slug: string;
  createdBy: string;
  overrides?: ContestOverrides;
}) {
  const type: ContestType = isContestType(input.type) ? input.type : "hackathon";
  const preset = getPreset(type);
  const o = input.overrides ?? {};
  const pick = <T,>(v: T | undefined | null, d: T): T => (v === undefined || v === null ? d : v);

  const [contest] = await db
    .insert(contests)
    .values({
      name: input.name,
      slug: input.slug,
      contestType: type,
      description: o.description ?? preset.description,
      status: o.status ?? "draft",
      createdBy: input.createdBy,
      heroTitle: o.heroTitle || input.name,
      heroSubtitle: o.heroSubtitle || preset.heroSubtitle,
      heroCtaText: o.heroCtaText || preset.heroCtaText,
      bannerImageUrl: o.bannerImageUrl ?? null,
      rulesContent: o.rulesContent ?? null,
      eligibilityRules: o.eligibilityRules ?? (preset.rules.eligibilityRules || null),
      teamStructureRules: o.teamStructureRules ?? (preset.rules.teamStructureRules || null),
      deliverableRules: o.deliverableRules ?? (preset.rules.deliverableRules || null),
      scoringCriteria: pick(o.scoringCriteria, preset.scoringCriteria),
      phaseConfig: pick(o.phaseConfig, preset.phaseConfig),
      prizes: pick(o.prizes, preset.prizes),
      roleConfig: pick(o.roleConfig, preset.roleConfig),
      submissionFields: pick(o.submissionFields, preset.submissionFields),
      scoringScale: pick(o.scoringScale, preset.scoringScale),
      terminology: pick(o.terminology, preset.terminology),
      settings: pick(o.settings, preset.settings),
      agenda: o.agenda ?? null,
      speakers: o.speakers ?? null,
      faqConfig: o.faqConfig ?? null,
      brandingConfig: o.brandingConfig ?? null,
      supportEmail: o.supportEmail ?? null,
      maxTeams: o.maxTeams ?? preset.maxTeams,
      maxApprovedTeams: o.maxApprovedTeams ?? preset.maxApprovedTeams,
      maxTeamMembers: o.maxTeamMembers ?? preset.maxTeamMembers,
      startDate: o.startDate ?? null,
      endDate: o.endDate ?? null,
      registrationDeadline: o.registrationDeadline ?? null,
      awards: o.awards ?? preset.awards ?? null,
    })
    .returning();

  const trackList = o.tracks ?? preset.tracks;
  const insertedTracks =
    trackList.length > 0
      ? await db
          .insert(tracks)
          .values(
            trackList.map((t, i) => ({
              contestId: contest.id,
              name: t.name,
              description: t.description ?? null,
              icon: t.icon ?? null,
              sortOrder: i,
            })),
          )
          .returning({ id: tracks.id, name: tracks.name })
      : [];

  const bank = o.problemBank ?? preset.problemBank ?? [];
  if (bank.length > 0) {
    const trackId = (name: string) => insertedTracks.find((t) => t.name === name)?.id ?? null;
    await db.insert(problemStatements).values(
      bank.map((p, i) => ({
        contestId: contest.id,
        trackId: trackId(p.track),
        title: p.title,
        description: p.description,
        ownerDepartment: p.ownerDepartment ?? null,
        metricTemplate: p.metricTemplate ?? null,
        maxTeams: 2,
        status: "open",
        sortOrder: i,
        createdBy: input.createdBy,
      })),
    );
  }
  return contest;
}
