/**
 * Optional per-person ID a participant gives for a contest, so organisers can
 * tell students/employees apart (two "Rahul Sharma"s, personal emails, ...).
 * Stored in contest_users.member_identifier; its label comes from
 * contests.settings.memberIdLabel, else a default by contest type.
 */
import { resolveSettings } from "@/lib/contest-config";

export const MEMBER_ID_MAX = 100;

export function memberIdLabel(contest: { contestType?: string | null; settings?: unknown }): string {
  const custom = resolveSettings(contest.settings).memberIdLabel;
  if (custom) return custom;
  // Ideathon runs inside TeamLease; symposiums and hackathons run on campuses.
  return contest.contestType === "ideathon" ? "Employee ID" : "Enrollment Number";
}

/**
 * Clean a raw value from a request body.
 * undefined → not sent (leave as is); null → clear; string → trimmed value or null when blank.
 * Returns `{ error }` for anything else or an over-long value.
 */
export function parseMemberIdentifier(raw: unknown): { value?: string | null; error?: string } {
  if (raw === undefined) return {};
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: "ID must be text" };
  const v = raw.trim();
  if (v.length > MEMBER_ID_MAX) return { error: `ID must be at most ${MEMBER_ID_MAX} characters` };
  return { value: v || null };
}
