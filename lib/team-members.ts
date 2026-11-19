/**
 * Email-based team building: the team creator names teammates by email and
 * they are enrolled and placed on the team in one step, shared by
 * teams/create and teams/add-member.
 *
 * `contest_users` holds one row per user per contest, so its `teamId` is what
 * guarantees "one team per contest"; `addMember` only claims a row whose
 * teamId is still null, which also covers two teams racing for one student.
 *
 * Multi-team contests (Ideathon, `multiTeam: true`) drop that rule: a person
 * may join several teams. The join is recorded in `team_members` and only
 * fills `contest_users.teamId` (their active team) when they have none yet.
 * See lib/multi-team.ts.
 */
import { db } from "@/lib/db";
import { contestUsers, teamMembers, users } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { userTypeForEmail } from "@/lib/user-type";
import { parseMemberIdentifier } from "@/lib/member-identifier";

/** `memberIdentifier`: optional Enrollment Number / Employee ID for this contest. */
export type MemberInput = { email: string; name: string; memberIdentifier?: string | null };

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
    const id = parseMemberIdentifier(item?.memberIdentifier);
    if (id.error) return { members: [], error: `${email}: ${id.error}` };
    members.push({ email, name, memberIdentifier: id.value ?? null });
  }
  return { members };
}

export type MultiTeamOpts = {
  /** Contest lets one person be on several teams (Ideathon). */
  multiTeam?: boolean;
  /** Team being joined; with multiTeam, "in_team" means already on THIS team. */
  teamId?: string | null;
};

/** Where `email` stands for this contest. */
export async function memberStatus(contestId: string, email: string, opts: MultiTeamOpts = {}): Promise<MemberStatus> {
  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email}`,
    columns: { id: true, name: true },
  });
  if (!user) return { status: "new" };

  const membership = await db.query.contestUsers.findFirst({
    where: and(eq(contestUsers.contestId, contestId), eq(contestUsers.userId, user.id)),
    columns: { role: true, teamId: true },
  });
  if (membership?.teamId) {
    if (!opts.multiTeam) return { status: "in_team" };
    if (opts.teamId) {
      const onThis =
        membership.teamId === opts.teamId ||
        !!(await db.query.teamMembers.findFirst({
          where: and(eq(teamMembers.teamId, opts.teamId), eq(teamMembers.userId, user.id)),
          columns: { id: true },
        }));
      if (onThis) return { status: "in_team" };
    }
  }
  if (membership && membership.role !== "participant") return { status: "not_participant" };
  return { status: "available", name: user.name };
}

/** Why this teammate can't be added, or null when they can. */
export async function memberError(
  contestId: string,
  member: MemberInput,
  teamWord: string,
  opts: MultiTeamOpts = {},
): Promise<string | null> {
  const { status } = await memberStatus(contestId, member.email, opts);
  const team = teamWord.toLowerCase();
  if (status === "in_team") {
    return opts.multiTeam
      ? `${member.email} is already on this ${team}`
      : `${member.email} is already in a ${team} for this contest`;
  }
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
  args: { contestId: string; teamId: string; member: MemberInput; multiTeam?: boolean },
): Promise<{ userId: string; created: boolean }> {
  const { contestId, teamId, member, multiTeam } = args;

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
    .values({ contestId, userId: user.id, role: "participant", memberIdentifier: member.memberIdentifier ?? null })
    .onConflictDoNothing();
  // Already enrolled: fill in their ID only if they have none (a teammate never overwrites it).
  if (member.memberIdentifier) {
    await tx
      .update(contestUsers)
      .set({ memberIdentifier: member.memberIdentifier })
      .where(
        and(
          eq(contestUsers.contestId, contestId),
          eq(contestUsers.userId, user.id),
          isNull(contestUsers.memberIdentifier),
        ),
      );
  }

  if (multiTeam) {
    const cu = await tx.query.contestUsers.findFirst({
      where: and(eq(contestUsers.contestId, contestId), eq(contestUsers.userId, user.id)),
      columns: { id: true, role: true, teamId: true },
    });
    if (!cu || cu.role !== "participant") {
      throw new MemberConflictError(`${member.email} is not a participant in this contest`);
    }
    const [joined] = await tx
      .insert(teamMembers)
      .values({ contestId, teamId, userId: user.id })
      .onConflictDoNothing()
      .returning({ id: teamMembers.id });
    if (!joined) throw new MemberConflictError(`${member.email} is already on this team`);
    if (cu.teamId) {
      // Keep their current active team on record too.
      await tx.insert(teamMembers).values({ contestId, teamId: cu.teamId, userId: user.id }).onConflictDoNothing();
    } else {
      await tx.update(contestUsers).set({ teamId }).where(eq(contestUsers.id, cu.id));
      await tx.update(users).set({ teamId }).where(eq(users.id, user.id));
    }
    return { userId: user.id, created };
  }

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
