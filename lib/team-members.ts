/**
 * Email-based team building: the team creator names teammates by email and
 * they are enrolled and placed on the team in one step, shared by
 * teams/create and teams/add-member.
 *
 * `contest_users` holds one row per user per contest, so its `teamId` is what
 * guarantees "one team per contest"; `addMember` only claims a row whose
 * teamId is still null, which also covers two teams racing for one student.
 */
import { db } from "@/lib/db";
import { contestUsers, users } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { userTypeForEmail } from "@/lib/user-type";

export type MemberInput = { email: string; name: string };

export type MemberStatus =
  | { status: "new" }
  | { status: "available"; name: string | null }
  | { status: "in_team" }
  | { status: "not_participant" };

/** A teammate could not be claimed after validation passed (lost a race). */
export class MemberConflictError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/** Validate the raw `members` body field. Returns the clean list or an error. */
export function parseMembers(raw: unknown): { members: MemberInput[]; error?: string } {
  if (raw === undefined || raw === null) return { members: [] };
  if (!Array.isArray(raw)) return { members: [], error: "Invalid members list" };

  const members: MemberInput[] = [];
  for (const item of raw) {
    const email = typeof item?.email === "string" ? item.email.trim().toLowerCase() : "";
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (!isValidEmail(email)) {
      return { members: [], error: `"${email || "(blank)"}" is not a valid email` };
    }
    if (members.some((m) => m.email === email)) {
      return { members: [], error: `${email} is listed more than once` };
    }
    members.push({ email, name });
  }
  return { members };
}

/** Where `email` stands for this contest. */
export async function memberStatus(contestId: string, email: string): Promise<MemberStatus> {
  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email}`,
    columns: { id: true, name: true },
  });
  if (!user) return { status: "new" };

  const membership = await db.query.contestUsers.findFirst({
    where: and(eq(contestUsers.contestId, contestId), eq(contestUsers.userId, user.id)),
    columns: { role: true, teamId: true },
  });
  if (membership?.teamId) return { status: "in_team" };
  if (membership && membership.role !== "participant") return { status: "not_participant" };
  return { status: "available", name: user.name };
}

/** Why this teammate can't be added, or null when they can. */
export async function memberError(
  contestId: string,
  member: MemberInput,
  teamWord: string,
): Promise<string | null> {
  const { status } = await memberStatus(contestId, member.email);
  const team = teamWord.toLowerCase();
  if (status === "in_team") return `${member.email} is already in a ${team} for this contest`;
  if (status === "not_participant") return `${member.email} is not a participant in this contest`;
  if (status === "new" && !member.name) return `Please enter a name for ${member.email}`;
  return null;
}

/**
 * Create the account if needed, enrol the user, and put them on the team.
 * Run inside the transaction that owns the team change.
 */
export async function addMember(
  tx: Tx,
  args: { contestId: string; teamId: string; member: MemberInput },
): Promise<{ userId: string; created: boolean }> {
  const { contestId, teamId, member } = args;

  const findUser = () =>
    tx.query.users.findFirst({
      where: sql`lower(${users.email}) = ${member.email}`,
      columns: { id: true },
    });

  let user = await findUser();
  let created = false;
  if (!user) {
    const userType = userTypeForEmail(member.email);
    const [row] = await tx
      .insert(users)
      .values({
        email: member.email,
        name: member.name,
        userType,
        department: userType === "internal" ? "TeamLease" : null,
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    created = !!row;
    user = row ?? (await findUser());
  }
  if (!user) throw new MemberConflictError(`Could not add ${member.email}`);

  await tx
    .insert(contestUsers)
    .values({ contestId, userId: user.id, role: "participant" })
    .onConflictDoNothing();

  const claimed = await tx
    .update(contestUsers)
    .set({ teamId })
    .where(
      and(
        eq(contestUsers.contestId, contestId),
        eq(contestUsers.userId, user.id),
        eq(contestUsers.role, "participant"),
        isNull(contestUsers.teamId),
      ),
    )
    .returning({ id: contestUsers.id });
  if (claimed.length === 0) {
    throw new MemberConflictError(`${member.email} is already in a team for this contest`);
  }

  // users.teamId kept for backward compat
  await tx.update(users).set({ teamId }).where(eq(users.id, user.id));

  return { userId: user.id, created };
}
